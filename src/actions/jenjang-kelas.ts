// src/actions/jenjang-kelas.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuruAdmin } from "@/lib/auth"
import {
  jenjangSchema,
  kelasSchema,
  updateKelasSchema,
  type JenjangFormValues,
  type KelasFormValues,
  type UpdateKelasFormValues,
} from "@/lib/validations/jenjang-kelas"
import type { ActionResponse, JenjangWithKelas, KelasWithRelations } from "@/types"
import { guruCocokKelas } from "@/lib/guru-kelas-gender"
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
        jenisKelamin: "LAKI_LAKI" | "PEREMPUAN" | null
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
            jenisKelamin: true,
          },
        },
      },
    })

    return {
      success: true,
      message: "Data jenjang berhasil diambil",
      data: jenjangs,
    }
  } catch {
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
    await requireGuruAdmin()

    const jenjangs = await prisma.jenjang.findMany({
      orderBy: { urutan: "asc" },
      include: {
        kelas: {
          include: {
            jenjang: true,
            waliKelas: {
              where: { deleted_at: null },
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
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat data jenjang",
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
    await requireGuruAdmin()

    const validated = jenjangSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data jenjang tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { nama, urutan, tarifSppBulanan } = validated.data

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
      data: { nama, urutan, aktif: true, tarifSppBulanan: tarifSppBulanan ?? null },
    })

    revalidatePath("/dashboard/kelas")
    revalidatePath("/pendaftaran")

    return {
      success: true,
      message: `Jenjang "${nama}" berhasil ditambahkan`,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menambahkan jenjang",
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
    await requireGuruAdmin()

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
        tarifSppBulanan:
          payload.tarifSppBulanan !== undefined ? payload.tarifSppBulanan ?? null : undefined,
      },
    })

    revalidatePath("/dashboard/kelas")
    revalidatePath("/pendaftaran")

    return {
      success: true,
      message: "Data jenjang berhasil diperbarui",
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memperbarui data jenjang",
    }
  }
}

/**
 * Hapus jenjang (Hanya jika belum memiliki kelas/pendaftaran terkait)
 */
export async function deleteJenjang(id: string): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()

    // Validasi apakah jenjang terpakai
    const checkRelations = await prisma.jenjang.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            kelas: true,
            pendaftaran: true,
            mataPelajaran: true,
          },
        },
      },
    })

    if (!checkRelations) {
      return { success: false, message: "Jenjang tidak ditemukan" }
    }

    if (
      checkRelations._count.kelas > 0 ||
      checkRelations._count.pendaftaran > 0 ||
      checkRelations._count.mataPelajaran > 0
    ) {
      return {
        success: false,
        message:
          "Tidak dapat menghapus jenjang karena masih memiliki data kelas, pendaftaran aktif, atau mata pelajaran",
      }
    }

    await prisma.jenjang.delete({ where: { id } })

    revalidatePath("/dashboard/kelas")
    revalidatePath("/pendaftaran")

    return {
      success: true,
      message: "Jenjang berhasil dihapus",
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menghapus jenjang",
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
    await requireGuruAdmin()

    const kelas = await prisma.kelas.findMany({
      orderBy: [{ jenjang: { urutan: "asc" } }, { nama: "asc" }],
      include: {
        jenjang: true,
        waliKelas: {
          where: { deleted_at: null },
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
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat daftar kelas",
    }
  }
}

/**
 * Tambah kelas baru di suatu jenjang
 */
export async function createKelas(payload: KelasFormValues): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()

    const validated = kelasSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data kelas tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { nama, jenjangId, waliKelasId, kapasitas, jenisKelamin } = validated.data

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

    const kelasJenisKelamin = jenisKelamin ?? null

    // ✅ Validasi kecocokan gender guru wali kelas dengan gender kelas
    if (waliKelasId) {
      const wali = await prisma.guru.findUnique({
        where: { id: waliKelasId, deleted_at: null },
        select: {
          id: true,
          jenisKelamin: true,
          user: { select: { nama: true } },
        },
      })
      if (!wali) {
        return { success: false, message: "Guru wali kelas tidak ditemukan" }
      }
      if (!guruCocokKelas(wali.jenisKelamin, kelasJenisKelamin)) {
        const labelKelas = kelasJenisKelamin === "LAKI_LAKI" ? "Ikhwan" : "Akhwat"
        return {
          success: false,
          message: `Kelas khusus ${labelKelas} hanya dapat diampu oleh guru ${labelKelas}, namun "${wali.user.nama}" ${wali.jenisKelamin === "LAKI_LAKI" ? "laki-laki" : "perempuan"}.`,
        }
      }
    }

    await prisma.kelas.create({
      data: {
        nama,
        jenjangId,
        waliKelasId: waliKelasId || null,
        kapasitas,
        jenisKelamin: kelasJenisKelamin,
        aktif: true,
      },
    })

    revalidatePath("/dashboard/kelas")
    revalidatePath("/pendaftaran")

    return {
      success: true,
      message: `Kelas "${nama}" berhasil dibuat`,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal membuat kelas baru",
    }
  }
}

