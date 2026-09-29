// src/actions/verifikasi-email-manual.ts
"use server";

import prisma from "@/lib/prisma";
import { requireGuruAdmin } from "@/lib/auth";
import { toUserFriendlyError, AppError } from "@/lib/prisma-error";
import { revalidatePath } from "next/cache";
import type { ActionResponse } from "@/types";

/**
 * Jalur emergency: committee menandai email orang tua sebagai terverifikasi
 * TANPA OTP, setelah mengonfirmasi langsung ke orang tua (mis. telepon).
 *
 * Kenapa ini ada
 * --------------
 * `verifikasiPendaftaran` menolak menyetujui pendaftaran yang emailnya belum
 * terverifikasi. Tanpa jalur ini, pendaftar yang kehilangan token aksesnya
 * akan buntu: tidak bisa verifikasi (butuh token) dan tidak bisa di-approve.
 * Itu jalan buntu, bukan keamanan.
 *
 * Kenapa ini TIDAK diam-diam
 * -------------------------
 * Menyetujui pendaftaran berarti membuat akun orang tua + siswa lalu mengirim
 * kredensial ke alamat email itu. Kalau committee bisa menekan "verifikasi"
 * tanpa jejak, maka satu klik = bypass penuh untuk semua yang dilindungi
 * OTP. Karena itu:
 *
 *   - Hanya role admin committee (`requireGuruAdmin`).
 *   - Alasan WAJIB diisi, minimum 10 karakter, dan disimpan permanen.
 *   - `emailOrangTuaDiverifikasiOtpAt` SENGAJA TIDAK diisi. Baris ini tetap
 *     tercatat sebagai "terverifikasi tanpa bukti OTP", jadi committee bisa
 *     membedakan manual vs asli.
 *
 * Kenapa jejaknya di kolom sendiri, bukan di `catatanAdmin`
 * ---------------------------------------------------------
 * `catatanAdmin` DITIMPA setiap kali ada approval atau penolakan
 * (`verifikasi.ts`: `catatanAdmin: catatanAdmin || null`). Kalau jejak manual
 * ikut menumpang di sana, begitu panitia menyetujui pendaftaran, bukti bahwa
 * email ini diverifikasi manual hilang permanen dan tidak bisa
 * direkonstruksi dari kolom mana pun.
 *
 * Maka tiga kolom khusus: `emailOrangTuaDiverifikasiManualAt` (kapan),
 * `...ManualOlehId` (siapa), `alasanVerifikasiEmailManual` (mengapa). Ketiga
 * itu satu kesatuan — dipisah dari `catatanAdmin` supaya tidak bisa tertimpa,
 * dan tidak digabung jadi satu JSON supaya tidak bisa terisi sebagian.
 *
 * Ditulis dua kali: ke kolom khusus (kekal) dan ke `catatanAdmin` (agar
 * terlihat di panel yang sedang dibaca committee saat itu, sesuai catatan
 * approval/penolakan yang sudah ada).
 */
export async function tandaiEmailPendaftaranTerverifikasi(
  pendaftaranId: string,
  alasan: string,
): Promise<ActionResponse> {
  try {
    const admin = await requireGuruAdmin();

    const bersih = (alasan ?? "").trim();
    if (bersih.length < 10) {
      throw new AppError(
        "Alasan wajib diisi minimal 10 karakter. Cantumkan cara konfirmasi ke orang tua (mis. konfirmasi telepon 08xx pada 12/Mar/2026).",
      );
    }

    const pendaftaran = await prisma.pendaftaran.findUnique({
      where: { id: pendaftaranId },
      select: {
        id: true,
        nomorPendaftaran: true,
        status: true,
        deleted_at: true,
        emailOrangTuaTerverifikasiAt: true,
        emailOrangTuaDiverifikasiOtpAt: true,
        catatanAdmin: true,
      },
    });

    if (!pendaftaran || pendaftaran.deleted_at) {
      return { success: false, message: "Pendaftaran tidak ditemukan" };
    }

    // Gerbang sudah terbuka. Menolak di sini penting: tanpa pengecekan ini,
    // admin bisa "manual verifikasi" pendaftaran yang sebenarnya sudah punya
    // bukti OTP, dan jejaknya akan menyatakan manual padahal bukan.
    if (pendaftaran.emailOrangTuaTerverifikasiAt) {
      return {
        success: false,
        message: pendaftaran.emailOrangTuaDiverifikasiOtpAt
          ? `Email pada pendaftaran ${pendaftaran.nomorPendaftaran} sudah terverifikasi lewat OTP.`
          : `Email pada pendaftaran ${pendaftaran.nomorPendaftaran} sudah terverifikasi.`,
      };
    }

    // Menolak pendaftaran yang sudah DITOLAK/selesai tidak ada gunanya —
    // statusnya final dan tidak akan lagi melewati approval.
    if (pendaftaran.status === "DITOLAK" || pendaftaran.status === "DITERIMA") {
      return {
        success: false,
        message: `Pendaftaran ${pendaftaran.nomorPendaftaran} sudah berstatus ${pendaftaran.status} dan tidak perlu verifikasi email lagi.`,
      };
    }

    const sekarang = new Date();
    const stempel = `[Verifikasi email manual oleh ${admin.nama} pada ${sekarang.toLocaleString("id-ID")}] ${bersih}`;

    // Ditulis dua kali dengan sengaja:
    //
    //   1. Tiga kolom khusus — inilah yang kekal. `verifikasiPendaftaran`
    //      menimpa `catatanAdmin` saat approval, tapi tidak menyentuh kolom
    //      ini, jadi "ini manual" masih bisa dibaca kapan saja.
    //   2. `catatanAdmin` — supaya panel yang sedang dibaca committee
    //      langsung menunjukkan alasannya, konsisten dengan catatan
    //      approval/penolakan yang sudah ada di sana.
    //
    // Catatan admin lama tidak ditimpa, ditambahkan: bisa ada alasan dari
    // penolakan sebelumnya yang masih perlu dibaca.
    const catatanBaru = pendaftaran.catatanAdmin
      ? `${pendaftaran.catatanAdmin}\n\n${stempel}`
      : stempel;

    await prisma.pendaftaran.update({
      where: { id: pendaftaranId },
      data: {
        emailOrangTuaTerverifikasiAt: sekarang,
        // `emailOrangTuaDiverifikasiOtpAt` sengaja TIDAK diisi — lihat catatan
        // di header file.
        emailOrangTuaDiverifikasiManualAt: sekarang,
        emailOrangTuaDiverifikasiManualOlehId: admin.id,
        alasanVerifikasiEmailManual: bersih,
        catatanAdmin: catatanBaru,
      },
    });

    revalidatePath("/dashboard/verifikasi-pendaftaran");
    revalidatePath(`/pendaftaran/sukses`);

    return {
      success: true,
      message: `Email pada pendaftaran ${pendaftaran.nomorPendaftaran} ditandai terverifikasi. Alasan telah dicatat.`,
    };
  } catch (error: unknown) {
    console.error("Error tandaiEmailPendaftaranTerverifikasi:", error);
    return {
      success: false,
      message: toUserFriendlyError(
        error,
        "Gagal menandai email sebagai terverifikasi. Silakan coba lagi.",
      ),
    };
  }
}
