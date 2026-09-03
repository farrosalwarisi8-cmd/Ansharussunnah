// src/actions/mapel.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuru } from "@/lib/auth"
import { mapelSchema, type MapelFormValues } from "@/lib/validations/mapel"
import type { ActionResponse } from "@/types"
import { revalidatePath } from "next/cache"

// ========================================================
// 1. PUBLIC: DAFTAR MAPEL AKTIF
// ========================================================

export async function getMapelAktif(): Promise<
  ActionResponse<Array<{ id: string; kode: string; nama: string; kelompok: string | null }>>
> {
  try {
    const mapels = await prisma.mataPelajaran.findMany({
      where: { aktif: true },
      orderBy: { nama: "asc" },
      select: { id: true, kode: true, nama: true, kelompok: true },
    })

    return {
      success: true,
      message: "Daftar mata pelajaran berhasil diambil",
      data: mapels,
    }
  } catch {
    return {
      success: false,
      message: "Gagal memuat data mata pelajaran",
    }
  }
}

// ========================================================
// 2. ADMIN: CRUD MAPEL
// ========================================================

export async function getAdminMapelList(): Promise<
  ActionResponse<
    Array<{
      id: string
      kode: string
      nama: string
      kelompok: string | null
      aktif: boolean
      _count: {
        guruKelas: number
        ujian: number
        tugas: number
        materi: number
        nilaiRapor: number
      }
    }>
  >
> {
  try {
    await requireGuru()

    const mapels = await prisma.mataPelajaran.findMany({
      orderBy: { nama: "asc" },
      select: {
        id: true,
        kode: true,
        nama: true,
        kelompok: true,
        aktif: true,
        _count: {
          select: {
            guruKelas: true,
            ujian: true,
            tugas: true,
            materi: true,
            nilaiRapor: true,
          },
        },
      },
    })

    return {
      success: true,
      message: "Daftar mata pelajaran berhasil diambil",
      data: mapels,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat daftar mata pelajaran",
    }
  }
}

export async function createMapel(payload: MapelFormValues): Promise<ActionResponse> {
  try {
    await requireGuru()

    const validated = mapelSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data mata pelajaran tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { kode, nama, kelompok } = validated.data

    const existing = await prisma.mataPelajaran.findFirst({
      where: { OR: [{ kode }, { nama }] },
    })

    if (existing) {
      return {
        success: false,
        message:
          existing.kode === kode
            ? `Kode "${kode}" sudah digunakan`
            : `Nama "${nama}" sudah digunakan`,
      }
    }

    await prisma.mataPelajaran.create({
      data: {
        kode,
        nama,
        kelompok: kelompok || null,
        aktif: true,
      },
    })

    revalidatePath("/dashboard/mapel")

    return {
      success: true,
      message: `Mata pelajaran "${nama}" berhasil ditambahkan`,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menambahkan mata pelajaran",
    }
  }
}

export async function updateMapel(
  id: string,
  payload: Partial<MapelFormValues> & { aktif?: boolean }
): Promise<ActionResponse> {
  try {
    await requireGuru()

    const mapel = await prisma.mataPelajaran.findUnique({ where: { id } })
    if (!mapel) {
      return { success: false, message: "Mata pelajaran tidak ditemukan" }
    }

    if (payload.kode || payload.nama) {
      const duplicate = await prisma.mataPelajaran.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(payload.kode ? [{ kode: payload.kode }] : []),
            ...(payload.nama ? [{ nama: payload.nama }] : []),
          ],
        },
      })

      if (duplicate) {
        return {
          success: false,
          message:
            duplicate.kode === payload.kode
              ? `Kode "${payload.kode}" sudah digunakan`
              : `Nama "${payload.nama}" sudah digunakan`,
        }
      }
    }

    await prisma.mataPelajaran.update({
      where: { id },
      data: {
        kode: payload.kode,
        nama: payload.nama,
        kelompok: payload.kelompok !== undefined ? payload.kelompok ?? null : undefined,
        aktif: payload.aktif,
      },
    })

    revalidatePath("/dashboard/mapel")

    return {
      success: true,
      message: "Data mata pelajaran berhasil diperbarui",
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memperbarui mata pelajaran",
    }
  }
}

export async function deleteMapel(id: string): Promise<ActionResponse> {
  try {
    await requireGuru()

    const checkRelations = await prisma.mataPelajaran.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            guruKelas: true,
            ujian: true,
            tugas: true,
            materi: true,
            nilaiRapor: true,
          },
        },
      },
    })

    if (!checkRelations) {
      return { success: false, message: "Mata pelajaran tidak ditemukan" }
    }

    const totalUsed =
      checkRelations._count.guruKelas +
      checkRelations._count.ujian +
      checkRelations._count.tugas +
      checkRelations._count.materi +
      checkRelations._count.nilaiRapor

    if (totalUsed > 0) {
      return {
        success: false,
        message:
          "Tidak dapat menghapus mata pelajaran karena masih terhubung dengan data pengajar, ujian, tugas, materi, atau rapor",
      }
    }

    await prisma.mataPelajaran.delete({ where: { id } })

    revalidatePath("/dashboard/mapel")

    return {
      success: true,
      message: "Mata pelajaran berhasil dihapus",
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menghapus mata pelajaran",
    }
  }
}

export async function toggleMapelAktif(id: string): Promise<ActionResponse> {
  try {
    await requireGuru()

    const mapel = await prisma.mataPelajaran.findUnique({ where: { id } })
    if (!mapel) {
      return { success: false, message: "Mata pelajaran tidak ditemukan" }
    }

    await prisma.mataPelajaran.update({
      where: { id },
      data: { aktif: !mapel.aktif },
    })

    revalidatePath("/dashboard/mapel")

    return {
      success: true,
      message: `Mata pelajaran "${mapel.nama}" berhasil ${mapel.aktif ? "dinonaktifkan" : "diaktifkan"}`,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal mengubah status mata pelajaran",
    }
  }
}
