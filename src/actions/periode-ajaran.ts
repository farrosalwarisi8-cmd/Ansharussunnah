// src/actions/periode-ajaran.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuru } from "@/lib/auth"
import {
  createPeriodeAjaranSchema,
  updatePeriodeAjaranSchema,
  type CreatePeriodeAjaranValues,
  type UpdatePeriodeAjaranValues,
} from "@/lib/validations/rapor"
import type { ActionResponse } from "@/types"
import { revalidatePath } from "next/cache"

/**
 * Ambil semua periode ajaran (untuk dropdown di berbagai fitur).
 * Bisa dipanggil oleh role apapun yang sudah login.
 */
export async function getDaftarPeriodeAjaran(): Promise<ActionResponse> {
  try {
    await requireGuru()

    const periodeList = await prisma.periodeAjaran.findMany({
      orderBy: [{ tahunAjaran: "desc" }, { semester: "desc" }],
    })

    return {
      success: true,
      message: "Daftar periode ajaran berhasil dimuat",
      data: periodeList,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat periode ajaran",
    }
  }
}

/**
 * Ambil periode ajaran aktif (yang sedang berjalan) untuk dipakai
 * sebagai nilai default dropdown periode di form ujian/tugas/materi.
 */
export async function getPeriodeAjaranAktif(): Promise<
  ActionResponse<{ id: string; nama: string } | null>
> {
  try {
    await requireGuru()

    const periode = await prisma.periodeAjaran.findFirst({
      where: { aktif: true },
      select: { id: true, nama: true },
      orderBy: { tahunAjaran: "desc" },
    })

    return {
      success: true,
      message: "Periode ajaran aktif berhasil dimuat",
      data: periode,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat periode ajaran aktif",
    }
  }
}

/**
 * Buat periode ajaran baru.
 * Jika diset aktif=true, periode lain otomatis di-nonaktifkan.
 */
export async function createPeriodeAjaran(
  payload: CreatePeriodeAjaranValues
): Promise<ActionResponse<{ periodeId: string }>> {
  try {
    await requireGuru()

    const validated = createPeriodeAjaranSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data periode ajaran tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { nama, tahunAjaran, semester, tanggalMulai, tanggalSelesai, aktif } =
      validated.data

    // Cek duplikasi nama
    const existing = await prisma.periodeAjaran.findUnique({
      where: { nama },
    })
    if (existing) {
      return {
        success: false,
        message: "Nama periode ajaran sudah digunakan",
      }
    }

    const periode = await prisma.$transaction(
      async (tx) => {
      // Jika periode baru diset aktif, nonaktifkan semua periode lain
      if (aktif) {
        await tx.periodeAjaran.updateMany({
          where: { aktif: true },
          data: { aktif: false },
        })
      }

      return tx.periodeAjaran.create({
        data: {
          nama,
          tahunAjaran,
          semester,
          tanggalMulai: new Date(tanggalMulai),
          tanggalSelesai: new Date(tanggalSelesai),
          aktif,
        },
      })
      },
      { timeout: 10000, maxWait: 3000 }
    )

    revalidatePath("/dashboard/guru/periode")
    return {
      success: true,
      message: `Periode ajaran "${nama}" berhasil dibuat`,
      data: { periodeId: periode.id },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal membuat periode ajaran",
    }
  }
}

/**
 * Update periode ajaran (nama, tanggal, status aktif).
 */
export async function updatePeriodeAjaran(
  periodeId: string,
  payload: UpdatePeriodeAjaranValues
): Promise<ActionResponse> {
  try {
    await requireGuru()

    const validated = updatePeriodeAjaranSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data update tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const existing = await prisma.periodeAjaran.findUnique({
      where: { id: periodeId },
    })
    if (!existing) {
      return { success: false, message: "Periode ajaran tidak ditemukan" }
    }

    await prisma.$transaction(
      async (tx) => {
      // Jika mengaktifkan periode ini, nonaktifkan yang lain
      if (payload.aktif === true && !existing.aktif) {
        await tx.periodeAjaran.updateMany({
          where: { aktif: true, id: { not: periodeId } },
          data: { aktif: false },
        })
      }

      await tx.periodeAjaran.update({
        where: { id: periodeId },
        data: {
          nama: payload.nama,
          tahunAjaran: payload.tahunAjaran,
          semester: payload.semester,
          tanggalMulai: payload.tanggalMulai
            ? new Date(payload.tanggalMulai)
            : undefined,
          tanggalSelesai: payload.tanggalSelesai
            ? new Date(payload.tanggalSelesai)
            : undefined,
          aktif: payload.aktif,
        },
      })
      },
      { timeout: 10000, maxWait: 3000 }
    )

    revalidatePath("/dashboard/guru/periode")
    return { success: true, message: "Periode ajaran berhasil diperbarui" }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memperbarui periode ajaran",
    }
  }
}

/**
 * Hapus periode ajaran (hanya jika belum ada data terkait).
 */
export async function deletePeriodeAjaran(
  periodeId: string
): Promise<ActionResponse> {
  try {
    await requireGuru()

    const checkRelations = await prisma.periodeAjaran.findUnique({
      where: { id: periodeId },
      include: {
        _count: {
          select: {
            ujian: true,
            tugas: true,
            absensi: true,
            catatanRapor: true,
          },
        },
      },
    })

    if (!checkRelations) {
      return { success: false, message: "Periode ajaran tidak ditemukan" }
    }

    const totalRelasi =
      checkRelations._count.ujian +
      checkRelations._count.tugas +
      checkRelations._count.absensi +
      checkRelations._count.catatanRapor

    if (totalRelasi > 0) {
      return {
        success: false,
        message:
          "Tidak dapat menghapus periode yang masih memiliki data ujian, tugas, absensi, atau rapor",
      }
    }

    await prisma.periodeAjaran.delete({ where: { id: periodeId } })

    revalidatePath("/dashboard/guru/periode")
    return { success: true, message: "Periode ajaran berhasil dihapus" }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menghapus periode ajaran",
    }
  }
}