// src/lib/ujian-label.ts
// Helper label untuk jenis ujian & penomoran tugas/ujian. Dipakai server
// (actions) dan klien (daftar guru), sehingga label tetap konsisten.

import type { JenisUjian } from "@prisma/client"

/** Label jenis ujian (ULANGAN_HARIAN / UTS / Ujian Semester). */
export function labelJenisUjian(
  jenisUjian?: string | JenisUjian | null
): string {
  switch (jenisUjian) {
    case "UJIAN_TENGAH_SEMESTER":
      return "Ujian Tengah Semester"
    case "UJIAN_SEMESTER":
      return "Ujian Semester"
    case "ULANGAN_HARIAN":
    default:
      return "Ulangan Harian"
  }
}

/** Label tugas bernomor ("Tugas 3"). Tanpa nomor → "Tugas". */
export function labelNomorTugas(nomor?: number | null): string {
  return nomor ? `Tugas ${nomor}` : "Tugas"
}

/**
 * Label ujian bernomor ("Ujian 4") untuk ULANGAN_HARIAN;
 * UTS/Ujian Semester memakai label jenisnya (tidak bernomor).
 */
export function labelNomorUjian(
  jenisUjian?: string | JenisUjian | null,
  nomor?: number | null
): string {
  if (jenisUjian === "UJIAN_TENGAH_SEMESTER") return "Ujian Tengah Semester"
  if (jenisUjian === "UJIAN_SEMESTER") return "Ujian Semester"
  return nomor ? `Ujian ${nomor}` : "Ujian"
}