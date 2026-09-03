// src/actions/guru-kelas.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuru, requireGuruAdmin, isAcademicAdminRole } from "@/lib/auth"
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
      where: { guruId, kelasId, mataPelajaran: { nama: mataPelajaran } },
    })
    if (existing) {
      return {
        success: false,
        message: `Guru ini sudah ditugaskan untuk mapel "${mataPelajaran}" di kelas ini`,
      }
    }

    // Cari mata pelajaran berdasarkan nama untuk create
    const mapel = await prisma.mataPelajaran.findFirst({ where: { nama: mataPelajaran } })
    if (!mapel) {
      return { success: false, message: `Mata pelajaran "${mataPelajaran}" tidak ditemukan` }
    }

    await prisma.guruKelas.create({
      data: { guruId, kelasId, mataPelajaranId: mapel.id },
    })

    revalidatePath("/dashboard/guru")
    return {
      success: true,
      message: `Guru berhasil ditugaskan ke kelas untuk mapel "${mataPelajaran}"`,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menugaskan guru ke kelas",
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
      message: `Penugasan ${guruKelas.guru.user.nama} di kelas ${guruKelas.kelas.nama} berhasil dihapus`,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menghapus penugasan guru",
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
        mataPelajaran: {
          select: { id: true, nama: true, kode: true },
        },
      },
      orderBy: { mataPelajaranId: "asc" },
    })

    const formatted = pengajarList.map((p) => ({
      id: p.id,
      guruId: p.guruId,
      nama: p.guru.user.nama,
      email: p.guru.user.email,
      aktif: p.guru.user.aktif,
      mataPelajaran: {
        id: p.mataPelajaran.id,
        nama: p.mataPelajaran.nama,
        kode: p.mataPelajaran.kode,
      },
      createdAt: p.createdAt,
    }))

    return {
      success: true,
      message: "Daftar pengajar kelas berhasil dimuat",
      data: formatted,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat daftar pengajar",
    }
  }
}

// ========================================================
// 4. GET DAFTAR KELAS YANG DIAJAR GURU
// ========================================================

/**
 * Mengambil daftar semua kelas yang berhak dikelola oleh user akademik saat ini:
 * - SUPER_ADMIN / ADMIN_AKADEMIK: seluruh kelas aktif (akses penuh).
 * - Role.GURU: hanya kelas yang diajarnya (via GuruKelas) ATAU kelas yang
 *   menjadi wali kelasnya.
 * Dipakai sebagai sumber tunggal & konsisten untuk dropdown "Pilih Kelas"
 * di semua fitur akademik (absensi, rapor, ujian, tugas, materi, dll).
 */
export async function getDaftarKelasYangDiajarGuru(
  guruId?: string
): Promise<ActionResponse> {
  try {
    const user = await requireGuru()

    const isAdmin = isAcademicAdminRole(user.role)

    // Admin akademik / super admin melihat seluruh kelas aktif
    if (isAdmin) {
      const kelasList = await prisma.kelas.findMany({
        where: { aktif: true },
        include: {
          jenjang: { select: { nama: true } },
          _count: { select: { siswa: true } },
        },
        orderBy: [{ jenjang: { urutan: "asc" } }, { nama: "asc" }],
      })

      const formatted = kelasList.map((k) => ({
        guruKelasId: null,
        kelasId: k.id,
        namaKelas: k.nama,
        jenjang: k.jenjang.nama,
        mataPelajaranId: null,
        jumlahSiswa: k._count.siswa,
      }))

      return {
        success: true,
        message: "Daftar kelas berhasil dimuat",
        data: formatted,
      }
    }

    // Jika tidak ada guruId, ambil milik sendiri
    const targetGuruId = guruId || user.guru?.id
    if (!targetGuruId) {
      return { success: false, message: "Data guru tidak ditemukan" }
    }

    const guruKelasList = await prisma.guruKelas.findMany({
      where: { guruId: targetGuruId },
      include: {
        kelas: {
          include: {
            jenjang: { select: { nama: true } },
            _count: { select: { siswa: true } },
          },
        },
      },
      orderBy: [{ kelas: { jenjang: { urutan: "asc" } } }, { mataPelajaranId: "asc" }],
    })

    // Tambahkan kelas yang menjadi wali kelas (walau tidak mengajar mapel apa pun)
    const taughtKelasIds = guruKelasList.map((gk) => gk.kelasId)
    const waliKelasList = await prisma.kelas.findMany({
      where: { aktif: true, waliKelasId: targetGuruId, id: { notIn: taughtKelasIds } },
      include: {
        jenjang: { select: { nama: true } },
        _count: { select: { siswa: true } },
      },
      orderBy: [{ jenjang: { urutan: "asc" } }, { nama: "asc" }],
    })

    const formatted = [
      ...guruKelasList.map((gk) => ({
        guruKelasId: gk.id,
        kelasId: gk.kelasId,
        namaKelas: gk.kelas.nama,
        jenjang: gk.kelas.jenjang.nama,
        mataPelajaranId: gk.mataPelajaranId,
        jumlahSiswa: gk.kelas._count.siswa,
      })),
      ...waliKelasList.map((k) => ({
        guruKelasId: null,
        kelasId: k.id,
        namaKelas: k.nama,
        jenjang: k.jenjang.nama,
        mataPelajaranId: null,
        jumlahSiswa: k._count.siswa,
      })),
    ]

    return {
      success: true,
      message: "Daftar kelas yang diajar berhasil dimuat",
      data: formatted,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat daftar kelas",
    }
  }
}
