// src/lib/salin-dokumen-pendaftaran.ts

import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { nanoid } from "nanoid"

const BUCKET_SUMBER = "dokumen-pendaftaran"
const BUCKET_TUJUAN = "berkas-siswa"
const FOLDER_TUJUAN = "berkas-siswa"

export type KategoriDokumen = "kartuKeluarga" | "akteLahir" | "foto" | "lainnya"

export type DokumenPendaftaran = {
  kartuKeluarga: string | null
  akteLahir: string | null
  foto: string | null
  lainnya: string[]
}

export type SalinDokumenResult = {
  // Hanya path TUJUAN (bucket berkas-siswa) yang berhasil dicopy. Null/array
  // kosong berarti "belum ada" — pemanggil harus menyimpan null agar wali bisa
  // mengunggah ulang dari dashboard, bukan menyimpan path dari bucket lain.
  kartuKeluarga: string | null
  akteLahir: string | null
  foto: string | null
  lainnya: string[]
  // Path tujuan yang berhasil dicopy, untuk dibersihkan bila update DB gagal.
  tersalin: string[]
  // Path sumber yang gagal dicopy (untuk logging).
  gagal: string[]
}

/**
 * Menyalin dokumen pendaftaran dari bucket `dokumen-pendaftaran` ke bucket
 * `berkas-siswa` supaya menyatu dengan berkas siswa yang dikelola admin.
 *
 * Format path tujuan mengikuti `uploadBerkasSiswa`:
 *   berkas-siswa/{siswaId}/{kategori}/{nanoid}.{ext}
 *
 * Best-effort per berkas: satu file yang gagal tidak menggagalkan sisanya, dan
 * berkas itu dilaporkan lewat `gagal` (di luar hasil sukses).
 */
export async function salinDokumenPendaftaranKeSiswa(
  siswaId: string,
  dokumen: DokumenPendaftaran
): Promise<SalinDokumenResult> {
  const hasil: SalinDokumenResult = {
    kartuKeluarga: null,
    akteLahir: null,
    foto: null,
    lainnya: [],
    tersalin: [],
    gagal: [],
  }

  if (!siswaId) return hasil

  const supabaseAdmin = createSupabaseAdmin()
  const sumber = supabaseAdmin.storage.from(BUCKET_SUMBER)
  const tujuan = supabaseAdmin.storage.from(BUCKET_TUJUAN)

  const tugas: Array<{ kategori: KategoriDokumen; path: string }> = []
  if (dokumen.kartuKeluarga) tugas.push({ kategori: "kartuKeluarga", path: dokumen.kartuKeluarga })
  if (dokumen.akteLahir) tugas.push({ kategori: "akteLahir", path: dokumen.akteLahir })
  if (dokumen.foto) tugas.push({ kategori: "foto", path: dokumen.foto })
  for (const path of dokumen.lainnya) tugas.push({ kategori: "lainnya", path })

  for (const { kategori, path } of tugas) {
    const hasilCopy = await copySatuBerkas(sumber, tujuan, path, siswaId, kategori)
    if (!hasilCopy) {
      hasil.gagal.push(path)
      continue
    }

    hasil.tersalin.push(hasilCopy)

    if (kategori === "lainnya") {
      hasil.lainnya.push(hasilCopy)
    } else {
      hasil[kategori] = hasilCopy
    }
  }

  return hasil
}

type BucketApi = ReturnType<ReturnType<typeof createSupabaseAdmin>["storage"]["from"]>

/**
 * Supabase Storage tidak punya "copy antar bucket" di REST API publik, jadi
 * file dibaca lalu diunggah ulang ke bucket tujuan dengan service role.
 * Nama file baru memakai nanoid supaya tidak menimpa berkas lain.
 */
async function copySatuBerkas(
  sumber: BucketApi,
  tujuan: BucketApi,
  path: string,
  siswaId: string,
  kategori: KategoriDokumen
): Promise<string | null> {
  const filePath = `${FOLDER_TUJUAN}/${siswaId}/${kategori}/${nanoid(12)}.${ekstensiDari(path)}`

  try {
    const { data, error: downloadError } = await sumber.download(path)
    if (downloadError || !data) {
      console.error("Gagal mengunduh dokumen pendaftaran untuk disalin:", downloadError)
      return null
    }

    const buffer = await data.arrayBuffer()
    const { error: uploadError } = await tujuan.upload(filePath, buffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: data.type || undefined,
    })

    if (uploadError) {
      console.error("Gagal menyalin dokumen pendaftaran:", uploadError)
      return null
    }

    return filePath
  } catch (error) {
    console.error("Gagal menyalin dokumen pendaftaran:", error)
    return null
  }
}

function ekstensiDari(path: string): string {
  const cocok = /\.([A-Za-z0-9]{1,8})$/.exec(path)
  const ext = cocok?.[1]?.toLowerCase() ?? ""
  return /^(jpg|jpeg|png|webp|pdf)$/.test(ext) ? ext : "pdf"
}
