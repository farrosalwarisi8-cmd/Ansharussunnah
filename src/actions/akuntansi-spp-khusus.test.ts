// src/actions/akuntansi-spp-khusus.test.ts
// Verifikasi aksi "Generate Tagihan SPP Khusus (Potongan)" kirimnya beneran jalan:
//   - getSiswaUntukTagihanKhusus  → mapping tarif dasar / sppKhusus / sudahAdaTagihan
//   - generateTagihanSppKhusus    → idempotent, createMany, simpan sppKhusus, email ke siswa+ortu

import { describe, it, expect, vi, beforeEach } from "vitest"
import { Decimal } from "@prisma/client/runtime/library"

// ========================================================
// Mocks
// ========================================================
const {
  mockRequireRole,
  mockSiswaFindMany,
  mockSiswaUpdateMany,
  mockTagihanSiswaFindMany,
  mockTagihanSiswaCreateMany,
  mockTransaction,
  mockSendEmail,
  mockBuildTagihanSppEmail,
} = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockSiswaFindMany: vi.fn(),
  mockSiswaUpdateMany: vi.fn(),
  mockTagihanSiswaFindMany: vi.fn(),
  mockTagihanSiswaCreateMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockSendEmail: vi.fn(),
  mockBuildTagihanSppEmail: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: mockRequireRole,
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    siswa: {
      findMany: mockSiswaFindMany,
      updateMany: mockSiswaUpdateMany,
    },
    tagihanSiswa: {
      findMany: mockTagihanSiswaFindMany,
      createMany: mockTagihanSiswaCreateMany,
    },
    $transaction: mockTransaction,
  },
}))

vi.mock("@/lib/email", () => ({
  sendEmail: mockSendEmail,
  buildTagihanSppEmail: mockBuildTagihanSppEmail,
}))

vi.mock("@/lib/guru-auth", () => ({ verifyGuruAksesKelas: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({
  getClientIpFromHeaders: vi.fn(),
  rateLimitAsync: vi.fn(),
}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdmin: vi.fn() }))
vi.mock("@/lib/storage", () => ({ getSignedUrls: vi.fn(), getSignedUrl: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// ========================================================
import {
  getSiswaUntukTagihanKhusus,
  generateTagihanSppKhusus,
} from "@/actions/akuntansi"
import { AppError } from "@/lib/prisma-error"

const adminKeuangan = { id: "admin-keu-1", email: "keuangan@sekolah.sch.id", role: "ADMIN_KEUANGAN" }
function setupAdminAuth() {
  mockRequireRole.mockResolvedValue(adminKeuangan)
}
function setupNonAdminAuth() {
  mockRequireRole.mockRejectedValue(
    new AppError("Forbidden: Anda tidak memiliki akses. Role yang dibutuhkan: ADMIN_KEUANGAN")
  )
}

// ========================================================
describe("getSiswaUntukTagihanKhusus", () => {
  beforeEach(() => vi.clearAllMocks())

  it("non-admin ditolak akses", async () => {
    setupNonAdminAuth()
    const res = await getSiswaUntukTagihanKhusus({ bulan: 9, tahun: 2026 })
    expect(res.success).toBe(false)
    expect(res.message).toContain("Forbidden")
  })

  it("mapping benar: tarif dasar, sppKhusus, dan flag sudahAdaTagihan", async () => {
    setupAdminAuth()
    mockSiswaFindMany.mockResolvedValue([
      {
        id: "s1",
        nis: "NIS-1",
        jenisKelamin: "LAKI_LAKI",
        sppKhusus: new Decimal("450000"),
        kelasId: "k1",
        user: { nama: "Ahmad", email: "ahmad@mail.com" },
        kelas: { id: "k1", nama: "1A", jenjang: { nama: "SDIT", tarifSppBulanan: new Decimal("500000") } },
        tagihanSiswa: [],
      },
      {
        id: "s2",
        nis: null,
        jenisKelamin: "PEREMPUAN",
        sppKhusus: null,
        kelasId: null,
        user: { nama: "Siti", email: "siti@mail.com" },
        kelas: null,
        tagihanSiswa: [{ id: "tag-1" }],
      },
    ])

    const res = await getSiswaUntukTagihanKhusus({ bulan: 9, tahun: 2026 })

    expect(res.success).toBe(true)
    expect(mockSiswaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          tagihanSiswa: expect.objectContaining({
            where: { bulan: 9, tahun: 2026, deleted_at: null },
          }),
        }),
      })
    )
    expect(res.data).toEqual([
      {
        id: "s1",
        nama: "Ahmad",
        email: "ahmad@mail.com",
        nis: "NIS-1",
        kelasId: "k1",
        kelasNama: "1A",
        jenjangNama: "SDIT",
        jenisKelamin: "LAKI_LAKI",
        sppKhusus: 450000,
        tarifJenjang: 500000,
        sudahAdaTagihan: false,
      },
      {
        id: "s2",
        nama: "Siti",
        email: "siti@mail.com",
        nis: null,
        kelasId: null,
        kelasNama: null,
        jenjangNama: null,
        jenisKelamin: "PEREMPUAN",
        sppKhusus: null,
        tarifJenjang: null,
        sudahAdaTagihan: true,
      },
    ])
  })
})

