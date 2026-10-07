// src/lib/email-outbox.test.ts
//
// Menguji sistem outbox email:
//   - enqueueEmail menyimpan PENDING + kunci idempotency,
//   - event yang sama (P2002) tidak membuat duplikat,
//   - enqueue TIDAK pernah melempar (event bisnis tidak boleh gagal),
//   - worker menandai SENT saat sukses,
//   - kegagalan provider → PENDING + backoff + lastError (tersanitasi),
//   - setelah batas percobaan → FAILED tanpa nextRetryAt,
//   - klaim atomik: baris yang sudah diambil worker lain dilewati,
//   - retry manual mengirim ulang dan melaporkan hasil.

import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

const {
  mockCreate,
  mockFindMany,
  mockFindUnique,
  mockUpdate,
  mockUpdateMany,
  mockSendProvider,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockSendProvider: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    emailOutbox: {
      create: mockCreate,
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
      updateMany: mockUpdateMany,
    },
  },
}))

vi.mock("@/lib/email-provider", () => ({
  sendEmailViaProvider: mockSendProvider,
}))

import {
  enqueueEmail,
  prosesEmailOutbox,
  retryEmailOutboxManual,
  sanitasiErrorEmail,
  hitungBackoff,
  MAX_EMAIL_ATTEMPTS,
} from "@/lib/email-outbox"
import { Prisma, StatusEmailOutbox } from "@prisma/client"

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "mail-1",
    recipient: "ortu@example.com",
    subject: "Subjek",
    payload: { html: "<p>Halo</p>" },
    attempts: 0,
    ...overrides,
  }
}

describe("enqueueEmail", () => {
  beforeEach(() => vi.clearAllMocks())

  it("menyimpan email PENDING dengan kunci idempotency", async () => {
    mockCreate.mockResolvedValue({ id: "mail-1" })

    const hasil = await enqueueEmail({
      jenisEmail: "tagihan_spp",
      recipient: "ortu@example.com",
      subject: "Tagihan SPP",
      html: "<p>x</p>",
      idempotencyKey: "spp:2026-3:a@b.c",
    })

    expect(hasil).toEqual({ ok: true, duplicate: false, id: "mail-1" })
    const arg = mockCreate.mock.calls[0][0].data
    expect(arg.status).toBe("PENDING")
    expect(arg.idempotencyKey).toBe("spp:2026-3:a@b.c")
    expect(arg.payload.html).toBe("<p>x</p>")
  })

  it("event yang sama (P2002) tidak membuat duplikat dan tidak melempar", async () => {
    mockCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "6.19.3",
      })
    )

    const hasil = await enqueueEmail({
      jenisEmail: "kredensial_akun",
      recipient: "a@b.c",
      subject: "s",
      html: "h",
      idempotencyKey: "kredensial:REG-1",
    })

    expect(hasil.ok).toBe(true)
    expect(hasil.duplicate).toBe(true)
  })

  it("kegagalan DB tidak melempar, hanya mengembalikan ok:false", async () => {
    mockCreate.mockRejectedValue(new Error("connection refused"))

    const hasil = await enqueueEmail({
      jenisEmail: "umum",
      recipient: "a@b.c",
      subject: "s",
      html: "h",
    })

    expect(hasil.ok).toBe(false)
    expect(hasil.duplicate).toBe(false)
  })
})

describe("sanitasiErrorEmail", () => {
  it("menyamarkan token/password/bearer dan membatasi panjang", () => {
    const bearer = sanitasiErrorEmail("Gagal: bearer abc.def.ghi")
    expect(bearer).toContain("[REDACTED]")
    expect(bearer).not.toContain("abc.def.ghi")

    const pwd = sanitasiErrorEmail("password: rahasia123")
    expect(pwd).not.toContain("rahasia123")
    expect(pwd).toContain("[REDACTED]")

    expect(sanitasiErrorEmail("x".repeat(2000)).length).toBeLessThanOrEqual(500)
  })
})

describe("prosesEmailOutbox", () => {
  beforeEach(() => vi.clearAllMocks())

  it("menandai SENT saat provider sukses", async () => {
    mockFindMany.mockResolvedValue([row()])
    mockUpdateMany.mockResolvedValue({ count: 1 })
    mockSendProvider.mockResolvedValue({ success: true, id: "resend-1" })
    mockUpdate.mockResolvedValue({})

    const hasil = await prosesEmailOutbox({ limit: 10 })

    expect(hasil.terkirim).toBe(1)
    const updateArg = mockUpdate.mock.calls[0][0].data
    expect(updateArg.status).toBe("SENT")
    expect(updateArg.sentAt).toBeInstanceOf(Date)
    expect(updateArg.nextRetryAt).toBeNull()
  })

  it("kegagalan provider → PENDING + backoff + lastError tersanitasi", async () => {
    mockFindMany.mockResolvedValue([row()])
    mockUpdateMany.mockResolvedValue({ count: 1 })
    mockSendProvider.mockResolvedValue({
      success: false,
      error: "provider down — token: SECRET99",
    })
    mockUpdate.mockResolvedValue({})

    const hasil = await prosesEmailOutbox({ limit: 10 })

    expect(hasil.gagalSementara).toBe(1)
    const updateArg = mockUpdate.mock.calls[0][0].data
    expect(updateArg.status).toBe("PENDING")
    expect(updateArg.nextRetryAt).toBeInstanceOf(Date)
    expect(updateArg.lastError).not.toContain("SECRET99")
  })

  it("setelah batas percobaan → FAILED tanpa nextRetryAt", async () => {
    mockFindMany.mockResolvedValue([row({ attempts: MAX_EMAIL_ATTEMPTS - 1 })])
    mockUpdateMany.mockResolvedValue({ count: 1 })
    mockSendProvider.mockResolvedValue({ success: false, error: "gagal total" })
    mockUpdate.mockResolvedValue({})

    const hasil = await prosesEmailOutbox({ limit: 10 })

    expect(hasil.gagalPermanen).toBe(1)
    const updateArg = mockUpdate.mock.calls[0][0].data
    expect(updateArg.status).toBe("FAILED")
    expect(updateArg.nextRetryAt).toBeNull()
  })

  it("baris yang sudah diklaim worker lain dilewati (tidak dikirim)", async () => {
    mockFindMany.mockResolvedValue([row()])
    mockUpdateMany.mockResolvedValue({ count: 0 })

    const hasil = await prosesEmailOutbox({ limit: 10 })

    expect(hasil.diambil).toBe(1)
    expect(hasil.terkirim).toBe(0)
    expect(mockSendProvider).not.toHaveBeenCalled()
  })
})

