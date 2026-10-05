// src/actions/password-reset.ts

"use server"

import prisma from "@/lib/prisma"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { createOtpWithHash, verifyOtp } from "@/lib/otp"
import { sendEmail, buildOtpEmail } from "@/lib/email"
import { rateLimitAsyncStrict, getClientIpFromHeaders } from "@/lib/rate-limit"
import type { ActionResponse } from "@/types"
import { revalidatePath } from "next/cache"

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "10")
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || "3")
const OTP_RESEND_COOLDOWN_SECONDS = parseInt(
  process.env.OTP_RESEND_COOLDOWN_SECONDS || "60"
)

// Batas per-IP. Diterapkan DI DALAM ACTION (bukan hanya di route API) karena
// aksi ini juga dipanggil langsung dari Server Component
// (`app/lupa-password/*`), yang tidak melewati route API. Route API tetap punya
// limiter sendiri dengan bucket berbeda — jangan disatukan menjadi satu bucket,
// jika tidak satu panggilan API akan memakai kuota dua kali.
const RATE_LIMIT_REQUEST_PER_IP = { maxRequests: 3, windowMs: 5 * 60 * 1000 }
const RATE_LIMIT_VERIFY_PER_IP = { maxRequests: 5, windowMs: 60 * 1000 }
// `resetPassword` tidak dipanggil lewat route API sama sekali, jadi tanpa
// limiter di sini endpoint ini bebas dihammer dari luar. Token hasil OTP sudah
// invalidated setelah dipakai sekali, tapi limiter tetap menahan percobaan
// berulang dari penyerang yang sempat memperoleh tokenId-nya.
const RATE_LIMIT_RESET_PER_IP = { maxRequests: 10, windowMs: 5 * 60 * 1000 }

export async function requestPasswordReset(
  email: string
): Promise<ActionResponse> {
  try {
    const ip = await getClientIpFromHeaders()
    const limiter = await rateLimitAsyncStrict(
      `request-password-reset:${ip}`,
      RATE_LIMIT_REQUEST_PER_IP
    )
    if (!limiter.success) {
      return {
        success: false,
        message:
          "Terlalu banyak permintaan. Silakan coba lagi dalam 5 menit.",
      }
    }

    const normalizedEmail = email.toLowerCase().trim()

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { success: false, message: "Format email tidak valid" }
    }

    // Find any user record with this email (multiple roles may share the same auth)
    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail, deleted_at: null },
    })

    // ✅ generic response untuk meminimalkan email enumeration vulnerability
    const genericSuccessResponse = {
      success: true,
      message: "Jika email terdaftar, kode verifikasi akan dikirim dalam beberapa saat.",
    }

    if (!user || !user.aktif) {
      return genericSuccessResponse
    }

    // Rate Limit Check
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
      // Jangan ungkap bahwa email terdaftar — balas dengan respons generik yang
      // identik dengan kasus email tidak dikenal (anti email-enumeration).
      return genericSuccessResponse
    }

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, digunakan: false },
      data: { digunakan: true },
    })

    const { plainOtp, hashedOtp } = await createOtpWithHash()
    const expiredAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    const tokenBaru = await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        kodeOtpHash: hashedOtp,
        expiredAt,
        digunakan: false,
        jumlahGagal: 0,
      },
    })

    const hasilEmail = await sendEmail({
      to: normalizedEmail,
      jenisEmail: "reset_password",
      // Satu email OTP per token — retry event tidak menumpuk OTP baru.
      idempotencyKey: `reset-otp:${tokenBaru.id}`,
      subject: "Kode Verifikasi Reset Password",
      html: buildOtpEmail({
        nama: user.nama,
        kodeOtp: plainOtp,
        expiryMinutes: OTP_EXPIRY_MINUTES,
      }),
    })

    if (!hasilEmail.success) {
      await prisma.passwordResetToken.update({
        where: { id: tokenBaru.id },
        data: { digunakan: true },
      })
      console.error("Email OTP gagal dikirim:", hasilEmail.error)
    }

    return genericSuccessResponse
  } catch (error: unknown) {
    console.error("Error requestPasswordReset:", error)
    return {
      success: false,
      message: "Gagal mengirimkan kode verifikasi.",
    }
  }
}