// ========================================================
describe("generateTagihanSppKhusus", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAdminAuth()
    mockBuildTagihanSppEmail.mockImplementation((p) => `EMAIL:${p.namaSiswa}:${p.bulanLabel}`)
  })

  it("validasi: items kosong ditolak", async () => {
    const res = await generateTagihanSppKhusus({
      bulan: 9,
      tahun: 2026,
      items: [],
      simpanSebagaiSppKhusus: true,
      kirimEmail: true,
    })
    expect(res.success).toBe(false)
    expect(mockTagihanSiswaCreateMany).not.toHaveBeenCalled()
  })

  it("menerbitkan tagihan, menyimpan sppKhusus berkelanjutan, & mengirim email ke siswa+ortu", async () => {
    mockTagihanSiswaFindMany.mockResolvedValue([]) // tidak ada tagihan existing
    mockSiswaFindMany.mockResolvedValue([
      {
        id: "s1",
        user: { nama: "Ahmad", email: "ahmad@mail.com" },
        kelas: { nama: "1A", jenjang: { nama: "SDIT" } },
        orangTua: [
          { orangTua: { user: { nama: "Bapak Ahmad", email: "bapak@mail.com" } } },
        ],
      },
      {
        id: "s2",
        user: { nama: "Siti", email: "siti@mail.com" },
        kelas: null,
        orangTua: [],
      },
    ])
    mockTagihanSiswaCreateMany.mockResolvedValue({ count: 2 })
    mockTransaction.mockResolvedValue([])
    mockSendEmail.mockResolvedValue({ success: true, id: "email-id" })

    const res = await generateTagihanSppKhusus({
      bulan: 9,
      tahun: 2026,
      items: [
        { siswaId: "s1", nominal: 450000 },
        { siswaId: "s2", nominal: 480000 },
      ],
      simpanSebagaiSppKhusus: true,
      kirimEmail: true,
    })

    expect(res.success).toBe(true)

    // createMany: 2 baris, skip duplicate, jatuh tempo tgl 10 bulan tsb
    const createCall = mockTagihanSiswaCreateMany.mock.calls[0][0]
    expect(createCall.data).toHaveLength(2)
    expect(createCall.skipDuplicates).toBe(true)
    expect(createCall.data[0]).toMatchObject({
      siswaId: "s1",
      namaTagihan: "SPP September 2026",
      bulan: 9,
      tahun: 2026,
      status: "BELUM_BAYAR",
    })
    expect(createCall.data[0].nominal.toString()).toBe("450000")
    expect(createCall.data[0].jatuhTempo.getDate()).toBe(10)
    expect(createCall.data[0].jatuhTempo.getMonth()).toBe(8) // September (0-indexed)

    // sppKhusus berkelanjutan disimpan untuk kedua siswa
    expect(mockSiswaUpdateMany).toHaveBeenCalledTimes(2)
    expect(mockSiswaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1", deleted_at: null },
        data: expect.objectContaining({}),
      })
    )
    expect(mockSiswaUpdateMany.mock.calls[0][0].data.sppKhusus.toString()).toBe("450000")

    // Email: s1 (siswa + ortu = 2), s2 (siswa saja = 1) → 3 pengiriman
    expect(mockBuildTagihanSppEmail).toHaveBeenCalledTimes(3)
    expect(mockSendEmail).toHaveBeenCalledTimes(3)
    expect(res.data).toMatchObject({
      totalDiproses: 2,
      totalDilewati: 0,
      totalEmailTerkirim: 3,
    })
    expect(res.data!.rincian.map((r) => r.status)).toEqual(["DIBUAT", "DIBUAT"])
  })

  it("idempotent: siswa yang sudah punya tagihan dilewati (SUDAH_ADA)", async () => {
    mockTagihanSiswaFindMany.mockResolvedValue([{ siswaId: "s1" }])
    mockSiswaFindMany.mockResolvedValue([
      {
        id: "s1",
        user: { nama: "Ahmad", email: "ahmad@mail.com" },
        kelas: null,
        orangTua: [],
      },
      {
        id: "s2",
        user: { nama: "Siti", email: "siti@mail.com" },
        kelas: null,
        orangTua: [],
      },
    ])
    mockTagihanSiswaCreateMany.mockResolvedValue({ count: 1 })
    mockTransaction.mockResolvedValue([])
    mockSendEmail.mockResolvedValue({ success: true })

    const res = await generateTagihanSppKhusus({
      bulan: 9,
      tahun: 2026,
      items: [
        { siswaId: "s1", nominal: 450000 },
        { siswaId: "s2", nominal: 480000 },
      ],
      simpanSebagaiSppKhusus: false,
      kirimEmail: false,
    })

    expect(res.success).toBe(true)
    expect(mockTagihanSiswaCreateMany.mock.calls[0][0].data.map((d: { siswaId: string }) => d.siswaId)).toEqual(["s2"])
    expect(res.data!).toMatchObject({ totalDiproses: 1, totalDilewati: 1 })
    expect(res.data!.rincian).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ siswaId: "s1", status: "SUDAH_ADA" }),
        expect.objectContaining({ siswaId: "s2", status: "DIBUAT" }),
      ])
    )
    expect(mockSiswaUpdateMany).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it("siswa tak ditemukan dilaporkan sebagai TIDAK_DITEMUKAN, bukan gagal total", async () => {
    mockTagihanSiswaFindMany.mockResolvedValue([])
    mockSiswaFindMany.mockResolvedValue([]) // s1 & s2 tidak ada di DB
    mockTagihanSiswaCreateMany.mockResolvedValue({ count: 0 })
    mockTransaction.mockResolvedValue([])
    mockSendEmail.mockResolvedValue({ success: true })

    const res = await generateTagihanSppKhusus({
      bulan: 9,
      tahun: 2026,
      items: [{ siswaId: "ghost", nominal: 400000 }],
      simpanSebagaiSppKhusus: false,
      kirimEmail: false,
    })

    expect(res.success).toBe(true)
    expect(res.data!.totalDiproses).toBe(0)
    expect(res.data!.totalDilewati).toBe(1)
    expect(res.data!.rincian[0].status).toBe("TIDAK_DITEMUKAN")
    expect(mockTagihanSiswaCreateMany).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})