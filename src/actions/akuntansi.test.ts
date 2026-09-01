// src/actions/akuntansi.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

// ========================================================
// Mocks — di-hoist agar tersedia sebelum import modul
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
    pembayaranSiswa: {
      findMany: mockPembayaranSiswaFindMany,
    },
    siswa: {
      findMany: mockSiswaFindMany,
    },
    tagihanSiswa: {
      findMany: mockTagihanSiswaFindMany,
    },
  },
}))

vi.mock("@/lib/guru-auth", () => ({
  verifyGuruAksesKelas: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  getClientIpFromHeaders: vi.fn(),
  rateLimitAsync: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: vi.fn(),
}))

vi.mock("@/lib/storage", () => ({
  getSignedUrl: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

// ========================================================
// Import setelah semua vi.mock() terdaftar
// ========================================================

import {
  getDaftarPembayaranPendingVerifikasi,
  getRekapSppPerKelas,
  getRekapSppPerJenjang,
} from "@/actions/akuntansi"

// ========================================================
// Data dummy — admin keuangan yang sah
// ========================================================

const adminKeuangan = {
  id: "admin-keu-1",
  email: "keuangan@sekolah.sch.id",
  role: "ADMIN_KEUANGAN",
}

// ========================================================
// Helper: Setup mock admin keuangan
// ========================================================

function setupAdminAuth() {
  mockRequireRole.mockResolvedValue(adminKeuangan)
}

function setupNonAdminAuth() {
  mockRequireRole.mockRejectedValue(
    new Error("Forbidden: Anda tidak memiliki akses. Role yang dibutuhkan: ADMIN_KEUANGAN")
  )
}

// ========================================================
// 1. getDaftarPembayaranPendingVerifikasi
// ========================================================

describe("getDaftarPembayaranPendingVerifikasi", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus mengembalikan daftar pembayaran yang berstatus PENDING", async () => {
    setupAdminAuth()

    mockPembayaranSiswaFindMany.mockResolvedValue([
      {
        id: "pay-001",
        tagihanId: "tag-1",
        nominalDibayar: { toString: () => "500000" },
        metodeBayar: "Transfer BSI",
        namaBukti: "bukti-transfer.jpg",
        urlBukti: "spp/tag-1/bukti-transfer.jpg",
        catatan: null,
        createdAt: new Date("2024-03-01T09:30:00Z"),
        tagihan: {
          id: "tag-1",
          bulan: 3,
          tahun: 2024,
          nominal: { toString: () => "500000" },
          namaTagihan: "SPP Maret 2024",
          siswa: {
            id: "siswa-1",
            user: { nama: "Ahmad Fauzi" },
            kelas: {
              nama: "7A - Ikhwan",
              jenjang: { nama: "Tsawawiyah" },
            },
          },
        },
      },
      {
        id: "pay-002",
        tagihanId: "tag-2",
        nominalDibayar: { toString: () => "450000" },
        metodeBayar: "Transfer BCA",
        namaBukti: "bukti-bca.pdf",
        urlBukti: "spp/tag-2/bukti-bca.pdf",
        catatan: "Bayar sebagian",
        createdAt: new Date("2024-03-02T16:15:00Z"),
        tagihan: {
          id: "tag-2",
          bulan: 3,
          tahun: 2024,
          nominal: { toString: () => "500000" },
          namaTagihan: "SPP Maret 2024",
          siswa: {
            id: "siswa-2",
            user: { nama: "Zubair bin Awwam" },
            kelas: {
              nama: "8A - Ikhwan",
              jenjang: { nama: "Tsanawiyah" },
            },
          },
        },
      },
    ])

    const result = await getDaftarPembayaranPendingVerifikasi()

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.total).toBe(2)
    expect(result.data!.items).toHaveLength(2)

    // Verifikasi query hanya menggunakan filter PENDING
    expect(mockPembayaranSiswaFindMany).toHaveBeenCalledWith({
      where: { statusPembayaran: "PENDING" },
      include: expect.any(Object),
      orderBy: { createdAt: "asc" },
    })

    // Verifikasi data pertama
    const item1 = result.data!.items[0]
    expect(item1.id).toBe("pay-001")
    expect(item1.santriNama).toBe("Ahmad Fauzi")
    expect(item1.kelas).toBe("7A - Ikhwan")
    expect(item1.jenjang).toBe("Tsawawiyah")
    expect(item1.bulanTagihan).toBe("Maret 2024")
    expect(item1.nominalDibayar).toBe(500000)
    expect(item1.metodeBayar).toBe("Transfer BSI")

    // Verifikasi data kedua — nominal tidak sesuai tagihan
    const item2 = result.data!.items[1]
    expect(item2.santriNama).toBe("Zubair bin Awwam")
    expect(item2.nominalDibayar).toBe(450000)
    expect(item2.nominalTagihan).toBe(500000)
    expect(item2.catatan).toBe("Bayar sebagian")
  })

  it("harus mengembalikan array kosong jika tidak ada pembayaran PENDING", async () => {
    setupAdminAuth()
    mockPembayaranSiswaFindMany.mockResolvedValue([])

    const result = await getDaftarPembayaranPendingVerifikasi()

    expect(result.success).toBe(true)
    expect(result.data!.total).toBe(0)
    expect(result.data!.items).toHaveLength(0)
  })

  it("harus gagal jika bukan ADMIN_KEUANGAN", async () => {
    setupNonAdminAuth()

    const result = await getDaftarPembayaranPendingVerifikasi()

    expect(result.success).toBe(false)
    expect(result.message).toContain("Forbidden")
    expect(mockPembayaranSiswaFindMany).not.toHaveBeenCalled()
  })

  it("harus handle kelas/jenjang yang null (siswa tanpa kelas)", async () => {
    setupAdminAuth()

    mockPembayaranSiswaFindMany.mockResolvedValue([
      {
        id: "pay-003",
        tagihanId: "tag-3",
        nominalDibayar: { toString: () => "500000" },
        metodeBayar: "Tunai",
        namaBukti: null,
        urlBukti: null,
        catatan: null,
        createdAt: new Date("2024-03-03T08:00:00Z"),
        tagihan: {
          id: "tag-3",
          bulan: null,
          tahun: null,
          nominal: { toString: () => "500000" },
          namaTagihan: "SPP Custom",
          siswa: {
            id: "siswa-3",
            user: { nama: "Siswa Tanpa Kelas" },
            kelas: null,
          },
        },
      },
    ])

    const result = await getDaftarPembayaranPendingVerifikasi()

    expect(result.success).toBe(true)
    const item = result.data!.items[0]
    expect(item.kelas).toBe("Tanpa Kelas")
    expect(item.jenjang).toBe("-")
    // bulan dan tahun null → fallback ke namaTagihan
    expect(item.bulanTagihan).toBe("SPP Custom")
  })

  it("harus mengembalikan error message saat database error", async () => {
    setupAdminAuth()
    mockPembayaranSiswaFindMany.mockRejectedValue(new Error("Database connection timeout"))

    const result = await getDaftarPembayaranPendingVerifikasi()

    expect(result.success).toBe(false)
    expect(result.message).toContain("Database connection timeout")
  })
})

