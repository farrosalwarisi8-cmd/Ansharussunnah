// src/actions/materi.ts

"use server"

import prisma from "@/lib/prisma"
import { requireRole } from "@/lib/auth"
import { verifyGuruAksesKelas, getMapelIdYangDiajarDiKelas } from "@/lib/guru-auth"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { getSignedUrls, isExternalUrl } from "@/lib/storage"
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
      targetGender,
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

    // Validasi kecocokan gender mapel dengan target gender materi
    if (mapel.jenisKelamin && targetGender && mapel.jenisKelamin !== targetGender) {
      const labelMapel = mapel.jenisKelamin === "LAKI_LAKI" ? "khusus Ikhwan" : "khusus Akhwat"
      return {
        success: false,
        message: `Mata pelajaran "${mataPelajaran}" adalah mapel ${labelMapel}. Target gender materi tidak sesuai.`,
      }
    }

    // Bila mapel khusus gender & targetGender belum diisi, otomatis ikut gender mapel
    const effectiveTargetGender = mapel.jenisKelamin ?? targetGender ?? null

    const periode = await prisma.periodeAjaran.findUnique({
      where: { id: periodeAjaranId },
    })
    if (!periode) {
      return { success: false, message: "Periode ajaran tidak ditemukan" }
    }

    // Validasi path file jika ada urlFile
    // Dua bentuk diterima:
    //  1) Path storage internal -> `materi/{kelasId}/...` (diverifikasi di bucket)
    //  2) URL eksternal (Google Drive / cloud) -> `https://...` (diterima apa adanya)
    if (urlFile) {
      const expectedPrefix = `materi/${kelasId}/`
      const isInternalPath = urlFile.startsWith("materi/")
      const isExternalUrl = /^https?:\/\//i.test(urlFile)

      if (!isInternalPath && !isExternalUrl) {
        return { success: false, message: "Struktur lokasi berkas tidak valid" }
      }

      if (isInternalPath) {
        if (!urlFileCheck(urlFile, expectedPrefix)) {
          return { success: false, message: "Struktur lokasi berkas tidak valid" }
        }

        // Verifikasi file ada di Supabase Storage
        const supabaseAdmin = createSupabaseAdmin()
        const fileName = urlFile.split("/").pop()
        const { data: fileList, error: listError } = await supabaseAdmin.storage
          .from("materi")
          .list(`materi/${kelasId}`)

        if (listError) {
          console.error("Storage list error (materi):", listError)
          return { success: false, message: "Gagal memverifikasi berkas di storage." }
        }

        const fileExists = fileList?.some((f) => f.name === fileName)
        if (!fileExists) {
          return { success: false, message: "Berkas materi tidak ditemukan di server" }
        }
      }
    }

    const materi = await prisma.materiPembelajaran.create({
      data: {
        judul,
        deskripsi: deskripsi || null,
        mataPelajaranId: mapel.id,
        kelasId,
        targetGender: effectiveTargetGender,
        periodeAjaranId,
        urlFile: urlFile || null,
        urlLink: urlLink || null,
        diunggahOlehId: user.id,
      },
    })

    revalidatePath("/dashboard/materi")
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

    // Jika mataPelajaran diubah, cari ID baru
    let mataPelajaranId: string | undefined
    let mapelJenisKelamin: "LAKI_LAKI" | "PEREMPUAN" | null | undefined
    if (payload.mataPelajaran) {
      const mapel = await prisma.mataPelajaran.findFirst({ where: { nama: payload.mataPelajaran } })
      if (!mapel) {
        return { success: false, message: `Mata pelajaran "${payload.mataPelajaran}" tidak ditemukan` }
      }
      mataPelajaranId = mapel.id
      mapelJenisKelamin = mapel.jenisKelamin
    } else {
      const mapelSaatIni = await prisma.mataPelajaran.findUnique({
        where: { id: materi.mataPelajaranId },
        select: { jenisKelamin: true },
      })
      mapelJenisKelamin = mapelSaatIni?.jenisKelamin
    }

    // Validasi kecocokan gender mapel dengan target gender materi
    if (
      mapelJenisKelamin &&
      payload.targetGender &&
      mapelJenisKelamin !== payload.targetGender
    ) {
      const labelMapel = mapelJenisKelamin === "LAKI_LAKI" ? "khusus Ikhwan" : "khusus Akhwat"
      return {
        success: false,
        message: `Mata pelajaran tersebut adalah mapel ${labelMapel}. Target gender materi tidak sesuai.`,
      }
    }
    // Bila mapel khusus gender, target otomatis ikut gender mapel;
    // jika tidak, gunakan target dari payload (null = semua, boleh menghapus pilihan).
    const effectiveTargetGender =
      mapelJenisKelamin !== undefined && mapelJenisKelamin !== null
        ? mapelJenisKelamin
        : payload.targetGender !== undefined
          ? payload.targetGender
          : undefined

    // Verifikasi akses terhadap KELAS & MAPEL TUJUAN (setelah perubahan),
    // bukan hanya yang lama — mencegah guru memindahkan materi ke kelas/mapel
    // yang bukan wewenangnya.
    const targetKelasId = payload.kelasId ?? materi.kelasId
    const targetMapelId = mataPelajaranId ?? materi.mataPelajaranId
    await verifyGuruAksesKelas(targetKelasId, targetMapelId)

    // Validasi path file baru jika diubah (pakai kelas tujuan untuk prefix)
    if (payload.urlFile) {
      const expectedPrefix = `materi/${targetKelasId}/`
      const isInternalPath = payload.urlFile.startsWith("materi/")
      const isExternalUrl = /^https?:\/\//i.test(payload.urlFile)
      if (!isInternalPath && !isExternalUrl) {
        return { success: false, message: "Struktur lokasi berkas tidak valid" }
      }
      if (isInternalPath) {
        if (!urlFileCheck(payload.urlFile, expectedPrefix)) {
          return { success: false, message: "Struktur lokasi berkas tidak valid" }
        }

        // Verifikasi file ada di Supabase Storage
        const supabaseAdmin = createSupabaseAdmin()
        const fileName = payload.urlFile.split("/").pop()
        const { data: fileList, error: listError } = await supabaseAdmin.storage
          .from("materi")
          .list(`materi/${targetKelasId}`)

        if (listError) {
          console.error("Storage list error (materi):", listError)
          return { success: false, message: "Gagal memverifikasi berkas di storage." }
        }

        const fileExists = fileList?.some((f) => f.name === fileName)
        if (!fileExists) {
          return { success: false, message: "Berkas materi tidak ditemukan di server" }
        }
      }
    }

    await prisma.materiPembelajaran.update({
      where: { id: materiId },
      data: {
        judul: payload.judul,
        deskripsi: payload.deskripsi,
        mataPelajaranId,
        kelasId: payload.kelasId,
        targetGender: effectiveTargetGender,
        periodeAjaranId: payload.periodeAjaranId,
        urlFile: payload.urlFile !== undefined ? payload.urlFile : undefined,
        urlLink: payload.urlLink !== undefined ? payload.urlLink : undefined,
      },
    })

    revalidatePath("/dashboard/materi")
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

    // Best-effort: hapus file dari bucket jika materi menyimpan berkas internal.
    // Kegagalan di sini tidak menggagalkan penghapusan record di database.
    if (materi.urlFile && materi.urlFile.startsWith("materi/")) {
      try {
        const supabaseAdmin = createSupabaseAdmin()
        await supabaseAdmin.storage.from("materi").remove([materi.urlFile])
      } catch (storageError) {
        console.error("Storage cleanup error (deleteMateri):", storageError)
      }
    }

    revalidatePath("/dashboard/materi")
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

    const aksesMapel = await getMapelIdYangDiajarDiKelas(kelasId)
    if (aksesMapel !== "ALL" && aksesMapel.length === 0) {
      return {
        success: true,
        message: "Daftar materi kosong",
        data: [],
      }
    }

    const materiList = await prisma.materiPembelajaran.findMany({
      where: {
        kelasId,
        ...(aksesMapel !== "ALL" ? { mataPelajaranId: { in: aksesMapel } } : {}),
      },
      include: {
        periodeAjaran: { select: { nama: true } },
        diunggahOleh: { select: { nama: true } },
        mataPelajaran: { select: { nama: true, jenisKelamin: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    // Batch: ambil semua signed URL materi yang punya file dalam SATU panggilan API
    const urlFileList = materiList
      .map((m) => m.urlFile)
      .filter((u): u is string => !!u && !isExternalUrl(u))

    const signedUrlMap = await getSignedUrls("materi", urlFileList)

    const formatted = materiList.map((m) => {
      const signedUrl = m.urlFile ? signedUrlMap.get(m.urlFile) ?? null : null

      return {
        id: m.id,
        judul: m.judul,
        deskripsi: m.deskripsi,
        mataPelajaran: m.mataPelajaran.nama,
        targetGender: m.targetGender,
        mapelGender: m.mataPelajaran.jenisKelamin,
        urlFile: m.urlFile,
        urlLink: m.urlLink,
        signedUrl,
        periode: m.periodeAjaran.nama,
        diunggahOleh: m.diunggahOleh.nama,
        createdAt: m.createdAt,
      }
    })

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
      where: {
        kelasId: user.siswa.kelasId,
        AND: [
          {
            OR: [
              { targetGender: null },
              { targetGender: user.siswa.jenisKelamin },
            ],
          },
          {
            OR: [
              { mataPelajaran: { jenisKelamin: null } },
              { mataPelajaran: { jenisKelamin: user.siswa.jenisKelamin } },
            ],
          },
        ],
      },
      include: {
        periodeAjaran: { select: { nama: true } },
        diunggahOleh: { select: { nama: true } },
        mataPelajaran: { select: { nama: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    // Batch: ambil semua signed URL materi yang punya file dalam SATU panggilan API
    const urlFileList = materiList
      .map((m) => m.urlFile)
      .filter((u): u is string => !!u && !isExternalUrl(u))

    const signedUrlMap = await getSignedUrls("materi", urlFileList)

    const formatted = materiList.map((m) => {
      const signedUrl = m.urlFile ? signedUrlMap.get(m.urlFile) ?? null : null

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

    const siswa = await prisma.siswa.findUnique({ where: { id: siswaId, deleted_at: null } })
    if (!siswa || !siswa.kelasId) {
      return { success: false, message: "Data kelas siswa tidak valid" }
    }

    const materiList = await prisma.materiPembelajaran.findMany({
      where: {
        kelasId: siswa.kelasId,
        AND: [
          {
            OR: [
              { targetGender: null },
              { targetGender: siswa.jenisKelamin },
            ],
          },
          {
            OR: [
              { mataPelajaran: { jenisKelamin: null } },
              { mataPelajaran: { jenisKelamin: siswa.jenisKelamin } },
            ],
          },
        ],
      },
      include: {
        periodeAjaran: { select: { nama: true } },
        diunggahOleh: { select: { nama: true } },
        mataPelajaran: { select: { nama: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    // Batch: ambil semua signed URL materi yang punya file dalam SATU panggilan API
    const urlFileList = materiList
      .map((m) => m.urlFile)
      .filter((u): u is string => !!u && !isExternalUrl(u))

    const signedUrlMap = await getSignedUrls("materi", urlFileList)

    const formatted = materiList.map((m) => {
      const signedUrl = m.urlFile ? signedUrlMap.get(m.urlFile) ?? null : null

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
