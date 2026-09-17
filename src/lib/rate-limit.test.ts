// src/lib/rate-limit.test.ts
// Mengunci perilaku rate limiter untuk identitas "unknown" (FAIL-CLOSED):
// saat IP klien tidak bisa ditentukan, SEMUA pengguna berbagi satu bucket
// per rute. Mem-bypass bucket ini adalah celah enumerasi/brute-force, jadi
// bucket "unknown" TIDAK boleh diloloskan tanpa batas.

import { describe, it, expect } from "vitest"
import { rateLimitAsync, rateLimit } from "@/lib/rate-limit"

describe("rateLimitAsync — identitas unknown", () => {
  it("harus TERBATAS (tidak selalu lolos) walau identitas berakhiran :unknown", async () => {
    const options = { maxRequests: 1, windowMs: 10 * 60 * 1000 }
    const first = await rateLimitAsync("create-pendaftaran:unknown", options)
    expect(first.success).toBe(true)

    // Panggilan kedua dalam jendela yang sama harus DITOLAK (fail-closed).
    const second = await rateLimitAsync("create-pendaftaran:unknown", options)
    expect(second.success).toBe(false)
  })

  it("harus menerapkan batas per bucket :unknown (per rute)", async () => {
    const options = { maxRequests: 2, windowMs: 60 * 1000 }
    const results = []
    for (let i = 0; i < 4; i++) {
      results.push(
        (await rateLimitAsync("cek-pendaftaran:unknown", options)).success
      )
    }
    expect(results.filter((s) => s === true)).toHaveLength(2)
    expect(results.slice(2)).toEqual([false, false])
  })

  it("harus memisahkan bucket antar rute (awalan berbeda tidak saling menguras)", async () => {
    const options = { maxRequests: 1, windowMs: 60 * 1000 }
    // Kuras bucket rute A.
    await rateLimitAsync("upload-dokumen-pendaftaran:unknown", options)
    expect(
      (await rateLimitAsync("upload-dokumen-pendaftaran:unknown", options))
        .success
    ).toBe(false)

    // Rute B dengan identitas unknown tetap punya kuota sendiri.
    expect(
      (await rateLimitAsync("upload-bukti-transfer:unknown", options)).success
    ).toBe(true)
  })
})

describe("rateLimit (deprecated) — identitas unknown", () => {
  it("harus TERBATAS untuk bucket unknown (bukan dilewati)", () => {
    const options = { maxRequests: 1, windowMs: 60 * 1000 }
    expect(rateLimit("create-pendaftaran:unknown", options).success).toBe(true)
    expect(rateLimit("create-pendaftaran:unknown", options).success).toBe(false)
  })
})