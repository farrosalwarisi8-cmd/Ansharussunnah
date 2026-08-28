// src/actions/jenjang-kelas.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuru } from "@/lib/auth"
import {
  jenjangSchema,
  kelasSchema,
  type JenjangFormValues,
  type KelasFormValues,
} from "@/lib/validations/jenjang-kelas"
import type { ActionResponse, JenjangWithKelas, KelasWithRelations } from "@/types"
import { revalidatePath } from "next/cache"

// ========================================================
// 1. PUBLIC ACTIONS
// ========================================================

/**
 * Mengambil daftar jenjang aktif beserta kelasnya untuk dropdown form publik
 */
export async function getJenjangDenganKelas(): Promise<
  ActionResponse<
    Array<{
      id: string
      nama: string
      urutan: number
      kelas: Array<{
        id: string
        nama: string
        kapasitas: number
      }>
    }>
  >
> {
  try {
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
      message: "Data jenjang berhasil diambil",
      data: jenjangs,
    }
  } catch (error) {
    console.error("Error getJenjangDenganKelas:", error)
    return {
      success: false,
      message: "Gagal memuat data jenjang dan kelas",
    }
  }
}

// ========================================================
// 2. ACTIONS KHUSUS GURU: MANAJEMEN JENJANG
// ========================================================

/**
 * Mengambil seluruh daftar jenjang (aktif maupun non-aktif) untuk dashboard Guru
 */
export async function getAdminJenjangList(): Promise<ActionResponse<JenjangWithKelas[]>> {
  try {
    await requireGuru()

    const jenjangs = await prisma.jenjang.findMany({
      orderBy: { urutan: "asc" },
      include: {
        kelas: {
          include: {
            jenjang: true,
            waliKelas: {
              include: { user: true },
            },
            _count: {
              select: { siswa: true },
            },
          },
        },
      },
    })

    return {
      success: true,
      message: "Daftar jenjang berhasil diambil",
      data: jenjangs as JenjangWithKelas[],
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal memuat data jenjang",
    }
  }
}

/**
 * Tambah jenjang baru
 */
export async function createJenjang(
  payload: JenjangFormValues
): Promise<ActionResponse> {
  try {
    await requireGuru()

    const validated = jenjangSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data jenjang tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { nama, urutan } = validated.data

    // Cek duplikasi nama atau urutan
    const existing = await prisma.jenjang.findFirst({
      where: {
        OR: [{ nama }, { urutan }],
      },
    })

    if (existing) {
      return {
        success: false,
        message:
          existing.nama === nama
            ? "Nama jenjang sudah digunakan"
            : "Nomor urutan jenjang sudah digunakan",
      }
    }

    await prisma.jenjang.create({
      data: { nama, urutan, aktif: true },
    })

    revalidatePath("/dashboard/jenjang")
    revalidatePath("/pendaftaran")

    return {
      success: true,
      message: `Jenjang "${nama}" berhasil ditambahkan`,
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal menambahkan jenjang",
    }
  }
}

/**
 * Update data jenjang
 */
export async function updateJenjang(
  id: string,
  payload: Partial<JenjangFormValues> & { aktif?: boolean }
): Promise<ActionResponse> {
  try {
    await requireGuru()

    const jenjang = await prisma.jenjang.findUnique({ where: { id } })
    if (!jenjang) {
      return { success: false, message: "Jenjang tidak ditemukan" }
    }

    await prisma.jenjang.update({
      where: { id },
      data: {
        nama: payload.nama,
        urutan: payload.urutan,
        aktif: payload.aktif,
      },
    })

    revalidatePath("/dashboard/jenjang")
    revalidatePath("/pendaftaran")

    return {
      success: true,
      message: "Data jenjang berhasil diperbarui",
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal memperbarui data jenjang",
    }
  }
}

/**
 * Hapus jenjang (Hanya jika belum memiliki kelas/pendaftaran terkait)
 */
