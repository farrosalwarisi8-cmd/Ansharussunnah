// src/actions/akuntansi.integration.test.ts
//
// Integration-style tests that verify the COMPLETE data flow:
//   input → auth check → Prisma queries → data transformation → output
//
// Uses the project's standard vi.fn() mocking pattern (vitest-mock-extended
// has ESM compatibility issues in this project setup), but goes beyond
// unit tests by verifying:
//   1. Exact Prisma query shapes (including nested includes/selects)
//   2. Complete output transformations (Decimal → number, date formatting, etc.)
//   3. Data correctness across multiple related queries
//   4. Edge cases in the transformation pipeline

import { describe, it, expect, vi, beforeEach } from "vitest"

// ========================================================
// Mocks — vi.fn() pattern (consistent with project conventions)
// ========================================================

const {
  mockRequireRole,
  mockPembayaranSiswaFindMany,
  mockSiswaFindMany,
  mockTagihanSiswaFindMany,
} = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockPembayaranSiswaFindMany: vi.fn(),
  mockSiswaFindMany: vi.fn(),
  mockTagihanSiswaFindMany: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: mockRequireRole,
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    pembayaranSiswa: { findMany: mockPembayaranSiswaFindMany },
    siswa: { findMany: mockSiswaFindMany },
    tagihanSiswa: { findMany: mockTagihanSiswaFindMany },
  },
}))

