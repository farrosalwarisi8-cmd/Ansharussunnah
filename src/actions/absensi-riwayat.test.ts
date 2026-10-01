// src/actions/absensi-riwayat.test.ts
//
// Memastikan riwayat kehadiran siswa dipaginasi di server: hanya baris pada
// halaman diminta yang dikirim, ringkasan (HADIR/SAKIT/IZIN/ALPHA) dihitung
// dari SELURUH baris terfilter (bukan hanya halaman ini), dan daftar mapel
// untuk filter tetap lengkap.

import { describe, it, expect, vi, beforeEach } from "vitest"

const { mocks } = vi.hoisted(() => ({
  mocks: {
    requireRole: vi.fn(),
    absensiFindMany: vi.fn(),
    absensiCount: vi.fn(),
    absensiGroupBy: vi.fn(),
    verifyOrangTuaAksesSiswa: vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({
  requireRole: mocks.requireRole,
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/guru-auth", () => ({ verifyGuruAksesKelas: vi.fn() }))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/prisma", () => ({
  default: {
    absensi: {
      findMany: mocks.absensiFindMany,
      count: mocks.absensiCount,
      groupBy: mocks.absensiGroupBy,
    },
  },
}))

import { getRiwayatKehadiranSiswa } from "@/actions/absensi"

const riwayatRow = {
  id: "abs-1",
  tanggal: new Date("2026-03-10"),
  status: "HADIR",
  keterangan: null,
  kelas: { nama: "7A" },
  periodeAjaran: { nama: "2025/2026 Ganjil" },
  mataPelajaran: { id: "m1", nama: "Fiqih" },
}

describe("getRiwayatKehadiranSiswa — pagination server-side", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockResolvedValue({
      id: "u1",
      nama: "Santri Satu",
      siswa: { id: "siswa-1" },
    })
    mocks.absensiFindMany.mockImplementation(async (args: { select?: unknown }) => {
      // Panggilan daftar mapel memakai `select`; panggilan riwayat tidak.
      if (args?.select) {
        return [{ mataPelajaranId: "m1", mataPelajaran: { nama: "Fiqih" } }]
      }
      return [riwayatRow]
    })
    mocks.absensiCount.mockResolvedValue(42)
    mocks.absensiGroupBy.mockResolvedValue([
      { status: "HADIR", _count: { _all: 30 } },
      { status: "SAKIT", _count: { _all: 5 } },
      { status: "IZIN", _count: { _all: 4 } },
      { status: "ALPHA", _count: { _all: 3 } },
    ])
  })

  it("mengembalikan satu halaman + total sebenarnya (bukan panjang halaman)", async () => {
    const result = await getRiwayatKehadiranSiswa({ page: 1, pageSize: 25 })

    expect(result.success).toBe(true)
    const data = result.data as {
      total: number
      page: number
      pageSize: number
      totalPages: number
      riwayat: unknown[]
      ringkasan: Record<string, number>
      mataPelajaranList: Array<{ id: string; nama: string }>
    }

    expect(data.total).toBe(42)
    expect(data.totalPages).toBe(2)
    expect(data.page).toBe(1)
    expect(data.pageSize).toBe(25)
    expect(data.riwayat).toHaveLength(1)
  })

  it("menghitung ringkasan dari SELURUH baris terfilter via groupBy", async () => {
    const result = await getRiwayatKehadiranSiswa({ page: 1, pageSize: 25 })
    const data = result.data as { ringkasan: Record<string, number> }

    expect(data.ringkasan).toEqual({ HADIR: 30, SAKIT: 5, IZIN: 4, ALPHA: 3 })
    expect(mocks.absensiGroupBy).toHaveBeenCalledTimes(1)
  })

  it("menerapkan skip/take dan membatasi page size di server", async () => {
    await getRiwayatKehadiranSiswa({ page: 2, pageSize: 10 })

    const riwayatCall = mocks.absensiFindMany.mock.calls.find(
      (c) => !(c[0] as { select?: unknown })?.select,
    )
    expect(riwayatCall?.[0]).toMatchObject({ skip: 10, take: 10 })
  })

  it("menolak page size di atas 100 lewat validasi skema", async () => {
    const result = await getRiwayatKehadiranSiswa({ page: 1, pageSize: 500 })

    expect(result.success).toBe(false)
    expect(result.message).toContain("tidak valid")
  })

  it("mengembalikan daftar mapel untuk filter beserta ringkasan", async () => {
    const result = await getRiwayatKehadiranSiswa({ page: 1, pageSize: 25 })
    const data = result.data as { mataPelajaranList: Array<{ id: string; nama: string }> }

    expect(data.mataPelajaranList).toEqual([{ id: "m1", nama: "Fiqih" }])
  })
})
