// src/actions/materi.ts

"use server"

import prisma from "@/lib/prisma"
import { requireRole } from "@/lib/auth"
import { verifyGuruAksesKelas } from "@/lib/guru-auth"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { getSignedUrl } from "@/lib/storage"
import {
  createMateriSchema,
  updateMateriSchema,
  type CreateMateriValues,
  type UpdateMateriValues,
} from "@/lib/validations/materi"
import type { ActionResponse } from "@/types"
import { Role } from "@prisma/client"
import { revalidatePath } from "next/cache"

// ========================================================
// HELPER: Validasi relasi Orang Tua → Siswa
// ========================================================

async function verifyOrangTuaAksesSiswa(
  orangTuaId: string,
  siswaId: string
): Promise<boolean> {
  const relasi = await prisma.parentStudent.findFirst({
    where: { orangTuaId, siswaId },
  })
  return !!relasi
}

// ========================================================
// HELPER: Validasi path file & pencegahan path traversal
// ========================================================

function urlFileCheck(url: string, prefix: string): boolean {
  return url.startsWith(prefix) && !url.includes("..") && !url.includes("//")
}

// ========================================================
// 1. ACTIONS GURU: CRUD MATERI PEMBELAJARAN
// ========================================================

/**
 * Guru upload materi baru untuk kelas tertentu.
 * Validasi akses kelas + mata pelajaran via verifyGuruAksesKelas.
 */
export async function createMateri(
  payload: CreateMateriValues
): Promise<ActionResponse<{ materiId: string }>> {
  try {
    const validated = createMateriSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data materi tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const {
      judul,
      deskripsi,
      mataPelajaran,
      kelasId,
      periodeAjaranId,
      urlFile,
      urlLink,
    } = validated.data

    const { user } = await verifyGuruAksesKelas(kelasId, mataPelajaran)

    // Cari mata pelajaran berdasarkan nama
    const mapel = await prisma.mataPelajaran.findFirst({ where: { nama: mataPelajaran } })
    if (!mapel) {
      return { success: false, message: `Mata pelajaran "${mataPelajaran}" tidak ditemukan` }
    }

    const periode = await prisma.periodeAjaran.findUnique({
      where: { id: periodeAjaranId },
    })
    if (!periode) {
      return { success: false, message: "Periode ajaran tidak ditemukan" }
    }

    // Validasi path file jika ada urlFile
    if (urlFile) {
      const expectedPrefix = `materi/${kelasId}/`
      if (!urlFileCheck(urlFile, expectedPrefix)) {
        return { success: false, message: "Struktur lokasi berkas tidak valid" }
      }

      // Verifikasi file ada di Supabase Storage
      const supabaseAdmin = createSupabaseAdmin()
      const fileName = urlFile.split("/").pop()
      const { data: fileList } = await supabaseAdmin.storage
        .from("materi")
        .list(`materi/${kelasId}`)

      const fileExists = fileList?.some((f) => f.name === fileName)
      if (!fileExists) {
        return { success: false, message: "Berkas materi tidak ditemukan di server" }
      }
    }

    const materi = await prisma.materiPembelajaran.create({
      data: {
        judul,
        deskripsi: deskripsi || null,
        mataPelajaranId: mapel.id,
        kelasId,
        periodeAjaranId,
        urlFile: urlFile || null,
        urlLink: urlLink || null,
        diunggahOlehId: user.id,
      },
    })

    revalidatePath("/dashboard/guru/materi")
    return {
      success: true,
      message: "Materi pembelajaran berhasil diunggah",
      data: { materiId: materi.id },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal mengunggah materi",
    }
  }
}

/**
 * Update data materi yang sudah ada.
 */
export async function updateMateri(
  materiId: string,
  payload: UpdateMateriValues
): Promise<ActionResponse> {
  try {
    const validated = updateMateriSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data update materi tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const materi = await prisma.materiPembelajaran.findUnique({
      where: { id: materiId },
    })
    if (!materi) {
      return { success: false, message: "Materi tidak ditemukan" }
    }

    await verifyGuruAksesKelas(materi.kelasId, materi.mataPelajaranId)

    // Validasi path file baru jika diubah
    if (payload.urlFile) {
      const expectedPrefix = `materi/${materi.kelasId}/`
      if (!urlFileCheck(payload.urlFile, expectedPrefix)) {
        return { success: false, message: "Struktur lokasi berkas tidak valid" }
      }
    }

    // Jika mataPelajaran diubah, cari ID baru
    let mataPelajaranId: string | undefined
    if (payload.mataPelajaran) {
      const mapel = await prisma.mataPelajaran.findFirst({ where: { nama: payload.mataPelajaran } })
      if (!mapel) {
        return { success: false, message: `Mata pelajaran "${payload.mataPelajaran}" tidak ditemukan` }
      }
      mataPelajaranId = mapel.id
    }

    await prisma.materiPembelajaran.update({
      where: { id: materiId },
      data: {
        judul: payload.judul,
        deskripsi: payload.deskripsi,
        mataPelajaranId,
        kelasId: payload.kelasId,
        periodeAjaranId: payload.periodeAjaranId,
        urlFile: payload.urlFile !== undefined ? payload.urlFile : undefined,
        urlLink: payload.urlLink !== undefined ? payload.urlLink : undefined,
      },
    })

    revalidatePath("/dashboard/guru/materi")
    return { success: true, message: "Materi berhasil diperbarui" }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memperbarui materi",
    }
  }
}

/**
 * Hapus materi pembelajaran.
 */