/**
 * Update kelas (ganti nama, jenjang, kapasitas, atau wali kelas)
 */
export async function updateKelas(
  id: string,
  payload: UpdateKelasFormValues
): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()

    const validated = updateKelasSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data kelas tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const kelas = await prisma.kelas.findUnique({ where: { id } })
    if (!kelas) {
      return { success: false, message: "Kelas tidak ditemukan" }
    }

    const data = validated.data
    const kelasJenisKelamin =
      data.jenisKelamin !== undefined ? data.jenisKelamin : kelas.jenisKelamin
    const waliKelasId =
      data.waliKelasId !== undefined ? data.waliKelasId : kelas.waliKelasId

    // ✅ Duplikasi nama kelas di dalam jenjang yang sama
    const namaBaru = data.nama ?? kelas.nama
    const jenjangBaru = data.jenjangId ?? kelas.jenjangId
    const duplicate = await prisma.kelas.findUnique({
      where: { nama_jenjangId: { nama: namaBaru, jenjangId: jenjangBaru } },
    })
    if (duplicate && duplicate.id !== id) {
      return {
        success: false,
        message: `Kelas "${namaBaru}" sudah ada di jenjang yang dipilih`,
      }
    }

    // ✅ Validasi kecocokan gender guru wali kelas dengan gender kelas (hasil update)
    if (waliKelasId) {
      const wali = await prisma.guru.findUnique({
        where: { id: waliKelasId, deleted_at: null },
        select: {
          id: true,
          jenisKelamin: true,
          user: { select: { nama: true } },
        },
      })
      if (!wali) {
        return { success: false, message: "Guru wali kelas tidak ditemukan" }
      }
      if (!guruCocokKelas(wali.jenisKelamin, kelasJenisKelamin)) {
        const labelKelas = kelasJenisKelamin === "LAKI_LAKI" ? "Ikhwan" : "Akhwat"
        return {
          success: false,
          message: `Kelas khusus ${labelKelas} hanya dapat diampu oleh guru ${labelKelas}, namun "${wali.user.nama}" ${wali.jenisKelamin === "LAKI_LAKI" ? "laki-laki" : "perempuan"}.`,
        }
      }
    }

    await prisma.kelas.update({
      where: { id },
      data: {
        nama: data.nama,
        jenjangId: data.jenjangId,
        waliKelasId: data.waliKelasId !== undefined ? data.waliKelasId : undefined,
        kapasitas: data.kapasitas,
        jenisKelamin:
          data.jenisKelamin !== undefined ? data.jenisKelamin ?? null : undefined,
        aktif: data.aktif,
      },
    })

    revalidatePath("/dashboard/kelas")
    revalidatePath("/pendaftaran")

    return {
      success: true,
      message: "Data kelas berhasil diperbarui",
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memperbarui kelas",
    }
  }
}

/**
 * Hapus kelas
 */
export async function deleteKelas(id: string): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()

    const checkRelations = await prisma.kelas.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            siswa: true,
            pendaftaran: true,
            ujian: true,
            absensi: true,
            tugas: true,
            materi: true,
            nilaiRapor: true,
            riwayatSebagaiKelas: true,
            riwayatSebagaiKelasAsal: true,
          },
        },
      },
    })

    if (!checkRelations) {
      return { success: false, message: "Kelas tidak ditemukan" }
    }

    const { siswa, pendaftaran, ujian, absensi, tugas, materi, nilaiRapor, riwayatSebagaiKelas, riwayatSebagaiKelasAsal } =
      checkRelations._count

    if (
      siswa > 0 ||
      pendaftaran > 0 ||
      ujian > 0 ||
      absensi > 0 ||
      tugas > 0 ||
      materi > 0 ||
      nilaiRapor > 0 ||
      riwayatSebagaiKelas > 0 ||
      riwayatSebagaiKelasAsal > 0
    ) {
      return {
        success: false,
        message:
          "Tidak dapat menghapus kelas karena masih memiliki data terkait (siswa, pendaftaran, ujian, absensi, tugas, materi, nilai rapor, atau riwayat kelas)",
      }
    }

    await prisma.kelas.delete({ where: { id } })

    revalidatePath("/dashboard/kelas")
    revalidatePath("/pendaftaran")

    return {
      success: true,
      message: "Kelas berhasil dihapus",
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menghapus kelas",
    }
  }
}