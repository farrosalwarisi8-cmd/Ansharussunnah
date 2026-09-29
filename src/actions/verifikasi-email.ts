// src/actions/verifikasi-email.ts
"use server";
//
// Gerbang verifikasi kepemilikan email orang tua saat pendaftaran.
//
// Tanpa gerbang ini, siapa pun bisa mengisi form pendaftaran dengan email orang
// lain (atau email fiktif), lalu meninggalkan ratusan pendaftaran di meja panitia
// dengan data yang tidak pernah bisa dikonfirmasi via email.
//
// Alur: requestOtpVerifikasiEmail -> email berisi kode 6 digit ->
// verifyOtpVerifikasiEmail -> Pendaftaran.emailOrangTuaTerverifikasiAt terisi ->
// alur publik (unggah dokumen & bukti) terbuka.
//
// Kedua fungsi mewajibkan nomor pendaftaran + token akses, bukan nomor saja.
// Token itu sudah menjadi kredensial pemilik di alur upload; memakainya di sini
// mencegah orang tak dikenal memicu email ke alamat yang bukan miliknya.

import prisma from "@/lib/prisma";
import { createOtpWithHash, verifyOtp } from "@/lib/otp";
import { sendEmail, buildOtpVerifikasiPendaftaranEmail } from "@/lib/email";
import { rateLimitAsync, getClientIpFromHeaders } from "@/lib/rate-limit";
import {
  isTokenAksesBentukValid,
  isPendaftaranTokenValid,
  isTokenAksesBelumKedaluwarsa,
} from "@/lib/pendaftaran-token";
import type { ActionResponse } from "@/types";

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "10");
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || "3");
const OTP_RESEND_COOLDOWN_SECONDS = parseInt(
  process.env.OTP_RESEND_COOLDOWN_SECONDS || "60",
);

// Batas per-IP, konsisten dengan password-reset.ts. Diterapkan di dalam
// action karena kedua fungsi ini dipanggil dari client component tanpa
// route API.
const RATE_LIMIT_REQUEST_PER_IP = { maxRequests: 3, windowMs: 5 * 60 * 1000 };
const RATE_LIMIT_VERIFY_PER_IP = { maxRequests: 5, windowMs: 60 * 1000 };

// Satu pesan untuk semua kegagalan. Membedakan "email tidak ada" vs "nomor
// salah" hanya berguna untuk enumerasi, padahal nomor pendaftaran sudah bisa
// dibaca publik lewat halaman cek — jadi pesan seragam tidak merusak apa pun.
const PESAN_TOKEN_INVALID = "Kredensial akses pendaftaran tidak valid";

// Pesan expiry sengaja sama dengan pesan yang dipakai upload-bukti &
// upload-dokumen, supaya alur tidak memberi alasan berbeda antar langkah
// untuk token yang sama.
const PESAN_TOKEN_EXPIRED =
  "Masa berlaku akses pendaftaran sudah habis (90 hari). Silakan hubungi panitia PPDB.";

/**
 * Muat pendaftaran bila nomor + token akses cocok.
 * NULL = tidak ada / tidak cocok (fail-closed), tanpa membocorkan mana.
 */
async function findPendaftaranTerotorisasi(
  nomorPendaftaran: string,
  tokenAkses: string,
) {
  if (!nomorPendaftaran || !isTokenAksesBentukValid(tokenAkses)) {
    return null;
  }
  const pendaftaran = await prisma.pendaftaran.findUnique({
    where: { nomorPendaftaran, deleted_at: null },
  });
  if (
    !pendaftaran ||
    !isPendaftaranTokenValid(pendaftaran.tokenAksesHash, tokenAkses)
  ) {
    return null;
  }
  return pendaftaran;
}