export async function deleteMateri(materiId: string): Promise<ActionResponse> {
  try {
    const materi = await prisma.materiPembelajaran.findUnique({
      where: { id: materiId },
    })
    if (!materi) {
      return { success: false, message: "Materi tidak ditemukan" }
    }

    await verifyGuruAksesKelas(materi.kelasId, materi.mataPelajaranId)

    await prisma.materiPembelajaran.delete({ where: { id: materiId } })

    revalidatePath("/dashboard/guru/materi")
    return { success: true, message: "Materi berhasil dihapus" }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menghapus materi",
    }
  }
}

// ========================================================
// 2. ACTIONS GURU: LIHAT DAFTAR MATERI PER KELAS
// ========================================================

/**
 * Guru melihat semua materi yang dia upload di kelas tertentu.
 */
export async function getDaftarMateriGuru(
  kelasId: string
): Promise<ActionResponse> {
  try {
    await verifyGuruAksesKelas(kelasId)

    const materiList = await prisma.materiPembelajaran.findMany({
      where: { kelasId },
      include: {
        periodeAjaran: { select: { nama: true } },
        diunggahOleh: { select: { nama: true } },
        mataPelajaran: { select: { nama: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const formatted = await Promise.all(
      materiList.map(async (m) => {
        let signedUrl: string | null = null
        if (m.urlFile) {
          signedUrl = await getSignedUrl("materi", m.urlFile)
        }

        return {
          id: m.id,
          judul: m.judul,
          deskripsi: m.deskripsi,
          mataPelajaran: m.mataPelajaran.nama,
          urlFile: m.urlFile,
          urlLink: m.urlLink,
          signedUrl,
          periode: m.periodeAjaran.nama,
          diunggahOleh: m.diunggahOleh.nama,
          createdAt: m.createdAt,
        }
      })
    )

    return {
      success: true,
      message: "Daftar materi berhasil dimuat",
      data: formatted,
    }  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat daftar materi",
    }
  }
}

// ========================================================


// 3. ACTIONS SISWA: LIHAT DAFTAR MATERI (Read-Only)
// ========================================================

/**
 * Siswa melihat semua materi di kelasnya sendiri.
 * siswaId diambil dari session, bukan dari input client.
 */
export async function getDaftarMateriSiswa(): Promise<ActionResponse> {
  try {
    const user = await requireRole([Role.SISWA])
    if (!user.siswa || !user.siswa.kelasId) {
      return { success: false, message: "Siswa belum terdaftar di kelas aktif" }
    }

    const materiList = await prisma.materiPembelajaran.findMany({
      where: { kelasId: user.siswa.kelasId },
      include: {
        periodeAjaran: { select: { nama: true } },
        diunggahOleh: { select: { nama: true } },
        mataPelajaran: { select: { nama: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const formatted = await Promise.all(
      materiList.map(async (m) => {
        let signedUrl: string | null = null
        if (m.urlFile) {
          signedUrl = await getSignedUrl("materi", m.urlFile)
        }

        return {
          id: m.id,
          judul: m.judul,
          deskripsi: m.deskripsi,
          mataPelajaran: m.mataPelajaran.nama,
          urlFile: m.urlFile,
          urlLink: m.urlLink,
          signedUrl,
          periode: m.periodeAjaran.nama,
          diunggahOleh: m.diunggahOleh.nama,
          createdAt: m.createdAt,
        }
      })
    )

    return {
      success: true,
      message: "Daftar materi berhasil dimuat",
      data: formatted,
    }  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat daftar materi",
    }
  }
}

// ========================================================


// 4. ACTIONS ORANG TUA: LIHAT DAFTAR MATERI ANAK (Read-Only)
// ========================================================

/**
 * Orang tua melihat materi anaknya.
 * Validasi relasi ParentStudent.
 */
export async function getDaftarMateriAnak(
  siswaId: string
): Promise<ActionResponse> {
  try {
    const user = await requireRole([Role.ORANG_TUA])
    if (!user.orangTua) {
      return { success: false, message: "Data orang tua tidak ditemukan" }
    }

    // Validasi relasi orang tua → siswa
    const hasAkses = await verifyOrangTuaAksesSiswa(user.orangTua.id, siswaId)
    if (!hasAkses) {
      return {
        success: false,
        message: "Akses ditolak: Siswa ini bukan anak Anda",
      }
    }

    const siswa = await prisma.siswa.findUnique({ where: { id: siswaId } })
    if (!siswa || !siswa.kelasId) {
      return { success: false, message: "Data kelas siswa tidak valid" }
    }

    const materiList = await prisma.materiPembelajaran.findMany({
      where: { kelasId: siswa.kelasId },
      include: {
        periodeAjaran: { select: { nama: true } },
        diunggahOleh: { select: { nama: true } },
        mataPelajaran: { select: { nama: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const formatted = await Promise.all(
      materiList.map(async (m) => {
        let signedUrl: string | null = null
        if (m.urlFile) {
          signedUrl = await getSignedUrl("materi", m.urlFile)
        }

        return {
          id: m.id,
          judul: m.judul,
          deskripsi: m.deskripsi,
          mataPelajaran: m.mataPelajaran.nama,
          urlFile: m.urlFile,
          urlLink: m.urlLink,
          signedUrl,
          periode: m.periodeAjaran.nama,
          diunggahOleh: m.diunggahOleh.nama,
          createdAt: m.createdAt,
        }
      })
    )

    return {
      success: true,
      message: "Daftar materi anak berhasil dimuat",
      data: formatted,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat daftar materi anak",
    }
  }
}
