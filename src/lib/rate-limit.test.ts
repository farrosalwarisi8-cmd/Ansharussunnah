// src/lib/rate-limit.test.ts
// Mengunci perilaku rate limiter untuk identitas "unknown":
// saat IP klien tidak bisa ditentukan, SEMUA pengguna berbagi satu bucket,
// sehingga menerapkan batas ketat di sana akan memblokir seluruh pengunjung.
// Bucket "unknown" harus SELALU lolos.

import { describe, it, expect } from "vitest"
import { rateLimitAsync, rateLimit } from "@/lib/rate-limit"

describe("rateLimitAsync — identitas unknown", () => {
  it("harus selalu lolos walau batas sudah 0 untuk bucket unknown (shared)", async () => {
    const options = { maxRequests: 1, windowMs: 10 * 60 * 1000 }
    // Panggil berkali-kali — jika dihitung sebagai bucket biasa, panggilan
    // kedua akan sukses: false. Dengan guard unknown, semua harus lolos.
    for (let i = 0; i < 5; i++) {
      const result = await rateLimitAsync("create-pendaftaran:unknown", options)
      expect(result.success).toBe(true)
    }
  })

  it("harus selalu lolos untuk identifier dengan awalan berbeda", async () => {
    const options = { maxRequests: 1, windowMs: 60 * 1000 }
    for (let i = 0; i < 5; i++) {
      const result = await rateLimitAsync("cek-pendaftaran:unknown", options)
      expect(result.success).toBe(true)
    }
  })
})

describe("rateLimit (deprecated) — identitas unknown", () => {
  it("harus selalu lolos untuk bucket unknown", () => {
    const options = { maxRequests: 1, windowMs: 60 * 1000 }
    for (let i = 0; i < 5; i++) {
      const result = rateLimit("create-pendaftaran:unknown", options)
      expect(result.success).toBe(true)
    }
  })
})