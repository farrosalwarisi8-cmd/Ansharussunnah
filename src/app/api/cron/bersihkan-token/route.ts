// src/app/api/cron/bersihkan-token/route.ts
// Cron job harian: membuang baris token yang sudah tidak berguna.
//
// Dipanggil Vercel Cron (lihat vercel.json). Dilindungi CRON_SECRET.
////   Dua tabel, alasan berbeda:
//   - otp_verifikasi_email: token yang SUDAH DIPAKAI tidak berguna lagi
//     (verifikasi sudah terjadi, `email_orang_tua_diverifikasi_otp_at` yang
//     jadi bukti). Yang belum dipakai tapi sudah kedaluwarsa juga tidak
//     berguna. OTP sudah dihapus dari alur pendaftaran baru, tapi tabelnya
//     dipertahankan untuk data/audit lama — pembersihannya tetap berjalan.
//   - password_reset_tokens: hanya hidup singkat, jadi hampir semua cepat
//     kedaluwarsa.
//   - pendaftaran_drafts: draft expired (TTL 30 hari lewat) dibuang; draft
//     finalized disimpan 90 hari untuk audit lalu dibuang.
//   - File temp-* yatim di bucket dokumen-pendaftaran: folder temporary dari
//     form pendaftaran yang tidak pernah direferensikan record Pendaftaran
//     (finalisasi gagal / pengguna berhenti di tengah) dihapus setelah 7 hari.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Berapa lama baris yang sudah dipakai disimpan sebelum dibuang. Dipakai
// supaya masih bisa dibaca audit committee kalau ada pertanyaan "token lama
// saya masih kesimpan?".
const RETENSI_HARI = 30;

// Draft yang sudah difinalisasi disimpan untuk audit sebelum dibuang.
const DRAFT_FINALIZED_RETENSI_HARI = 90;

