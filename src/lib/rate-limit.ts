// src/lib/rate-limit.ts

import { headers } from "next/headers"

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

export interface RateLimitOptions {
  maxRequests: number
  windowMs: number
}

export interface RateLimiterBackend {
  limit(identifier: string, options: RateLimitOptions): Promise<RateLimitResult>
}

// --- UPSTASH REDIS BACKEND (PRODUCTION) ---
interface RatelimitInstance {
  limit(identifier: string): Promise<{ success: boolean; remaining: number; reset: number }>
}

class UpstashRateLimiter implements RateLimiterBackend {
  // Keyed per konfigurasi (maxRequests:windowMs) agar setiap alur memakai
  // batasnya sendiri, tidak saling menumpuk dengan alur yang pertama dimuat.
  private ratelimits = new Map<string, RatelimitInstance>()

  private async getRatelimit(options: RateLimitOptions): Promise<RatelimitInstance> {
    const key = `${options.maxRequests}:${options.windowMs}`
    const cached = this.ratelimits.get(key)
    if (cached) return cached

    const { Ratelimit } = await import("@upstash/ratelimit")
    const { Redis } = await import("@upstash/redis")

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })

    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        options.maxRequests,
        `${options.windowMs} ms`
      ),
      analytics: false,
    })
    this.ratelimits.set(key, ratelimit)
    return ratelimit
  }

  async limit(
    identifier: string,
    options: RateLimitOptions
  ): Promise<RateLimitResult> {
    const ratelimit = await this.getRatelimit(options)
    const result = await ratelimit.limit(identifier)
    return {
      success: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    }
  }
}

// --- IN-MEMORY BACKEND (LOCAL FALLBACK) ---
interface InMemoryEntry {
  count: number
  resetAt: number
}

class InMemoryRateLimiter implements RateLimiterBackend {
  private store = new Map<string, InMemoryEntry>()

  constructor() {
    setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.store.entries()) {
        if (now > entry.resetAt) this.store.delete(key)
      }
    }, 5 * 60 * 1000).unref()
  }

  async limit(
    identifier: string,
    options: RateLimitOptions
  ): Promise<RateLimitResult> {
    const now = Date.now()
    const entry = this.store.get(identifier)

    if (!entry || now > entry.resetAt) {
      const resetAt = now + options.windowMs
      this.store.set(identifier, { count: 1, resetAt })
      return { success: true, remaining: options.maxRequests - 1, resetAt }
    }

    if (entry.count >= options.maxRequests) {
      return { success: false, remaining: 0, resetAt: entry.resetAt }
    }

    entry.count++
    return {
      success: true,
      remaining: options.maxRequests - entry.count,
      resetAt: entry.resetAt,
    }
  }
}

const localMemoryStore = new Map<string, InMemoryEntry>()

function createRateLimiter(): RateLimiterBackend {
  const hasUpstash =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN

  if (hasUpstash) {
    return new UpstashRateLimiter()
  }
  return new InMemoryRateLimiter()
}

const rateLimiterInstance = createRateLimiter()

// --- PUBLIC INTEGRATED EXPORTS ---

/**
 * @deprecated Gunakan rateLimitAsync() untuk production. Fungsi ini hanya pakai in-memory
 * yang TIDAK konsisten antara instance serverless di Vercel.
 */
export function rateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  if (identifier.endsWith(":unknown")) {
    return {
      success: true,
      remaining: options.maxRequests,
      resetAt: Date.now() + options.windowMs,
    }
  }
  const now = Date.now()
  const entry = localMemoryStore.get(identifier)

  if (!entry || now > entry.resetAt) {
    const resetAt = now + options.windowMs
    localMemoryStore.set(identifier, { count: 1, resetAt })
    return { success: true, remaining: options.maxRequests - 1, resetAt }
  }

  if (entry.count >= options.maxRequests) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return {
    success: true,
    remaining: options.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Async rate limit mendukung Upstash Redis (untuk Route Handler/Vercel Serverless).
 *
 * ⚠️ Identitas "unknown": saat IP klien TIDAK bisa ditentukan (header proxy tidak
 * tersedia, mis. Server Action di sebagian environment), semua pengguna jatuh ke
 * SATU bucket bersama `:unknown`. Menerapkan batas ketat di bucket ini berarti
 * setelah beberapa request, SELURUH pengunjung ikut terblokir — bukan hanya
 * penyalahguna. Karena kita tidak bisa membedakan pengguna, memblokir semua orang
 * lebih buruk daripada risiko spam yang dicegah, jadi bucket "unknown" dilewati
 * (tidak di-rate-limit) daripada dijadikan batas bersama.
 */
export async function rateLimitAsync(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  if (identifier.endsWith(":unknown")) {
    return {
      success: true,
      remaining: options.maxRequests,
      resetAt: Date.now() + options.windowMs,
    }
  }
  return rateLimiterInstance.limit(identifier, options)
}

// ---------------------------------------------------------------------------
// IP ADDRESS EXTRACTION (anti-spoofing)
// ---------------------------------------------------------------------------
// Klien sebenarnya BISA mengirim header `x-forwarded-for` palsu. Di balik proxy
// tepercaya (mis. Vercel Edge), IP asli klien selalu DITAMBAHKAN di AKHIR chain
// (nilai paling kanan). Maka:
//   1. Ambil nilai PALING KANAN dari x-forwarded-for (bukan yang paling kiri).
//   2. Validasi berupa IP valid (v4/v6). Jika tidak valid → fallback lain.
//   3. Jika tetap tidak bisa ditentukan, kembalikan "unknown" (bucket bersama,
//      konservatif — hanya dipakai saat header benar-benar tidak tersedia).

const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/
const IPV6_RE =
  /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/

function isValidIp(value: string): boolean {
  return IPV4_RE.test(value) || IPV6_RE.test(value)
}

function extractClientIpFromHeaders(
  forwarded: string | null,
  realIp: string | null
): string {
  if (forwarded) {
    // Ambil dari paling kanan: di chain yang benar, elemen paling kanan adalah
    // yang ditambahkan oleh proxy terdekat (tepercaya). Elemen kiri bisa
    // dipalsukan langsung oleh klien.
    const parts = forwarded
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .reverse()
    const trusted = parts.find(isValidIp)
    if (trusted) return trusted
  }

  if (realIp && isValidIp(realIp)) return realIp

  return "unknown"
}

export function getClientIp(request: Request): string {
  return extractClientIpFromHeaders(
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip")
  )
}

export async function getClientIpFromHeaders(): Promise<string> {
  try {
    const headersList = await headers()
    return extractClientIpFromHeaders(
      headersList.get("x-forwarded-for"),
      headersList.get("x-real-ip")
    )
  } catch {
    return "unknown"
  }
}