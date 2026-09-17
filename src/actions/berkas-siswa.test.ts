// src/actions/berkas-siswa.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

// ========================================================
// Mocks — di-hoist agar tersedia sebelum import modul
// ========================================================

const {
  mockSiswaFindUnique,
  mockSiswaUpdate,
  mockStorageUpload,
  mockStorageRemove,
  mockValidateFile,
  mockGetSignedUrls,
  mockRequireGuruAdmin,
  mockToUserFriendlyError,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockSiswaFindUnique: vi.fn(),
  mockSiswaUpdate: vi.fn(),
  mockStorageUpload: vi.fn(),
  mockStorageRemove: vi.fn(),
  mockValidateFile: vi.fn(),
  mockGetSignedUrls: vi.fn(),
  mockRequireGuruAdmin: vi.fn(),
  mockToUserFriendlyError: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    siswa: {
      findUnique: mockSiswaFindUnique,
      update: mockSiswaUpdate,
    },
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
  getSignedUrls: (...args: unknown[]) => mockGetSignedUrls(...args),
}))

vi.mock("@/lib/auth", () => ({
  requireGuruAdmin: () => mockRequireGuruAdmin(),
}))

vi.mock("@/lib/prisma-error", () => ({
  toUserFriendlyError: (...args: unknown[]) => mockToUserFriendlyError(...args),
}))

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

// ========================================================
// Import setelah semua vi.mock() terdaftar
// ========================================================

import {
  getBerkasSiswa,
  uploadBerkasSiswa,
  hapusBerkasSiswa,
} from "@/actions/berkas-siswa"

// ========================================================
// Data dummy
// ========================================================

type MockSiswaRow = {
  id: string
  userId: string
  nisn: string | null
  nis: string | null
  jenisKelamin: string | null
  deleted_at: Date | null
  dokKartuKeluarga: string | null
  dokAkteLahir: string | null
  dokFoto: string | null
  dokLainnya: string[]
  user: { nama: string; email: string }
  kelas: { nama: string; jenjang: { nama: string } } | null
}

const mockSiswa: MockSiswaRow = {
  id: "siswa-1",
  userId: "user-1",
  nisn: "1234567890",
  nis: "2026001",
  jenisKelamin: "LAKI_LAKI",
  deleted_at: null,
  dokKartuKeluarga: null,
  dokAkteLahir: "berkas-siswa/siswa-1/akteLahir/lama.pdf",
  dokFoto: null,
  dokLainnya: ["berkas-siswa/siswa-1/lainnya/a.pdf"],
  user: { nama: "ABDULLAH", email: "abdullah@example.com" },
  kelas: { nama: "7A", jenjang: { nama: "SMP" } },
}

function makeFile(name: string, type: string): File {
  return new File(["dummy-content"], name, { type })
}

function makeFormData(file?: File): FormData {
  const fd = new FormData()
  if (file) fd.append("file", file)
  return fd
}

// ========================================================
// Setup
// ========================================================

beforeEach(() => {
  vi.clearAllMocks()

  // Default: guru admin lolos guard
  mockRequireGuruAdmin.mockResolvedValue({ id: "guru-1", role: "GURU", isAdmin: true })

  // Default: siswa ditemukan
  mockSiswaFindUnique.mockResolvedValue(mockSiswa)

  // Default: update sukses
  mockSiswaUpdate.mockResolvedValue({ ...mockSiswa })

  // Default: validasi file lolos & storage sukses
  mockValidateFile.mockResolvedValue({ valid: true, detectedType: "image/jpeg" })
  mockStorageUpload.mockResolvedValue({ error: null })
  mockStorageRemove.mockResolvedValue({ error: null })

  // Default: signed URLs sukses
  mockGetSignedUrls.mockImplementation(async (bucket: string, paths: string[]) => {
    const map = new Map<string, string>()
    for (const p of paths) map.set(p, `https://cdn.test/${encodeURIComponent(p)}`)
    return map
  })

  // Default: error mapping
  mockToUserFriendlyError.mockImplementation((_err: unknown, fallback: string) => fallback)
})

// ========================================================
// getBerkasSiswa
// ========================================================

