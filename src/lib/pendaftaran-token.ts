// src/lib/pendaftaran-token.ts

import { timingSafeEqual } from "crypto"

// Token akses pendaftaran dihasilkan server (nanoid 32 — alphanumeric + "-" dan
// "_" secara default). Regex dipakai untuk validasi bentuk input dari klien.
export const RE_TOKEN_AKSES = /^[A-Za-z0-9_-]{16,64}$/

export function isTokenAksesBentukValid(value: string): boolean {
  return RE_TOKEN_AKSES.test(value)
}

/**
 * Pembandingan token dengan timingSafeEqual agar isi/panjang tidak bisa
 * diukur lewat selisih waktu respons. Panjang token sudah tetap (32 char),
 * sehingga pre-check panjang tidak membocorkan apa pun yang bermanfaat.
 */
export function isPendaftaranTokenValid(
  stored: string | null | undefined,
  provided: string | null | undefined
): boolean {
  if (!stored || !provided) return false
  const a = Buffer.from(stored, "utf8")
  const b = Buffer.from(provided, "utf8")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}