// src/actions/struktur-akademik.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuru, isAcademicAdminRole } from "@/lib/auth"
import type { ActionResponse } from "@/types"

/**
 * Mengambil struktur jenjang → kelas sebagai sumber tunggal konsisten untuk
 * semua dropdown "Pilih Kelas" di fitur akademik (ujian, tugas, materi, rapor, dll).
 *
 * Cakupan kelas disesuaikan dengan role pengunjung:
 * - SUPER_ADMIN / ADMIN_AKADEMIK: seluruh kelas aktif (akses penuh).
 * - Role.GURU: hanya kelas yang diajarnya (via GuruKelas) atau kelas yang
 *   menjadi wali kelasnya — konsisten dengan getDaftarKelasYangDiajarGuru.
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
    const isAdmin = isAcademicAdminRole(user.role) || user.isAdmin

    const jenjangWhere: Record<string, unknown> = { aktif: true }

    if (!isAdmin) {
      const guruId = user.guru?.id
      if (!guruId) {
        return { success: false, message: "Forbidden: Profil guru tidak ditemukan" }
      }
      // GURU: hanya kelas yang diajar / menjadi wali kelas
      jenjangWhere.kelas = {
        some: {
          OR: [
            { waliKelasId: guruId },
            { guruMengajar: { some: { guruId } } },
          ],
        },
      }
    }

    const jenjangs = await prisma.jenjang.findMany({
      where: jenjangWhere as never,
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
    const isAdmin = isAcademicAdminRole(user.role)

    // Admin akademik / super admin: semua mapel aktif yang ditetapkan untuk kelas ini
    // (melalui MapelKelas) tersedia. Jika belum ada MapelKelas, tampilkan semua mapel aktif
    // sebagai fallback untuk backward compatibility.
    if (isAdmin) {
      // Cek apakah ada mapel yang ditetapkan via MapelKelas untuk kelas ini
      const mapelViaKelas = await prisma.mataPelajaran.findMany({
        where: {
          aktif: true,
          mapelKelas: { some: { kelasId } },
        },
        select: { id: true, nama: true },
        orderBy: { nama: "asc" },
      })

      if (mapelViaKelas.length > 0) {
        return {
          success: true,
          message: "Daftar mata pelajaran tersedia untuk kelas ini",
          data: mapelViaKelas,
        }
      }

      // Fallback: jika belum ada MapelKelas, tampilkan semua mapel aktif
      const mapels = await prisma.mataPelajaran.findMany({
        where: { aktif: true },
        select: { id: true, nama: true },
        orderBy: { nama: "asc" },
      })

      return {
        success: true,
        message: "Daftar mata pelajaran tersedia untuk kelas ini",
        data: mapels,
      }
    }

    // Role.GURU: hanya mapel yang diajarnya di kelas tersebut (dari GuruKelas)
    // DAN yang ditetapkan untuk kelas tersebut (dari MapelKelas, jika ada).
    if (!user.guru) {
      return { success: false, message: "Forbidden: Profil guru tidak ditemukan" }
    }

    const mapels = await prisma.mataPelajaran.findMany({
      where: {
        aktif: true,
        guruKelas: { some: { kelasId, guruId: user.guru.id } },
        mapelKelas: { some: { kelasId } },
      },
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
