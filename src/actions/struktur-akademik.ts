// src/actions/struktur-akademik.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuru, isAcademicAdminRole } from "@/lib/auth"
import type { ActionResponse } from "@/types"

/**
 * Mengambil struktur jenjang → kelas (hanya kelas aktif) sebagai sumber tunggal
 * konsisten untuk semua dropdown "Pilih Kelas" di fitur akademik
 * (ujian, tugas, materi, absensi, rapor, dll).
 *
 * Semua role akademik (GURU, SUPER_ADMIN, ADMIN_AKADEMIK) dapat melihat seluruh
 * kelas aktif secara bebas.
 */
export async function getStrukturKelasSiswaAkademik(): Promise<
  ActionResponse<{
    role: string
    isAdmin: boolean
    jenjangList: Array<{
      id: string
      nama: string
      urutan: number
      kelas: Array<{
        id: string
        nama: string
        kapasitas: number
      }>
    }>
  }>
> {
  try {
    const user = await requireGuru()
    const isAdmin = isAcademicAdminRole(user.role)

    const jenjangs = await prisma.jenjang.findMany({
      where: { aktif: true },
      orderBy: { urutan: "asc" },
      include: {
        kelas: {
          where: { aktif: true },
          orderBy: { nama: "asc" },
          select: {
            id: true,
            nama: true,
            kapasitas: true,
          },
        },
      },
    })

    return {
      success: true,
      message: "Struktur jenjang/kelas berhasil dimuat",
      data: {
        role: user.role,
        isAdmin,
        jenjangList: jenjangs,
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat struktur jenjang/kelas",
    }
  }
}

/**
 * Mengambil daftar mata pelajaran yang tersedia untuk dipilih di sebuah kelas.
 * - Admin akademik/super admin: semua mapel yang diajarkan di kelas tersebut.
 * - Role.GURU: hanya mapel yang diajarnya di kelas tersebut (dari GuruKelas).
 * Konsisten dipakai oleh dropdown "Pilih Mapel" di semua fitur akademik.
 */
export async function getMapelTersedia(
  kelasId: string
): Promise<ActionResponse<Array<{ id: string; nama: string }>>> {
  try {
    const user = await requireGuru()
    if (!user.guru) {
      return { success: false, message: "Forbidden: Profil guru tidak ditemukan" }
    }

    const isAdmin = isAcademicAdminRole(user.role)
    const where =
      isAdmin
        ? { kelasId }
        : { kelasId, guruId: user.guru.id }

    const mapels = await prisma.mataPelajaran.findMany({
      where: { guruKelas: { some: where } },
      select: { id: true, nama: true },
      orderBy: { nama: "asc" },
    })

    return {
      success: true,
      message: "Daftar mata pelajaran tersedia untuk kelas ini",
      data: mapels,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat daftar mata pelajaran",
    }
  }
}