export async function requestOtpVerifikasiEmail(
  nomorPendaftaran: string,
  tokenAkses: string,
): Promise<ActionResponse> {
  try {
    const ip = await getClientIpFromHeaders();
    const limiter = await rateLimitAsync(
      `request-otp-verifikasi-email:${ip}`,
      RATE_LIMIT_REQUEST_PER_IP,
    );
    if (!limiter.success) {
      return {
        success: false,
        message: "Terlalu banyak permintaan. Silakan coba lagi dalam 5 menit.",
      };
    }

    const pendaftaran = await findPendaftaranTerotorisasi(
      nomorPendaftaran,
      tokenAkses,
    );
    if (!pendaftaran) {
      return { success: false, message: PESAN_TOKEN_INVALID };
    }

    // Masa berlaku token 90 hari. Tanpa cek ini, gerbang email masih bisa
    // dibuka lewat OTP meski token sudah kedaluwarsa — ketidakkonsistenan
    // dengan upload-bukti & upload-dokumen yang keduanya sudah menolak.
    // Dicek SESUDAH token (bukan sebelum) supaya penyerang tanpa token tetap
    // mendapat PESAN_TOKEN_INVALID yang sama dan tidak bisa memetakan
    // status pendaftaran lewat perbedaan pesan.
    if (!isTokenAksesBelumKedaluwarsa(pendaftaran.tokenAksesExpiraAt)) {
      return { success: false, message: PESAN_TOKEN_EXPIRED };
    }

    // Sudah punya BUKTI OTP (bukan sekadar gerbang terbuka). Yang dicek di
    // sini `emailOrangTuaDiverifikasiOtpAt`, bukan `emailOrangTuaTerverifikasiAt`:
    // grandfathering mengisi yang kedua tanpa bukti apa pun, jadi kalau itu
    // yang jadi acuan, pendaftar lama tidak akan pernah bisa "upgrade"
    // membuktikan kepemilikan emailnya.
    if (pendaftaran.emailOrangTuaDiverifikasiOtpAt) {
      return {
        success: true,
        message: "Email orang tua Anda sudah terverifikasi.",
      };
    }

    // Cooldown resend: satu pendaftaran hanya boleh punya satu OTP aktif.
    const tokenAktif = await prisma.otpVerifikasiEmail.findFirst({
      where: {
        pendaftaranId: pendaftaran.id,
        digunakan: false,
        createdAt: {
          gte: new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000),
        },
      },
      orderBy: { createdAt: "desc" },
    });
    if (tokenAktif) {
      return {
        success: false,
        message: `Kode masih aktif. Silakan tunggu ${OTP_RESEND_COOLDOWN_SECONDS} detik sebelum meminta kode baru.`,
      };
    }

    // Jatuhkan OTP lama supaya hanya ada satu yang bisa dipakai, dan sekalian
    // buang yang sudah kedaluwarsa agar tabel tidak menumpuk untuk pendaftaran
    // yang aktif. Pendaftaran yang abandoned menyisakan beberapa baris — volumenya
    // kecil dan tidak ada cron pembersih (konsisten dengan password_reset_tokens).
    await prisma.otpVerifikasiEmail.deleteMany({
      where: { pendaftaranId: pendaftaran.id, expiredAt: { lt: new Date() } },
    });
    await prisma.otpVerifikasiEmail.updateMany({
      where: { pendaftaranId: pendaftaran.id, digunakan: false },
      data: { digunakan: true },
    });

    const { plainOtp, hashedOtp } = await createOtpWithHash();
    const expiredAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.otpVerifikasiEmail.create({
      data: {
        pendaftaranId: pendaftaran.id,
        email: pendaftaran.emailOrangTua,
        kodeOtpHash: hashedOtp,
        expiredAt,
        digunakan: false,
        jumlahGagal: 0,
      },
    });

    await sendEmail({
      to: pendaftaran.emailOrangTua,
      subject: "Kode Verifikasi Email Pendaftaran PPDB",
      html: buildOtpVerifikasiPendaftaranEmail({
        namaOrangTua: pendaftaran.namaOrangTua,
        namaSiswa: pendaftaran.namaLengkap,
        nomorPendaftaran: pendaftaran.nomorPendaftaran,
        kodeOtp: plainOtp,
        expiryMinutes: OTP_EXPIRY_MINUTES,
      }),
    });

    return {
      success: true,
      message: `Kode verifikasi telah dikirim ke ${pendaftaran.emailOrangTua}.`,
    };
  } catch (error: unknown) {
    console.error("Error requestOtpVerifikasiEmail:", error);
    return {
      success: false,
      message: "Gagal mengirim kode verifikasi. Silakan coba lagi.",
    };
  }
}

