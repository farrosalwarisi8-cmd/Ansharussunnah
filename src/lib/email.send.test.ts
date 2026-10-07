// src/lib/email.send.test.ts
//
// Menguji `sendEmail()` setelah ketergantungan outbox dihapus:
//   - provider (Resend) dipanggil LANGSUNG dan hasilnya ditunggu,
//   - `enqueueEmail()` TIDAK dipanggil (di-mock: langsung melempar bila terpakai),
//   - hasil sukses provider diteruskan apa adanya,
//   - error/exception provider → { success: false, error } (tidak melempar),
//   - timeout provider diteruskan sebagai kegagalan yang jelas,
//   - API key/rahasia tidak bocor ke response maupun log,
//   - parameter lama (jenisEmail/idempotencyKey) tetap kompatibel,
//   - idempotencyKey mencegah pengiriman ganda dalam satu instance proses.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

const { mockSendProvider } = vi.hoisted(() => ({ mockSendProvider: vi.fn() }))

// Ambil modul provider ASLI (agar sanitasi error ikut teruji), tapi ganti
// fungsi kirimnya dengan mock.
vi.mock("@/lib/email-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email-provider")>()
  return { ...actual, sendEmailViaProvider: mockSendProvider }
})

// Bila ada yang mengembalikan `enqueueEmail` ke alur email, langsung gagal.
vi.mock("@/lib/email-outbox", () => ({
  enqueueEmail: vi.fn(() => {
    throw new Error("enqueueEmail tidak boleh dipanggil dari alur email baru")
  }),
}))

import { sendEmail, resetRiwayatIdempotencyEmail } from "@/lib/email"

const DASAR = {
  to: "wali@example.com",
  subject: "Subjek Tes",
  html: "<p>Halo</p>",
}

beforeEach(() => {
  vi.clearAllMocks()
  resetRiwayatIdempotencyEmail()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("sendEmail — pengiriman langsung ke provider", () => {
  it("memanggil provider langsung dengan to/subject/html dan meneruskan hasil sukses", async () => {
    mockSendProvider.mockResolvedValueOnce({ success: true, id: "resend-123" })

    const hasil = await sendEmail(DASAR)

    expect(mockSendProvider).toHaveBeenCalledTimes(1)
    expect(mockSendProvider).toHaveBeenCalledWith(DASAR)
    expect(hasil).toEqual({ success: true, id: "resend-123" })
  })

  it("meneruskan error provider sebagai { success: false, error } tanpa melempar", async () => {
    mockSendProvider.mockResolvedValueOnce({
      success: false,
      error: "Provider sedang gangguan",
    })

    const hasil = await sendEmail(DASAR)

    expect(hasil).toEqual({ success: false, error: "Provider sedang gangguan" })
  })

  it("timeout provider diteruskan sebagai kegagalan yang jelas (bukan menggantung)", async () => {
    mockSendProvider.mockResolvedValueOnce({
      success: false,
      error: "Panggilan provider email melebihi batas waktu 30 detik",
    })

    const hasil = await sendEmail(DASAR)

    expect(hasil.success).toBe(false)
    if (!hasil.success) expect(hasil.error).toContain("batas waktu")
  })

  it("exception tak terduga tidak dilempar ke pemanggil dan tidak membocorkan API key", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockSendProvider.mockRejectedValueOnce(
      new Error("connection reset re_abcdef123456789 token=rahasia-baru"),
    )

    const hasil = await sendEmail(DASAR)

    expect(hasil.success).toBe(false)
    if (!hasil.success) {
      expect(hasil.error).not.toContain("re_abcdef123456789")
      expect(hasil.error).not.toContain("rahasia-baru")
      expect(hasil.error.length).toBeGreaterThan(0)
    }

    // Log pun tidak boleh memuat rahasia.
    const logCalls = vi.mocked(console.error).mock.calls.flat().join(" ")
    expect(logCalls).not.toContain("re_abcdef123456789")
    expect(logCalls).not.toContain("rahasia-baru")
  })

  it("parameter lama jenisEmail & idempotencyKey tetap kompatibel dan tidak menulis outbox", async () => {
    mockSendProvider.mockResolvedValueOnce({ success: true, id: "id-1" })

    const hasil = await sendEmail({
      ...DASAR,
      jenisEmail: "kredensial_akun",
      idempotencyKey: "kredensial:REG-2026-00001",
    })

    expect(hasil.success).toBe(true)
    expect(mockSendProvider).toHaveBeenCalledTimes(1)
    // enqueueEmail di-mock akan melempar bila terpakai — tidak ada error berarti
    // alur email tidak menyentuh outbox.
  })
})

describe("sendEmail — guard idempotency", () => {
  it("idempotencyKey yang sama tidak dikirim dua kali dalam satu instance", async () => {
    mockSendProvider.mockResolvedValue({ success: true, id: "id-1" })
    const params = { ...DASAR, idempotencyKey: "pendaftaran-berhasil:REG-1" }

    const pertama = await sendEmail(params)
    const kedua = await sendEmail(params)

    expect(pertama.success).toBe(true)
    expect(kedua.success).toBe(true)
    expect(mockSendProvider).toHaveBeenCalledTimes(1)
  })

  it("event berbeda (idempotencyKey berbeda) tetap dikirim", async () => {
    mockSendProvider.mockResolvedValue({ success: true, id: "id-1" })

    await sendEmail({ ...DASAR, idempotencyKey: "event:a" })
    await sendEmail({ ...DASAR, idempotencyKey: "event:b" })

    expect(mockSendProvider).toHaveBeenCalledTimes(2)
  })

  it("pengiriman GAGAL tidak mengunci kunci idempotency — retry event yang sama boleh mencoba lagi", async () => {
    mockSendProvider
      .mockResolvedValueOnce({ success: false, error: "sementara gagal" })
      .mockResolvedValueOnce({ success: true, id: "id-2" })
    const params = { ...DASAR, idempotencyKey: "event:retry" }

    const gagal = await sendEmail(params)
    const ulang = await sendEmail(params)

    expect(gagal.success).toBe(false)
    expect(ulang.success).toBe(true)
    expect(mockSendProvider).toHaveBeenCalledTimes(2)
  })
})

describe("tidak ada alur baru yang memakai outbox", () => {
  const akar = process.cwd()

  function bacaSemuaTs(dir: string, hasil: string[] = []): string[] {
    for (const entri of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entri.name)
      if (entri.isDirectory()) bacaSemuaTs(p, hasil)
      else if (/\.(ts|tsx)$/.test(entri.name) && !entri.name.endsWith(".test.ts"))
        hasil.push(p)
    }
    return hasil
  }

  it("src/lib/email.ts memanggil provider langsung dan tidak lagi mengenal enqueueEmail", () => {
    const src = readFileSync(path.join(akar, "src/lib/email.ts"), "utf8")
    expect(src).toContain("sendEmailViaProvider")
    expect(src).not.toContain("enqueueEmail")
    // Hanya import TYPE dari modul outbox (JenisEmail) yang boleh tersisa.
    expect(src).not.toMatch(/import\s*\{[^}]*enqueueEmail/)
  })

  it("tidak ada pemanggilan enqueueEmail di actions/app/components", () => {
    const folder = ["src/actions", "src/app", "src/components"].map((f) =>
      path.join(akar, f),
    )
    const pelanggar: string[] = []
    for (const f of folder) {
      for (const file of bacaSemuaTs(f)) {
        const src = readFileSync(file, "utf8")
        if (src.includes("enqueueEmail(")) pelanggar.push(file)
      }
    }
    expect(pelanggar).toEqual([])
  })
})
