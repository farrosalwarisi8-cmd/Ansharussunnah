// src/actions/upload-dokumen.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

// ========================================================
// Mocks — di-hoist agar tersedia sebelum import modul
// ========================================================

const {
  mockPendaftaranFindUnique,
  mockPrismaTransaction,
  mockStorageUpload,
  mockStorageRemove,
  mockValidateFile,
  mockRateLimitAsync,
  mockGetClientIp,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockPendaftaranFindUnique: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockStorageUpload: vi.fn(),
  mockStorageRemove: vi.fn(),
  mockValidateFile: vi.fn(),
  mockRateLimitAsync: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    pendaftaran: {
      findUnique: mockPendaftaranFindUnique,
    },
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
  },
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
      }),
    },
  }),
}))

vi.mock("@/lib/storage", () => ({
  validateFile: (...args: unknown[]) => mockValidateFile(...args),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: (...args: unknown[]) => mockRateLimitAsync(...args),
  getClientIpFromHeaders: (...args: unknown[]) =>
    mockGetClientIp(...args),
}))

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

// ========================================================
// Import setelah semua vi.mock() terdaftar
// ========================================================

import { uploadDokumenPendaftaran } from "@/actions/upload-dokumen"

// ========================================================
// Data dummy
// ========================================================

const mockPendaftaran = {
  id: "pend-1",
  nomorPendaftaran: "REG-2026-00001",
  dokKartuKeluarga: null,
  dokAkteLahir: "dokumen-pendaftaran/pendaftaran/pend-1/lama.pdf",
  dokFoto: null,
}

function makeFile(name: string, type: string): File {
  return new File(["dummy-content"], name, { type })
}

function makeFormData(
  overrides: Record<string, File | string> = {}
): FormData {
  const fd = new FormData()
  fd.set("nomorPendaftaran", "REG-2026-00001")
  for (const [key, value] of Object.entries(overrides)) {
    fd.set(key, value)
  }
  return fd
}

// ========================================================
// Setup
// ========================================================

beforeEach(() => {
  vi.clearAllMocks()

  // Default: rate limit lolos
  mockRateLimitAsync.mockResolvedValue({ success: true })
  mockGetClientIp.mockResolvedValue("127.0.0.1")

  // Default: pendaftaran ditemukan
  mockPendaftaranFindUnique.mockResolvedValue(mockPendaftaran)

  // Default: validasi file lolos & upload storage sukses
  mockValidateFile.mockResolvedValue({ valid: true })
  mockStorageUpload.mockResolvedValue({ error: null })
  mockStorageRemove.mockResolvedValue({ error: null })

  // Default: transaction sukses — eksekusi callback dengan tx mock
  mockPrismaTransaction.mockImplementation(async (cb: unknown) => {
    if (typeof cb === "function") {
      return cb({ pendaftaran: { update: vi.fn().mockResolvedValue({}) } })
    }
    return undefined
  })
})

// ========================================================
// 1. Validasi Input
// ========================================================

