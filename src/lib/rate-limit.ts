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
  private ratelimit: RatelimitInstance | null = null

  private async getRatelimit(options: RateLimitOptions): Promise<RatelimitInstance> {
    if (!this.ratelimit) {
      const { Ratelimit } = await import("@upstash/ratelimit")
      const { Redis } = await import("@upstash/redis")

      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })

      this.ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(
          options.maxRequests,
          `${options.windowMs} ms`
        ),
        analytics: false,
      })
    }
    return this.ratelimit
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
 */
export async function rateLimitAsync(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  return rateLimiterInstance.limit(identifier, options)
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip") || "unknown"
}

export async function getClientIpFromHeaders(): Promise<string> {
  try {
    const headersList = await headers()
    const forwarded = headersList.get("x-forwarded-for")
    if (forwarded) return forwarded.split(",")[0].trim()
    return headersList.get("x-real-ip") || "unknown"
  } catch {
    return "unknown"
  }
}