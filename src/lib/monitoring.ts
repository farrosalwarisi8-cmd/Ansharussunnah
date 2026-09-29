// src/lib/monitoring.ts
//
// Jembatan monitoring server-side ke Sentry (@sentry/nextjs, sudah ada di
// package.json). Tujuan utamanya: error cache Redis yang FAIL-OPEN (app tetap
// jalan via DB) tetap terlihat di production — tanpa modul ini error hanya
// jadi console.warn yang tidak ada yang pantau.
//
// Desain throttle:
// - Event cache error biasanya beruntun (Redis down beberapa menit → ratusan
//   request). Tanpa throttle, kuota event Sentry gratis habis dalam hitungan
//   menit untuk satu insiden yang sama.
// - Default: maksimal 1 event per fingerprint per 5 menit. Fingerprint =
//   operasi + key/prefix, jadi insiden pada key berbeda tetap terlapor.
// - Lama throttle dipengaruhi env CACHE_ERROR_THROTTLE_SECONDS (opsional),
//   mis. untuk mengencangkan saat insiden berlangsung.
// - Eksport `resetCacheErrorThrottle` untuk test.

import * as Sentry from "@sentry/nextjs"

const DEFAULT_THROTTLE_SECONDS = 300

let throttleSeconds: number | null = null

function getThrottleSeconds(): number {
  if (throttleSeconds === null) {
    const raw = process.env.CACHE_ERROR_THROTTLE_SECONDS
    const parsed = raw ? parseInt(raw, 10) : NaN
    throttleSeconds =
      !isNaN(parsed) && parsed > 0 ? parsed : DEFAULT_THROTTLE_SECONDS
  }
  return throttleSeconds
}

const lastReportedAt = new Map<string, number>()

export type CacheErrorOperation = "read" | "write" | "invalidation"

/**
 * Laporkan error cache ke Sentry (tanpa pernah melempar error — fail-open).
 * Di-throttle per fingerprint `operasi:key` agar satu insiden tidak menghabiskan
 * kuota event. No-op otomatis bila Sentry belum dikonfigurasi (DSN kosong),
 * karena getSentry() mengembalikan proxy yang aman dipanggil.
 */
export function reportCacheError(
  operation: CacheErrorOperation,
  key: string,
  error: unknown
): void {
  try {
    const now = Date.now()
    const fingerprint = `${operation}:${key}`
    const last = lastReportedAt.get(fingerprint) ?? 0
    if (now - last < getThrottleSeconds() * 1000) return

    lastReportedAt.set(fingerprint, now)

    Sentry.captureMessage(`[cache] ${operation} gagal (Redis): ${key}`, {
      level: "warning",
      extra: {
        operation,
        key,
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : undefined,
      },
    })
  } catch {
    // Monitoring tidak boleh pernah membuat request gagal.
  }
}

/** Hanya untuk test: bersihkan state throttle. */
export function resetCacheErrorThrottle(): void {
  lastReportedAt.clear()
  throttleSeconds = null
}