// ========================================================
// 2. getRekapSppPerKelas
// ========================================================

describe("getRekapSppPerKelas", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus menghitung rekap per kelas dengan benar", async () => {
    setupAdminAuth()

    // 3 siswa aktif: 2 di kelas 7A, 1 di kelas 8A
    mockSiswaFindMany.mockResolvedValue([
      {
        id: "siswa-1",
        kelasId: "kelas-7a",
        sppKhusus: null,
        kelas: {
          id: "kelas-7a",
          nama: "7A - Ikhwan",
          jenjang: {
            id: "jenjang-ts",
            nama: "Tsawawiyah",
            tarifSppBulanan: { toString: () => "500000" },
          },
        },
      },
      {
        id: "siswa-2",
        kelasId: "kelas-7a",
        sppKhusus: null,
        kelas: {
          id: "kelas-7a",
          nama: "7A - Ikhwan",
          jenjang: {
            id: "jenjang-ts",
            nama: "Tsawawiyah",
            tarifSppBulanan: { toString: () => "500000" },
          },
        },
      },
      {
        id: "siswa-3",
        kelasId: "kelas-8a",
        sppKhusus: null,
        kelas: {
          id: "kelas-8a",
          nama: "8A - Ikhwan",
          jenjang: {
            id: "jenjang-ts",
            nama: "Tsawawiyah",
            tarifSppBulanan: { toString: () => "500000" },
          },
        },
      },
    ])

    // Tagihan: siswa-1 LUNAS, siswa-2 BELUM_BAYAR, siswa-3 TERLAMBAT
    mockTagihanSiswaFindMany.mockResolvedValue([
      { siswaId: "siswa-1", nominal: { toString: () => "500000" }, status: "SUDAH_BAYAR" },
      { siswaId: "siswa-2", nominal: { toString: () => "500000" }, status: "BELUM_BAYAR" },
      { siswaId: "siswa-3", nominal: { toString: () => "500000" }, status: "TERLAMBAT" },
    ])

    const result = await getRekapSppPerKelas()

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.items).toHaveLength(2)

    // Kelas 7A: 2 siswa, 1 lunas (500k), 1 belum bayar (500k)
    const kelas7a = result.data!.items.find((i) => i.namaKelas === "7A - Ikhwan")
    expect(kelas7a).toBeDefined()
    expect(kelas7a!.jumlahSiswa).toBe(2)
    expect(kelas7a!.totalLunas).toBe(500000)
    expect(kelas7a!.totalNunggak).toBe(500000)
    expect(kelas7a!.totalTagihan).toBe(1000000)
    expect(kelas7a!.persentaseKepatuhan).toBe(50)

    // Kelas 8A: 1 siswa, 0 lunas, 1 terlambat (500k)
    const kelas8a = result.data!.items.find((i) => i.namaKelas === "8A - Ikhwan")
    expect(kelas8a).toBeDefined()
    expect(kelas8a!.jumlahSiswa).toBe(1)
    expect(kelas8a!.totalLunas).toBe(0)
    expect(kelas8a!.totalNunggak).toBe(500000)
    expect(kelas8a!.persentaseKepatuhan).toBe(0)
  })

  it("harus memfilter berdasarkan bulan dan tahun jika disediakan", async () => {
    setupAdminAuth()
    mockSiswaFindMany.mockResolvedValue([])
    mockTagihanSiswaFindMany.mockResolvedValue([])

    await getRekapSppPerKelas({ bulan: 3, tahun: 2024 })

    expect(mockTagihanSiswaFindMany).toHaveBeenCalledWith({
      where: {
        jenisTagihan: "SPP",
        bulan: 3,
        tahun: 2024,
      },
      select: expect.any(Object),
    })
  })

  it("harus mengembalikan array kosong jika tidak ada siswa aktif", async () => {
    setupAdminAuth()
    mockSiswaFindMany.mockResolvedValue([])
    mockTagihanSiswaFindMany.mockResolvedValue([])

    const result = await getRekapSppPerKelas()

    expect(result.success).toBe(true)
    expect(result.data!.items).toHaveLength(0)
  })

  it("harus gagal jika bukan ADMIN_KEUANGAN", async () => {
    setupNonAdminAuth()

    const result = await getRekapSppPerKelas()

    expect(result.success).toBe(false)
    expect(result.message).toContain("Forbidden")
    expect(mockSiswaFindMany).not.toHaveBeenCalled()
  })

  it("harus menghitung persentase 100% jika semua siswa lunas", async () => {
    setupAdminAuth()

    mockSiswaFindMany.mockResolvedValue([
      {
        id: "siswa-1",
        kelasId: "kelas-7a",
        sppKhusus: null,
        kelas: {
          id: "kelas-7a",
          nama: "7A - Ikhwan",
          jenjang: {
            id: "jenjang-ts",
            nama: "Tsawawiyah",
            tarifSppBulanan: { toString: () => "500000" },
          },
        },
      },
    ])

    mockTagihanSiswaFindMany.mockResolvedValue([
      { siswaId: "siswa-1", nominal: { toString: () => "500000" }, status: "SUDAH_BAYAR" },
    ])

    const result = await getRekapSppPerKelas()

    expect(result.success).toBe(true)
    expect(result.data!.items[0].persentaseKepatuhan).toBe(100)
    expect(result.data!.items[0].totalNunggak).toBe(0)
  })

  it("harus menangani kelas tanpa jenjang dengan nama fallback", async () => {
    setupAdminAuth()

    mockSiswaFindMany.mockResolvedValue([
      {
        id: "siswa-1",
        kelasId: "kelas-x",
        sppKhusus: null,
        kelas: {
          id: "kelas-x",
          nama: "Kelas X",
          jenjang: null,
        },
      },
    ])

    mockTagihanSiswaFindMany.mockResolvedValue([])

    const result = await getRekapSppPerKelas()

    expect(result.success).toBe(true)
    expect(result.data!.items[0].namaJenjang).toBe("-")
    expect(result.data!.items[0].totalTagihan).toBe(0)
    expect(result.data!.items[0].persentaseKepatuhan).toBe(0)
  })

  it("harus mengembalikan error message saat database error", async () => {
    setupAdminAuth()
    mockSiswaFindMany.mockRejectedValue(new Error("Connection refused"))

    const result = await getRekapSppPerKelas()

    expect(result.success).toBe(false)
    expect(result.message).toContain("Connection refused")
  })
})

