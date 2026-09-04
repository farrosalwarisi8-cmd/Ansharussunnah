// src/actions/mapel.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuru } from "@/lib/auth"
import { mapelSchema, type MapelFormValues } from "@/lib/validations/mapel"
import type { ActionResponse } from "@/types"
import { revalidatePath } from "next/cache"

async function validateKelasIds(jenjangId: string | null | undefined, kelasIds: string[]) {
  const uniqueKelasIds = [...new Set(kelasIds)]
  if (uniqueKelasIds.length === 0) return null
  if (uniqueKelasIds.length !== kelasIds.length) return "Kelas tidak boleh dipilih lebih dari sekali"
  if (!jenjangId) return "Jenjang wajib dipilih jika kelas ditetapkan"

  const kelas = await prisma.kelas.findMany({
    where: { id: { in: uniqueKelasIds }, jenjangId, aktif: true },
    select: { id: true },
  })

  if (kelas.length !== uniqueKelasIds.length) {
    return "Kelas tidak valid atau tidak sesuai dengan jenjang yang dipilih"
  }

  return null
}

// ========================================================
// 1. PUBLIC: DAFTAR MAPEL AKTIF
// ========================================================

export async function getMapelAktif(): Promise<
  ActionResponse<Array<{ id: string; kode: string; nama: string; kelompok: string | null; jenjangId: string | null }>>
> {
  try {
    const mapels = await prisma.mataPelajaran.findMany({
      where: { aktif: true },
      orderBy: { nama: "asc" },
      select: { id: true, kode: true, nama: true, kelompok: true, jenjangId: true },
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
// 1b. PUBLIC: DAFTAR JENJANG AKTIF (untuk dropdown)
// ========================================================

export async function getJenjangList(): Promise<
  ActionResponse<Array<{ id: string; nama: string; urutan: number }>>
> {
  try {
    const jenjangs = await prisma.jenjang.findMany({
      where: { aktif: true },
      orderBy: { urutan: "asc" },
      select: { id: true, nama: true, urutan: true },
    })

    return {
      success: true,
      message: "Daftar jenjang berhasil diambil",
      data: jenjangs,
    }
  } catch {
    return {
      success: false,
      message: "Gagal memuat daftar jenjang",
    }
  }
}

// ========================================================
// 1c. PUBLIC: DAFTAR KELAS BERDASARKAN JENJANG (untuk multi-select)
// ========================================================

export async function getKelasByJenjang(jenjangId: string): Promise<
  ActionResponse<Array<{ id: string; nama: string }>>
> {
  try {
    const kelas = await prisma.kelas.findMany({
      where: { jenjangId, aktif: true },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true },
    })

    return {
      success: true,
      message: "Daftar kelas berhasil diambil",
      data: kelas,
    }
  } catch {
    return {
      success: false,
      message: "Gagal memuat daftar kelas",
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
      jenjangId: string | null
      jenjangNama: string | null
      aktif: boolean
      kelasList: Array<{ id: string; nama: string }>
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
        jenjangId: true,
        jenjang: { select: { nama: true } },
        aktif: true,
        mapelKelas: {
          select: {
            kelas: { select: { id: true, nama: true } },
          },
        },
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

    const data = mapels.map((m) => ({
      id: m.id,
      kode: m.kode,
      nama: m.nama,
      kelompok: m.kelompok,
      jenjangId: m.jenjangId,
      jenjangNama: m.jenjang?.nama ?? null,
      aktif: m.aktif,
      kelasList: m.mapelKelas.map((mk) => mk.kelas),
      _count: m._count,
    }))

    return {
      success: true,
      message: "Daftar mata pelajaran berhasil diambil",
      data,
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

    const { kode, nama, kelompok, jenjangId, kelasIds } = validated.data

    const kelasError = await validateKelasIds(jenjangId, kelasIds)
    if (kelasError) return { success: false, message: kelasError }

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
        jenjangId: jenjangId || null,
        aktif: true,
        mapelKelas: kelasIds && kelasIds.length > 0
          ? {
              create: kelasIds.map((kelasId) => ({ kelasId })),
            }
          : undefined,
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

    // Update mapelKelas (hapus semua lama, tambah yang baru)
    const kelasIds = payload.kelasIds
    const targetJenjangId = payload.jenjangId !== undefined ? payload.jenjangId : mapel.jenjangId
    if (
      payload.jenjangId !== undefined &&
      payload.jenjangId !== mapel.jenjangId &&
      kelasIds === undefined
    ) {
      return { success: false, message: "Kelas harus dipilih ulang saat jenjang diubah" }
    }

    if (kelasIds !== undefined) {
      const kelasError = await validateKelasIds(targetJenjangId, kelasIds)
      if (kelasError) return { success: false, message: kelasError }
    }

    if (kelasIds !== undefined) {
      await prisma.$transaction(async (tx) => {
        await tx.mapelKelas.deleteMany({ where: { mapelId: id } })
        if (kelasIds.length > 0) {
          await tx.mapelKelas.createMany({
            data: [...new Set(kelasIds)].map((kelasId) => ({ mapelId: id, kelasId })),
          })
        }
        await tx.mataPelajaran.update({
          where: { id },
          data: {
            kode: payload.kode,
            nama: payload.nama,
            kelompok: payload.kelompok !== undefined ? payload.kelompok ?? null : undefined,
            jenjangId: payload.jenjangId !== undefined ? payload.jenjangId ?? null : undefined,
            aktif: payload.aktif,
          },
        })
      })
    } else {
      await prisma.mataPelajaran.update({
        where: { id },
        data: {
          kode: payload.kode,
          nama: payload.nama,
          kelompok: payload.kelompok !== undefined ? payload.kelompok ?? null : undefined,
          jenjangId: payload.jenjangId !== undefined ? payload.jenjangId ?? null : undefined,
          aktif: payload.aktif,
        },
      })
    }

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
            mapelKelas: true,
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
      checkRelations._count.mapelKelas +
      checkRelations._count.ujian +
      checkRelations._count.tugas +
      checkRelations._count.materi +
      checkRelations._count.nilaiRapor

    if (totalUsed > 0) {
      return {
        success: false,
        message:
          "Tidak dapat menghapus mata pelajaran karena masih terhubung dengan data pengajar, kelas, ujian, tugas, materi, atau rapor",
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
