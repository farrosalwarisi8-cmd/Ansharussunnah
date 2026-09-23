// src/lib/cache.ts
// Lapisan cache Redis (Upstash) untuk data referensi yang sering dibaca dan
// jarang berubah (periode ajaran, daftar kelas, daftar mapel, jenjang).
//
// Desain:
// - FAIL-OPEN: kalau Redis tidak dikonfigurasi/down, semua pemanggilan
//   fallback langsung ke `fetcher` (DB) dan app tetap berjalan normal.
// - Read path: GET key → hit? parse & balas. Miss? jalankan fetcher, simpan
//   dengan TTL, lalu kembalikan hasil.
// - Write path: action yang mengubah domain tersebut memanggil
//   `invalidateCache(prefix)` agar request berikutnya refetch dari DB.
//
// Hasil "null" yang sah (mis. belum ada periode aktif) ikut di-cache,
// sehingga DB tidak ditanya berulang-ulang demi jawaban yang sama.

import { Redis } from "@upstash/redis"

const CACHE_KEY_PREFIX = "cache:"

export const CACHE_TTL_REF = 300

let redisInstance: Redis | null | undefined

/**
 * KEAMANAN: segment key dinamis (mis. dari payload request) disaring dulu —
 * hanya karakter alfanumerik, "-", "_", ":", "." yang boleh masuk. Ini
 * mencegah key injection/collision antar bucket cache via input klien.
 */
function sanitizeKeySegment(value: string): string {
  return value.replace(/[^A-Za-z0-9:._-]/g, "")
}

function buildFullKey(key: string): string {
  return `${CACHE_KEY_PREFIX}${sanitizeKeySegment(key)}`
}

function getRedis(): Redis | null {
  if (redisInstance !== undefined) return redisInstance
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  redisInstance = url && token ? new Redis({ url, token }) : null
  return redisInstance
}

/**
 * Ambil data dari cache bila ada; bila tidak, jalankan `fetcher`, simpan
 * hasilnya dengan TTL, dan kembalikan hasil tersebut.
 */
export async function cachedJson<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const redis = getRedis()
  if (!redis) return fetcher()

  const fullKey = buildFullKey(key)

  let parsed: T | undefined

  try {
    const cached = await redis.get<string | T | null>(fullKey)
    if (cached !== null) {
      // SDK Upstash otomatis deserialize nilai yang tampak seperti JSON,
      // jadi saat runtime nilainya bisa berupa object/array (bukan string).
      // Terima kedua bentuk: object langsung pakai, string di-parse manual.
      parsed = (typeof cached === "string" ? JSON.parse(cached) : cached) as T
    }
  } catch (error) {
    // Value rusak/asing (mis. ditulis klien eksternal ke Redis) → anggap miss.
    console.warn("[cache] read miss-fallback (Redis):", error)
  }

  if (parsed !== undefined) return parsed

  const value = await fetcher()
  if (value === undefined) return value

  try {
    await redis.set(fullKey, JSON.stringify(value), { ex: ttlSeconds })
  } catch (error) {
    console.warn("[cache] write failed (Redis):", error)
  }

  return value
}

/**
 * Hapus semua key cache yang diawali prefix tertentu (contoh: "ref:kelas").
 * Fail-open: error Redis diabaikan, data akan kedaluwarsa sendiri oleh TTL.
 */
export async function invalidateCache(prefix: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    const keys = await redis.keys(`${buildFullKey(prefix)}*`)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (error) {
    console.warn("[cache] invalidation failed (Redis):", error)
  }
}