export async function verifyOtpVerifikasiEmail(
  nomorPendaftaran: string,
  tokenAkses: string,
  otp: string,
): Promise<ActionResponse> {
  try {
    const ip = await getClientIpFromHeaders();
    const limiter = await rateLimitAsync(
      `verify-otp-verifikasi-email:${ip}`,
      RATE_LIMIT_VERIFY_PER_IP,
    );
    if (!limiter.success) {
      return {
        success: false,
        message: "Terlalu banyak percobaan. Silakan coba lagi dalam 1 menit.",
      };
    }

    const pendaftaran = await findPendaftaranTerotorisasi(
      nomorPendaftaran,
      tokenAkses,
    );
    if (!pendaftaran) {
      return { success: false, message: PESAN_TOKEN_INVALID };
    }

    // Sama seperti requestOtpVerifikasiEmail: token kedaluwarsa menutup
    // gerbang email juga, bukan hanya upload. Kalau hanya checked di
    // request, penyerang yang sudah punya OTP lama masih bisa memakainya
    // selama belum dipakai.
    if (!isTokenAksesBelumKedaluwarsa(pendaftaran.tokenAksesExpiraAt)) {
      return { success: false, message: PESAN_TOKEN_EXPIRED };
    }

    if (pendaftaran.emailOrangTuaDiverifikasiOtpAt) {
      return { success: true, message: "Email sudah terverifikasi." };
    }

    const kode = otp?.trim() ?? "";
    if (!/^\d{6}$/.test(kode)) {
      return { success: false, message: "Kode verifikasi tidak valid" };
    }

    const token = await prisma.otpVerifikasiEmail.findFirst({
      where: {
        pendaftaranId: pendaftaran.id,
        digunakan: false,
        expiredAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    // Tidak ada token aktif = kode salah/kedaluwarsa. Pesannya sengaja sama
    // dengan "kode salah" agar tidak mengungkap apakah ada OTP yang terkirim.
    if (!token) {
      return { success: false, message: "Kode verifikasi tidak valid" };
    }

    if (!(await verifyOtp(kode, token.kodeOtpHash))) {
      const jumlahGagal = token.jumlahGagal + 1;
      const lockout = jumlahGagal >= OTP_MAX_ATTEMPTS;
      await prisma.otpVerifikasiEmail.update({
        where: { id: token.id },
        data: {
          jumlahGagal,
          // Setelah batas percobaan habis, token langsung di-invalidate —
          // bukan sekadar incremented.
          digunakan: lockout,
        },
      });
      return {
        success: false,
        message: lockout
          ? "Terlalu banyak percobaan salah. Silakan minta kode baru."
          : "Kode verifikasi tidak valid",
      };
    }

    // Satu timestamp dipakai untuk kedua kolom supaya "gerbang dibuka" dan
    // "bukti OTP diterima" selalu bertanggal sama.
    const now = new Date();

    // Sukses: token dipakai & pendaftaran ditandai terverifikasi dalam satu
    // transaksi supaya tidak ada keadaan setengah (token terpakai tapi
    // pendaftaran belum ditandai, atau sebaliknya).
    await prisma.$transaction([
      prisma.otpVerifikasiEmail.update({
        where: { id: token.id },
        data: { digunakan: true },
      }),
      prisma.pendaftaran.update({
        where: { id: pendaftaran.id },
        data: {
          // Keduanya diisi: yang pertama membuka gerbang alur publik, yang
          // kedua mencatat bahwa gerbang itu dibuka DENGAN BUKTI (OTP), bukan
          // karena grandfathering. Untuk pendaftaran baru keduanya kosong, jadi
          // `?? new Date()` hanya kena pada kasus upgrade.
          emailOrangTuaTerverifikasiAt:
            pendaftaran.emailOrangTuaTerverifikasiAt ?? now,
          emailOrangTuaDiverifikasiOtpAt: now,
        },
      }),
    ]);

    return {
      success: true,
      message:
        "Email orang tua berhasil diverifikasi. Pendaftaran bisa dilanjutkan.",
    };
  } catch (error: unknown) {
    console.error("Error verifyOtpVerifikasiEmail:", error);
    return {
      success: false,
      message: "Gagal memverifikasi kode. Silakan coba lagi.",
    };
  }
}
