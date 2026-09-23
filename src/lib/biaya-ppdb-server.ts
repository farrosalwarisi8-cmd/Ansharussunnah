// src/lib/biaya-ppdb-server.ts
//
// Lapisan akses data untuk pengaturan biaya PPDB (server-only).
//
// KECEPATAN: seluruh pembacaan di-cache via Redis (cachedJson) dengan TTL
// pendek sehingga halaman publik pendaftaran tidak memukul DB setiap request.
// Setiap perubahan lewat panel admin memanggil invalidateBiayaPPDBCache()
// agar perubahan harga langsung terlihat.
//
// KEAMANAN: penulisan hanya lewat server actions yang memverifikasi role
// admin (lihat src/actions/biaya-ppdb.ts). Modul ini hanya menyediakan read.

import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { cachedJson, invalidateCache, CACHE_TTL_REF } from "@/lib/cache"
import {
  REKENING_PPDB_DEFAULT,
  resolveBiayaJenjang,
  type BiayaPPDB,
} from "@/lib/biaya-ppdb"

const CACHE_KEY_PENGATURAN = "ref:ppdb:pengaturan"
const CACHE_KEY_BIAYA_JENJANG = "ref:ppdb:biaya-jenjang"

export type RekeningPPDB = {
  bankNama: string
  bankNoRekening: string
  bankAtasNama: string
  kontakWa: string
  namaKontakWa: string
}

type PengaturanRow = {
  bankNama: string
  bankNoRekening: string
  bankAtasNama: string
  kontakWa: string
  namaKontakWa: string
}

type BiayaJenjangRow = {
  id: string
  nama: string
  biayaPendaftaranPPDB: Prisma.Decimal | null
  biayaUangGedung: Prisma.Decimal | null
  biayaSarpras: Prisma.Decimal | null
}

/**
 * Ambil pengaturan rekening & kontak WA yang sedang berlaku.
 * Fail-open: jika tabel/DB bermasalah, kembalikan default agar halaman
 * pendaftaran tetap menampilkan instruksi pembayaran yang benar.
 */
export async function getPengaturanPPDB(): Promise<RekeningPPDB> {
  try {
    const row = await cachedJson<PengaturanRow | null>(
      CACHE_KEY_PENGATURAN,
      CACHE_TTL_REF,
      async () => {
        const r = await prisma.pengaturanPPDB.findUnique({ where: { id: 1 } })
        if (!r) return null
        return {
          bankNama: r.bankNama,
          bankNoRekening: r.bankNoRekening,
          bankAtasNama: r.bankAtasNama,
          kontakWa: r.kontakWa,
          namaKontakWa: r.namaKontakWa,
        }
      }
    )
    return row ?? { ...REKENING_PPDB_DEFAULT }
  } catch {
    return { ...REKENING_PPDB_DEFAULT }
  }
}

/**
 * Resolve biaya untuk satu jenjang (dipakai server action createPendaftaran).
 * Fallback ke default bila jenjang tidak ada di peta (mis. non-aktif).
 */
export function resolveBiayaFromMap(
  map: Record<string, BiayaPPDB>,
  jenjangId: string,
  namaJenjang: string
): BiayaPPDB {
  if (map[jenjangId]) return map[jenjangId]
  return resolveBiayaJenjang(namaJenjang, {
    biayaPendaftaranPPDB: null,
    biayaUangGedung: null,
    biayaSarpras: null,
  })
}

/**
 * Ambil peta biaya per jenjang (id → BiayaPPDB). NULL kolom di-resolve ke
 * default sesuai nama jenjang. Dipakai form pendaftaran & panel admin.
 */
export async function getBiayaPPDBPerJenjang(): Promise<
  Record<string, BiayaPPDB>
> {
  try {
    const rows = await cachedJson<BiayaJenjangRow[]>(
      CACHE_KEY_BIAYA_JENJANG,
      CACHE_TTL_REF,
      async () =>
        prisma.jenjang.findMany({
          where: { aktif: true },
          orderBy: { urutan: "asc" },
          select: {
            id: true,
            nama: true,
            biayaPendaftaranPPDB: true,
            biayaUangGedung: true,
            biayaSarpras: true,
          },
        })
    )

    const map: Record<string, BiayaPPDB> = {}
    for (const row of rows) {
      map[row.id] = resolveBiayaJenjang(row.nama, {
        biayaPendaftaranPPDB: row.biayaPendaftaranPPDB != null ? row.biayaPendaftaranPPDB.toString() : null,
        biayaUangGedung: row.biayaUangGedung != null ? row.biayaUangGedung.toString() : null,
        biayaSarpras: row.biayaSarpras != null ? row.biayaSarpras.toString() : null,
      })
    }
    return map
  } catch {
    return {}
  }
}

/** Hapus cache pengaturan PPDB — WAJIB dipanggil setelah admin mengubah nilai. */
export async function invalidateBiayaPPDBCache(): Promise<void> {
  await Promise.all([
    invalidateCache(CACHE_KEY_PENGATURAN),
    invalidateCache(CACHE_KEY_BIAYA_JENJANG),
  ])
}