describe("uploadDokumenPendaftaran — Validasi Input", () => {
  it("harus menolak tanpa nomor pendaftaran", async () => {
    const fd = new FormData()
    fd.set("kartuKeluarga", makeFile("kk.jpg", "image/jpeg"))

    const result = await uploadDokumenPendaftaran(fd)

    expect(result.success).toBe(false)
    expect(result.message).toContain("Nomor pendaftaran wajib diisi")
  })

  it("harus menolak jika tidak ada berkas yang dikirim", async () => {
    const result = await uploadDokumenPendaftaran(makeFormData())

    expect(result.success).toBe(false)
    expect(result.message).toContain(
      "Pilih minimal satu berkas"
    )
  })

  it("harus menolak file yang tidak lolos validasi (magic bytes/ukuran)", async () => {
    mockValidateFile.mockResolvedValue({
      valid: false,
      error: "Format berkas tidak valid",
    })

    const result = await uploadDokumenPendaftaran(
      makeFormData({ kartuKeluarga: makeFile("kk.exe", "application/octet-stream") })
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain("Format berkas tidak valid")
    expect(mockStorageUpload).not.toHaveBeenCalled()
  })

  it("harus menolak ekstensi yang tidak diizinkan", async () => {
    const result = await uploadDokumenPendaftaran(
      makeFormData({ kartuKeluarga: makeFile("kk.txt", "text/plain") })
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain("format berkas tidak valid")
    expect(mockStorageUpload).not.toHaveBeenCalled()
  })

  it("harus menolak jika nomor pendaftaran tidak ditemukan", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(null)

    const result = await uploadDokumenPendaftaran(
      makeFormData({ foto: makeFile("foto.png", "image/png") })
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain("Nomor pendaftaran tidak ditemukan")
    expect(mockStorageUpload).not.toHaveBeenCalled()
  })

  it("harus terkena rate limit", async () => {
    mockRateLimitAsync.mockResolvedValue({ success: false })

    const result = await uploadDokumenPendaftaran(
      makeFormData({ foto: makeFile("foto.jpg", "image/jpeg") })
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain("Terlalu banyak")
    expect(mockStorageUpload).not.toHaveBeenCalled()
  })
})

// ========================================================
// 2. Kasus Sukses
// ========================================================

describe("uploadDokumenPendaftaran — Kasus Sukses", () => {
  it("harus berhasil mengunggah satu dokumen baru", async () => {
    const result = await uploadDokumenPendaftaran(
      makeFormData({ kartuKeluarga: makeFile("kk.jpg", "image/jpeg") })
    )

    expect(result.success).toBe(true)
    expect(mockStorageUpload).toHaveBeenCalledOnce()

    // Path file ditentukan SERVER (folder per pendaftaran), bukan dari klien
    const [path, , options] = mockStorageUpload.mock.calls[0]
    expect(path).toMatch(/^dokumen-pendaftaran\/pendaftaran\/pend-1\//)
    expect(path.endsWith(".jpg")).toBe(true)
    expect(options.upsert).toBe(false)

    // Update record via transaction memakai path server
    const txCb = mockPrismaTransaction.mock.calls[0][0]
    const txMock = { pendaftaran: { update: vi.fn().mockResolvedValue({}) } }
    await txCb(txMock)
    const updatedData = txMock.pendaftaran.update.mock.calls[0][0].data
    expect(updatedData.dokKartuKeluarga).toBe(path)
  })

  it("harus berhasil mengunggah banyak dokumen sekaligus", async () => {
    const result = await uploadDokumenPendaftaran(
      makeFormData({
        kartuKeluarga: makeFile("kk.jpg", "image/jpeg"),
        akteLahir: makeFile("akte.pdf", "application/pdf"),
        foto: makeFile("foto.png", "image/png"),
      })
    )

    expect(result.success).toBe(true)
    expect(mockStorageUpload).toHaveBeenCalledTimes(3)
  })

  it("harus menghapus dokumen lama yang diganti secara best-effort", async () => {
    const result = await uploadDokumenPendaftaran(
      makeFormData({ akteLahir: makeFile("akte-baru.pdf", "application/pdf") })
    )

    expect(result.success).toBe(true)
    expect(mockStorageRemove).toHaveBeenCalled()
    const [removedPaths] = mockStorageRemove.mock.calls[0]
    expect(removedPaths).toContain(
      "dokumen-pendaftaran/pendaftaran/pend-1/lama.pdf"
    )
  })

  it("tidak menghapus dokumen apa pun jika tidak ada yang diganti", async () => {
    const result = await uploadDokumenPendaftaran(
      makeFormData({ foto: makeFile("foto.png", "image/png") })
    )

    expect(result.success).toBe(true)
    expect(mockStorageRemove).not.toHaveBeenCalled()
  })
})

// ========================================================
// 3. Kegagalan & Rollback
// ========================================================

describe("uploadDokumenPendaftaran — Kegagalan & Rollback", () => {
  it("harus membersihkan file yang sudah terupload jika salah satu upload gagal", async () => {
    mockStorageUpload
      .mockResolvedValueOnce({ error: null }) // KK sukses
      .mockResolvedValueOnce({ error: { message: "quota" } }) // Akte gagal

    const result = await uploadDokumenPendaftaran(
      makeFormData({
        kartuKeluarga: makeFile("kk.jpg", "image/jpeg"),
        akteLahir: makeFile("akte.pdf", "application/pdf"),
      })
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain("Akta Kelahiran")
    // File KK yang sudah terupload dibersihkan
    expect(mockStorageRemove).toHaveBeenCalled()
    expect(mockPrismaTransaction).not.toHaveBeenCalled()
  })

  it("harus membersihkan file jika transaction DB gagal", async () => {
    mockPrismaTransaction.mockRejectedValue(new Error("db down"))

    const result = await uploadDokumenPendaftaran(
      makeFormData({ kartuKeluarga: makeFile("kk.jpg", "image/jpeg") })
    )

    expect(result.success).toBe(false)
    expect(mockStorageRemove).toHaveBeenCalled()
  })
})