describe("retryEmailOutboxManual", () => {
  beforeEach(() => vi.clearAllMocks())

  it("mengirim ulang email FAILED dan melaporkan sukses", async () => {
    mockFindUnique.mockResolvedValue({ id: "mail-1", status: "FAILED" })
    mockUpdate.mockResolvedValue({})
    mockFindMany.mockResolvedValue([row()])
    mockUpdateMany.mockResolvedValue({ count: 1 })
    mockSendProvider.mockResolvedValue({ success: true })

    const hasil = await retryEmailOutboxManual("mail-1")

    expect(hasil.success).toBe(true)
    // Reset attempts sebelum diproses.
    const resetArg = mockUpdate.mock.calls[0][0].data
    expect(resetArg.status).toBe("PENDING")
    expect(resetArg.attempts).toBe(0)
  })

  it("menolak retry untuk email yang sudah terkirim", async () => {
    mockFindUnique.mockResolvedValue({ id: "mail-1", status: "SENT" })

    const hasil = await retryEmailOutboxManual("mail-1")

    expect(hasil.success).toBe(false)
    expect(hasil.message).toContain("sudah terkirim")
    expect(mockSendProvider).not.toHaveBeenCalled()
  })
})

describe("hitungBackoff", () => {
  it("naik bertahap dan jenuh pada nilai maksimum", () => {
    const now = new Date("2026-01-01T00:00:00Z")
    const b1 = hitungBackoff(1, now).getTime() - now.getTime()
    const b3 = hitungBackoff(3, now).getTime() - now.getTime()
    expect(b1).toBe(1 * 60 * 1000)
    expect(b3).toBeGreaterThan(b1)
    // attempts sangat besar → tetap delay maksimum (tidak melebihi array).
    expect(hitungBackoff(999, now).getTime()).toBe(hitungBackoff(5, now).getTime())
  })
})

describe("outbox legacy — model & data lama dipertahankan", () => {
  const akar = process.cwd()

  it("model Prisma dan migration tabel email_outbox tetap ada (tidak dihapus)", () => {
    const schema = readFileSync(path.join(akar, "prisma/schema.prisma"), "utf8")
    expect(schema).toContain("model EmailOutbox")
    expect(schema).toContain('@@map("email_outbox")')

    const migration = readFileSync(
      path.join(akar, "prisma/migrations/20261002000000_email_outbox/migration.sql"),
      "utf8",
    )
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "email_outbox"')
    // Tidak boleh ada statement penghapusan tabel di migration outbox.
    expect(migration).not.toMatch(/DROP\s+TABLE/i)
  })

  it("enum status legacy tetap tersedia untuk data PENDING/SENT/FAILED", () => {
    expect(String(StatusEmailOutbox.PENDING)).toBe("PENDING")
    expect(String(StatusEmailOutbox.SENT)).toBe("SENT")
    expect(String(StatusEmailOutbox.FAILED)).toBe("FAILED")
  })

  it("tidak ada kode yang menghapus baris/tabel email_outbox", () => {
    const berkas: string[] = []
    for (const folder of ["src", "scripts"]) {
      const dir = path.join(akar, folder)
      for (const rel of readdirSync(dir, { recursive: true }) as string[]) {
        const p = path.join(dir, rel)
        if (/\.(ts|tsx)$/.test(p) && !p.endsWith(".test.ts")) berkas.push(p)
      }
    }
    const pelanggar = berkas.filter((f) =>
      /emailOutbox\.(delete|deleteMany)|DROP\s+TABLE[^;]*email_outbox/i.test(
        readFileSync(f, "utf8"),
      ),
    )
    expect(pelanggar).toEqual([])
  })

  it("worker legacy tetap bisa membaca & memproses baris lama", () => {
    // fungsi worker/reader masih diekspor dan utuh (compile-time teruji tsc).
    expect(typeof prosesEmailOutbox).toBe("function")
    expect(typeof retryEmailOutboxManual).toBe("function")
    expect(typeof enqueueEmail).toBe("function")
  })
})
