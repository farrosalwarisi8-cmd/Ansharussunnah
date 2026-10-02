// src/lib/validations/external-url.test.ts
//
// Test kebijakan allowlist URL eksternal (Pilihan B):
//   - drive.google.com / docs.google.com (dan subdomain) diterima,
//   - domain arbitrary ditolak,
//   - protokol non-https (http, javascript:, data:, vbscript:) ditolak,
//   - kredensial (user:pass@) ditolak,
//   - path traversal ditolak,
//   - URL yang lolos dinormalisasi (tanpa fragment/userinfo).

import { describe, it, expect } from "vitest"
import { validasiUrlEksternal } from "./external-url"

describe("validasiUrlEksternal — allowlist domain", () => {
  it("menerima drive.google.com dengan https", () => {
    const result = validasiUrlEksternal(
      "https://drive.google.com/file/d/abc123/view"
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.normalized).toBe(
        "https://drive.google.com/file/d/abc123/view"
      )
    }
  })

  it("menerima docs.google.com dengan query string", () => {
    const result = validasiUrlEksternal(
      "https://docs.google.com/forms/d/e/x/viewform?usp=sf_link"
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.normalized).toBe(
        "https://docs.google.com/forms/d/e/x/viewform?usp=sf_link"
      )
    }
  })

  it("menerima subdomain dari host yang diizinkan", () => {
    const result = validasiUrlEksternal("https://drive.google.com.a.example/")
    // Bukan subdomain drive.google.com — host berbeda → ditolak.
    expect(result.ok).toBe(false)

    const sub = validasiUrlEksternal("https://docs.google.com.evil.com/")
    expect(sub.ok).toBe(false)
  })

  it("menolak domain arbitrary", () => {
    for (const url of [
      "https://example.com/bukti.jpg",
      "https://drive.example.com/bukti.jpg",
      "https://evil.com/phishing",
      "https://googledrive.com/fake",
    ]) {
      const result = validasiUrlEksternal(url)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toMatch(/tidak diizinkan/i)
    }
  })
})

describe("validasiUrlEksternal — protokol", () => {
  it("menolak http://", () => {
    const result = validasiUrlEksternal("http://drive.google.com/file/d/x")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/https/i)
  })

  it("menolak javascript: dan data: (XSS via URL)", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ]) {
      const result = validasiUrlEksternal(url)
      expect(result.ok).toBe(false)
    }
  })

  it("menolak URL yang tidak bisa di-parse", () => {
    const result = validasiUrlEksternal("bukan url sama sekali")
    expect(result.ok).toBe(false)
  })
})

describe("validasiUrlEksternal — kredensial & traversal", () => {
  it("menolak URL dengan username/password tersembunyi", () => {
    const result = validasiUrlEksternal(
      "https://user:pass@drive.google.com/file/d/x"
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/kredensial/i)
  })

  it("menolak path traversal pada URL eksternal", () => {
    const result = validasiUrlEksternal(
      "https://drive.google.com/file/../../etc/passwd"
    )
    expect(result.ok).toBe(false)
  })
})

describe("validasiUrlEksternal — normalisasi", () => {
  it("membuang fragment dan userinfo saat menormalisasi", () => {
    const result = validasiUrlEksternal(
      "https://drive.google.com/file/d/abc/view?usp=sharing#frag"
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.normalized).toBe(
        "https://drive.google.com/file/d/abc/view?usp=sharing"
      )
      expect(result.normalized).not.toContain("#")
    }
  })

  it("hostname case-insensitive", () => {
    const result = validasiUrlEksternal(
      "https://DRIVE.GOOGLE.COM/file/d/abc/view"
    )
    expect(result.ok).toBe(true)
  })
})
