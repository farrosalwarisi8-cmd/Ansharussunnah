// src/actions/berkas-siswa.ts

"use server"

import prisma from "@/lib/prisma"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { validateFile, getSignedUrls } from "@/lib/storage"
import { requireGuruAdmin } from "@/lib/auth"
import { toUserFriendlyError } from "@/lib/prisma-error"
import type { ActionResponse } from "@/types"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"

// Ekstensi yang diizinkan (whitelist, dikombinasikan dengan magic bytes di
// validateFile).
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf"])

// Nama bucket & folder root. Path object dibuat server-side sepenuhnya.
const BERKAS_BUCKET = "berkas-siswa"
const BERKAS_FOLDER = "berkas-siswa"

// Kategori berkas tunggal → kolom di tabel siswas.
const KATEGORI_KOLOM = {
  kartuKeluarga: "dokKartuKeluarga",
  akteLahir: "dokAkteLahir",
  foto: "dokFoto",
} as const

type KategoriTunggal = keyof typeof KATEGORI_KOLOM

const KATEGORI_TUNGGAL = new Set<string>(Object.keys(KATEGORI_KOLOM))

const LABEL_KATEGORI: Record<string, string> = {
  kartuKeluarga: "Kartu Keluarga (KK)",
  akteLahir: "Akta Kelahiran",
  foto: "Pas Foto 3x4",
  lainnya: "Dokumen Lain",
}

function isKategoriValid(kategori: string): kategori is KategoriTunggal | "lainnya" {
  return KATEGORI_TUNGGAL.has(kategori) || kategori === "lainnya"
}

/**
 * Struktur data berkas siswa yang dikirim ke klien: biodata ringkas +
 * signed URL setiap dokumen (kartu keluarga, akta, foto, dan dokumen lain).
 */
export type BerkasSiswaData = {
  siswa: {
    id: string
    nama: string
    nisn: string | null
    nis: string | null
    jenisKelamin: "LAKI_LAKI" | "PEREMPUAN" | null
    kelasNama: string | null
    jenjangNama: string | null
    email: string
  }
  berkas: {
    kartuKeluarga: string | null
    akteLahir: string | null
    foto: string | null
    lainnya: Array<{ path: string; url: string | null }>
  }
}

/**
 * Mengambil detail biodata siswa + seluruh berkasnya beserta signed URL.
 * Hanya untuk guru admin (requireGuruAdmin).
 */
export async function getBerkasSiswa(
  siswaId: string
): Promise<ActionResponse<BerkasSiswaData>> {
  try {
    await requireGuruAdmin()

    if (!siswaId || typeof siswaId !== "string") {
      return { success: false, message: "ID siswa tidak valid" }
    }

    const siswa = await prisma.siswa.findUnique({
      where: { id: siswaId },
      include: {
        user: { select: { nama: true, email: true } },
        kelas: { select: { nama: true, jenjang: { select: { nama: true } } } },
      },
    })

    if (!siswa || siswa.deleted_at) {
      return { success: false, message: "Siswa tidak ditemukan" }
    }

    const paths = [
      siswa.dokKartuKeluarga,
      siswa.dokAkteLahir,
      siswa.dokFoto,
      ...siswa.dokLainnya,
    ].filter((p): p is string => typeof p === "string" && p.length > 0)

    const signedMap = await getSignedUrls(BERKAS_BUCKET, paths)

    const data: BerkasSiswaData = {
      siswa: {
        id: siswa.id,
        nama: siswa.user.nama,
        nisn: siswa.nisn,
        nis: siswa.nis,
        jenisKelamin: siswa.jenisKelamin,
        kelasNama: siswa.kelas?.nama ?? null,
        jenjangNama: siswa.kelas?.jenjang?.nama ?? null,
        email: siswa.user.email,
      },
      berkas: {
        kartuKeluarga: siswa.dokKartuKeluarga
          ? signedMap.get(siswa.dokKartuKeluarga) ?? null
          : null,
        akteLahir: siswa.dokAkteLahir
          ? signedMap.get(siswa.dokAkteLahir) ?? null
          : null,
        foto: siswa.dokFoto ? signedMap.get(siswa.dokFoto) ?? null : null,
        lainnya: siswa.dokLainnya.map((p) => ({
          path: p,
          url: signedMap.get(p) ?? null,
        })),
      },
    }

    return { success: true, message: "Berkas siswa berhasil dimuat", data }
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memuat berkas siswa"),
    }
  }
}

/**
 * Unggah/serganti satu berkas siswa (KK, akta, pas foto, atau dokumen lain).
 * File DIKIRIM ke server dan diunggah oleh server (service role) ke bucket
 * `berkas-siswa`; path ditentukan server dengan nanoid sehingga klien tidak
 * bisa memalsukan path/bucket (anti path traversal & bucket injection).
 * File lama yang diganti dibersihkan best-effort.
 */
