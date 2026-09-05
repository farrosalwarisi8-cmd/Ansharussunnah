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
 * - Admin (SUPER_ADMIN / ADMIN_AKADEMIK / GURU dengan isAdmin=true): semua mapel
 *   yang ditetapkan untuk kelas tersebut (dari MapelKelas), atau fallback semua
 *   mapel aktif bila belum ada penautan MapelKelas.
 * - Role.GURU yang menjadi wali kelas: diperlakukan seperti admin untuk kelas itu,
 *   konsisten dengan verifyGuruAksesKelas yang memberi akses WALI_KELAS penuh.
 * - Role.GURU (pengajar): hanya mapel yang diajarnya di kelas tersebut (GuruKelas);
 *   mapel yang belum punya penautan MapelKelas tetap tampil (backward compat).
 * Konsisten dipakai oleh dropdown "Pilih Mapel" di semua fitur akademik.
 */
export async function getMapelTersedia(
  kelasId: string
): Promise<ActionResponse<Array<{ id: string; nama: string }>>> {
  try {
    const user = await requireGuru()
    // Penting: GURU dengan flag isAdmin juga dianggap admin di sini, sama seperti
    // di verifyGuruAksesKelas & getStrukturKelasSiswaAkademik. Tanpa ini, "admin guru"
    // terjebak filter GuruKelas dan dropdown mapel di ujian/tugas/materi menjadi kosong.
    const isAdmin = isAcademicAdminRole(user.role) || user.isAdmin

    // Mapel aktif yang ditetapkan untuk kelas ini via MapelKelas.
    // Jika belum ada penautan MapelKelas sama sekali, fallback ke semua mapel aktif.
    const cariMapelKelas = async (): Promise<Array<{ id: string; nama: string }>> => {
      const mapelViaKelas = await prisma.mataPelajaran.findMany({
        where: {
          aktif: true,
          mapelKelas: { some: { kelasId } },
        },
        select: { id: true, nama: true },
        orderBy: { nama: "asc" },
      })
      if (mapelViaKelas.length > 0) return mapelViaKelas

      const mapels = await prisma.mataPelajaran.findMany({
        where: { aktif: true },
        select: { id: true, nama: true },
        orderBy: { nama: "asc" },
      })
      return mapels
    }

    const balasanMapel = (data: Array<{ id: string; nama: string }>) => ({
      success: true as const,
      message: "Daftar mata pelajaran tersedia untuk kelas ini",
      data,
    })

    // Admin akademik / super admin / guru-admin: akses penuh ke seluruh kelas.
    if (isAdmin) {
      return balasanMapel(await cariMapelKelas())
    }

    if (!user.guru) {
      return { success: false, message: "Forbidden: Profil guru tidak ditemukan" }
    }
    const guruId = user.guru.id

    // Wali kelas: berhak mengelola seluruh mapel di kelas yang diampunya
    // (verifyGuruAksesKelas mengizinkan wali kelas membuat konten di kelas tsb).
    const waliKelas = await prisma.kelas.findFirst({
      where: { id: kelasId, waliKelasId: guruId },
      select: { id: true },
    })
    if (waliKelas) {
      return balasanMapel(await cariMapelKelas())
    }

    // Pengajar: hanya mapel yang diajarnya di kelas tersebut.
    // Mapel yang belum ditautkan MapelKelas tetap tampil (kompatibel dengan data lama),
    // karena penugasan GuruKelas sudah menjadi otorisasi yang cukup.
    const mapels = await prisma.mataPelajaran.findMany({
      where: {
        aktif: true,
        guruKelas: { some: { kelasId, guruId } },
        OR: [
          { mapelKelas: { some: { kelasId } } },
          { mapelKelas: { none: {} } },
        ],
      },
      select: { id: true, nama: true },
      orderBy: { nama: "asc" },
    })

    return balasanMapel(mapels)
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat daftar mata pelajaran",
    }
  }
}
