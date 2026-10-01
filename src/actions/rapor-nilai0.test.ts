// src/actions/rapor-nilai0.test.ts
//
// Regresi BUG nilai-0: nilai ujian/tugas 0 adalah nilai SAH dan harus ikut
// dihitung. Sebelum perbaikan, pemeriksaan truthiness (`if (p.nilaiTotal)`)
// membuang 0 sehingga mapel dengan nilai 0 tampak "tak pernah dinilai".
//
// Prisma tiruan sengaja mengembalikan angka JS `0` (bukan Decimal) untuk
// memaksa masalah truthiness terlihat bila regresi muncul kembali.

import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  mockVerifyGuruAksesKelas,
  mockPeriodeFindUnique,
  mockSiswaFindMany,
  mockPengerjaanFindMany,
  mockPengumpulanFindMany,
  mockAbsensiFindMany,
  mockCatatanFindMany,
} = vi.hoisted(() => ({
  mockVerifyGuruAksesKelas: vi.fn(),
  mockPeriodeFindUnique: vi.fn(),
  mockSiswaFindMany: vi.fn(),
  mockPengerjaanFindMany: vi.fn(),
  mockPengumpulanFindMany: vi.fn(),
  mockAbsensiFindMany: vi.fn(),
  mockCatatanFindMany: vi.fn(),
}))

vi.mock("@/lib/guru-auth", () => ({
  verifyGuruAksesKelas: mockVerifyGuruAksesKelas,
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  default: {
    periodeAjaran: { findUnique: mockPeriodeFindUnique },
    siswa: { findMany: mockSiswaFindMany },
    pengerjaanUjian: { findMany: mockPengerjaanFindMany },
    pengumpulanTugas: { findMany: mockPengumpulanFindMany },
    absensi: { findMany: mockAbsensiFindMany },
    catatanRapor: { findMany: mockCatatanFindMany },
  },
}))

import { getRekapRaporKelas } from "@/actions/rapor"

describe("getRekapRaporKelas — nilai 0 ikut dihitung", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyGuruAksesKelas.mockResolvedValue({
      user: { id: "guru-1" },
      roleInKelas: "WALI_KELAS",
    })
    mockPeriodeFindUnique.mockResolvedValue({
      id: "periode-1",
      nama: "Ganjil 2026/2027",
      tahunAjaran: "2026/2027",
      tanggalRapor: null,
    })
    mockSiswaFindMany.mockResolvedValue([
      { id: "siswa-1", nisn: null, user: { nama: "Ahmad Fauzi" } },
    ])
    // Nilai 0 untuk ujian DAN tugas pada mapel yang sama.
    mockPengerjaanFindMany.mockResolvedValue([
      {
        siswaId: "siswa-1",
        nilaiTotal: 0,
        ujian: {
          waktuMulai: new Date("2026-09-01T08:00:00Z"),
          mataPelajaran: { nama: "Fiqih" },
        },
      },
    ])
    mockPengumpulanFindMany.mockResolvedValue([
      {
        siswaId: "siswa-1",
        nilai: 0,
        waktuKumpul: new Date("2026-09-05T08:00:00Z"),
        tugas: {
          deadline: new Date("2026-09-05T23:59:59Z"),
          inputManual: false,
          mataPelajaran: { nama: "Fiqih" },
        },
      },
    ])
    mockAbsensiFindMany.mockResolvedValue([])
    mockCatatanFindMany.mockResolvedValue([])
  })

  it("menghitung nilai ujian & tugas 0, bukan membuangnya", async () => {
    const result = await getRekapRaporKelas({
      kelasId: "kelas-1",
      periodeAjaranId: "periode-1",
      bulan: 0,
    })

    expect(result.success).toBe(true)
    type Mapel = {
      jumlahUjian: number
      jumlahTugas: number
      rataRataUjian: number
      rataRataTugas: number
      nilaiGabungan: number
    }
    const data = result.data as unknown as {
      rekap: Array<{ nilaiMapel: Mapel[]; rataRataKeseluruhan: number }>
    }

    const mapel = data.rekap[0].nilaiMapel[0]
    expect(mapel.jumlahUjian).toBe(1)
    expect(mapel.jumlahTugas).toBe(1)
    expect(mapel.rataRataUjian).toBe(0)
    expect(mapel.rataRataTugas).toBe(0)
    expect(mapel.nilaiGabungan).toBe(0)
    expect(data.rekap[0].rataRataKeseluruhan).toBe(0)
  })
})
