// src/actions/guru-kelas.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuru, requireGuruAdmin } from "@/lib/auth"
import { verifyGuruAksesKelas } from "@/lib/guru-auth"
import {
  assignGuruKeKelasSchema,
  type AssignGuruKeKelasValues,
} from "@/lib/validations/guru"
import type { ActionResponse } from "@/types"
import { revalidatePath } from "next/cache"

// ========================================================
// 1. ASSIGN GURU KE KELAS
// ========================================================

/**
 * Menugaskan guru ke kelas untuk mata pelajaran tertentu.
 * Hanya wali kelas atau admin yang bisa melakukan ini.
 */
export async function assignGuruKeKelas(
  payload: AssignGuruKeKelasValues
): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()

    const validated = assignGuruKeKelasSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data penugasan tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { guruId, kelasId, mataPelajaran } = validated.data

    // Validasi guru exists
    const guru = await prisma.guru.findUnique({ where: { id: guruId } })
    if (!guru) {
      return { success: false, message: "Guru tidak ditemukan" }
    }

    // Validasi kelas exists
    const kelas = await prisma.kelas.findUnique({ where: { id: kelasId } })
    if (!kelas) {
      return { success: false, message: "Kelas tidak ditemukan" }
    }

    // Cek apakah kombinasi guru+kelas+mapel sudah ada
    const existing = await prisma.guruKelas.findFirst({
      where: { guruId, kelasId, mataPelajaran },
    })
    if (existing) {
      return {
        success: false,
        message: `Guru ini sudah ditugaskan untuk mapel "${mataPelajaran}" di kelas ini`,
      }
    }

    await prisma.guruKelas.create({
      data: { guruId, kelasId, mataPelajaran },
    })

    revalidatePath("/dashboard/guru")
    return {
      success: true,
      message: `Guru berhasil ditugaskan ke kelas untuk mapel "${mataPelajaran}"`,
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal menugaskan guru ke kelas",
    }
  }
}

// ========================================================
// 2. REMOVE GURU DARI KELAS
// ========================================================

/**
 * Menghapus penugasan guru dari kelas tertentu.
 */
export async function removeGuruDariKelas(
  guruKelasId: string
): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()

    const guruKelas = await prisma.guruKelas.findUnique({
      where: { id: guruKelasId },
      include: {
        guru: { include: { user: { select: { nama: true } } } },
        kelas: { select: { nama: true } },
      },
    })

    if (!guruKelas) {
      return { success: false, message: "Data penugasan tidak ditemukan" }
    }

    await prisma.guruKelas.delete({ where: { id: guruKelasId } })

    revalidatePath("/dashboard/guru")
    return {
      success: true,
      message: `Penugasan ${guruKelas.guru.user.nama} di kelas ${guruKelas.kelas.nama} (${guruKelas.mataPelajaran}) berhasil dihapus`,
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal menghapus penugasan guru",
    }
  }
}

// ========================================================
// 3. GET DAFTAR PENGAJAR KELAS
// ========================================================

/**
 * Mengambil daftar semua guru yang mengajar di kelas tertentu.
 */
export async function getDaftarPengajarKelas(
  kelasId: string
): Promise<ActionResponse> {
  try {
    await requireGuru()

    const kelas = await prisma.kelas.findUnique({ where: { id: kelasId } })
    if (!kelas) {
      return { success: false, message: "Kelas tidak ditemukan" }
    }

    const pengajarList = await prisma.guruKelas.findMany({
      where: { kelasId },
      include: {
        guru: {
          include: {
            user: { select: { nama: true, email: true, aktif: true } },
          },
        },
      },
      orderBy: { mataPelajaran: "asc" },
    })

    const formatted = pengajarList.map((p) => ({
      id: p.id,
      guruId: p.guruId,
      nama: p.guru.user.nama,
      email: p.guru.user.email,
      aktif: p.guru.user.aktif,
      mataPelajaran: p.mataPelajaran,
      createdAt: p.createdAt,
    }))

    return {
      success: true,
      message: "Daftar pengajar kelas berhasil dimuat",
      data: formatted,
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal memuat daftar pengajar",
    }
  }
}

// ========================================================
// 4. GET DAFTAR KELAS YANG DIAJAR GURU
// ========================================================

/**
 * Mengambil daftar semua kelas + mata pelajaran yang diajar oleh guru tertentu.
 */
export async function getDaftarKelasYangDiajarGuru(
  guruId?: string
): Promise<ActionResponse> {
  try {
    const user = await requireGuru()

    // Jika tidak ada guruId, ambil milik sendiri
    const targetGuruId = guruId || user.guru?.id
    if (!targetGuruId) {
      return { success: false, message: "Data guru tidak ditemukan" }
    }

    const kelasList = await prisma.guruKelas.findMany({
      where: { guruId: targetGuruId },
      include: {
        kelas: {
          include: {
            jenjang: { select: { nama: true } },
            _count: { select: { siswa: true } },
          },
        },
      },
      orderBy: [{ kelas: { jenjang: { urutan: "asc" } } }, { mataPelajaran: "asc" }],
    })

    const formatted = kelasList.map((gk) => ({
      guruKelasId: gk.id,
      kelasId: gk.kelasId,
      namaKelas: gk.kelas.nama,
      jenjang: gk.kelas.jenjang.nama,
      mataPelajaran: gk.mataPelajaran,
      jumlahSiswa: gk.kelas._count.siswa,
    }))

    return {
      success: true,
      message: "Daftar kelas yang diajar berhasil dimuat",
      data: formatted,
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal memuat daftar kelas",
    }
  }
}
