// src/lib/datetime-local.test.ts

import { describe, it, expect } from "vitest"
import { toDatetimeLocalValue, toDateLocalValue } from "@/lib/datetime-local"

// Properti inti dari perbaikan ini: nilai yang dihasilkan harus di-parse oleh
// browser sebagai waktu LOKAL yang sama dengan instan aslinya (round-trip).
// Ini berlaku untuk semua zona waktu dan tidak bergantung pada mesin penjalan.
const roundTripKeInstanAsli = (iso: string) => {
  const hasil = toDatetimeLocalValue(iso)
  return new Date(hasil).toISOString()
}

describe("toDatetimeLocalValue", () => {
  it("harus mengembalikan string kosong untuk input kosong/null/tidak valid", () => {
    expect(toDatetimeLocalValue(null)).toBe("")
    expect(toDatetimeLocalValue(undefined)).toBe("")
    expect(toDatetimeLocalValue("")).toBe("")
    expect(toDatetimeLocalValue("tidak-valid")).toBe("")
  })

  it("konversi harus round-trip: nilai hasil jika di-parse sebagai waktu lokal = instan asli", () => {
    // Satu-satunya cara bug lama ("slice ISO UTC") bisa ternilai salah adalah
    // ketika hasil "T00:00" dipakai untuk edit. Round-trip membuktikan bahwa
    // kita mengembalikan instan yang sama persis.
    const kasus = [
      "2026-09-10T00:00:00.000Z",
      "2026-09-10T07:00:00.000Z",
      "2026-09-10T23:30:00.000Z",
      "2026-01-01T12:45:00.000Z",
      "2026-12-31T17:30:00.000Z",
    ]
    for (const iso of kasus) {
      expect(roundTripKeInstanAsli(iso)).toBe(new Date(iso).toISOString())
    }
  })

  it("harus mem-format YYYY-MM-DDTHH:mm (tanpa detik/detik pecahan)", () => {
    const hasil = toDatetimeLocalValue("2026-09-10T00:00:00.000Z")
    expect(hasil).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it("harus menerima objek Date", () => {
    const d = new Date("2026-09-10T01:30:00.000Z")
    expect(toDatetimeLocalValue(d)).toBe(
      toDatetimeLocalValue("2026-09-10T01:30:00.000Z")
    )
  })

  it("konsisten dengan ekspektasi WIB (UTC+7): 2026-09-10T00:00Z = 07:00 WIB", () => {
    const offsetMin = new Date("2026-09-10T00:00:00.000Z").getTimezoneOffset()
    if (offsetMin === -420) {
      // Hanya berlaku bila mesin penjalan tes berada di UTC+7 (WIB).
      expect(toDatetimeLocalValue("2026-09-10T00:00:00.000Z")).toBe("2026-09-10T07:00")
    } else {
      // Di zona lain nilai pasti berbeda dari slice UTC naif (atau sama jika offset 0).
      const naiveUtc = "2026-09-10T00:00"
      const hasil = toDatetimeLocalValue("2026-09-10T00:00:00.000Z")
      if (offsetMin === 0) {
        expect(hasil).toBe(naiveUtc)
      } else {
        expect(hasil).not.toBe(naiveUtc)
      }
    }
  })
})

describe("toDateLocalValue", () => {
  it("harus mengembalikan hanya komponen tanggal (YYYY-MM-DD)", () => {
    const hasil = toDateLocalValue(new Date("2026-09-10T02:00:00.000Z"))
    expect(hasil).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("tanggal hasil harus konsisten dengan datetime-local (slice 10 pertama)", () => {
    for (const iso of [
      "2026-09-10T00:00:00.000Z",
      "2026-12-31T17:30:00.000Z",
      "2026-01-01T12:45:00.000Z",
    ]) {
      expect(toDateLocalValue(iso)).toBe(toDatetimeLocalValue(iso).slice(0, 10))
    }
  })

  it("harus mengembalikan string kosong untuk input kosong", () => {
    expect(toDateLocalValue(null)).toBe("")
    expect(toDateLocalValue(undefined)).toBe("")
    expect(toDateLocalValue("")).toBe("")
  })
})