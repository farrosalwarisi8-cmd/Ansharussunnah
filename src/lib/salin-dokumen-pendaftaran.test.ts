// src/lib/salin-dokumen-pendaftaran.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockDownload, mockUpload, mockFrom } = vi.hoisted(() => ({
  mockDownload: vi.fn(),
  mockUpload: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: () => ({
    storage: { from: mockFrom },
  }),
}))

import { salinDokumenPendaftaranKeSiswa } from "@/lib/salin-dokumen-pendaftaran"

function makeBucket() {
  return { download: mockDownload, upload: mockUpload }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  mockFrom.mockImplementation((bucket: string) =>
    bucket === "dokumen-pendaftaran" ? makeBucket() : makeBucket()
  )
  mockDownload.mockResolvedValue({
    data: { arrayBuffer: async () => new ArrayBuffer(8), type: "image/jpeg" },
    error: null,
  })
  mockUpload.mockResolvedValue({ error: null })
})

const dokumenLengkap = {
  kartuKeluarga: "dokumen-pendaftaran/pendaftaran/p1/kk.jpg",
  akteLahir: "dokumen-pendaftaran/pendaftaran/p1/akte.pdf",
  foto: "dokumen-pendaftaran/pendaftaran/p1/foto.png",
  lainnya: ["dokumen-pendaftaran/pendaftaran/p1/lain-1.webp"],
}