describe("getBerkasSiswa", () => {
  it("harus gagal jika bukan guru admin", async () => {
    mockRequireGuruAdmin.mockRejectedValue(new Error("Akses ditolak"))
    const result = await getBerkasSiswa("siswa-1")
    expect(result.success).toBe(false)
  })

  it("harus menolak tanpa ID siswa", async () => {
    const result = await getBerkasSiswa("")
    expect(result.success).toBe(false)
    expect(result.message).toContain("ID siswa")
  })

  it("harus menolak jika siswa tidak ditemukan", async () => {
    mockSiswaFindUnique.mockResolvedValue(null)
    const result = await getBerkasSiswa("siswa-x")
    expect(result.success).toBe(false)
    expect(result.message).toContain("tidak ditemukan")
  })

  it("harus mengembalikan biodata + signed URL semua berkas", async () => {
    const result = await getBerkasSiswa("siswa-1")
    expect(result.success).toBe(true)

    const data = result.data!
    expect(data.siswa.nama).toBe("ABDULLAH")
    expect(data.siswa.kelasNama).toBe("7A")

    expect(data.berkas.kartuKeluarga).toBeNull()
    expect(data.berkas.akteLahir).toContain("https://cdn.test/")
    expect(data.berkas.foto).toBeNull()
    expect(data.berkas.lainnya).toHaveLength(1)
    expect(data.berkas.lainnya[0].path).toBe(
      "berkas-siswa/siswa-1/lainnya/a.pdf"
    )

    // Semua path (termasuk kolom null) dikumpulkan ke getSignedUrls
    const [, paths] = mockGetSignedUrls.mock.calls[0]
    expect(paths).toContain("berkas-siswa/siswa-1/akteLahir/lama.pdf")
    expect(paths).toContain("berkas-siswa/siswa-1/lainnya/a.pdf")
  })
})

// ========================================================
// uploadBerkasSiswa
// ========================================================

