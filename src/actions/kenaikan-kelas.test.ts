// src/actions/kenaikan-kelas.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

// ========================================================
// Mocks — di-hoist agar tersedia sebelum import modul
// ========================================================

const {
  mockRequireGuruAdmin,
  mockPeriodeAjaranFindUnique,
  mockKelasFindMany,
  mockSiswaFindMany,
  mockPrismaTransaction,
  mockRiwayatCreateMany,
  mockSiswaUpdateMany,
} = vi.hoisted(() => ({
  mockRequireGuruAdmin: vi.fn(),
  mockPeriodeAjaranFindUnique: vi.fn(),
  mockKelasFindMany: vi.fn(),
  mockSiswaFindMany: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockRiwayatCreateMany: vi.fn(),
  mockSiswaUpdateMany: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireGuru: vi.fn(),
  requireGuruAdmin: mockRequireGuruAdmin,
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    periodeAjaran: { findUnique: mockPeriodeAjaranFindUnique },
    kelas: { findMany: mockKelasFindMany },
    siswa: {
      findMany: mockSiswaFindMany,
      updateMany: mockSiswaUpdateMany,
    },
    $transaction: mockPrismaTransaction,
  },
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

// ========================================================
// Import setelah semua vi.mock() terdaftar
// ========================================================

import { promosiSiswaMassal } from "@/actions/kenaikan-kelas"

// ========================================================
// Data dummy
// ========================================================

const adminUser = {
  id: "guru-admin-1",
  email: "admin@sekolah.sch.id",
  role: "GURU",
  isAdmin: true,
}

const periode = {
  id: "periode-1",
  nama: "2025/2026 Ganjil",
  tahunAjaran: "2025/2026",
  semester: "Ganjil",
}

const kelasBaru1 = { id: "kelas-8A", nama: "8A" }
const kelasBaru2 = { id: "kelas-8B", nama: "8B" }

const siswaList = [
  { id: "siswa-1", kelasId: "kelas-7A" },
  { id: "siswa-2", kelasId: "kelas-7A" },
  { id: "siswa-3", kelasId: "kelas-7B" },
  { id: "siswa-4", kelasId: "kelas-7A" },
  { id: "siswa-5", kelasId: "kelas-7B" },
]

// Mapping: 3 siswa → 8A, 2 siswa → 8B
const validMapping = [
  { siswaId: "siswa-1", kelasBaruId: "kelas-8A" },
  { siswaId: "siswa-2", kelasBaruId: "kelas-8A" },
  { siswaId: "siswa-3", kelasBaruId: "kelas-8B" },
  { siswaId: "siswa-4", kelasBaruId: "kelas-8A" },
  { siswaId: "siswa-5", kelasBaruId: "kelas-8B" },
]

// ========================================================
// Helper: setup mock happy path
// ========================================================

function setupHappyPath() {
  mockRequireGuruAdmin.mockResolvedValue(adminUser)
  mockPeriodeAjaranFindUnique.mockResolvedValue(periode)
  mockKelasFindMany.mockResolvedValue([kelasBaru1, kelasBaru2])
  mockSiswaFindMany.mockResolvedValue(siswaList)

  // Transaction executor: panggil callback tx seperti Prisma
  mockPrismaTransaction.mockImplementation(async (fn: Function) => {
    return fn({
      riwayatKelasSiswa: { createMany: mockRiwayatCreateMany.mockResolvedValue({ count: 5 }) },
      siswa: { updateMany: mockSiswaUpdateMany.mockResolvedValue({ count: 5 }) },
    })
  })
}

// ========================================================
// Test Suite
// ========================================================

describe("promosiSiswaMassal - Batch Optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --------------------------------------------------------
  // KASUS 1: Happy path — 5 siswa, 2 kelas tujuan
  //   → createMany 1x, updateMany 2x (per grup kelas)
  // --------------------------------------------------------
  it("harus menggunakan createMany dan updateMany per grup kelas", async () => {
    setupHappyPath()

    const result = await promosiSiswaMassal({
      periodeAjaranId: "periode-1",
      mapping: validMapping,
    })

    expect(result.success).toBe(true)
    expect(result.data?.totalBerhasil).toBe(5)
    expect(result.data?.totalGagal).toBe(0)

    // Transaction harus dipanggil
    expect(mockPrismaTransaction).toHaveBeenCalledOnce()

    // createMany dipanggil 1x untuk riwayat (bukan 5x findUnique+create)
    expect(mockRiwayatCreateMany).toHaveBeenCalledOnce()
    expect(mockRiwayatCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
      })
    )

    // updateMany dipanggil 2x (1 untuk kelas-8A, 1 untuk kelas-8B)
    // BUKAN 5x (per siswa)
    expect(mockSiswaUpdateMany).toHaveBeenCalledTimes(2)

    // Grup kelas-8A: siswa-1, siswa-2, siswa-4
    expect(mockSiswaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["siswa-1", "siswa-2", "siswa-4"] } },
        data: { kelasId: "kelas-8A" },
      })
    )

    // Grup kelas-8B: siswa-3, siswa-5
    expect(mockSiswaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["siswa-3", "siswa-5"] } },
        data: { kelasId: "kelas-8B" },
      })
    )
  })

  // --------------------------------------------------------
  // KASUS 2: Semua siswa ke 1 kelas → updateMany hanya 1x
  // --------------------------------------------------------
  it("harus mengelompokkan updateMany dengan benar (semua ke 1 kelas)", async () => {
    setupHappyPath()

    const mappingSingleKelas = [
      { siswaId: "siswa-1", kelasBaruId: "kelas-8A" },
      { siswaId: "siswa-2", kelasBaruId: "kelas-8A" },
      { siswaId: "siswa-3", kelasBaruId: "kelas-8A" },
    ]

    // Hanya perlu 1 kelas tujuan
    mockKelasFindMany.mockResolvedValue([kelasBaru1])
    mockSiswaFindMany.mockResolvedValue(siswaList.slice(0, 3))

    const result = await promosiSiswaMassal({
      periodeAjaranId: "periode-1",
      mapping: mappingSingleKelas,
    })

    expect(result.success).toBe(true)
    expect(result.data?.totalBerhasil).toBe(3)

    // updateMany hanya 1x karena semua ke kelas yang sama
    expect(mockSiswaUpdateMany).toHaveBeenCalledTimes(1)
    expect(mockSiswaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["siswa-1", "siswa-2", "siswa-3"] } },
        data: { kelasId: "kelas-8A" },
      })
    )
  })

  // --------------------------------------------------------
  // KASUS 3: Transaction timeout dikonfigurasi dengan benar
  // --------------------------------------------------------
  it("harus memanggil $transaction dengan timeout 30000 dan maxWait 10000", async () => {
    setupHappyPath()

    await promosiSiswaMassal({
      periodeAjaranId: "periode-1",
      mapping: validMapping,
    })

    expect(mockPrismaTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 30000, maxWait: 10000 }
    )
  })

  // --------------------------------------------------------
  // KASUS 4: Siswa tanpa kelas asal (kelasId: null)
  //   → riwayat TIDAK disimpan (data kosong), tapi tetap dipromosikan
  // --------------------------------------------------------
  it("harus skip riwayat untuk siswa tanpa kelas asal", async () => {
    mockRequireGuruAdmin.mockResolvedValue(adminUser)
    mockPeriodeAjaranFindUnique.mockResolvedValue(periode)
    mockKelasFindMany.mockResolvedValue([kelasBaru1])
    mockSiswaFindMany.mockResolvedValue([
      { id: "siswa-new", kelasId: null }, // Siswa baru, belum punya kelas
    ])

    mockPrismaTransaction.mockImplementation(async (fn: Function) => {
      return fn({
        riwayatKelasSiswa: { createMany: mockRiwayatCreateMany.mockResolvedValue({ count: 0 }) },
        siswa: { updateMany: mockSiswaUpdateMany.mockResolvedValue({ count: 1 }) },
      })
    })

    const result = await promosiSiswaMassal({
      periodeAjaranId: "periode-1",
      mapping: [{ siswaId: "siswa-new", kelasBaruId: "kelas-8A" }],
    })

    expect(result.success).toBe(true)
    expect(result.data?.totalBerhasil).toBe(1)

    // createMany TIDAK dipanggil karena semua siswa punya kelasId: null
    // → riwayatData kosong → if (riwayatData.length > 0) guard melewati createMany
    expect(mockRiwayatCreateMany).not.toHaveBeenCalled()

    // updateMany tetap dipanggil untuk memindahkan siswa
    expect(mockSiswaUpdateMany).toHaveBeenCalledOnce()
    expect(mockSiswaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["siswa-new"] } },
        data: { kelasId: "kelas-8A" },
      })
    )
  })

  // --------------------------------------------------------
  // KASUS 5: Pre-validasi — ada siswa tidak ditemukan di DB
  //   → validasi awal menolak, mengembalikan error sebelum transaction
  // --------------------------------------------------------
  it("harus menolak jika ada siswa yang tidak ditemukan di DB", async () => {
    mockRequireGuruAdmin.mockResolvedValue(adminUser)
    mockPeriodeAjaranFindUnique.mockResolvedValue(periode)
    mockKelasFindMany.mockResolvedValue([kelasBaru1])

    // DB hanya punya siswa-1, siswa-99 tidak ada
    mockSiswaFindMany.mockResolvedValue([
      { id: "siswa-1", kelasId: "kelas-7A" },
    ])

    const mapping = [
      { siswaId: "siswa-1", kelasBaruId: "kelas-8A" },
      { siswaId: "siswa-99", kelasBaruId: "kelas-8A" }, // tidak ada di DB
    ]

    const result = await promosiSiswaMassal({
      periodeAjaranId: "periode-1",
      mapping,
    })

    // Validasi awal menolak: siswaList.length (1) !== siswaIds.length (2)
    expect(result.success).toBe(false)
    expect(result.message).toContain("Siswa tidak valid")
    expect(result.message).toContain("siswa-99")

    // Transaction TIDAK dipanggil karena validasi gagal
    expect(mockPrismaTransaction).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 6: Semua siswa tidak ditemukan → validasi awal menolak
  // --------------------------------------------------------
  it("harus menolak jika semua siswa tidak ditemukan di DB", async () => {
    mockRequireGuruAdmin.mockResolvedValue(adminUser)
    mockPeriodeAjaranFindUnique.mockResolvedValue(periode)
    mockKelasFindMany.mockResolvedValue([kelasBaru1])

    // DB tidak punya siswa yang diminta
    mockSiswaFindMany.mockResolvedValue([])

    const result = await promosiSiswaMassal({
      periodeAjaranId: "periode-1",
      mapping: [
        { siswaId: "siswa-gone-1", kelasBaruId: "kelas-8A" },
        { siswaId: "siswa-gone-2", kelasBaruId: "kelas-8A" },
      ],
    })

    // Validasi awal menolak: siswaList.length (0) !== siswaIds.length (2)
    expect(result.success).toBe(false)
    expect(result.message).toContain("Siswa tidak valid")
    expect(result.message).toContain("siswa-gone-1")
    expect(result.message).toContain("siswa-gone-2")

    // Transaction TIDAK dipanggil karena validasi gagal
    expect(mockPrismaTransaction).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 7: Periode ajaran tidak ditemukan → gagal
  // --------------------------------------------------------
  it("harus gagal jika periode ajaran tidak ditemukan", async () => {
    mockRequireGuruAdmin.mockResolvedValue(adminUser)
    mockPeriodeAjaranFindUnique.mockResolvedValue(null)

    const result = await promosiSiswaMassal({
      periodeAjaranId: "periode-999",
      mapping: [{ siswaId: "siswa-1", kelasBaruId: "kelas-8A" }],
    })

    expect(result.success).toBe(false)
    expect(result.message).toBe("Periode ajaran tidak ditemukan")
    expect(mockPrismaTransaction).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 8: Kelas tujuan tidak valid → gagal
  // --------------------------------------------------------
  it("harus gagal jika kelas tujuan tidak ditemukan", async () => {
    mockRequireGuruAdmin.mockResolvedValue(adminUser)
    mockPeriodeAjaranFindUnique.mockResolvedValue(periode)

    // DB tidak punya kelas-999 → findMany mengembalikan array kosong
    mockKelasFindMany.mockResolvedValue([])

    const result = await promosiSiswaMassal({
      periodeAjaranId: "periode-1",
      mapping: [{ siswaId: "siswa-1", kelasBaruId: "kelas-999" }],
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("Kelas tujuan tidak valid")
    expect(result.message).toContain("kelas-999")
    expect(mockPrismaTransaction).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 9: Siswa tidak valid di DB → gagal
  // --------------------------------------------------------
  it("harus gagal jika semua siswa tidak ditemukan di database", async () => {
    mockRequireGuruAdmin.mockResolvedValue(adminUser)
    mockPeriodeAjaranFindUnique.mockResolvedValue(periode)
    mockKelasFindMany.mockResolvedValue([kelasBaru1])

    // DB tidak punya siswa-99
    mockSiswaFindMany.mockResolvedValue([])

    const result = await promosiSiswaMassal({
      periodeAjaranId: "periode-1",
      mapping: [{ siswaId: "siswa-99", kelasBaruId: "kelas-8A" }],
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("Siswa tidak valid")
    expect(mockPrismaTransaction).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 10: Payload invalid (mapping kosong) → gagal validasi
  // --------------------------------------------------------
  it("harus menolak payload dengan mapping kosong", async () => {
    mockRequireGuruAdmin.mockResolvedValue(adminUser)

    const result = await promosiSiswaMassal({
      periodeAjaranId: "periode-1",
      mapping: [],
    })

    expect(result.success).toBe(false)
    expect(result.message).toBe("Data promosi tidak valid")
    expect(result.errors).toBeDefined()
    expect(mockPeriodeAjaranFindUnique).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 11: Transaction gagal → error di-catch
  // --------------------------------------------------------
  it("harus gagal jika transaction database error", async () => {
    mockRequireGuruAdmin.mockResolvedValue(adminUser)
    mockPeriodeAjaranFindUnique.mockResolvedValue(periode)
    mockKelasFindMany.mockResolvedValue([kelasBaru1, kelasBaru2])
    mockSiswaFindMany.mockResolvedValue(siswaList)

    mockPrismaTransaction.mockRejectedValue(
      new Error("Transaction timeout: exceeded 5000ms")
    )

    const result = await promosiSiswaMassal({
      periodeAjaranId: "periode-1",
      mapping: validMapping,
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("Transaction timeout")
  })

  // --------------------------------------------------------
  // KASUS 12: Skala besar — 100 siswa, 4 kelas
  //   → createMany 1x, updateMany 4x
  // --------------------------------------------------------
  it("harus efisien dengan 100 siswa dan 4 kelas tujuan", async () => {
    setupHappyPath()

    // Buat 100 siswa, 25 per kelas
    const largeSiswaList = Array.from({ length: 100 }, (_, i) => ({
      id: `siswa-${String(i + 1).padStart(3, "0")}`,
      kelasId: `kelas-7${String.fromCharCode(65 + (i % 4))}`, // 7A, 7B, 7C, 7D
    }))

    mockSiswaFindMany.mockResolvedValue(largeSiswaList)

    const kelasBaruList = [
      { id: "kelas-8A", nama: "8A" },
      { id: "kelas-8B", nama: "8B" },
      { id: "kelas-8C", nama: "8C" },
      { id: "kelas-8D", nama: "8D" },
    ]
    mockKelasFindMany.mockResolvedValue(kelasBaruList)

    // 100 siswa, masing-masing ke kelas yang beda berdasarkan suffix
    const largeMapping = largeSiswaList.map((s, i) => ({
      siswaId: s.id,
      kelasBaruId: `kelas-8${String.fromCharCode(65 + (i % 4))}`,
    }))

    const result = await promosiSiswaMassal({
      periodeAjaranId: "periode-1",
      mapping: largeMapping,
    })

    expect(result.success).toBe(true)
    expect(result.data?.totalBerhasil).toBe(100)
    expect(result.data?.totalGagal).toBe(0)

    // createMany hanya 1x (bukan 100x findUnique+create)
    expect(mockRiwayatCreateMany).toHaveBeenCalledOnce()

    // updateMany hanya 4x (per kelas tujuan, bukan 100x per siswa)
    expect(mockSiswaUpdateMany).toHaveBeenCalledTimes(4)
  })

  // --------------------------------------------------------
  // KASUS 13: Mapping dengan duplicate siswaId
  //   → validasi sebelumnya sudah handle (unique di schema),
  //     tapi test memastikan tidak crash
  // --------------------------------------------------------
  it("harus menangani mapping dengan benar meski ada duplikat siswaId", async () => {
    setupHappyPath()

    // Mapping punya siswa-1 dua kali (arah beda)
    const duplicateMapping = [
      { siswaId: "siswa-1", kelasBaruId: "kelas-8A" },
      { siswaId: "siswa-1", kelasBaruId: "kelas-8B" }, // duplikat
    ]

    // findMany mengembalikan siswa-1 sekali saja
    mockSiswaFindMany.mockResolvedValue([
      { id: "siswa-1", kelasId: "kelas-7A" },
    ])

    const result = await promosiSiswaMassal({
      periodeAjaranId: "periode-1",
      mapping: duplicateMapping,
    })

    // Kedua mapping lolos pre-validasi (siswa-1 ada di siswaMap)
    // Tapi kelasBaruId beda → 2 grup → updateMany 2x
    expect(result.success).toBe(true)
    expect(result.data?.totalBerhasil).toBe(2)
    expect(mockSiswaUpdateMany).toHaveBeenCalledTimes(2)
  })

  // --------------------------------------------------------
  // KASUS 14: createMany dipanggil dengan skipDuplicates: true
  // --------------------------------------------------------
  it("harus memanggil createMany dengan skipDuplicates: true", async () => {
    setupHappyPath()

    await promosiSiswaMassal({
      periodeAjaranId: "periode-1",
      mapping: validMapping,
    })

    // Verifikasi skipDuplicates ada di parameter createMany
    const createManyCall = mockRiwayatCreateMany.mock.calls[0][0]
    expect(createManyCall.skipDuplicates).toBe(true)

    // Verifikasi data yang dikirim
    expect(createManyCall.data).toHaveLength(5)
    expect(createManyCall.data[0]).toEqual(
      expect.objectContaining({
        siswaId: "siswa-1",
        kelasId: "kelas-7A",
        kelasAsalId: "kelas-7A",
        periodeAjaranId: "periode-1",
      })
    )
  })

  // --------------------------------------------------------
  // KASUS 15: Tidak ada siswa valid tapi totalGagal = 0
  //   (mapping kosong setelah validasi schema)
  // --------------------------------------------------------
  it("harus return 0/0 jika validasi schema menolak mapping kosong", async () => {
    mockRequireGuruAdmin.mockResolvedValue(adminUser)

    const result = await promosiSiswaMassal({
      periodeAjaranId: "periode-1",
      mapping: [],
    })

    expect(result.success).toBe(false)
    expect(result.message).toBe("Data promosi tidak valid")
  })
})
