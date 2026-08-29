// src/actions/guru.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuru, requireGuruAdmin } from "@/lib/auth"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { generateSecurePassword } from "@/lib/password"
import { sendEmail, buildKredensialGuruEmail } from "@/lib/email"
import {
  createAkunGuruSchema,
  updateAkunGuruSchema,
  type CreateAkunGuruValues,
  type UpdateAkunGuruValues,
} from "@/lib/validations/guru"
import type { ActionResponse } from "@/types"
import { revalidatePath } from "next/cache"

// ========================================================
// 1. CRUD AKUN GURU
// ========================================================

/**
 * Membuat akun guru baru.
 * Hanya bisa dipanggil oleh guru admin (requireGuruAdmin).
 * - Generate password random aman
 * - Buat user di Supabase Auth (email_confirm: true)
 * - Set mustChangePassword: true
 * - Buat record Guru terkait
 * - Kirim kredensial via email
 */
export async function createAkunGuru(
  payload: CreateAkunGuruValues
): Promise<ActionResponse<{ userId: string }>> {
  try {
    await requireGuruAdmin()

    const validated = createAkunGuruSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data guru tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { nama, email, nip, jabatan, noHp } = validated.data

    // Cek duplikasi email
    const existingEmail = await prisma.user.findUnique({ where: { email } })
    if (existingEmail) {
      return { success: false, message: "Email sudah terdaftar dalam sistem" }
    }

    // Cek duplikasi NIP jika diisi
    if (nip) {
      const existingNip = await prisma.guru.findUnique({ where: { nip } })
      if (existingNip) {
        return { success: false, message: "NIP sudah terdaftar dalam sistem" }
      }
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
          role: "GURU",
        },
      })

    if (authError) {
      console.error("Supabase auth error:", authError)
      return { success: false, message: `Gagal membuat akun auth: ${authError.message}` }
    }

    // Buat record User + Guru dalam transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          nama,
          role: "GURU",
          authId: authData.user!.id,
          mustChangePassword: true,
          aktif: true,
        },
      })

      const guru = await tx.guru.create({
        data: {
          userId: (user as any).id,
          nip: nip || null,
          jabatan: jabatan || null,
          noHp: noHp || null,
        },
      })

      return { userId: (user as any).id, guruId: (guru as any).id }
    })

    // Kirim kredensial via email (fire-and-forget, jangan block response)
    sendEmail({
      to: email,
      subject: "Akun Guru Baru — Ansharussunnah",
      html: buildKredensialGuruEmail({
        nama,
        email,
        password,
      }),
    }).catch((err) => console.error("Gagal mengirim email kredensial guru:", err))

    revalidatePath("/dashboard/guru")
    return {
      success: true,
      message: `Akun guru "${nama}" berhasil dibuat. Kredensial telah dikirim ke ${email}.`,
      data: { userId: result.userId },
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal membuat akun guru",
    }
  }
}

/**
 * Update data profil guru (nama, NIP, jabatan, noHp).
 */
export async function updateAkunGuru(
  userId: string,
  payload: UpdateAkunGuruValues
): Promise<ActionResponse> {
  try {
    await requireGuru()

    const validated = updateAkunGuruSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data update tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { guru: true },
    })

    if (!user || user.role !== "GURU") {
      return { success: false, message: "Akun guru tidak ditemukan" }
    }

    if (!user.guru) {
      return { success: false, message: "Profil guru tidak ditemukan" }
    }

    // Cek duplikasi NIP jika diubah
    if (validated.data.nip && validated.data.nip !== user.guru.nip) {
      const existingNip = await prisma.guru.findUnique({
        where: { nip: validated.data.nip },
      })
      if (existingNip) {
        return { success: false, message: "NIP sudah digunakan oleh guru lain" }
      }
    }

    await prisma.$transaction(async (tx) => {
      // Update nama di User jika diubah
      if (validated.data.nama) {
        await tx.user.update({
          where: { id: userId },
          data: { nama: validated.data.nama },
        })
      }

      // Update data Guru
      await tx.guru.update({
        where: { id: user.guru!.id },
        data: {
          nip: validated.data.nip !== undefined ? validated.data.nip : undefined,
          jabatan: validated.data.jabatan !== undefined ? validated.data.jabatan : undefined,
          noHp: validated.data.noHp !== undefined ? validated.data.noHp : undefined,
        },
      })
    })

    revalidatePath("/dashboard/guru")
    return { success: true, message: "Data guru berhasil diperbarui" }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal memperbarui data guru",
    }
  }
}