vi.mock("@/lib/guru-auth", () => ({ verifyGuruAksesKelas: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({ getClientIpFromHeaders: vi.fn(), rateLimitAsync: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdmin: vi.fn() }))
vi.mock("@/lib/storage", () => ({ getSignedUrl: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// ========================================================
// Import setelah semua vi.mock() terdaftar
// ========================================================

import {
  getDaftarPembayaranPendingVerifikasi,
  getRekapSppPerKelas,
  getRekapSppPerJenjang,
} from "@/actions/akuntansi"

// ========================================================
// Data dummy — realistic Prisma Decimal objects
// ========================================================

const adminKeuangan = { id: "admin-keu-1", email: "keuangan@sekolah.sch.id", role: "ADMIN_KEUANGAN" }

function dec(v: number) {
  return { toString: () => String(v) }
}

function setupAdmin() {
  mockRequireRole.mockResolvedValue(adminKeuangan)
}

function setupNonAdmin() {
  mockRequireRole.mockRejectedValue(new Error("Forbidden: Anda tidak memiliki akses. Role yang dibutuhkan: ADMIN_KEUANGAN"))
}

// ========================================================
// 1. getDaftarPembayaranPendingVerifikasi — Full Pipeline
// ========================================================

describe("getDaftarPembayaranPendingVerifikasi — Full Pipeline", () => {
  beforeEach(() => vi.clearAllMocks())

  it("harus mengubah raw Prisma result menjadi flat items dengan format yang benar", async () => {
    setupAdmin()
    mockPembayaranSiswaFindMany.mockResolvedValue([
      {
        id: "pay-001",
        tagihanId: "tag-1",
        nominalDibayar: dec(500000),
        metodeBayar: "Transfer BSI",
        urlBukti: "spp/tag-1/bukti.jpg",
        namaBukti: "bukti.jpg",
        catatan: null,
        createdAt: new Date("2024-03-01T09:30:00Z"),
        tagihan: {
          bulan: 3, tahun: 2024, nominal: dec(500000),
          siswa: {
            user: { nama: "Ahmad Fauzi" },
            kelas: { nama: "7A", jenjang: { nama: "Tsawawiyah" } },
          },
        },
      },
    ])

    const result = await getDaftarPembayaranPendingVerifikasi()

    // Verifikasi query: PENDING filter, nested includes, asc order
    expect(mockPembayaranSiswaFindMany).toHaveBeenCalledWith({
      where: { statusPembayaran: "PENDING" },
      include: {
        tagihan: {
          include: {
            siswa: {
              include: {
                user: { select: { nama: true } },
                kelas: { include: { jenjang: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    // Verifikasi transformation: nested → flat, Decimal → number
    expect(result.data!.items[0]).toEqual({
      id: "pay-001",
      tagihanId: "tag-1",
      santriNama: "Ahmad Fauzi",
      kelas: "7A",
      jenjang: "Tsawawiyah",
      bulanTagihan: "Maret 2024",
      nominalTagihan: 500000,
      nominalDibayar: 500000,
      metodeBayar: "Transfer BSI",
      namaBukti: "bukti.jpg",
      urlBukti: "spp/tag-1/bukti.jpg",
      catatan: null,
      waktuUpload: new Date("2024-03-01T09:30:00Z"),
    })
  })

  it("harus handle 10+ items dalam satu batch", async () => {
    setupAdmin()
    const items = Array.from({ length: 15 }, (_, i) => ({
      id: `pay-${String(i + 1).padStart(3, "0")}`,
      tagihanId: `tag-${i + 1}`,
      nominalDibayar: dec(500000),
      metodeBayar: "Tunai",
      urlBukti: null,
      namaBukti: null,
      catatan: null,
      createdAt: new Date(`2024-03-${String(i + 1).padStart(2, "0")}T08:00:00Z`),
      tagihan: {
        bulan: 3, tahun: 2024, nominal: dec(500000),
        siswa: {
          user: { nama: `Siswa ${i + 1}` },
          kelas: { nama: `${7 + (i % 3)}A`, jenjang: { nama: "Tsawawiyah" } },
        },
      },
    }))

    mockPembayaranSiswaFindMany.mockResolvedValue(items)

    const result = await getDaftarPembayaranPendingVerifikasi()

    expect(result.data!.total).toBe(15)
    expect(result.data!.items).toHaveLength(15)
    // Pastikan semua items ter-transform dengan benar
    result.data!.items.forEach((item: { nominalDibayar: number; santriNama: string }) => {
      expect(item.nominalDibayar).toBe(500000)
      expect(item.santriNama).toMatch(/^Siswa \d+$/)
    })
  })

  it("harus handle Decimal yang mengembalikan float string (edge case)", async () => {
    setupAdmin()
    mockPembayaranSiswaFindMany.mockResolvedValue([{
      id: "pay-edge",
      tagihanId: "tag-edge",
      nominalDibayar: { toString: () => "500000.00" },
      metodeBayar: "Bank",
      urlBukti: null,
      namaBukti: null,
      catatan: null,
      createdAt: new Date(),
      tagihan: {
        bulan: 6, tahun: 2024, nominal: { toString: () => "500000.00" },
        siswa: {
          user: { nama: "Test" },
          kelas: { nama: "7A", jenjang: { nama: "Ts" } },
        },
      },
    }])

    const result = await getDaftarPembayaranPendingVerifikasi()

    // Number("500000.00") === 500000 — should work
    expect(result.data!.items[0].nominalDibayar).toBe(500000)
    expect(result.data!.items[0].nominalTagihan).toBe(500000)
  })
})

// ========================================================
// 2. getRekapSppPerKelas — Full Pipeline
// ========================================================

describe("getRekapSppPerKelas — Full Pipeline", () => {
  beforeEach(() => vi.clearAllMocks())

  it("harus menghitung total per kelas dari 4 siswa dan 4 tagihan secara konsisten", async () => {
    setupAdmin()

    // 4 siswa: 2 di 7A, 2 di 8A
    mockSiswaFindMany.mockResolvedValue([
      { id: "s1", kelasId: "k7a", sppKhusus: null, kelas: { id: "k7a", nama: "7A", jenjangId: "j1", jenjang: { id: "j1", nama: "Ts", tarifSppBulanan: dec(500000) } } },
      { id: "s2", kelasId: "k7a", sppKhusus: null, kelas: { id: "k7a", nama: "7A", jenjangId: "j1", jenjang: { id: "j1", nama: "Ts", tarifSppBulanan: dec(500000) } } },
      { id: "s3", kelasId: "k8a", sppKhusus: null, kelas: { id: "k8a", nama: "8A", jenjangId: "j1", jenjang: { id: "j1", nama: "Ts", tarifSppBulanan: dec(500000) } } },
      { id: "s4", kelasId: "k8a", sppKhusus: null, kelas: { id: "k8a", nama: "8A", jenjangId: "j1", jenjang: { id: "j1", nama: "Ts", tarifSppBulanan: dec(500000) } } },
    ])

    // s1: LUNAS, s2: BELUM_BAYAR, s3: TERLAMBAT, s4: DIBAYAR_SEBAGIAN
    mockTagihanSiswaFindMany.mockResolvedValue([
      { siswaId: "s1", nominal: dec(500000), status: "SUDAH_BAYAR" },
      { siswaId: "s2", nominal: dec(500000), status: "BELUM_BAYAR" },
      { siswaId: "s3", nominal: dec(500000), status: "TERLAMBAT" },
      { siswaId: "s4", nominal: dec(500000), status: "DIBAYAR_SEBAGIAN" },
    ])

    const result = await getRekapSppPerKelas()

    // Verifikasi query efficiency: 2 queries total
    expect(mockSiswaFindMany).toHaveBeenCalledTimes(1)
    expect(mockTagihanSiswaFindMany).toHaveBeenCalledTimes(1)

    // Verifikasi tagihan query uses select (NOT full include)
    expect(mockTagihanSiswaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { siswaId: true, nominal: true, status: true },
      })
    )

    expect(result.data!.items).toHaveLength(2)

    // 7A: s1(LUNAS) + s2(BELUM_BAYAR)
    const k7a = result.data!.items.find((i: { kelasId: string }) => i.kelasId === "k7a")!
    expect(k7a).toEqual(expect.objectContaining({
      namaKelas: "7A",
      namaJenjang: "Ts",
      jumlahSiswa: 2,
      totalLunas: 500000,
      totalNunggak: 500000,
      totalTagihan: 1000000,
      persentaseKepatuhan: 50,
    }))

    // 8A: s3(TERLAMBAT) + s4(DIBAYAR_SEBAGIAN)
    const k8a = result.data!.items.find((i: { kelasId: string }) => i.kelasId === "k8a")!
    expect(k8a).toEqual(expect.objectContaining({
      namaKelas: "8A",
      jumlahSiswa: 2,
      totalLunas: 0,
      totalNunggak: 1000000,
      totalTagihan: 1000000,
      persentaseKepatuhan: 0,
    }))
  })

  it("harus memisahkan tagihan SPP dari non-SPP (hanya jenisTagihan=SPP)", async () => {
    setupAdmin()
    mockSiswaFindMany.mockResolvedValue([
      { id: "s1", kelasId: "k1", sppKhusus: null, kelas: { id: "k1", nama: "7A", jenjangId: "j1", jenjang: { id: "j1", nama: "Ts", tarifSppBulanan: dec(500000) } } },
    ])
    mockTagihanSiswaFindMany.mockResolvedValue([
      { siswaId: "s1", nominal: dec(500000), status: "SUDAH_BAYAR" },
    ])

    await getRekapSppPerKelas()

    // Pastikan filter jenisTagihan: "SPP" ada di query
    expect(mockTagihanSiswaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ jenisTagihan: "SPP" }),
      })
    )
  })

  it("harus mengembalikan periodeDipakai yang sesuai filter", async () => {
    setupAdmin()
    mockSiswaFindMany.mockResolvedValue([])
    mockTagihanSiswaFindMany.mockResolvedValue([])

    const r1 = await getRekapSppPerKelas({ bulan: 1, tahun: 2025 })
    expect(r1.data!.periodeDipakai).toBe("Januari 2025")

    vi.clearAllMocks()
    setupAdmin()
    const r2 = await getRekapSppPerKelas()
    expect(r2.data!.periodeDipakai).toBe("Semua Periode")
  })

  it("harus handle siswa tanpa kelas (kelasId=null) — tidak crash", async () => {
    setupAdmin()
    mockSiswaFindMany.mockResolvedValue([
      { id: "s1", kelasId: null, sppKhusus: null, kelas: null },
    ])
    mockTagihanSiswaFindMany.mockResolvedValue([])

    const result = await getRekapSppPerKelas()

    // Siswa tanpa kelas masuk di bawah "no-class" → skip (filter kelasId === "no-class" → continue)
    expect(result.data!.items).toHaveLength(0)
  })

  it("harus menghitung 100% jika semua siswa di kelas sudah lunas", async () => {
    setupAdmin()
    mockSiswaFindMany.mockResolvedValue([
      { id: "s1", kelasId: "k1", sppKhusus: null, kelas: { id: "k1", nama: "7A", jenjangId: "j1", jenjang: { id: "j1", nama: "Ts", tarifSppBulanan: dec(500000) } } },
      { id: "s2", kelasId: "k1", sppKhusus: null, kelas: { id: "k1", nama: "7A", jenjangId: "j1", jenjang: { id: "j1", nama: "Ts", tarifSppBulanan: dec(500000) } } },
    ])
    mockTagihanSiswaFindMany.mockResolvedValue([
      { siswaId: "s1", nominal: dec(500000), status: "SUDAH_BAYAR" },
      { siswaId: "s2", nominal: dec(500000), status: "SUDAH_BAYAR" },
    ])

    const result = await getRekapSppPerKelas()

    expect(result.data!.items[0].persentaseKepatuhan).toBe(100)
    expect(result.data!.items[0].totalNunggak).toBe(0)
    expect(result.data!.items[0].totalLunas).toBe(1000000)
  })
})

// ========================================================
// 3. getRekapSppPerJenjang — Full Pipeline
// ========================================================

describe("getRekapSppPerJenjang — Full Pipeline", () => {
  beforeEach(() => vi.clearAllMocks())

  it("harus mengagregasi 2 kelas ke 1 jenjang dengan total yang konsisten", async () => {
    setupAdmin()

    mockSiswaFindMany.mockResolvedValue([
      { id: "s1", kelasId: "k1", kelas: { id: "k1", nama: "7A", jenjangId: "j1", jenjang: { id: "j1", nama: "Ts" } } },
      { id: "s2", kelasId: "k1", kelas: { id: "k1", nama: "7A", jenjangId: "j1", jenjang: { id: "j1", nama: "Ts" } } },
      { id: "s3", kelasId: "k2", kelas: { id: "k2", nama: "8A", jenjangId: "j1", jenjang: { id: "j1", nama: "Ts" } } },
      { id: "s4", kelasId: "k2", kelas: { id: "k2", nama: "8A", jenjangId: "j1", jenjang: { id: "j1", nama: "Ts" } } },
    ])

    mockTagihanSiswaFindMany.mockResolvedValue([
      { siswaId: "s1", nominal: dec(500000), status: "SUDAH_BAYAR" },
      { siswaId: "s2", nominal: dec(500000), status: "SUDAH_BAYAR" },
      { siswaId: "s3", nominal: dec(500000), status: "BELUM_BAYAR" },
      { siswaId: "s4", nominal: dec(500000), status: "TERLAMBAT" },
    ])

    const result = await getRekapSppPerJenjang()

    // 2 queries only
    expect(mockSiswaFindMany).toHaveBeenCalledTimes(1)
    expect(mockTagihanSiswaFindMany).toHaveBeenCalledTimes(1)

    expect(result.data!.items).toHaveLength(1)

    const ts = result.data!.items[0]
    expect(ts).toEqual(expect.objectContaining({
      jenjangId: "j1",
      namaJenjang: "Ts",
      jumlahKelas: 2,
      jumlahSiswa: 4,
      totalLunas: 1000000,
      totalNunggak: 1000000,
      totalTagihan: 2000000,
      persentaseKepatuhan: 50,
    }))
  })

  it("harus memisahkan ke 3 jenjang berbeda dengan jumlah kelas unik", async () => {
    setupAdmin()

    mockSiswaFindMany.mockResolvedValue([
      { id: "s1", kelasId: "k1", kelas: { id: "k1", nama: "7A", jenjangId: "j-ali", jenjang: { id: "j-ali", nama: "Aliyah" } } },
      { id: "s2", kelasId: "k1", kelas: { id: "k1", nama: "7A", jenjangId: "j-ali", jenjang: { id: "j-ali", nama: "Aliyah" } } },
      { id: "s3", kelasId: "k2", kelas: { id: "k2", nama: "10A", jenjangId: "j-ali", jenjang: { id: "j-ali", nama: "Aliyah" } } },
      { id: "s4", kelasId: "k3", kelas: { id: "k3", nama: "8A", jenjangId: "j-ibt", jenjang: { id: "j-ibt", nama: "Ibtidaiyah" } } },
      { id: "s5", kelasId: "k4", kelas: { id: "k4", nama: "9A", jenjangId: "j-ts", jenjang: { id: "j-ts", nama: "Tsawawiyah" } } },
    ])

    mockTagihanSiswaFindMany.mockResolvedValue([
      { siswaId: "s1", nominal: dec(600000), status: "SUDAH_BAYAR" },
      { siswaId: "s2", nominal: dec(600000), status: "SUDAH_BAYAR" },
      { siswaId: "s3", nominal: dec(600000), status: "SUDAH_BAYAR" },
      { siswaId: "s4", nominal: dec(500000), status: "BELUM_BAYAR" },
      { siswaId: "s5", nominal: dec(500000), status: "TERLAMBAT" },
    ])

    const result = await getRekapSppPerJenjang()

    expect(result.data!.items).toHaveLength(3)

    // Aliyah: 3 siswa, 2 kelas, 100% lunas
    const ali = result.data!.items.find((i: { namaJenjang: string }) => i.namaJenjang === "Aliyah")!
    expect(ali.jumlahKelas).toBe(2)
    expect(ali.jumlahSiswa).toBe(3)
    expect(ali.totalLunas).toBe(1800000)
    expect(ali.persentaseKepatuhan).toBe(100)

    // Ibtidaiyah: 1 siswa, 1 kelas, 0% lunas
    const ibt = result.data!.items.find((i: { namaJenjang: string }) => i.namaJenjang === "Ibtidaiyah")!
    expect(ibt.jumlahKelas).toBe(1)
    expect(ibt.persentaseKepatuhan).toBe(0)

    // Tsawawiyah: 1 siswa, 1 kelas, 0% lunas
    const ts = result.data!.items.find((i: { namaJenjang: string }) => i.namaJenjang === "Tsawawiyah")!
    expect(ts.jumlahKelas).toBe(1)
    expect(ts.persentaseKepatuhan).toBe(0)
  })

  it("harus memfilter dengan bulan+tahun jika disediakan", async () => {
    setupAdmin()
    mockSiswaFindMany.mockResolvedValue([])
    mockTagihanSiswaFindMany.mockResolvedValue([])

    await getRekapSppPerJenjang({ bulan: 12, tahun: 2024 })

    expect(mockTagihanSiswaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bulan: 12, tahun: 2024 }),
      })
    )
  })

  it("harus mengembalikan periodeDipakai='Semua Periode' jika tidak ada filter", async () => {
    setupAdmin()
    mockSiswaFindMany.mockResolvedValue([])
    mockTagihanSiswaFindMany.mockResolvedValue([])

    const result = await getRekapSppPerJenjang()
    expect(result.data!.periodeDipakai).toBe("Semua Periode")
  })

  it("harus handle 0 siswa aktif dengan items kosong", async () => {
    setupAdmin()
    mockSiswaFindMany.mockResolvedValue([])
    mockTagihanSiswaFindMany.mockResolvedValue([])

    const result = await getRekapSppPerJenjang()

    expect(result.success).toBe(true)
    expect(result.data!.items).toHaveLength(0)
    expect(result.data!.periodeDipakai).toBe("Semua Periode")
  })
})

// ========================================================
// 4. Cross-Cutting: Auth & Error Handling
// ========================================================

describe("Cross-Cutting — Auth & Error Handling", () => {
  beforeEach(() => vi.clearAllMocks())

  it("ketiga fungsi harus menolak non-ADMIN_KEUANGAN TANPA query database", async () => {
    setupNonAdmin()

    const [r1, r2, r3] = await Promise.all([
      getDaftarPembayaranPendingVerifikasi(),
      getRekapSppPerKelas(),
      getRekapSppPerJenjang(),
    ])

    // Semua gagal
    expect([r1.success, r2.success, r3.success]).toEqual([false, false, false])

    // Auth check dilakukan sebelum query — tidak ada DB call
    expect(mockRequireRole).toHaveBeenCalledTimes(3)
    expect(mockPembayaranSiswaFindMany).not.toHaveBeenCalled()
    expect(mockSiswaFindMany).not.toHaveBeenCalled()
    expect(mockTagihanSiswaFindMany).not.toHaveBeenCalled()
  })

  it("database error harus di-catch dan dikembalikan sebagai ActionResponse error", async () => {
    setupAdmin()
    mockPembayaranSiswaFindMany.mockRejectedValue(new Error("Connection pool exhausted"))
    mockSiswaFindMany.mockRejectedValue(new Error("Connection pool exhausted"))
    mockTagihanSiswaFindMany.mockRejectedValue(new Error("Connection pool exhausted"))

    const [r1, r2, r3] = await Promise.all([
      getDaftarPembayaranPendingVerifikasi(),
      getRekapSppPerKelas(),
      getRekapSppPerJenjang(),
    ])

    // Semua mengembalikan success:false dengan pesan error
    expect(r1.success).toBe(false)
    expect(r1.message).toContain("Connection pool exhausted")
    expect(r2.success).toBe(false)
    expect(r2.message).toContain("Connection pool exhausted")
    expect(r3.success).toBe(false)
    expect(r3.message).toContain("Connection pool exhausted")
  })

  it("requireRole harus dipanggil dengan argumen ['ADMIN_KEUANGAN', 'SUPER_ADMIN'] untuk ketiga fungsi", async () => {
    setupAdmin()
    mockPembayaranSiswaFindMany.mockResolvedValue([])
    mockSiswaFindMany.mockResolvedValue([])
    mockTagihanSiswaFindMany.mockResolvedValue([])

    await getDaftarPembayaranPendingVerifikasi()
    await getRekapSppPerKelas()
    await getRekapSppPerJenjang()

    expect(mockRequireRole).toHaveBeenCalledTimes(3)
    mockRequireRole.mock.calls.forEach((call: unknown[]) => {
      expect(call[0]).toEqual(["ADMIN_KEUANGAN", "SUPER_ADMIN"])
    })
  })
})