export async function uploadBerkasSiswa(
  siswaId: string,
  kategori: string,
  formData: FormData
): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()

    if (!siswaId || typeof siswaId !== "string") {
      return { success: false, message: "ID siswa tidak valid" }
    }
    if (!isKategoriValid(kategori)) {
      return { success: false, message: "Jenis berkas tidak valid" }
    }

    const file = formData.get("file") as File | null
    if (!file || file.size === 0) {
      return { success: false, message: "Pilih berkas untuk diunggah" }
    }

    const validation = await validateFile(file)
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error || "Berkas yang diunggah tidak valid",
      }
    }

    const fileExt = (file.name.split(".").pop() || "").toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(fileExt)) {
      return {
        success: false,
        message: "Format berkas tidak valid (gunakan JPG, PNG, WEBP, atau PDF)",
      }
    }

    const siswa = await prisma.siswa.findUnique({ where: { id: siswaId } })
    if (!siswa || siswa.deleted_at) {
      return { success: false, message: "Siswa tidak ditemukan" }
    }

    const supabaseAdmin = createSupabaseAdmin()
    const generatedName = `${nanoid(12)}.${fileExt}`
    const filePath = `${BERKAS_FOLDER}/${siswa.id}/${kategori}/${generatedName}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BERKAS_BUCKET)
      .upload(filePath, arrayBuffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      })

    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      return {
        success: false,
        message:
          "Gagal mengunggah berkas. Pastikan format dan ukuran file sesuai (maks. 5 MB).",
      }
    }

    const isLainnya = kategori === "lainnya"
    const kolom = isLainnya ? null : KATEGORI_KOLOM[kategori as KategoriTunggal]
    const oldPath =
      kolom && typeof siswa[kolom] === "string" ? (siswa[kolom] as string) : null

    try {
      if (isLainnya) {
        await prisma.siswa.update({
          where: { id: siswa.id },
          data: { dokLainnya: { push: [filePath] } },
        })
      } else {
        const updateData: Record<string, string> = {}
        updateData[kolom as string] = filePath
        await prisma.siswa.update({
          where: { id: siswa.id },
          data: updateData,
        })
      }
    } catch (dbError) {
      // Bersihkan file baru agar tidak menjadi file yatim.
      await supabaseAdmin.storage
        .from(BERKAS_BUCKET)
        .remove([filePath])
        .catch(() => {})
      throw dbError
    }

    // Best-effort: hapus berkas lama yang diganti (kategori tunggal saja).
    if (oldPath && oldPath !== filePath) {
      await supabaseAdmin.storage
        .from(BERKAS_BUCKET)
        .remove([oldPath])
        .catch(() => {})
    }

    revalidatePath("/dashboard/siswa")

    return {
      success: true,
      message: `${LABEL_KATEGORI[kategori]} berhasil diunggah`,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal mengunggah berkas siswa"),
    }
  }
}

/**
 * Menghapus berkas siswa. Untuk kategori tunggal (KK/akta/foto) kolom
 * dikosongkan; untuk "lainnya" hanya path yang dikirim yang dihapus dari
 * daftar. File di storage dibersihkan best-effort.
 */
export async function hapusBerkasSiswa(
  siswaId: string,
  kategori: string,
  path?: string
): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()

    if (!siswaId || typeof siswaId !== "string") {
      return { success: false, message: "ID siswa tidak valid" }
    }
    if (!isKategoriValid(kategori)) {
      return { success: false, message: "Jenis berkas tidak valid" }
    }

    const siswa = await prisma.siswa.findUnique({ where: { id: siswaId } })
    if (!siswa || siswa.deleted_at) {
      return { success: false, message: "Siswa tidak ditemukan" }
    }

    let pathToRemove: string | null = null

    if (kategori === "lainnya") {
      if (!path || !siswa.dokLainnya.includes(path)) {
        return { success: false, message: "Berkas tidak ditemukan" }
      }
      pathToRemove = path
      await prisma.siswa.update({
        where: { id: siswa.id },
        data: {
          dokLainnya: {
            set: siswa.dokLainnya.filter((p) => p !== path),
          },
        },
      })
    } else {
      const kolom = KATEGORI_KOLOM[kategori as KategoriTunggal]
      pathToRemove =
        typeof siswa[kolom] === "string" ? (siswa[kolom] as string) : null
      const updateData: Record<string, string | null> = {}
      updateData[kolom] = null
      await prisma.siswa.update({
        where: { id: siswa.id },
        data: updateData,
      })
    }

    if (pathToRemove) {
      const supabaseAdmin = createSupabaseAdmin()
      await supabaseAdmin.storage
        .from(BERKAS_BUCKET)
        .remove([pathToRemove])
        .catch(() => {})
    }

    revalidatePath("/dashboard/siswa")

    return { success: true, message: `${LABEL_KATEGORI[kategori]} berhasil dihapus` }
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal menghapus berkas siswa"),
    }
  }
}