/**
 * Nonaktifkan akun guru (soft-delete via field aktif di User).
 * Tidak hard delete agar data historis tetap tersimpan.
 * Juga melakukan ban di Supabase Auth agar login benar-benar diblokir.
 */
export async function nonaktifkanAkunGuru(
  userId: string
): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { guru: true },
    })

    if (!user || user.role !== "GURU") {
      return { success: false, message: "Akun guru tidak ditemukan" }
    }

    if (!user.aktif) {
      return { success: false, message: "Akun guru sudah nonaktif" }
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

    revalidatePath("/dashboard/guru")
    return { success: true, message: `Akun guru "${user.nama}" berhasil dinonaktifkan` }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal menonaktifkan akun guru",
    }
  }
}

/**
 * Mengaktifkan kembali akun guru yang sebelumnya dinonaktifkan.
 * Mencabut ban di Supabase Auth dan mengembalikan field aktif: true.
 */
export async function aktifkanKembaliAkunGuru(
  userId: string
): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { guru: true },
    })

    if (!user || user.role !== "GURU") {
      return { success: false, message: "Akun guru tidak ditemukan" }
    }

    if (user.aktif) {
      return { success: false, message: "Akun guru sudah aktif" }
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

    revalidatePath("/dashboard/guru")
    return { success: true, message: `Akun guru "${user.nama}" berhasil diaktifkan kembali` }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal mengaktifkan kembali akun guru",
    }
  }
}

/**
 * Mengubah status admin guru (promote/demote).
 * Hanya bisa dipanggil oleh guru admin (requireGuruAdmin).
 */
export async function setGuruAdmin(
  userId: string,
  isAdmin: boolean
): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { guru: true },
    })

    if (!user || user.role !== "GURU") {
      return { success: false, message: "Akun guru tidak ditemukan" }
    }

    // Tidak boleh mengubah status admin diri sendiri
    const currentUser = await requireGuruAdmin()
    if (currentUser.id === userId) {
      return { success: false, message: "Tidak dapat mengubah status admin diri sendiri" }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isAdmin },
    })

    const action = isAdmin ? "diangkat menjadi admin" : "diturunkan dari admin"
    revalidatePath("/dashboard/guru")
    return {
      success: true,
      message: `Guru "${user.nama}" berhasil ${action}`,
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal mengubah status admin guru",
    }
  }
}

/**
 * Mengambil daftar semua guru beserta info akun.
 */
export async function getDaftarGuru(): Promise<ActionResponse> {
  try {
    await requireGuru()

    const guruList = await prisma.guru.findMany({
      include: {
        user: {
          select: {
            id: true,
            nama: true,
            email: true,
            aktif: true,
            isAdmin: true,
            mustChangePassword: true,
            createdAt: true,
          },
        },
        waliKelas: {
          select: { nama: true },
        },
        mengajar: {
          select: {
            kelas: { select: { nama: true } },
            mataPelajaran: true,
          },
        },
      },
      orderBy: { user: { nama: "asc" } },
    })

    const formatted = guruList.map((g) => ({
      id: g.id,
      userId: g.user.id,
      nama: g.user.nama,
      email: g.user.email,
      nip: g.nip,
      jabatan: g.jabatan,
      noHp: g.noHp,
      aktif: g.user.aktif,
      isAdmin: g.user.isAdmin,
      mustChangePassword: g.user.mustChangePassword,
      createdAt: g.user.createdAt,
      waliKelas: g.waliKelas.map((k) => k.nama),
      jumlahMengajar: g.mengajar.length,
    }))

    return {
      success: true,
      message: "Daftar guru berhasil dimuat",
      data: formatted,
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal memuat daftar guru",
    }
  }
}
