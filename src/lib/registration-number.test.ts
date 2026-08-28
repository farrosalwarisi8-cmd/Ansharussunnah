// src/lib/registration-number.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

const mockFindFirst = vi.fn()
vi.mock("@/lib/prisma", () => ({
  default: {
    pendaftaran: {
      findFirst: (...args: any[]) => mockFindFirst(...args),
    },
  },
}))

import { generateNomorPendaftaran } from "@/lib/registration-number"

describe("generateNomorPendaftaran", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus men-generate REG-YYYY-00001 jika pendaftaran kosong", async () => {
    mockFindFirst.mockResolvedValue(null)

    const result = await generateNomorPendaftaran()
    const year = new Date().getFullYear()

    expect(result).toBe(`REG-${year}-00001`)
  })

  it("harus meng-increment nomor pendaftaran terakhir", async () => {
    const year = new Date().getFullYear()
    mockFindFirst.mockResolvedValue({
      nomorPendaftaran: `REG-${year}-00042`,
    })

    const result = await generateNomorPendaftaran()
    expect(result).toBe(`REG-${year}-00043`)
  })

  it("harus me-reset counter kembali ke 00001 pada transisi tahun baru", async () => {
    // Query pakai startsWith REG-{tahunBerjalan}-
    // Jadi DB tidak akan mengembalikan nomor tahun sebelumnya → null
    mockFindFirst.mockResolvedValue(null)

    const result = await generateNomorPendaftaran()
    const year = new Date().getFullYear()

    expect(result).toBe(`REG-${year}-00001`)
  })

  it("harus aman jika nomor terakhir tidak valid (defensive)", async () => {
    const year = new Date().getFullYear()
    // Simulasi data korup / prefix tidak cocok
    mockFindFirst.mockResolvedValue({
      nomorPendaftaran: `REG-${year - 1}-99999`,
    })

    const result = await generateNomorPendaftaran()
    expect(result).toBe(`REG-${year}-00001`)
  })
})