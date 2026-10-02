// src/actions/akuntansi-pembayaran.test.ts
//
// Regression tests untuk submitBuktiPembayaranSpp:
//   - submit sekali berhasil,
//   - retry dengan idempotencyKey sama TIDAK membuat pembayaran duplikat,
//   - dua request paralel (klaim status) hanya satu yang berhasil,
//   - race unique violation (P2002) ditangani dengan pesan ramah,
//   - tagihan lunas/dibatalkan/bukan milik user ditolak.

import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  mockRequireAuth,
  mockRateLimitAsync,
  mockGetClientIp,
  mockTagihanFindUnique,
  mockOrangTuaFindUnique,
  mockParentStudentFindFirst,
  mockTransaction,
  mockPembayaranFindFirst,
  mockTagihanFindUniqueTx,
  mockTagihanUpdateMany,
  mockPembayaranCreate,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRateLimitAsync: vi.fn().mockResolvedValue({ success: true }),
  mockGetClientIp: vi.fn().mockResolvedValue("127.0.0.1"),
  mockTagihanFindUnique: vi.fn(),
  mockOrangTuaFindUnique: vi.fn(),
  mockParentStudentFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
  mockPembayaranFindFirst: vi.fn(),
  mockTagihanFindUniqueTx: vi.fn(),
  mockTagihanUpdateMany: vi.fn(),
  mockPembayaranCreate: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  requireRole: vi.fn(),
}))
vi.mock("@/lib/rate-limit", () => ({
  getClientIpFromHeaders: mockGetClientIp,
  rateLimitAsync: mockRateLimitAsync,
}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdmin: vi.fn() }))
vi.mock("@/lib/storage", () => ({
  getSignedUrl: vi.fn(),
  getSignedUrls: vi.fn().mockResolvedValue(new Map()),
}))
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(), buildTagihanSppEmail: vi.fn() }))
vi.mock("@/lib/biaya-ppdb-server", () => ({
  getPengaturanPPDB: vi.fn().mockResolvedValue({
    bankNama: "BRI",
    bankNoRekening: "1",
    bankAtasNama: "X",
    kontakWa: "62",
    namaKontakWa: "Y",
  }),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  default: {
    tagihanSiswa: { findUnique: mockTagihanFindUnique },
    orangTua: { findUnique: mockOrangTuaFindUnique },
    parentStudent: { findFirst: mockParentStudentFindFirst },
    $transaction: mockTransaction,
  },
}))

import { submitBuktiPembayaranSpp } from "@/actions/akuntansi"
import { Prisma } from "@prisma/client"

// URL eksternal ke domain allowlist agar alur verifikasi
// storage internal dilewati (Google Drive adalah satu-satunya
// domain eksternal yang diizinkan).
const payload = {
  tagihanId: "tag-1",
  nominalDibayar: 500000,
  metodeBayar: "Transfer BSI",
  urlBukti: "https://drive.google.com/file/d/abc123/view?usp=sharing",
  namaBukti: "bukti.jpg",
  catatan: "Transfer via BSI",
  idempotencyKey: "idem-key-12345678",
}

function setupSuccess() {
  mockRequireAuth.mockResolvedValue({ id: "user-ortu-1", role: "ORANG_TUA" })
  mockTagihanFindUnique.mockResolvedValue({
    id: "tag-1",
    siswaId: "siswa-1",
    status: "BELUM_BAYAR",
  })
  mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-1" })
  mockParentStudentFindFirst.mockResolvedValue({ id: "rel-1" })
  mockPembayaranFindFirst.mockResolvedValue(null)
  mockTagihanFindUniqueTx.mockResolvedValue({ status: "BELUM_BAYAR" })
  mockTagihanUpdateMany.mockResolvedValue({ count: 1 })
  mockPembayaranCreate.mockResolvedValue({ id: "pay-1" })
  mockTransaction.mockImplementation(
    async (cb: (tx: Record<string, unknown>) => Promise<unknown>) =>
      cb({
        pembayaranSiswa: {
          findFirst: mockPembayaranFindFirst,
          create: mockPembayaranCreate,
        },
        tagihanSiswa: {
          findUnique: mockTagihanFindUniqueTx,
          updateMany: mockTagihanUpdateMany,
        },
      })
  )
}