describe("uploadBerkasSiswa", () => {
  it("harus menolak kategori yang tidak dikenal", async () => {
    const result = await uploadBerkasSiswa(
      "siswa-1",
      "ijazah",
      makeFormData(makeFile("ijazah.pdf", "application/pdf"))
    )
    expect(result.success).toBe(false)
    expect(result.message).toContain("Jenis berkas")
    expect(mockStorageUpload).not.toHaveBeenCalled()
  })

  it("harus menolak tanpa file", async () => {
    const result = await uploadBerkasSiswa("siswa-1", "foto", makeFormData())
    expect(result.success).toBe(false)
    expect(result.message).toContain("Pilih berkas")
    expect(mockStorageUpload).not.toHaveBeenCalled()
  })

  it("harus menolak file yang tidak lolos validasi magic bytes", async () => {
    mockValidateFile.mockResolvedValue({ valid: false, error: "Format berkas tidak valid" })
    const result = await uploadBerkasSiswa(
      "siswa-1",
      "foto",
      makeFormData(makeFile("foto.exe", "application/octet-stream"))
    )
    expect(result.success).toBe(false)
    expect(result.message).toContain("Format berkas tidak valid")
    expect(mockStorageUpload).not.toHaveBeenCalled()
  })

  it("harus menolak ekstensi yang tidak diizinkan", async () => {
    const result = await uploadBerkasSiswa(
      "siswa-1",
      "foto",
      makeFormData(makeFile("foto.txt", "text/plain"))
    )
    expect(result.success).toBe(false)
    expect(result.message).toContain("Format berkas tidak valid")
    expect(mockStorageUpload).not.toHaveBeenCalled()
  })

  it("harus menolak jika siswa tidak ditemukan", async () => {
    mockSiswaFindUnique.mockResolvedValue(null)
    const result = await uploadBerkasSiswa(
      "siswa-x",
      "foto",
      makeFormData(makeFile("foto.jpg", "image/jpeg"))
    )
    expect(result.success).toBe(false)
    expect(result.message).toContain("tidak ditemukan")
    expect(mockStorageUpload).not.toHaveBeenCalled()
  })

  it("harus berhasil mengunggah kategori tunggal dengan path server", async () => {
    const file = makeFile("kk.png", "image/png")
    const result = await uploadBerkasSiswa("siswa-1", "kartuKeluarga", makeFormData(file))

    expect(result.success).toBe(true)
    expect(mockStorageUpload).toHaveBeenCalledOnce()

    // Path dibuat server-side (foldername siswaId+kategori), bukan dari nama file klien
    const [path, , options] = mockStorageUpload.mock.calls[0]
    expect(path).toMatch(/^berkas-siswa\/siswa-1\/kartuKeluarga\//)
    expect(path.endsWith(".png")).toBe(true)
    expect(options.upsert).toBe(false)

    // Kolom dok* di DB diisi path server
    expect(mockSiswaUpdate).toHaveBeenCalledOnce()
    const updateData = mockSiswaUpdate.mock.calls[0][0].data
    expect(updateData.dokKartuKeluarga).toBe(path)

    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/siswa")
  })

  it("harus menghapus berkas lama best-effort saat mengganti", async () => {
    const result = await uploadBerkasSiswa(
      "siswa-1",
      "akteLahir",
      makeFormData(makeFile("akte-baru.pdf", "application/pdf"))
    )

    expect(result.success).toBe(true)
    expect(mockStorageRemove).toHaveBeenCalledOnce()
    const [removedPaths] = mockStorageRemove.mock.calls[0]
    expect(removedPaths).toContain("berkas-siswa/siswa-1/akteLahir/lama.pdf")
  })

  it("tidak menghapus apa pun jika tidak ada berkas lama", async () => {
    const result = await uploadBerkasSiswa(
      "siswa-1",
      "foto",
      makeFormData(makeFile("foto.jpg", "image/jpeg"))
    )
    expect(result.success).toBe(true)
    expect(mockStorageRemove).not.toHaveBeenCalled()
  })

  it("harus menambah ke dokLainnya untuk kategori lainnya", async () => {
    const file = makeFile("rapor.pdf", "application/pdf")
    const result = await uploadBerkasSiswa("siswa-1", "lainnya", makeFormData(file))

    expect(result.success).toBe(true)
    const updateData = mockSiswaUpdate.mock.calls[0][0].data
    expect(updateData.dokLainnya).toEqual({ push: [expect.stringMatching(/^berkas-siswa\/siswa-1\/lainnya\//)] })
    // "lainnya" tidak menghapus berkas lama
    expect(mockStorageRemove).not.toHaveBeenCalled()
  })

  it("harus membersihkan file baru jika update DB gagal", async () => {
    mockSiswaUpdate.mockRejectedValue(new Error("db down"))
    const result = await uploadBerkasSiswa(
      "siswa-1",
      "foto",
      makeFormData(makeFile("foto.jpg", "image/jpeg"))
    )
    expect(result.success).toBe(false)
    expect(mockStorageRemove).toHaveBeenCalled()
    const [removedPaths] = mockStorageRemove.mock.calls[0]
    expect(removedPaths[0]).toMatch(/^berkas-siswa\/siswa-1\/foto\//)
  })
})

// ========================================================
// hapusBerkasSiswa
// ========================================================

describe("hapusBerkasSiswa", () => {
  it("harus menolak jika siswa tidak ditemukan", async () => {
    mockSiswaFindUnique.mockResolvedValue(null)
    const result = await hapusBerkasSiswa("siswa-x", "foto")
    expect(result.success).toBe(false)
    expect(result.message).toContain("tidak ditemukan")
  })

  it("harus mengosongkan kolom & menghapus file untuk kategori tunggal", async () => {
    const result = await hapusBerkasSiswa("siswa-1", "akteLahir")
    expect(result.success).toBe(true)

    const updateData = mockSiswaUpdate.mock.calls[0][0].data
    expect(updateData.dokAkteLahir).toBeNull()

    expect(mockStorageRemove).toHaveBeenCalledOnce()
    const [removedPaths] = mockStorageRemove.mock.calls[0]
    expect(removedPaths).toContain("berkas-siswa/siswa-1/akteLahir/lama.pdf")
  })

  it("harus menolak path lainnya yang tidak terdaftar", async () => {
    const result = await hapusBerkasSiswa("siswa-1", "lainnya", "berkas-siswa/siswa-1/lainnya/tidak-ada.pdf")
    expect(result.success).toBe(false)
    expect(result.message).toContain("tidak ditemukan")
    expect(mockSiswaUpdate).not.toHaveBeenCalled()
  })

  it("harus menghapus satu path dari dokLainnya", async () => {
    const result = await hapusBerkasSiswa(
      "siswa-1",
      "lainnya",
      "berkas-siswa/siswa-1/lainnya/a.pdf"
    )
    expect(result.success).toBe(true)

    const updateData = mockSiswaUpdate.mock.calls[0][0].data
    expect(updateData.dokLainnya).toEqual({ set: [] })

    expect(mockStorageRemove).toHaveBeenCalledOnce()
    const [removedPaths] = mockStorageRemove.mock.calls[0]
    expect(removedPaths[0]).toBe("berkas-siswa/siswa-1/lainnya/a.pdf")
  })
})