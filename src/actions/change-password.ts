// src/actions/change-password.ts

"use server"

import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import type { ActionResponse } from "@/types"
import { revalidatePath } from "next/cache"

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<ActionResponse> {
  try {
    const user = await requireAuth()

    // Validasi input
    if (newPassword.length < 8) {
      return { success: false, message: "Password baru minimal 8 karakter" }
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return {
        success: false,
        message: "Password baru harus mengandung huruf dan angka",
      }
    }

    if (newPassword !== confirmPassword) {
      return { success: false, message: "Konfirmasi password tidak cocok" }
    }

    if (currentPassword === newPassword) {
      return {
        success: false,
        message: "Password baru tidak boleh sama dengan password lama",
      }
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Verifikasi password lama via Supabase Auth
    const { data: signInData, error: signInError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })

    if (signInError || !signInData.user) {
      return { success: false, message: "Password saat ini salah" }
    }

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

    // Update flag di database Prisma
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mustChangePassword: false,
        lastPasswordChange: new Date(),
      },
    })

    // Invalidate semua session lain
    await supabaseAdmin.auth.admin.signOut(user.authId)

    revalidatePath("/", "layout")

    return {
      success: true,
      message: "Password berhasil diubah. Silakan login ulang.",
    }
  } catch (error: any) {
    console.error("Error changePassword:", error)
    return {
      success: false,
      message: error.message || "Gagal mengganti password",
    }
  }
}