export async function deleteJenjang(id: string): Promise<ActionResponse> {
  try {
    await requireGuru()

    // Validasi apakah jenjang terpakai
    const checkRelations = await prisma.jenjang.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            kelas: true,
            pendaftaran: true,
          },
        },
      },
    })

    if (!checkRelations) {
      return { success: false, message: "Jenjang tidak ditemukan" }
    }

    if (checkRelations._count.kelas > 0 || checkRelations._count.pendaftaran > 0) {
      return {
        success: false,
        message:
          "Tidak dapat menghapus jenjang karena masih memiliki data kelas atau data pendaftaran aktif",
      }
    }

    await prisma.jenjang.delete({ where: { id } })

    revalidatePath("/dashboard/jenjang")
    revalidatePath("/pendaftaran")

    return {
      success: true,
      message: "Jenjang berhasil dihapus",
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal menghapus jenjang",
    }
  }
}

// ========================================================
// 3. ACTIONS KHUSUS GURU: MANAJEMEN KELAS
// ========================================================

/**
 * Mengambil seluruh daftar kelas beserta guru wali kelas
 */
export async function getAdminKelasList(): Promise<ActionResponse<KelasWithRelations[]>> {
  try {
    await requireGuru()

    const kelas = await prisma.kelas.findMany({
      orderBy: [{ jenjang: { urutan: "asc" } }, { nama: "asc" }],
      include: {
        jenjang: true,
        waliKelas: {
          include: { user: true },
        },
        _count: {
          select: { siswa: true },
        },
      },
    })

    return {
      success: true,
      message: "Daftar kelas berhasil dimuat",
      data: kelas as KelasWithRelations[],
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal memuat daftar kelas",
    }
  }
}

/**
 * Tambah kelas baru di suatu jenjang
 */
export async function createKelas(payload: KelasFormValues): Promise<ActionResponse> {
  try {
    await requireGuru()

    const validated = kelasSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data kelas tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { nama, jenjangId, waliKelasId, kapasitas } = validated.data

    // Cek apakah kombinasi nama dan jenjang sudah terdaftar
    const existing = await prisma.kelas.findUnique({
      where: {
        nama_jenjangId: {
          nama,
          jenjangId,
        },
      },
    })

    if (existing) {
      return {
        success: false,
        message: `Kelas "${nama}" sudah ada di jenjang yang dipilih`,
      }
    }

    await prisma.kelas.create({
      data: {
        nama,
        jenjangId,
        waliKelasId: waliKelasId || null,
        kapasitas,
        aktif: true,
      },
    })

    revalidatePath("/dashboard/kelas")
    revalidatePath("/pendaftaran")

    return {
      success: true,
      message: `Kelas "${nama}" berhasil dibuat`,
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal membuat kelas baru",
    }
  }
}

/**
 * Update kelas (ganti nama, kapasitas, atau wali kelas)
 */
export async function updateKelas(
  id: string,
  payload: Partial<KelasFormValues> & { aktif?: boolean }
): Promise<ActionResponse> {
  try {
    await requireGuru()

    const kelas = await prisma.kelas.findUnique({ where: { id } })
    if (!kelas) {
      return { success: false, message: "Kelas tidak ditemukan" }
    }

    await prisma.kelas.update({
      where: { id },
      data: {
        nama: payload.nama,
        jenjangId: payload.jenjangId,
        waliKelasId: payload.waliKelasId !== undefined ? payload.waliKelasId : undefined,
        kapasitas: payload.kapasitas,
        aktif: payload.aktif,
      },
    })

    revalidatePath("/dashboard/kelas")
    revalidatePath("/pendaftaran")

    return {
      success: true,
      message: "Data kelas berhasil diperbarui",
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal memperbarui kelas",
    }
  }
}

/**
 * Hapus kelas
 */
export async function deleteKelas(id: string): Promise<ActionResponse> {
  try {
    await requireGuru()

    const checkRelations = await prisma.kelas.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            siswa: true,
            pendaftaran: true,
          },
        },
      },
    })

    if (!checkRelations) {
      return { success: false, message: "Kelas tidak ditemukan" }
    }

    if (checkRelations._count.siswa > 0 || checkRelations._count.pendaftaran > 0) {
      return {
        success: false,
        message:
          "Tidak dapat menghapus kelas karena masih memiliki siswa atau pendaftar aktif",
      }
    }

    await prisma.kelas.delete({ where: { id } })

    revalidatePath("/dashboard/kelas")
    revalidatePath("/pendaftaran")

    return {
      success: true,
      message: "Kelas berhasil dihapus",
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal menghapus kelas",
    }
  }
}