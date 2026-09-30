// src/lib/berkas-siswa-service.test.ts
//
// Kontrak yang dijaga file ini: status kelengkapan berkas yang dikirim ke
// dashboard wali dihitung oleh helper yang SAMA dengan halaman cek status,
// upload dokumen, dan panel verifikasi admin (src/lib/status-berkas.ts).
//
// Yang paling rawan: status ikut dihitung dari signed URL. URL itu sementara
// dan bisa gagal ditandatangani; kalau dipakai sebagai sumber kebenaran,
// berkas yang SUDAH tercatat di database akan terlihat belum ada di dashboard
// wali, padahal di panel panitia berkas itu lengkap. Dua layar, dua angka,
// untuk data yang sama.

import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockSiswaFindUnique, mockGetSignedUrls } = vi.hoisted(() => ({
  mockSiswaFindUnique: vi.fn(),
  mockGetSignedUrls: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    siswa: { findUnique: mockSiswaFindUnique },
  },
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: () => ({
    storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) },
  }),
}))

vi.mock("@/lib/storage", () => ({
  validateFile: vi.fn().mockResolvedValue({ valid: true }),
  // kanonikEkstensiDariFile dipakai service untuk ekstensi object dari magic
  // bytes; "pdf" cukup untuk jalur upload, deteksi asli dites di storage.
  kanonikEkstensiDariFile: vi.fn().mockResolvedValue("pdf"),
  getSignedUrls: (...args: unknown[]) => mockGetSignedUrls(...args),
}))

import { readBerkasSiswa } from "@/lib/berkas-siswa-service"

const SISWA = {
  id: "siswa-1",
  deleted_at: null,
  nisn: "1234567890",
  nis: null,
  jenisKelamin: "LAKI_LAKI",
  dokKartuKeluarga: "berkas-siswa/berkas-siswa/siswa-1/kk.jpg",
  dokAkteLahir: "berkas-siswa/berkas-siswa/siswa-1/akte.pdf",
  dokFoto: null,
  dokLainnya: ["berkas-siswa/berkas-siswa/siswa-1/surat.pdf"],
  user: { nama: "Anak Santri", email: "anak@example.com" },
  kelas: { nama: "Kelas 1", jenjang: { nama: "MI" } },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSiswaFindUnique.mockResolvedValue(SISWA)
  mockGetSignedUrls.mockResolvedValue(new Map())
})

describe("readBerkasSiswa — status berkas unified", () => {
  it("mengembalikan status dari path database, bukan dari signed URL", async () => {
    // Tidak satu pun signed URL berhasil dibuat. Status TIDAK boleh ikut
    // berubah hanya karena penandatanganan gagal.
    const res = await readBerkasSiswa("siswa-1")

    expect(res.success, res.message).toBe(true)
    expect(res.data?.statusBerkas).toEqual({
      kartuKeluarga: true,
      akteLahir: true,
      foto: false,
      lainnya: 1,
      jumlahLengkap: 2,
    })
  })

  it("tetap sama persis dengan helper tunggal saat signed URL tersedia", async () => {
    mockGetSignedUrls.mockResolvedValue(
      new Map([
        [SISWA.dokKartuKeluarga, "https://signed/kk.jpg"],
        [SISWA.dokAkteLahir, "https://signed/akte.pdf"],
        [SISWA.dokLainnya[0], "https://signed/surat.pdf"],
      ])
    )

    const res = await readBerkasSiswa("siswa-1")

    expect(res.data?.statusBerkas.jumlahLengkap).toBe(2)
    expect(res.data?.statusBerkas.lainnya).toBe(1)
  })

  it("path kosong tetap dihitung belum ada", async () => {
    mockSiswaFindUnique.mockResolvedValue({
      ...SISWA,
      dokKartuKeluarga: "",
      dokAkteLahir: null,
      dokLainnya: [],
    })

    const res = await readBerkasSiswa("siswa-1")

    expect(res.data?.statusBerkas).toEqual({
      kartuKeluarga: false,
      akteLahir: false,
      foto: false,
      lainnya: 0,
      jumlahLengkap: 0,
    })
  })
})
