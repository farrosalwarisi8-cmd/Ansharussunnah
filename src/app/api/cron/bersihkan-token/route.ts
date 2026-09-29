// src/app/api/cron/bersihkan-token/route.ts
// Cron job harian: membuang baris token yang sudah tidak berguna.
//
// Dipanggil Vercel Cron (lihat vercel.json). Dilindungi CRON_SECRET.
//
// Dua tabel, alasan berbeda:
//   - otp_verifikasi_email: token yang SUDAH DIPAKAI tidak berguna lagi
//     (verifikasi sudah terjadi, `email_orang_tua_diverifikasi_otp_at` yang
//     jadi bukti). Yang belum dipakai tapi sudah kedaluwarsa juga tidak
//     berguna.
//   - password_reset_tokens: hanya hidup singkat, jadi hampir semua cepat
//     kedaluwarsa.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Berapa lama baris yang sudah dipakai disimpan sebelum dibuang. Dipakai
// supaya masih bisa dibaca audit committee kalau ada pertanyaan "token lama
// saya masih kesimpan?".
const RETENSI_HARI = 30;

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

    const [otpTerpakai, otpKedaluwarsa, resetKedaluwarsa] = await Promise.all([
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
    ]);

    return NextResponse.json({
      success: true,
      message: "Pembersihan token selesai",
      dihapus: {
        // Angka sengaja tidak dijumlahkan: dua query di atas bisa saling
        // tumpang tindih (baris terpakai DAN kedaluwarsa), jadi penjumlahan
        // akan melaporkan angka lebih besar dari jumlah baris yang benar-benar
        // hilang.
        otpTerpakaiLewatRetensi: otpTerpakai.count,
        otpKedaluwarsa: otpKedaluwarsa.count,
        resetKedaluwarsa: resetKedaluwarsa.count,
      },
      retensiHari: RETENSI_HARI,
    });
  } catch (error: unknown) {
    console.error("Error cron bersihkan-token:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membersihkan token" },
      { status: 500 },
    );
  }
}