// ========================================================
// 3. getRekapSppPerJenjang
// ========================================================

describe("getRekapSppPerJenjang", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus mengagregasi rekap dari level kelas ke level jenjang", async () => {
    setupAdminAuth()

    // 4 siswa di 2 kelas berbeda, 1 jenjang sama (Tsawawiyah)
    mockSiswaFindMany.mockResolvedValue([
      {
        id: "siswa-1",
        kelasId: "kelas-7a",
        kelas: {
          id: "kelas-7a",
          nama: "7A - Ikhwan",
          jenjangId: "jenjang-ts",
          jenjang: {
            id: "jenjang-ts",
            nama: "Tsawawiyah",
          },
        },
      },
      {
        id: "siswa-2",
        kelasId: "kelas-7a",
        kelas: {
          id: "kelas-7a",
          nama: "7A - Ikhwan",
          jenjangId: "jenjang-ts",
          jenjang: {
            id: "jenjang-ts",
            nama: "Tsawawiyah",
          },
        },
      },
      {
        id: "siswa-3",
        kelasId: "kelas-8a",
        kelas: {
          id: "kelas-8a",
          nama: "8A - Ikhwan",
          jenjangId: "jenjang-ts",
          jenjang: {
            id: "jenjang-ts",
            nama: "Tsawawiyah",
          },
        },
      },
      {
        id: "siswa-4",
        kelasId: "kelas-8a",
        kelas: {
          id: "kelas-8a",
          nama: "8A - Ikhwan",
          jenjangId: "jenjang-ts",
          jenjang: {
            id: "jenjang-ts",
            nama: "Tsawawiyah",
          },
        },
      },
    ])

    // Tagihan: 2 lunas, 2 belum bayar
    mockTagihanSiswaFindMany.mockResolvedValue([
      { siswaId: "siswa-1", nominal: { toString: () => "500000" }, status: "SUDAH_BAYAR" },
      { siswaId: "siswa-2", nominal: { toString: () => "500000" }, status: "SUDAH_BAYAR" },
      { siswaId: "siswa-3", nominal: { toString: () => "500000" }, status: "BELUM_BAYAR" },
      { siswaId: "siswa-4", nominal: { toString: () => "500000" }, status: "TERLAMBAT" },
    ])

    const result = await getRekapSppPerJenjang()

    expect(result.success).toBe(true)
    expect(result.data!.items).toHaveLength(1)

    const jenjang = result.data!.items[0]
    expect(jenjang.namaJenjang).toBe("Tsawawiyah")
    expect(jenjang.jumlahKelas).toBe(2)
    expect(jenjang.jumlahSiswa).toBe(4)
    expect(jenjang.totalLunas).toBe(1000000) // 2 siswa × 500k
    expect(jenjang.totalNunggak).toBe(1000000) // 2 siswa × 500k
    expect(jenjang.totalTagihan).toBe(2000000)
    expect(jenjang.persentaseKepatuhan).toBe(50)
  })

  it("harus memisahkan siswa ke jenjang yang berbeda", async () => {
    setupAdminAuth()

    mockSiswaFindMany.mockResolvedValue([
      {
        id: "siswa-1",
        kelasId: "kelas-7a",
        kelas: {
          id: "kelas-7a",
          nama: "7A - Ikhwan",
          jenjangId: "jenjang-ts",
          jenjang: { id: "jenjang-ts", nama: "Tsawawiyah" },
        },
      },
      {
        id: "siswa-2",
        kelasId: "kelas-10a",
        kelas: {
          id: "kelas-10a",
          nama: "10A - Ikhwan",
          jenjangId: "jenjang-ali",
          jenjang: { id: "jenjang-ali", nama: "Aliyah" },
        },
      },
    ])

    mockTagihanSiswaFindMany.mockResolvedValue([
      { siswaId: "siswa-1", nominal: { toString: () => "500000" }, status: "SUDAH_BAYAR" },
      { siswaId: "siswa-2", nominal: { toString: () => "600000" }, status: "BELUM_BAYAR" },
    ])

    const result = await getRekapSppPerJenjang()

    expect(result.success).toBe(true)
    expect(result.data!.items).toHaveLength(2)

    // Tsawawiyah: 1 siswa, 100% lunas
    const ts = result.data!.items.find((i) => i.namaJenjang === "Tsawawiyah")
    expect(ts!.jumlahKelas).toBe(1)
    expect(ts!.persentaseKepatuhan).toBe(100)

    // Aliyah: 1 siswa, 0% lunas
    const ali = result.data!.items.find((i) => i.namaJenjang === "Aliyah")
    expect(ali!.jumlahKelas).toBe(1)
    expect(ali!.persentaseKepatuhan).toBe(0)
  })

  it("harus memfilter berdasarkan bulan jika disediakan", async () => {
    setupAdminAuth()
    mockSiswaFindMany.mockResolvedValue([])
    mockTagihanSiswaFindMany.mockResolvedValue([])

    await getRekapSppPerJenjang({ bulan: 6, tahun: 2024 })

    expect(mockTagihanSiswaFindMany).toHaveBeenCalledWith({
      where: {
        jenisTagihan: "SPP",
        bulan: 6,
        tahun: 2024,
      },
      select: expect.any(Object),
    })
  })

  it("harus mengembalikan array kosong jika tidak ada siswa aktif", async () => {
    setupAdminAuth()
    mockSiswaFindMany.mockResolvedValue([])
    mockTagihanSiswaFindMany.mockResolvedValue([])

    const result = await getRekapSppPerJenjang()

    expect(result.success).toBe(true)
    expect(result.data!.items).toHaveLength(0)
  })

  it("harus gagal jika bukan ADMIN_KEUANGAN", async () => {
    setupNonAdminAuth()

    const result = await getRekapSppPerJenjang()

    expect(result.success).toBe(false)
    expect(result.message).toContain("Forbidden")
    expect(mockSiswaFindMany).not.toHaveBeenCalled()
  })

  it("harus menghitung jumlah kelas yang benar per jenjang", async () => {
    setupAdminAuth()

    // 3 kelas berbeda dalam 1 jenjang
    mockSiswaFindMany.mockResolvedValue([
      {
        id: "siswa-1", kelasId: "k1",
        kelas: { id: "k1", nama: "7A", jenjangId: "j1", jenjang: { id: "j1", nama: "Tsawawiyah" } },
      },
      {
        id: "siswa-2", kelasId: "k2",
        kelas: { id: "k2", nama: "7B", jenjangId: "j1", jenjang: { id: "j1", nama: "Tsawawiyah" } },
      },
      {
        id: "siswa-3", kelasId: "k3",
        kelas: { id: "k3", nama: "8A", jenjangId: "j1", jenjang: { id: "j1", nama: "Tsawawiyah" } },
      },
    ])

    mockTagihanSiswaFindMany.mockResolvedValue([])

    const result = await getRekapSppPerJenjang()

    expect(result.success).toBe(true)
    expect(result.data!.items[0].jumlahKelas).toBe(3)
    expect(result.data!.items[0].jumlahSiswa).toBe(3)
  })

  it("harus mengembalikan error message saat database error", async () => {
    setupAdminAuth()
    mockSiswaFindMany.mockRejectedValue(new Error("Connection refused"))

    const result = await getRekapSppPerJenjang()

    expect(result.success).toBe(false)
    expect(result.message).toContain("Connection refused")
  })
})
