// src/actions/change-password.ts

"use server"

import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { encryptSecret } from "@/lib/crypto"
import { rateLimitAsync, getClientIpFromHeaders } from "@/lib/rate-limit"
import type { ActionResponse } from "@/types"
import { revalidatePath } from "next/cache"

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<ActionResponse> {
  try {
    const user = await requireAuth()

    // Rate Limit: maksimal 5 percobaan ganti password per 15 menit per IP
    const ip = await getClientIpFromHeaders()
    const limiter = await rateLimitAsync(`change-password:${ip}:${user.id}`, {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000, // 15 menit
    })
    if (!limiter.success) {
      return {
        success: false,
        message: "Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit.",
      }
    }

    if (newPassword.length < 8) {
      return { success: false, message: "Password baru minimal 8 karakter" }
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return {
        success: false,
        message: "Password baru harus berupa kombinasi huruf dan angka",
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

    // Verifikasi validitas password saat ini TANPA membuat sesi baru.
    // Client dibuat dengan persistSession: false sehingga signInWithPassword
    // tidak menulis cookie sesi sementara (client sesi lama menciptakan sesi
    // tidak berguna yang harus dibereskan lewat signOut global). Tetap memakai
    // anon key sehingga rate limiting Supabase Auth per-user tetap berlaku.
    const { createClient } = await import("@supabase/supabase-js")
    const verifySupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
    const { error: signInError } = await verifySupabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (signInError) {
      return { success: false, message: "Password saat ini yang Anda masukkan salah" }
    }

    // Update password di level Auth (butuh service role untuk admin.updateUserById)
    const supabaseAdmin = createSupabaseAdmin()
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.authId,
      { password: newPassword }
    )

    if (updateError) {
      console.error("Supabase update password error:", updateError)
      return {
        success: false,
        message: "Gagal memperbarui password. Silakan coba lagi.",
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mustChangePassword: false,
        lastPasswordChange: new Date(),
        passwordPlain: encryptSecret(newPassword),
      },
    })

    // Sign out global
    await supabaseAdmin.auth.admin.signOut(user.authId)

    // Bersihkan cookie pemilihan role agar akun/role yang dipilih sebelumnya
    // tidak terbawa saat login kembali setelah ganti password.
    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()
    cookieStore.delete("selected_role")
    cookieStore.delete("selected_user_id")

    revalidatePath("/", "layout")

    return {
      success: true,
      message: "Password berhasil diperbarui. Silakan login kembali.",
    }
  } catch (error) {
    console.error("Error changePassword:", error)
    return {
      success: false,
      message: "Gagal mengganti password. Silakan coba lagi.",
    }
  }
}