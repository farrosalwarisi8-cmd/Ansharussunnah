// src/lib/biaya-ppdb.ts
//
// Sumber kebenaran default biaya PPDB per komponen & identitas rekening tujuan.
// Dipakai bersama oleh server actions, halaman publik, dan panel admin, jadi
// TIDAK boleh meng-import modul server-only (prisma, next/headers, dsb).
//
// Prinsip data:
// - Kolom biaya di tabel `jenjangs` boleh NULL → berarti pakai DEFAULT di bawah.
// - Admin dapat mengubah nilai per jenjang lewat /dashboard/biaya-ppdb.
// - Saat pendaftaran dibuat, ketiga komponen biaya di-snapshot ke record
//   pendaftaran sehingga perubahan tarif tidak memengaruhi pendaftaran lama.

export const BIAYA_PPDB_DEFAULT = {
  // Biaya administrasi pendaftaran: MI (Ibtidaiyyah) 75rb, jenjang di atasnya 100rb.
  pendaftaran: 75_000,
  // Uang gedung: jenjang masuk MI & MTs 600rb, Aliyah 1jt, Mahad Aly tidak ada (0).
  uangGedung: 600_000,
  // Sarana prasarana: 250rb (Mahad Aly tidak ada → 0).
  sarpras: 250_000,
} as const

export const REKENING_PPDB_DEFAULT = {
  bankNama: "BRI",
  bankNoRekening: "321301015889536",
  bankAtasNama: "Sadiman",
  kontakWa: "6285702854133",
  namaKontakWa: "Ust. Abu Wafidah",
} as const

export type BiayaPPDB = {
  biayaPendaftaran: number
  biayaUangGedung: number
  biayaSarpras: number
}

/** Total yang HARUS ditransfer calon santri (kebalikan manipulasi sisi klien). */
export function totalBiayaPPDB(biaya: BiayaPPDB): number {
  return biaya.biayaPendaftaran + biaya.biayaUangGedung + biaya.biayaSarpras
}

/**
 * Resolve biaya sebuah jenjang: kolom NULL → fallback default berdasarkan
 * nama jenjang (idempotent terhadap urutan seed).
 */
export function resolveBiayaJenjang(
  namaJenjang: string,
  kolom: {
    biayaPendaftaranPPDB: number | string | null | undefined
    biayaUangGedung: number | string | null | undefined
    biayaSarpras: number | string | null | undefined
  }
): BiayaPPDB {
  return {
    biayaPendaftaran:
      parseDecimal(kolom.biayaPendaftaranPPDB) ??
      defaultPendaftaranByNama(namaJenjang),
    biayaUangGedung:
      parseDecimal(kolom.biayaUangGedung) ?? defaultGedungSarprasByNama(namaJenjang).uangGedung,
    biayaSarpras:
      parseDecimal(kolom.biayaSarpras) ?? defaultGedungSarprasByNama(namaJenjang).sarpras,
  }
}

/** Nilai default komponen pendaftaran untuk jenjang tertentu. */
export function defaultPendaftaranByNama(namaJenjang: string): number {
  // MI 75rb; MTs (Mutawasithah) ke atas — Aliyah, Mahad Aly, Kuliah — 100rb.
  return /aliyah|aly|kuliah|mahad|mutawasithah/i.test(namaJenjang)
    ? 100_000
    : BIAYA_PPDB_DEFAULT.pendaftaran // MI
}

/** Nilai default uang gedung & sarpras untuk jenjang tertentu. */
export function defaultGedungSarprasByNama(namaJenjang: string): {
  uangGedung: number
  sarpras: number
} {
  if (/kuliah|mahad|aly/i.test(namaJenjang)) {
    // Mahad Aly / Kuliah: tanpa uang gedung & sarpras.
    return { uangGedung: 0, sarpras: 0 }
  }
  if (/aliyah/i.test(namaJenjang)) {
    // Aliyah: uang gedung 1jt, sarpras 250rb.
    return { uangGedung: 1_000_000, sarpras: BIAYA_PPDB_DEFAULT.sarpras }
  }
  // MI & MTs (Mutawasithah): uang gedung 600rb, sarpras 250rb.
  return { uangGedung: BIAYA_PPDB_DEFAULT.uangGedung, sarpras: BIAYA_PPDB_DEFAULT.sarpras }
}

/** Parse Decimal/number/string → number, null bila tidak valid (agar fallback jalan). */
function parseDecimal(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Format rupiah ringkas (id-ID). */
export function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n)
}
