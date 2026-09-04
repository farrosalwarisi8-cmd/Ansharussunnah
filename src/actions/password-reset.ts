// src/actions/password-reset.ts

"use server"

import prisma from "@/lib/prisma"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { createOtpWithHash, verifyOtp } from "@/lib/otp"
import { sendEmail, buildOtpEmail } from "@/lib/email"
import type { ActionResponse } from "@/types"
import { revalidatePath } from "next/cache"

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "10")
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || "3")
const OTP_RESEND_COOLDOWN_SECONDS = parseInt(
  process.env.OTP_RESEND_COOLDOWN_SECONDS || "60"
)

export async function requestPasswordReset(
  email: string
): Promise<ActionResponse> {
  try {
    const normalizedEmail = email.toLowerCase().trim()

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { success: false, message: "Format email tidak valid" }
    }

    // Find any user record with this email (multiple roles may share the same auth)
    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail },
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
      const waitSeconds = Math.ceil(
        (recentToken.createdAt.getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000
      )
      return {
        success: false,
        message: `Silakan tunggu ${waitSeconds} detik sebelum meminta kode baru.`,
      }
    }

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, digunakan: false },
      data: { digunakan: true },
    })

    const { plainOtp, hashedOtp } = await createOtpWithHash()
    const expiredAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        kodeOtpHash: hashedOtp,
        expiredAt,
        digunakan: false,
        jumlahGagal: 0,
      },
    })

    await sendEmail({
      to: normalizedEmail,
      subject: "Kode Verifikasi Reset Password",
      html: buildOtpEmail({
        nama: user.nama,
        kodeOtp: plainOtp,
        expiryMinutes: OTP_EXPIRY_MINUTES,
      }),
    })

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
    const normalizedEmail = email.toLowerCase().trim()

    if (!otp || !/^\d{6}$/.test(otp)) {
      return { success: false, message: "Kode OTP harus berupa 6 digit angka" }
    }

    // Find any user record with this email (multiple roles may share the same auth)
    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail },
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
        message: "Terlalu banyak percobaan salah. Silakan minta kode verifikasi baru.",
      }
    }

    const isValid = await verifyOtp(otp, token.kodeOtpHash)

    if (!isValid) {
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
      where: { email: normalizedEmail },
    })

    if (!user) {
      return { success: false, message: "Token reset tidak valid" }
    }

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
        message: "Token reset tidak valid atau sudah kedaluwarsa",
      }
    }

    const supabaseAdmin = createSupabaseAdmin()

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

    // Invalidate semua session aktif (global sign-out)
    await supabaseAdmin.auth.admin.signOut(user.authId)

    await prisma.$transaction(
      async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: token.id },
        data: { digunakan: true },
      })

      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, digunakan: false },
        data: { digunakan: true },
      })

      await tx.user.update({
        where: { id: user.id },
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