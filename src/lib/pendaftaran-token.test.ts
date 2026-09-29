// src/lib/pendaftaran-token.test.ts

import { describe, it, expect } from "vitest"
import {
  isPendaftaranTokenValid,
  isTokenAksesBentukValid,
  hashTokenAkses,
  hitungTokenAksesExpiraAt,
  isTokenAksesBelumKedaluwarsa,
  TOKEN_AKSES_MASA_BERLAKU_MS,
  RE_TOKEN_AKSES,
} from "@/lib/pendaftaran-token"

const HARI = 24 * 60 * 60 * 1000

describe("isTokenAksesBentukValid", () => {
  it("menerima token nanoid 32 karakter", () => {
    expect(isTokenAksesBentukValid("71W2jdYzzAV0FR0DUUPXD2X1seYJfY4Z")).toBe(true)
  })

  it("menolak token dengan karakter di luar whitelisted", () => {
    expect(isTokenAksesBentukValid("token-dengan-simbol@")).toBe(false)
    expect(isTokenAksesBentukValid("cnbc://token-snippet")).toBe(false)
  })

  it("menolak token terlalu pendek", () => {
    expect(isTokenAksesBentukValid("pendek")).toBe(false)
  })

  it("menolak string kosong", () => {
    expect(isTokenAksesBentukValid("")).toBe(false)
  })
})

describe("isPendaftaranTokenValid", () => {
  // Nilai di bawah adalah SHA-256 dari token di sebelah, dihitung di luar kode
  // produksi. Mengunci format hex agar tetap sama dengan backfill SQL
  // encode(sha256(convert_to(token,'UTF8')),'hex') di migrasi 20260928010000.
  const TOKEN = "71W2jdYzzAV0FR0DUUPXD2X1seYJfY4Z"
  const TOKEN_HASH =
    "cee95955952f3e496e503a0ae8ceb0cc459befc9be187928b7e7d4ff75a28c73"

  it("hashTokenAkses menghasilkan SHA-256 hex lowercase yang cocok dengan backfill SQL", () => {
    expect(hashTokenAkses(TOKEN)).toBe(TOKEN_HASH)
    expect(hashTokenAkses(TOKEN)).toMatch(/^[0-9a-f]{64}$/)
  })

  it("menerima token yang cocok", () => {
    expect(isPendaftaranTokenValid(TOKEN_HASH, TOKEN)).toBe(true)
  })

  it("menolak token yang berbeda", () => {
    expect(
      isPendaftaranTokenValid(TOKEN_HASH, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
    ).toBe(false)
  })

  it("menolak ketika salah satu sisi kosong", () => {
    expect(isPendaftaranTokenValid(null, TOKEN)).toBe(false)
    expect(isPendaftaranTokenValid(TOKEN_HASH, null)).toBe(false)
    expect(isPendaftaranTokenValid(undefined, undefined)).toBe(false)
  })

  it("fail-closed bila hash tersimpan bukan 64 hex (baris rusak / belum di-backfill)", () => {
    expect(isPendaftaranTokenValid("abc", TOKEN)).toBe(false)
    expect(isPendaftaranTokenValid(TOKEN, TOKEN)).toBe(false)
  })
})

describe("hashTokenAkses", () => {
  it("bersifat deterministik dan spesifik input", () => {
    expect(hashTokenAkses("token-a")).toBe(hashTokenAkses("token-a"))
    expect(hashTokenAkses("token-a")).not.toBe(hashTokenAkses("token-b"))
  })

  it("tidak pernah mengembalikan inputnya sendiri", () => {
    const token = "71W2jdYzzAV0FR0DUUPXD2X1seYJfY4Z"
    expect(hashTokenAkses(token)).not.toBe(token)
    expect(hashTokenAkses(token)).not.toContain(token)
  })
})

describe("hitungTokenAksesExpiraAt", () => {
  it("menambah 90 hari ke waktu pendaftaran dibuat", () => {
    const dibuat = new Date("2026-01-01T00:00:00.000Z")
    const expira = hitungTokenAksesExpiraAt(dibuat)

    expect(expira.toISOString()).toBe("2026-04-01T00:00:00.000Z")
  })

  it("memakai waktu sekarang sebagai default", () => {
    const sebelum = Date.now()
    const expira = hitungTokenAksesExpiraAt()
    const sesudah = Date.now()

    expect(expira.getTime()).toBeGreaterThanOrEqual(sebelum + TOKEN_AKSES_MASA_BERLAKU_MS)
    expect(expira.getTime()).toBeLessThanOrEqual(sesudah + TOKEN_AKSES_MASA_BERLAKU_MS)
  })

  it("memakai masa berlaku tepat 90 hari", () => {
    expect(TOKEN_AKSES_MASA_BERLAKU_MS).toBe(90 * HARI)
  })

  it("tidak mengubah objek Date asal", () => {
    const dibuat = new Date("2026-01-01T00:00:00.000Z")
    hitungTokenAksesExpiraAt(dibuat)
    expect(dibuat.toISOString()).toBe("2026-01-01T00:00:00.000Z")
  })
})

describe("isTokenAksesBelumKedaluwarsa", () => {
  const sekarang = new Date("2026-06-01T00:00:00.000Z")

  it("benar saat expiry masih di masa depan", () => {
    expect(isTokenAksesBelumKedaluwarsa(new Date("2026-06-01T00:00:01.000Z"), sekarang)).toBe(true)
  })

  it("benar tepat sampai batas akhir (belum lewat)", () => {
    expect(isTokenAksesBelumKedaluwarsa(new Date("2026-06-01T00:00:00.000Z"), sekarang)).toBe(false)
  })

  it("salah saat expiry sudah lewat", () => {
    expect(isTokenAksesBelumKedaluwarsa(new Date("2026-05-31T23:59:59.000Z"), sekarang)).toBe(false)
  })

  it("fail-closed: expiry NULL dianggap kedaluwarsa", () => {
    expect(isTokenAksesBelumKedaluwarsa(null, sekarang)).toBe(false)
  })

  it("fail-closed: expiry undefined dianggap kedaluwarsa", () => {
    expect(isTokenAksesBelumKedaluwarsa(undefined, sekarang)).toBe(false)
  })

  it("konsisten dengan hitungTokenAksesExpiraAt untuk pendaftaran hari ini", () => {
    const dibuat = new Date("2026-01-01T00:00:00.000Z")
    const expira = hitungTokenAksesExpiraAt(dibuat)
    // 121 hari setelah dibuat → sudah lewat 90 hari
    const setelah121Hari = new Date(dibuat.getTime() + 121 * HARI)
    expect(isTokenAksesBelumKedaluwarsa(expira, setelah121Hari)).toBe(false)
    // 89 hari setelah dibuat → masih berlaku
    const setelah89Hari = new Date(dibuat.getTime() + 89 * HARI)
    expect(isTokenAksesBelumKedaluwarsa(expira, setelah89Hari)).toBe(true)
  })
})

describe("RE_TOKEN_AKSES", () => {
  it("menolak bentuk berbahaya (path traversal / url)", () => {
    expect(RE_TOKEN_AKSES.test("../../etc/passwd")).toBe(false)
    expect(RE_TOKEN_AKSES.test("https://evil.example/x")).toBe(false)
  })
})
