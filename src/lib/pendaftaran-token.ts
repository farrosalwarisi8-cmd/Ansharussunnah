// src/lib/pendaftaran-token.ts

import { createHash, timingSafeEqual } from "crypto";

// Token akses pendaftaran dihasilkan server (nanoid 32 — alphanumeric + "-" dan
// "_" secara default). Regex dipakai untuk validasi bentuk input dari klien.
export const RE_TOKEN_AKSES = /^[A-Za-z0-9_-]{16,64}$/;

export function isTokenAksesBentukValid(value: string): boolean {
  return RE_TOKEN_AKSES.test(value);
}

/**
 * Hash token akses untuk disimpan di database.
 *
 * SHA-256 (bukan bcrypt/argon2) disengaja: token adalah nanoid 32 karakter
 * acak (~192 bit entropy), jadi mustahil di-brute force dan tidak berguna
 * melawan rainbow table. Hash lambat hanya dibutuhkan untuk secret berenti dua
 * pilihan seperti password.
 *
 * Formatnya harus identik dengan backfill SQL di migrasi
 * `20260928010000_hash_token_akses`:
 *   encode(sha256(convert_to(x,'UTF8')),'hex')  ==  digest("hex")
 */
export function hashTokenAkses(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Verifikasi token yang diberikan klien terhadap hash yang tersimpan.
 *
 * Kolom yang dibandingkan SELALU panjang tetap (64 hex), sehingga
 * timingSafeEqual bisa dipakai tanpa pre-check panjang yang membocorkan apa pun.
 * Hash NULL/format salah diperlakukan sebagai tidak valid (fail-closed).
 */
export function isPendaftaranTokenValid(
  storedHash: string | null | undefined,
  provided: string | null | undefined,
): boolean {
  if (!storedHash || !provided) return false;
  if (storedHash.length !== HASH_LENGTH) return false;
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(hashTokenAkses(provided), "hex");
  return timingSafeEqual(a, b);
}

const HASH_LENGTH = 64; // panjang hex SHA-256

// Masa berlaku token akses: 90 hari sejak pendaftaran dibuat.
const TOKEN_AKSES_MASA_BERLAKU_HARI = 90;

export const TOKEN_AKSES_MASA_BERLAKU_MS =
  TOKEN_AKSES_MASA_BERLAKU_HARI * 24 * 60 * 60 * 1000;

/**
 * Menghitung batas akhir token akses dari waktu pendaftaran dibuat.
 * Dipakai saat pendaftaran dibuat dan saat token diterbitkan ulang.
 */
export function hitungTokenAksesExpiraAt(dibuatPada: Date = new Date()): Date {
  return new Date(dibuatPada.getTime() + TOKEN_AKSES_MASA_BERLAKU_MS);
}

/**
 * Apakah token akses masih dalam masa berlaku.
 *
 * NULL diperlakukan sebagai KEDALUWARSA (fail-closed): kolom expiry selalu
 * diisi saat pendaftaran dibuat dan oleh backfill migrasi, jadi NULL hanya
 * terjadi bila ada baris rusak — dan itu tidak boleh tetap bisa diunggah.
 */
export function isTokenAksesBelumKedaluwarsa(
  expiraAt: Date | null | undefined,
  sekarang: Date = new Date(),
): boolean {
  if (!expiraAt) return false;
  return expiraAt.getTime() > sekarang.getTime();
}
