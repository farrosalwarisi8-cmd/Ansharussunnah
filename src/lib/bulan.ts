// src/lib/bulan.ts

// Konvensi nilai `bulan` pada rapor:
// 0  = Rapor Akhir Semester (rapor besar mencakup seluruh periode)
// 1-12 = Rapor Bulanan (Januari s.d. Desember)
export const BULAN_AKHIR_SEMESTER = 0

export const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
]

/** Konversi angka bulan (1-12) ke nama bulan Indonesia. */
export function namaBulan(angka: number): string {
  if (angka < 1 || angka > 12) return ""
  return NAMA_BULAN[angka - 1]
}

/** Label jenis rapor berdasarkan nilai `bulan`. 0 = akhir semester, 1-12 = bulanan. */
export function labelJenisRapor(bulan: number): string {
  if (bulan === BULAN_AKHIR_SEMESTER) return "Rapor Akhir Semester"
  const nama = namaBulan(bulan)
  return nama ? `Rapor Bulanan - ${nama}` : "Rapor"
}

/**
 * Rentang tanggal kalender untuk satu bulan tertentu pada tahun tertentu
 * (timezone lokal). Dipakai untuk memfilter ujian/tugas/absensi per bulan.
 */
export function rentangBulan(
  bulan: number,
  tahun: number
): { gte: Date; lt: Date } {
  const gte = new Date(tahun, bulan - 1, 1, 0, 0, 0, 0)
  const lt = new Date(tahun, bulan, 1, 0, 0, 0, 0)
  return { gte, lt }
}