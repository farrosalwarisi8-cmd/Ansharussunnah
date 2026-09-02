// src/actions/admin-keuangan.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuruAdmin } from "@/lib/auth"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { generateSecurePassword } from "@/lib/password"
import { sendEmail } from "@/lib/email"
import {
  createAkunAdminKeuanganSchema,
  updateAkunAdminKeuanganSchema,
  type CreateAkunAdminKeuanganValues,
  type UpdateAkunAdminKeuanganValues,
} from "@/lib/validations/admin-keuangan"
import type { ActionResponse } from "@/types"
import { Role } from "@prisma/client"
import { revalidatePath } from "next/cache"

// ========================================================
// EMAIL TEMPLATE: Kredensial Akun Admin Keuangan Baru
// ========================================================

function buildKredensialAdminKeuanganEmail(params: {
  nama: string
  email: string
  password: string
}): string {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color: #1e40af; margin-top: 0;">💰 Akun Admin Keuangan Baru — Ansharussunnah</h2>
        <p>Halo <strong>${params.nama}</strong>,</p>
        <p>Anda telah terdaftar sebagai Admin Keuangan di sistem LMS Ansharussunnah. Berikut adalah informasi akun Anda:</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        
        <h3 style="color: #333;">🔐 Informasi Akun Login</h3>
        
        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 2px 0;">Email: <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${params.email}</code></p>
          <p style="margin: 2px 0;">Password: <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${params.password}</code></p>
        </div>
        
        <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #92400e;">⚠️ <strong>PENTING:</strong> Saat pertama kali login, Anda akan diminta untuk mengganti password. Simpan informasi ini dengan aman dan jangan bagikan kepada siapapun.</p>
        </div>
        
        <p style="color: #666; font-size: 13px; margin-top: 24px;">
          Jika Anda tidak merasa mendaftar, abaikan email ini atau hubungi admin sekolah.
        </p>
      </div>
    </body>
    </html>
  `
}

// ========================================================
// 1. CRUD AKUN ADMIN KEUANGAN
// ========================================================

/**
 * Membuat akun admin keuangan baru.
 * Hanya bisa dipanggil oleh guru admin (requireGuruAdmin).
 * - Generate password random aman
 * - Buat user di Supabase Auth (email_confirm: true)
 * - Set mustChangePassword: true
 * - Kirim kredensial via email
 */
export async function createAkunAdminKeuangan(
  payload: CreateAkunAdminKeuanganValues
): Promise<ActionResponse<{ userId: string }>> {
  try {
    await requireGuruAdmin()

    const validated = createAkunAdminKeuanganSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data admin keuangan tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { nama, email, noHp } = validated.data

    // Cek duplikasi email untuk role yang sama
    const existingEmail = await prisma.user.findFirst({ where: { email, role: Role.ADMIN_KEUANGAN } })
    if (existingEmail) {
      return { success: false, message: "Email sudah terdaftar untuk role Admin Keuangan" }
    }

    // Generate password random aman
    const password = generateSecurePassword(14)

    // Buat user di Supabase Auth
    const supabaseAdmin = createSupabaseAdmin()
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Langsung verified
        user_metadata: {
          nama,
          role: "ADMIN_KEUANGAN",
        },
      })

    if (authError) {
      console.error("Supabase auth error:", authError)
      return { success: false, message: `Gagal membuat akun auth: ${authError.message}` }
    }

    // Buat record User
    const user = await prisma.user.create({
      data: {
        email,
        nama,
        role: "ADMIN_KEUANGAN",
        authId: authData.user!.id,
        mustChangePassword: true,
        aktif: true,
      },
    })

    // Kirim kredensial via email (fire-and-forget, jangan block response)
    sendEmail({
      to: email,
      subject: "Akun Admin Keuangan Baru — Ansharussunnah",
      html: buildKredensialAdminKeuanganEmail({
        nama,
        email,
        password,
      }),
    }).catch((err) => console.error("Gagal mengirim email kredensial admin keuangan:", err))

    revalidatePath("/dashboard/admin-keuangan")
    return {
      success: true,
      message: `Akun admin keuangan "${nama}" berhasil dibuat. Kredensial telah dikirim ke ${email}.`,
      data: { userId: user.id },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal membuat akun admin keuangan",
    }
  }
}

/**
 * Update data profil admin keuangan (nama, noHp).
 * Bisa dipanggil oleh diri sendiri atau guru admin.
 */
export async function updateAkunAdminKeuangan(
  userId: string,
  payload: UpdateAkunAdminKeuanganValues
): Promise<ActionResponse> {
  try {
    // Otorisasi: hanya boleh edit profil sendiri atau guru admin boleh edit siapa saja
    const { requireAuth } = await import("@/lib/auth")
    const currentUser = await requireAuth()

    if (currentUser.id !== userId && currentUser.role !== "GURU") {
      return {
        success: false,
        message: "Akses ditolak: Anda hanya bisa mengedit profil sendiri",
      }
    }

    // Jika bukan guru admin, pastikan target adalah admin keuangan
    if (currentUser.role !== "GURU" && currentUser.id !== userId) {
      return {
        success: false,
        message: "Akses ditolak",
      }
    }

    const validated = updateAkunAdminKeuanganSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data update tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || user.role !== "ADMIN_KEUANGAN") {
      return { success: false, message: "Akun admin keuangan tidak ditemukan" }
    }

    // Update data User
    await prisma.user.update({
      where: { id: userId },
      data: {
        nama: validated.data.nama !== undefined ? validated.data.nama : undefined,
      },
    })

    revalidatePath("/dashboard/admin-keuangan")
    return { success: true, message: "Data admin keuangan berhasil diperbarui" }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memperbarui data admin keuangan",
    }
  }
}

/**
 * Nonaktifkan akun admin keuangan (soft-delete via field aktif di User).
 * Tidak hard delete agar data historis tetap tersimpan.
 * Juga melakukan ban di Supabase Auth agar login benar-benar diblokir.
 */
export async function nonaktifkanAkunAdminKeuangan(
  userId: string
): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()

    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || user.role !== "ADMIN_KEUANGAN") {
      return { success: false, message: "Akun admin keuangan tidak ditemukan" }
    }

    if (!user.aktif) {
      return { success: false, message: "Akun admin keuangan sudah nonaktif" }
    }

    // Nonaktifkan user di Supabase Auth juga
    // ban_duration "876000h" = 100 tahun = effectively permanent ban
    const supabaseAdmin = createSupabaseAdmin()
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      user.authId,
      { ban_duration: "876000h" }
    )

    if (authError) {
      console.error("Supabase auth ban error:", authError)
      // Lanjutkan meskipun gagal di Supabase — tetap nonaktifkan di DB
    }

    await prisma.user.update({
      where: { id: userId },
      data: { aktif: false },
    })

    revalidatePath("/dashboard/admin-keuangan")
    return { success: true, message: `Akun admin keuangan "${user.nama}" berhasil dinonaktifkan` }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menonaktifkan akun admin keuangan",
    }
  }
}

/**
 * Mengaktifkan kembali akun admin keuangan yang sebelumnya dinonaktifkan.
 * Mencabut ban di Supabase Auth dan mengembalikan field aktif: true.
 */
export async function aktifkanKembaliAkunAdminKeuangan(
  userId: string
): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()

    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || user.role !== "ADMIN_KEUANGAN") {
      return { success: false, message: "Akun admin keuangan tidak ditemukan" }
    }

    if (user.aktif) {
      return { success: false, message: "Akun admin keuangan sudah aktif" }
    }

    // Cabut ban di Supabase Auth
    const supabaseAdmin = createSupabaseAdmin()
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      user.authId,
      { ban_duration: "none" }
    )

    if (authError) {
      console.error("Supabase auth unban error:", authError)
      // Lanjutkan meskipun gagal di Supabase — tetap aktifkan di DB
    }

    await prisma.user.update({
      where: { id: userId },
      data: { aktif: true },
    })

    revalidatePath("/dashboard/admin-keuangan")
    return { success: true, message: `Akun admin keuangan "${user.nama}" berhasil diaktifkan kembali` }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal mengaktifkan kembali akun admin keuangan",
    }
  }
}

/**
 * Mengambil daftar semua admin keuangan beserta info akun.
 */
export async function getDaftarAdminKeuangan(): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()

    const adminList = await prisma.user.findMany({
      where: { role: "ADMIN_KEUANGAN" },
      select: {
        id: true,
        nama: true,
        email: true,
        aktif: true,
        mustChangePassword: true,
        createdAt: true,
      },
      orderBy: { nama: "asc" },
    })

    return {
      success: true,
      message: "Daftar admin keuangan berhasil dimuat",
      data: adminList,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat daftar admin keuangan",
    }
  }
}