describe("salinDokumenPendaftaranKeSiswa", () => {
  it("menyalin semua dokumen ke bucket berkas-siswa dengan path per kategori", async () => {
    const hasil = await salinDokumenPendaftaranKeSiswa("siswa-1", dokumenLengkap)

    expect(mockFrom).toHaveBeenCalledWith("dokumen-pendaftaran")
    expect(mockFrom).toHaveBeenCalledWith("berkas-siswa")
    expect(hasil.gagal).toEqual([])
    expect(hasil.kartuKeluarga).toMatch(
      /^berkas-siswa\/siswa-1\/kartuKeluarga\/[A-Za-z0-9_-]{12}\.jpg$/
    )
    expect(hasil.akteLahir).toMatch(
      /^berkas-siswa\/siswa-1\/akteLahir\/[A-Za-z0-9_-]{12}\.pdf$/
    )
    expect(hasil.foto).toMatch(
      /^berkas-siswa\/siswa-1\/foto\/[A-Za-z0-9_-]{12}\.png$/
    )
    expect(hasil.lainnya).toHaveLength(1)
    expect(hasil.lainnya[0]).toMatch(
      /^berkas-siswa\/siswa-1\/lainnya\/[A-Za-z0-9_-]{12}\.webp$/
    )
  })

  it("tidak memakai path sumber (cross-bucket) pada hasil", async () => {
    const hasil = await salinDokumenPendaftaranKeSiswa("siswa-1", dokumenLengkap)

    for (const p of [
      hasil.kartuKeluarga,
      hasil.akteLahir,
      hasil.foto,
      ...hasil.lainnya,
    ]) {
      expect(p).not.toBeNull()
      expect(String(p).startsWith("berkas-siswa/")).toBe(true)
      expect(String(p).startsWith("dokumen-pendaftaran/")).toBe(false)
    }
  })

  it("mengunggah dengan upsert false", async () => {
    await salinDokumenPendaftaranKeSiswa("siswa-1", dokumenLengkap)

    for (const call of mockUpload.mock.calls) {
      expect(call[2].upsert).toBe(false)
    }
  })

  it("membiarkan berkas yang kosong tetap kosong", async () => {
    const hasil = await salinDokumenPendaftaranKeSiswa("siswa-1", {
      kartuKeluarga: null,
      akteLahir: null,
      foto: null,
      lainnya: [],
    })

    expect(hasil.kartuKeluarga).toBeNull()
    expect(hasil.akteLahir).toBeNull()
    expect(hasil.foto).toBeNull()
    expect(hasil.lainnya).toEqual([])
    expect(hasil.tersalin).toEqual([])
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it("tidak melakukan apa-apa tanpa siswaId", async () => {
    const hasil = await salinDokumenPendaftaranKeSiswa("", dokumenLengkap)

    expect(hasil.gagal).toEqual([])
    expect(hasil.tersalin).toEqual([])
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it("lanjut menyalin berkas lain saat satu download gagal, dan menandai sisanya kosong", async () => {
    mockDownload
      .mockResolvedValueOnce({
        data: null,
        error: { message: "not found" },
      })
      .mockResolvedValue({
        data: { arrayBuffer: async () => new ArrayBuffer(8), type: "image/jpeg" },
        error: null,
      })

    const hasil = await salinDokumenPendaftaranKeSiswa("siswa-1", dokumenLengkap)

    expect(hasil.gagal).toEqual(["dokumen-pendaftaran/pendaftaran/p1/kk.jpg"])
    // Berkas gagal TIDAK boleh diisi dengan path sumber
    expect(hasil.kartuKeluarga).toBeNull()
    // Sisanya tetap tersalin
    expect(hasil.akteLahir).not.toBeNull()
    expect(hasil.foto).not.toBeNull()
    expect(hasil.lainnya).toHaveLength(1)
  })

  it("lanjut menyalin berkas lain saat satu upload gagal", async () => {
    mockUpload
      .mockResolvedValueOnce({ error: { message: "quota" } })
      .mockResolvedValue({ error: null })

    const hasil = await salinDokumenPendaftaranKeSiswa("siswa-1", dokumenLengkap)

    expect(hasil.gagal).toHaveLength(1)
    expect(hasil.kartuKeluarga).toBeNull()
    expect(hasil.akteLahir).not.toBeNull()
  })

  it("menangani exception saat menyalin tanpa melempar keluar", async () => {
    mockDownload.mockRejectedValue(new Error("network down"))

    const hasil = await salinDokumenPendaftaranKeSiswa("siswa-1", dokumenLengkap)

    expect(hasil.gagal).toHaveLength(4)
    expect(hasil.kartuKeluarga).toBeNull()
    expect(hasil.lainnya).toEqual([])
  })

  it("fallback ekstensi ke pdf untuk nama tanpa ekstensi", async () => {
    const hasil = await salinDokumenPendaftaranKeSiswa("siswa-1", {
      kartuKeluarga: "dokumen-pendaftaran/pendaftaran/p1/namadengantitle",
      akteLahir: null,
      foto: null,
      lainnya: [],
    })

    expect(hasil.kartuKeluarga).toMatch(/\.pdf$/)
  })

  it("menolak ekstensi berbahaya pada path tujuan", async () => {
    const hasil = await salinDokumenPendaftaranKeSiswa("siswa-1", {
      kartuKeluarga: "dokumen-pendaftaran/pendaftaran/p1/x.exe",
      akteLahir: null,
      foto: null,
      lainnya: [],
    })

    expect(hasil.kartuKeluarga).toMatch(/\.pdf$/)
    expect(hasil.kartuKeluarga).not.toMatch(/\.exe/)
  })

  it("mencatat semua path tujuan yang berhasil disalin untuk pembersihan", async () => {
    const hasil = await salinDokumenPendaftaranKeSiswa("siswa-1", dokumenLengkap)

    expect(hasil.tersalin).toHaveLength(4)
    // Semua path tujuan unik (nanoid) — tidak ada yang menimpa
    expect(new Set(hasil.tersalin).size).toBe(4)
    expect(hasil.tersalin).toContain(hasil.kartuKeluarga)
    expect(hasil.tersalin).toContain(hasil.akteLahir)
    expect(hasil.tersalin).toContain(hasil.foto)
    expect(hasil.tersalin).toContain(hasil.lainnya[0])
  })
})
