// src/actions/email-outbox.test.ts
//
// Menguji aksi admin email outbox:
//   - non-admin ditolak TANPA query DB,
//   - admin menerima daftar + ringkasan + pagination,
//   - `payload` (HTML berisi kredensial) TIDAK diambil dari DB.

import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  mockRequireRole,
  mockFindMany,
  mockCount,
  mockGroupBy,
  mockRetryManual,
  mockRevalidate,
} = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockGroupBy: vi.fn(),
  mockRetryManual: vi.fn(),
  mockRevalidate: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }))
vi.mock("@/lib/email-outbox", () => ({
  retryEmailOutboxManual: mockRetryManual,
}))
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidate }))
vi.mock("@/lib/prisma", () => ({
  default: {
    emailOutbox: {
      findMany: mockFindMany,
      count: mockCount,
      groupBy: mockGroupBy,
    },
  },
}))

import {
  getDaftarEmailOutbox,
  retryEmailOutbox,
} from "@/actions/email-outbox"

describe("getDaftarEmailOutbox", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "SUPER_ADMIN" })
    mockFindMany.mockResolvedValue([
      {
        id: "mail-1",
        jenisEmail: "tagihan_spp",
        recipient: "a@b.c",
        subject: "Tagihan",
        status: "PENDING",
        attempts: 1,
        lastError: null,
        nextRetryAt: new Date(),
        sentAt: null,
        createdAt: new Date(),
      },
    ])
    mockCount.mockResolvedValue(1)
    mockGroupBy.mockResolvedValue([
      { status: "PENDING", _count: { _all: 1 } },
      { status: "SENT", _count: { _all: 2 } },
      { status: "FAILED", _count: { _all: 3 } },
    ])
  })

  it("menolak non-admin tanpa query database", async () => {
    const { AppError } = await import("@/lib/prisma-error")
    mockRequireRole.mockRejectedValue(new AppError("Forbidden"))

    const result = await getDaftarEmailOutbox()

    expect(result.success).toBe(false)
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it("mengembalikan daftar + ringkasan status + pagination", async () => {
    const result = await getDaftarEmailOutbox({ status: "PENDING", page: 2, pageSize: 25 })

    expect(result.success).toBe(true)
    expect(result.data!.total).toBe(1)
    expect(result.data!.page).toBe(2)
    expect(result.data!.pageSize).toBe(25)
    expect(result.data!.ringkasan).toEqual({ pending: 1, sent: 2, failed: 3 })
    // query memakai skip sesuai halaman
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 25, take: 25 })
    )
  })

  it("TIDAK mengambil kolom payload (HTML berisi kredensial)", async () => {
    await getDaftarEmailOutbox()
    const arg = mockFindMany.mock.calls[0][0]
    expect(arg.select).toBeDefined()
    expect(arg.select.payload).toBeUndefined()
  })

  it("membatasi pageSize maksimum 100", async () => {
    await getDaftarEmailOutbox({ pageSize: 5000 })
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }))
  })
})

describe("retryEmailOutbox", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "SUPER_ADMIN" })
  })

  it("meneruskan retry manual dan revalidate saat sukses", async () => {
    mockRetryManual.mockResolvedValue({ success: true, message: "Email berhasil dikirim ulang" })

    const result = await retryEmailOutbox("mail-1")

    expect(result.success).toBe(true)
    expect(mockRetryManual).toHaveBeenCalledWith("mail-1")
    expect(mockRevalidate).toHaveBeenCalledWith("/dashboard/email-outbox")
  })

  it("mengembalikan pesan gagal dari lib", async () => {
    mockRetryManual.mockResolvedValue({ success: false, message: "Email ini sudah terkirim" })

    const result = await retryEmailOutbox("mail-1")

    expect(result.success).toBe(false)
    expect(result.message).toContain("sudah terkirim")
  })
})
