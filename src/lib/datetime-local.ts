// src/lib/datetime-local.ts

/**
 * Helper untuk mengisi value input `type="datetime-local"` (format
 * "YYYY-MM-DDTHH:mm") dari nilai ISO string / Date hasil server.
 *
 * Input datetime-local menampilkan waktu sesuai zona waktu lokal perangkat,
 * dan nilai string-nya di-parse sebagai waktu LOKAL oleh browser. Karena itu
 * kita TIDAK boleh memakai `date.toISOString().slice(0, 16)` — itu memakai
 * UTC sehingga jam bergeser sesuai offset zona waktu (mis. bergeser 7 jam
 * untuk WIB). Fungsi ini mengkonversi instan waktu ke waktu lokal terlebih
 * dahulu lalu memformatnya dalam bentuk yang diterima datetime-local.
 */
export function toDatetimeLocalValue(
  value: string | Date | null | undefined
): string {
  if (value === null || value === undefined || value === "") return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const offsetMs = date.getTimezoneOffset() * 60000
  const localDate = new Date(date.getTime() - offsetMs)
  return localDate.toISOString().slice(0, 16)
}

/**
 * Variasi untuk input `type="date"` (format "YYYY-MM-DD").
 * Mengambil tanggal kalender LOKAL dari instan waktu yang diberikan
 * (bukan tanggal UTC), sehingga tanggal tidak bergeser satu hari.
 */
export function toDateLocalValue(
  value: string | Date | null | undefined
): string {
  return toDatetimeLocalValue(value).slice(0, 10)
}