export async function verifyResetOtp(
  email: string,
  otp: string
): Promise<ActionResponse<{ resetToken: string }>> {
  try {
    const ip = await getClientIpFromHeaders()
    const limiter = await rateLimitAsyncStrict(
      `verify-reset-otp:${ip}`,
      RATE_LIMIT_VERIFY_PER_IP
    )
    if (!limiter.success) {
      return {
        success: false,
        message: "Terlalu banyak percobaan. Silakan coba lagi dalam 1 menit.",
      }
    }

    const normalizedEmail = email.toLowerCase().trim()

    if (!otp || !/^\d{6}$/.test(otp)) {
      return { success: false, message: "Kode OTP harus berupa 6 digit angka" }
    }

    // Find any user record with this email (multiple roles may share the same auth)
    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail, deleted_at: null },
    })

    if (!user) {
      return { success: false, message: "Kode verifikasi tidak valid" }
    }

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
        message: "Kode verifikasi tidak valid atau sudah kedaluwarsa",
      }
    }

    // anti-brute force lockout
    if (token.jumlahGagal >= OTP_MAX_ATTEMPTS) {
      await prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { digunakan: true },
      })
      return {
        success: false,
        message: "Kode verifikasi tidak valid atau sudah kedaluwarsa",
      }
    }

    const isValid = await verifyOtp(otp, token.kodeOtpHash)

    if (!isValid) {
      await prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { jumlahGagal: { increment: 1 } },
      })

      return {
        success: false,
        message: "Kode verifikasi tidak valid atau sudah kedaluwarsa",
      }
    }

    return {
      success: true,
      message: "Verifikasi kode berhasil",
      data: { resetToken: token.id },
    }
  } catch (error: unknown) {
    console.error("Error verifyResetOtp:", error)
    return { success: false, message: "Gagal memproses verifikasi OTP" }
  }
}

export async function resetPassword(
  email: string,
  resetTokenId: string,
  newPassword: string,
  confirmPassword: string
): Promise<ActionResponse> {
  try {
    const ip = await getClientIpFromHeaders()
    const limiter = await rateLimitAsyncStrict(
      `reset-password:${ip}`,
      RATE_LIMIT_RESET_PER_IP
    )
    if (!limiter.success) {
      return {
        success: false,
        message:
          "Terlalu banyak percobaan. Silakan coba lagi dalam 5 menit.",
      }
    }

    const normalizedEmail = email.toLowerCase().trim()

    if (newPassword.length < 8) {
      return { success: false, message: "Password minimal harus 8 karakter" }
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return {
        success: false,
        message: "Password harus mengandung kombinasi huruf dan angka",
      }
    }

    if (newPassword !== confirmPassword) {
      return { success: false, message: "Konfirmasi password baru tidak cocok" }
    }

    // Find any user record with this email (multiple roles may share the same auth)
    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail, deleted_at: null },
    })

    if (!user) {
      return { success: false, message: "Token reset tidak valid" }
    }

    const supabaseAdmin = createSupabaseAdmin()

    const claimed = await prisma.passwordResetToken.updateMany({
      where: {
        id: resetTokenId,
        userId: user.id,
        digunakan: false,
        expiredAt: { gte: new Date() },
      },
      data: { digunakan: true },
    })

    if (claimed.count === 0) {
      return {
        success: false,
        message: "Token reset tidak valid atau sudah kedaluwarsa",
      }
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.authId,
      { password: newPassword }
    )

    if (updateError) {
      console.error("Password reset updateUserById gagal:", updateError.message)
      return {
        success: false,
        message: "Gagal memperbarui password. Silakan coba lagi nanti.",
      }
    }

    // Invalidate semua session aktif (global sign-out)
    await supabaseAdmin.auth.admin.signOut(user.authId)

    await prisma.$transaction(
      async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, digunakan: false },
        data: { digunakan: true },
      })

      await tx.user.updateMany({
        where: { authId: user.authId },
        data: {
          mustChangePassword: false,
          lastPasswordChange: new Date(),
        },
      })
      },
      { timeout: 8000, maxWait: 3000 }
    )

    // Revalidate layout agar mustChangePassword guard di sisi klien ikut ter-update
    revalidatePath("/", "layout")

    return {
      success: true,
      message: "Password berhasil diubah. Silakan login kembali.",
    }
  } catch (error: unknown) {
    console.error("Error resetPassword:", error)
    return {
      success: false,
      message: "Gagal menyetel password baru.",
    }
  }
}