// File temporary (folder temp-*) yang tidak direferensikan dihapus setelah
// umurnya melewati batas ini. Form mengunggah temp tepat sebelum submit, jadi
// 7 hari adalah jendela yang sangat aman untuk submit yang "tertunda".
const FILE_TEMP_RETENSI_HARI = 7;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const secret = process.env.CRON_SECRET;
  const expected = `Bearer ${secret ?? ""}`;

  // Guard: hanya Vercel Cron yang sah (punya CRON_SECRET) boleh menjalankan
  // pembersihan. Tanpa ini, siapa pun bisa memicu DELETE berulang.
  // Pembandingan konstan-waktu agar tebakan tidak bisa mengukur secret dari
  // waktu respons.
  const safeToRun =
    !!secret &&
    authHeader !== null &&
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));

  if (!safeToRun) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const now = new Date();
    const cutoffRetensi = new Date(
      now.getTime() - RETENSI_HARI * 24 * 60 * 60 * 1000,
    );
    const cutoffDraftFinalized = new Date(
      now.getTime() - DRAFT_FINALIZED_RETENSI_HARI * 24 * 60 * 60 * 1000,
    );

    const [
      otpTerpakai,
      otpKedaluwarsa,
      resetKedaluwarsa,
      draftExpired,
      draftFinalized,
    ] = await Promise.all([
      // Sudah dipakai DAN lewat retensi. Baris yang baru dipakai sengaja
      // ditahan sebulan agar tidak hilang sebelum sempat dibaca untuk audit.
      prisma.otpVerifikasiEmail.deleteMany({
        where: { digunakan: true, createdAt: { lt: cutoffRetensi } },
      }),
      // Belum dipakai tapi sudah kedaluwarsa: tidak akan pernah dipakai lagi
      // karena `verifyOtpVerifikasiEmail` memfilter `expiredAt > now()`.
      prisma.otpVerifikasiEmail.deleteMany({
        where: { expiredAt: { lt: now } },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { expiredAt: { lt: now } },
      }),
      // Draft pendaftaran yang melewati TTL-nya.
      prisma.pendaftaranDraft.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      // Draft finalized lewat masa retensi audit.
      prisma.pendaftaranDraft.deleteMany({
        where: {
          finalizedAt: { lt: cutoffDraftFinalized },
        },
      }),
    ]);

    // File temporary yatim: folder temp-* di bucket dokumen-pendaftaran yang
    // tidak direferensikan record Pendaftaran manapun (finalisasi gagal atau
    // pengguna berhenti di tengah). Best-effort — kegagalan cleanup storage
    // tidak menggagalkan pembersihan DB.
    let fileTempDihapus = 0;
    try {
      const supabaseAdmin = createSupabaseAdmin();
      const cutoffFile = new Date(
        now.getTime() - FILE_TEMP_RETENSI_HARI * 24 * 60 * 60 * 1000,
      );

      // Kumpulkan path temp yang MASIH dipakai record pendaftaran.
      const terpakai = await prisma.pendaftaran.findMany({
        where: { deleted_at: null },
        select: {
          dokKartuKeluarga: true,
          dokAkteLahir: true,
          dokFoto: true,
          dokLainnya: true,
        },
      });
      const dipakaiSet = new Set<string>();
      for (const row of terpakai) {
        for (const p of [
          row.dokKartuKeluarga,
          row.dokAkteLahir,
          row.dokFoto,
          ...(Array.isArray(row.dokLainnya) ? row.dokLainnya : []),
        ]) {
          if (p && p.includes("/temp-")) dipakaiSet.add(p);
        }
      }

      // List folder temp di root pendaftaran/ dengan pagination penuh.
      let offset = 0;
      const FOLDER_PAGE_SIZE = 1000;
      const folders: Array<{ name: string; updated_at: string | null }> = [];

      while (true) {
        const { data: page, error: listError } = await supabaseAdmin.storage
          .from("dokumen-pendaftaran")
          .list("pendaftaran", { limit: FOLDER_PAGE_SIZE, offset });

        if (listError || !page) break;
        folders.push(...page);
        if (page.length < FOLDER_PAGE_SIZE) break;
        offset += FOLDER_PAGE_SIZE;
      }

      for (const folder of folders) {
        if (!folder.name.startsWith("temp-")) continue;

        const dibuat = folder.updated_at ? new Date(folder.updated_at) : null;
        if (!dibuat || dibuat > cutoffFile) continue;

        let fileOffset = 0;
        const FILE_PAGE_SIZE = 1000;
        const paths: string[] = [];

        while (true) {
          const { data: files, error: fileListError } = await supabaseAdmin.storage
            .from("dokumen-pendaftaran")
            .list(`pendaftaran/${folder.name}`, { limit: FILE_PAGE_SIZE, offset: fileOffset });

          if (fileListError || !files) break;
          for (const f of files) {
            const p = `pendaftaran/${folder.name}/${f.name}`;
            if (!dipakaiSet.has(p)) paths.push(p);
          }
          if (files.length < FILE_PAGE_SIZE) break;
          fileOffset += FILE_PAGE_SIZE;
        }

        if (paths.length === 0) continue;

        const { error: removeError } = await supabaseAdmin.storage
          .from("dokumen-pendaftaran")
          .remove(paths);
        if (!removeError) fileTempDihapus += paths.length;
      }
    } catch (storageError) {
      console.error("Cleanup file temp gagal (best-effort):", storageError);
    }

    return NextResponse.json({
      success: true,
      message: "Pembersihan token selesai",
      dihapus: {
        // Angka sengaja tidak dijumlahkan: query di atas bisa saling tumpang
        // tindih (baris terpakai DAN kedaluwarsa), jadi penjumlahan akan
        // melaporkan angka lebih besar dari jumlah baris yang benar-benar
        // hilang.
        otpTerpakaiLewatRetensi: otpTerpakai.count,
        otpKedaluwarsa: otpKedaluwarsa.count,
        resetKedaluwarsa: resetKedaluwarsa.count,
        draftKedaluwarsa: draftExpired.count,
        draftFinalisasiLewatRetensi: draftFinalized.count,
        fileTempYatim: fileTempDihapus,
      },
      retensiHari: RETENSI_HARI,
      draftFinalizedRetensiHari: DRAFT_FINALIZED_RETENSI_HARI,
      fileTempRetensiHari: FILE_TEMP_RETENSI_HARI,
    });
  } catch (error: unknown) {
    console.error("Error cron bersihkan-token:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membersihkan token" },
      { status: 500 },
    );
  }
}
