// src/lib/pendaftaran-token-client.ts
"use client"

// Penyimpanan token akses pendaftaran di sessionStorage (per-tab, tidak
// bertahan antar sesi) supaya halaman upload & sukses bisa memakainya tanpa
// menaruh token rahasia di URL. Token juga bisa diketik manual oleh pemilik
// yang menyimpannya sendiri.

const KEY_PREFIX = "pdaf-token:"

export function getTokenAkses(nomor: string): string {
  try {
    return window.sessionStorage.getItem(`${KEY_PREFIX}${nomor}`) ?? ""
  } catch {
    return ""
  }
}

export function setTokenAkses(nomor: string, token: string): void {
  try {
    window.sessionStorage.setItem(`${KEY_PREFIX}${nomor}`, token)
  } catch {
    // sessionStorage tidak tersedia (mode privat/lainnya) — tutup rapat
  }
}