describe("submitBuktiPembayaranSpp — idempotensi & race", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimitAsync.mockResolvedValue({ success: true })
    setupSuccess()
  })

  it("submit sekali berhasil dan membuat pembayaran PENDING", async () => {
    const result = await submitBuktiPembayaranSpp(payload)

    expect(result.success).toBe(true)
    expect(mockPembayaranCreate).toHaveBeenCalledTimes(1)
    const arg = mockPembayaranCreate.mock.calls[0][0].data
    expect(arg.statusPembayaran).toBe("PENDING")
    expect(arg.idempotencyKey).toBe("idem-key-12345678")
    expect(mockTagihanUpdateMany).toHaveBeenCalledTimes(1)
  })

  it("retry dengan idempotencyKey sama TIDAK membuat pembayaran duplikat", async () => {
    // Simulasi: baris dengan kunci sama sudah ada → replay idempotent.
    mockPembayaranFindFirst.mockResolvedValue({ id: "pay-existing" })

    const result = await submitBuktiPembayaranSpp(payload)

    expect(result.success).toBe(true)
    expect(mockPembayaranCreate).not.toHaveBeenCalled()
    // Status tagihan tidak diubah lagi pada replay.
    expect(mockTagihanUpdateMany).not.toHaveBeenCalled()
  })

  it("dua request paralel: klaim status 0 baris → request kedua ditolak", async () => {
    mockTagihanUpdateMany.mockResolvedValue({ count: 0 })

    const result = await submitBuktiPembayaranSpp(payload)

    expect(result.success).toBe(false)
    expect(result.message).toContain("menunggu verifikasi")
    expect(mockPembayaranCreate).not.toHaveBeenCalled()
  })

  it("unique violation (P2002) ditangani dengan pesan ramah, bukan error mentah", async () => {
    mockTransaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.3",
      })
    )

    const result = await submitBuktiPembayaranSpp(payload)

    expect(result.success).toBe(false)
    expect(result.message).toContain("baru saja dikirim")
  })

  it("tagihan lunas ditolak", async () => {
    mockTagihanFindUnique.mockResolvedValue({
      id: "tag-1",
      siswaId: "siswa-1",
      status: "SUDAH_BAYAR",
    })

    const result = await submitBuktiPembayaranSpp(payload)

    expect(result.success).toBe(false)
    expect(result.message).toContain("lunas")
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("tagihan dibatalkan ditolak", async () => {
    mockTagihanFindUnique.mockResolvedValue({
      id: "tag-1",
      siswaId: "siswa-1",
      status: "DIBATALKAN",
    })

    const result = await submitBuktiPembayaranSpp(payload)

    expect(result.success).toBe(false)
    expect(result.message).toContain("dibatalkan")
  })

  it("user yang bukan pemilik tagihan ditolak", async () => {
    mockParentStudentFindFirst.mockResolvedValue(null)

    const result = await submitBuktiPembayaranSpp(payload)

    expect(result.success).toBe(false)
    expect(result.message).toContain("bukan anak Anda")
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("rate limit mencegah spam submit", async () => {
    mockRateLimitAsync.mockResolvedValue({ success: false })

    const result = await submitBuktiPembayaranSpp(payload)

    expect(result.success).toBe(false)
    expect(result.message).toContain("Terlalu banyak")
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("URL eksternal domain arbitrary ditolak (allowlist ketat)", async () => {
    const result = await submitBuktiPembayaranSpp({
      ...payload,
      urlBukti: "https://evil.example.com/bukti.jpg",
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("tidak diizinkan")
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("URL http:// ditolak — hanya https yang diizinkan", async () => {
    const result = await submitBuktiPembayaranSpp({
      ...payload,
      urlBukti: "http://drive.google.com/file/d/abc",
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("https")
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("URL javascript: ditolak (XSS via URL)", async () => {
    const result = await submitBuktiPembayaranSpp({
      ...payload,
      urlBukti: "javascript:alert(1)",
    })

    expect(result.success).toBe(false)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("URL dengan kredensial tersembunyi ditolak", async () => {
    const result = await submitBuktiPembayaranSpp({
      ...payload,
      urlBukti: "https://user:pass@drive.google.com/file/d/abc",
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("kredensial")
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("URL Google Drive yang valid disimpan ternormalisasi", async () => {
    await submitBuktiPembayaranSpp(payload)

    const arg = mockPembayaranCreate.mock.calls[0][0].data
    // Fragment dibuang; query dipertahankan.
    expect(arg.urlBukti).toBe(
      "https://drive.google.com/file/d/abc123/view?usp=sharing"
    )
  })

  it("URL dengan fragment dinormalisasi sebelum disimpan", async () => {
    await submitBuktiPembayaranSpp({
      ...payload,
      urlBukti: "https://drive.google.com/file/d/abc/view#frag",
    })

    const arg = mockPembayaranCreate.mock.calls[0][0].data
    expect(arg.urlBukti).toBe("https://drive.google.com/file/d/abc/view")
  })
})
