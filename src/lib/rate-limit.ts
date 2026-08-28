// src/lib/rate-limit.ts

/**
 * Simple in-memory rate limiter per IP address.
 * Cocok untuk single-instance deployment.
 * Untuk production multi-instance, gunakan Redis/Upstash.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Bersihkan entry yang sudah expired setiap 5 menit
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

export function rateLimit(
  identifier: string,
  options: { maxRequests: number; windowMs: number }
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const key = identifier
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    // Window baru
    const resetAt = now + options.windowMs
    store.set(key, { count: 1, resetAt })
    return {
      success: true,
      remaining: options.maxRequests - 1,
      resetAt,
    }
  }

  if (entry.count >= options.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  entry.count++
  return {
    success: true,
    remaining: options.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Helper untuk mendapatkan IP dari NextRequest
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  return request.headers.get("x-real-ip") || "unknown"
}