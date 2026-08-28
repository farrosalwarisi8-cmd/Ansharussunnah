// src/actions/password-reset.ts

"use server"

import prisma from "@/lib/prisma"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { createOtpWithHash, verifyOtp } from "@/lib/otp"
import { sendEmail, buildOtpEmail } from "@/lib/email"
import type { ActionResponse } from "@/types"

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "10")
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || "3")
const OTP_RESEND_COOLDOWN_SECONDS = parseInt(
  process.env.OTP_RESEND_COOLDOWN_SECONDS || "60"
)

/**
 * Step 1: Request OTP — Generate & kirim kode ke email
 */
export async function requestPasswordReset(
  email: string
): Promise<ActionResponse> {
  try {
    const normalizedEmail = email.toLowerCase().trim()

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { success: false, message: "Format email tidak valid" }
    }

    // Cari user di database
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    // ✅ SECURITY: Jangan beri tahu apakah email terdaftar atau tidak
    // Selalu return success agar attacker tidak bisa enumerate email
    if (!user) {
      return {
        success: true,
        message:
          "Jika email terdaftar, kode verifikasi akan dikirim dalam beberapa saat.",
      }
    }

    if (!user.aktif) {
      return {
        success: true,
        message:
          "Jika email terdaftar, kode verifikasi akan dikirim dalam beberapa saat.",
      }
    }

    // ✅ Rate limit: Cek apakah user sudah request OTP dalam 60 detik terakhir
    const recentToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        digunakan: false,
        createdAt: {
          gte: new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000),
        },
      },
      orderBy: { createdAt: "desc" },
    })

    if (recentToken) {
      const waitSeconds = Math.ceil(
        (recentToken.createdAt.getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000
      )
      return {
        success: false,
        message: `Silakan tunggu ${waitSeconds} detik sebelum meminta kode baru.`,
      }
    }

    // Invalidate token lama yang belum digunakan
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, digunakan: false },
      data: { digunakan: true },
    })

    // Generate OTP baru
    const { plainOtp, hashedOtp } = await createOtpWithHash()
    const expiredAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    // Simpan ke database (hashed)
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        kodeOtpHash: hashedOtp,
        expiredAt,
        digunakan: false,
        jumlahGagal: 0,
      },
    })

    // Kirim email
    await sendEmail({
      to: normalizedEmail,
      subject: "Kode Verifikasi Lupa Password",
      html: buildOtpEmail({
        nama: user.nama,
        kodeOtp: plainOtp,
        expiryMinutes: OTP_EXPIRY_MINUTES,
      }),
    })

    return {
      success: true,
      message:
        "Jika email terdaftar, kode verifikasi akan dikirim dalam beberapa saat.",
    }
  } catch (error: any) {
    console.error("Error requestPasswordReset:", error)
    return {
      success: false,
      message: "Terjadi kesalahan. Silakan coba lagi.",
    }
  }
}

/**
 * Step 2: Verifikasi OTP — Cek apakah kode benar dan belum expired
 * Return token sementara jika valid (untuk digunakan di step 3)
 */
export async function verifyResetOtp(
  email: string,
  otp: string
): Promise<ActionResponse<{ resetToken: string }>> {
  try {
    const normalizedEmail = email.toLowerCase().trim()

    if (!otp || !/^\d{6}$/.test(otp)) {
      return { success: false, message: "Kode OTP harus 6 digit angka" }
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      return { success: false, message: "Kode verifikasi tidak valid" }
    }

    // Cari token aktif terbaru
    const token = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        digunakan: false,
        expiredAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    })

    if (!token) {
      return {
        success: false,
        message: "Kode verifikasi tidak valid atau sudah kadaluarsa",
      }
    }

    // ✅ Anti brute-force: Cek jumlah percobaan gagal
    if (token.jumlahGagal >= OTP_MAX_ATTEMPTS) {
      // Invalidate token
      await prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { digunakan: true },
      })
      return {
        success: false,
        message:
          "Terlalu banyak percobaan salah. Silakan minta kode verifikasi baru.",
      }
    }

    // Verifikasi OTP
    const isValid = await verifyOtp(otp, token.kodeOtpHash)

    if (!isValid) {
      // Increment counter gagal
      await prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { jumlahGagal: { increment: 1 } },
      })

      const sisaPercobaan = OTP_MAX_ATTEMPTS - token.jumlahGagal - 1
      return {
        success: false,
        message:
          sisaPercobaan > 0
            ? `Kode salah. Sisa ${sisaPercobaan} percobaan lagi.`
            : "Terlalu banyak percobaan salah. Silakan minta kode baru.",
      }
    }

    // OTP valid — return resetToken (ID token yang sudah diverifikasi)
    return {
      success: true,
      message: "Kode verifikasi berhasil",
      data: { resetToken: token.id },
    }
  } catch (error: any) {
    console.error("Error verifyResetOtp:", error)
    return { success: false, message: "Terjadi kesalahan. Silakan coba lagi." }
  }
}

/**
 * Step 3: Reset Password — Set password baru & invalidate semua session
 */
export async function resetPassword(
  email: string,
  resetTokenId: string,
  newPassword: string,
  confirmPassword: string
): Promise<ActionResponse> {
  try {
    const normalizedEmail = email.toLowerCase().trim()

    // Validasi password baru
    if (newPassword.length < 8) {
      return { success: false, message: "Password minimal 8 karakter" }
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return {
        success: false,
        message: "Password harus mengandung huruf dan angka",
      }
    }

    if (newPassword !== confirmPassword) {
      return { success: false, message: "Konfirmasi password tidak cocok" }
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      return { success: false, message: "Reset token tidak valid" }
    }

    // Verifikasi token masih valid
    const token = await prisma.passwordResetToken.findFirst({
      where: {
        id: resetTokenId,
        userId: user.id,
        digunakan: false,
        expiredAt: { gte: new Date() },
      },
    })

    if (!token) {
      return {
        success: false,
        message: "Token reset tidak valid atau sudah kadaluarsa",
      }
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Update password di Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.authId,
      { password: newPassword }
    )

    if (updateError) {
      return {
        success: false,
        message: `Gagal memperbarui password: ${updateError.message}`,
      }
    }

    // ✅ Invalidate semua session aktif (logout semua device)
    await supabaseAdmin.auth.admin.signOut(user.authId)

    // Update database Prisma
    await prisma.$transaction(async (tx) => {
      // Tandai token sebagai sudah digunakan
      await tx.passwordResetToken.update({
        where: { id: token.id },
        data: { digunakan: true },
      })

      // Invalidate semua token lain yang masih aktif
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, digunakan: false },
        data: { digunakan: true },
      })

      // Update flag user
      await tx.user.update({
        where: { id: user.id },
        data: {
          mustChangePassword: false,
          lastPasswordChange: new Date(),
        },
      })
    })

    return {
      success: true,
      message:
        "Password berhasil diubah. Silakan login dengan password baru.",
    }
  } catch (error: any) {
    console.error("Error resetPassword:", error)
    return {
      success: false,
      message: "Terjadi kesalahan. Silakan coba lagi.",
    }
  }
}