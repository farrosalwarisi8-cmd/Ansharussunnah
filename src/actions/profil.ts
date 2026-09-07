// src/actions/profil.ts

"use server"

import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { updateProfilSchema, type UpdateProfilValues } from "@/lib/validations/profil"
import type { ActionResponse } from "@/types"
import { revalidatePath } from "next/cache"

type AkunProfilData = {
  username: string | null
  email: string
}

/**
 * Mengambil data akun (username + email) user yang sedang login.
 */
export async function getAkunProfil(): Promise<ActionResponse<AkunProfilData>> {
  try {
    const user = await requireAuth()
    return {
      success: true,
      message: "Data akun berhasil dimuat",
      data: { username: user.username, email: user.email },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat data akun",
    }
  }
}

/**
 * Update username & email akun sendiri (tersimpan permanen di database):
 * - username: langsung disimpan ke User.username
 * - email: disinkronkan ke Supabase Auth (email_confirm) lalu ke DB.
 * Semua record User dengan authId yang sama ikut diperbarui agar konsisten
 * (kasus satu orang punya beberapa role dengan email auth sama).
 */
export async function updateAkunProfil(
  payload: UpdateProfilValues
): Promise<ActionResponse<AkunProfilData>> {
  try {
    const user = await requireAuth()

    const normalizedPayload =
      payload.username !== undefined
        ? { ...payload, username: payload.username.trim().toLowerCase() }
        : payload

    const validated = updateProfilSchema.safeParse(normalizedPayload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data akun tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const username = validated.data.username?.trim() || null
    const email = validated.data.email?.toLowerCase().trim() || null

    if (!username && !email) {
      return { success: false, message: "Tidak ada perubahan yang diberikan" }
    }

    // Username baru wajib unik secara global (login via username bersifat global)
    if (username && username !== (user.username || "")) {
      const duplicateUsername = await prisma.user.findFirst({
        where: {
          username,
          id: { not: user.id },
          NOT: { username: null },
        },
        select: { id: true },
      })
      if (duplicateUsername) {
        return { success: false, message: `Username "${username}" sudah dipakai pengguna lain` }
      }
    }

    // Email baru tidak boleh dipakai record lain dengan authId berbeda
    if (email && email !== user.email.toLowerCase()) {
      const otherUser = await prisma.user.findFirst({
        where: {
          email,
          authId: { not: user.authId },
        },
        select: { id: true },
      })
      if (otherUser) {
        return { success: false, message: "Email sudah terdaftar untuk akun lain" }
      }

      // Sinkronkan email ke Supabase Auth
      const supabaseAdmin = createSupabaseAdmin()
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user.authId, {
        email,
        email_confirm: true,
      })
      if (authError) {
        return {
          success: false,
          message: `Gagal mengubah email di sistem login: ${authError.message}`,
        }
      }

      await prisma.user.updateMany({
        where: { authId: user.authId },
        data: { email },
      })
    }

    if (username && username !== (user.username || "")) {
      await prisma.user.update({
        where: { id: user.id },
        data: { username },
      })
    }

    revalidatePath("/", "layout")

    return {
      success: true,
      message: "Akun berhasil diperbarui",
      data: {
        username:
          username && username !== user.username ? username : user.username,
        email: email && email !== user.email.toLowerCase() ? email : user.email,
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memperbarui akun",
    }
  }
}