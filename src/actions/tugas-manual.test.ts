// src/actions/tugas-manual.test.ts
//
// Menguji fitur penomoran & input nilai manual tugas offline:
// - inputNilaiTugasManual membuat PengumpulanTugas berstatus DINILAI dengan
//   sentinel urlFile/namaFile (tanpa berkas di storage)
// - Validasi: siswa harus terdaftar di kelas tugas
// - createTugas memberikan nomorTugas otomatis (max+1) per kelas+mapel+periode
//   dan menandai inputManual; deadline tidak wajib untuk tugas manual
// - revalidatePath diarahkan ke rute nyata

import { describe, it, expect, vi, beforeEach } from "vitest"

const hoist = vi.hoisted(() => ({
  mockTugasFindUnique: vi.fn(),
  mockSiswaFindMany: vi.fn(),
  mockPengumpulanFindMany: vi.fn(),
  mockMapelFindFirst: vi.fn(),
  mockPeriodeFindUnique: vi.fn(),
  mockVerifyGuruAksesKelas: vi.fn(),
  mockTransaction: vi.fn(),
  mockUpsert: vi.fn(),
  mockAggregate: vi.fn(),
  mockCreate: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    tugas: { findUnique: hoist.mockTugasFindUnique },
    siswa: { findMany: hoist.mockSiswaFindMany },
    pengumpulanTugas: { findMany: hoist.mockPengumpulanFindMany },
    mataPelajaran: { findFirst: hoist.mockMapelFindFirst },
    periodeAjaran: { findUnique: hoist.mockPeriodeFindUnique },
    $transaction: hoist.mockTransaction,
  },
}))

vi.mock("@/lib/guru-auth", () => ({
  verifyGuruAksesKelas: hoist.mockVerifyGuruAksesKelas,
  getMapelIdYangDiajarDiKelas: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({ rateLimitAsync: vi.fn(), getClientIpFromHeaders: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdmin: vi.fn() }))
vi.mock("@/lib/storage", () => ({
  getSignedUrl: vi.fn(),
  getSignedUrls: vi.fn(),
  isExternalUrl: vi.fn(() => false),
}))

vi.mock("@prisma/client", () => {
  class Decimal {
    constructor(public value: number) {}
  }
  return {
    Prisma: { Decimal },
    Role: { GURU: "GURU", SISWA: "SISWA", SUPER_ADMIN: "SUPER_ADMIN", ADMIN_AKADEMIK: "ADMIN_AKADEMIK" },
    StatusPengumpulan: {
      BELUM_DIKUMPULKAN: "BELUM_DIKUMPULKAN",
      TEPAT_WAKTU: "TEPAT_WAKTU",
      TERLAMBAT: "TERLAMBAT",
      DINILAI: "DINILAI",
    },
  }
})

vi.mock("next/cache", () => ({ revalidatePath: hoist.mockRevalidatePath }))

import {
  inputNilaiTugasManual,
  createTugas,
} from "@/actions/tugas"

const mockTx = {
  pengumpulanTugas: { upsert: hoist.mockUpsert },
  tugas: { aggregate: hoist.mockAggregate, create: hoist.mockCreate },
}

beforeEach(() => {
  vi.clearAllMocks()
  hoist.mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mockTx))
  hoist.mockVerifyGuruAksesKelas.mockResolvedValue({
    user: { id: "guru-1" },
    guru: { id: "guru-1" },
    roleInKelas: "PENGAJAR",
  })
  hoist.mockPengumpulanFindMany.mockResolvedValue([])
})

describe("inputNilaiTugasManual", () => {
  it("menyimpan penilaian manual berstatus DINILAI dengan sentinel (tanpa berkas)", async () => {
    hoist.mockTugasFindUnique.mockResolvedValue({
      id: "tugas-1",
      kelasId: "kelas-1",
      mataPelajaranId: "mapel-1",
      inputManual: true,
      mataPelajaran: { jenisKelamin: null },
    })
    hoist.mockSiswaFindMany.mockResolvedValue([{ id: "siswa-A" }, { id: "siswa-B" }])
    hoist.mockUpsert.mockResolvedValue({ id: "pengumpulan-1" })

    const result = await inputNilaiTugasManual({
      tugasId: "tugas-1",
      penilaian: [
        { siswaId: "siswa-A", nilai: 85, feedback: "Bagus" },
        { siswaId: "siswa-B", nilai: 90 },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ jumlahDinilai: 2 })
    expect(hoist.mockUpsert).toHaveBeenCalledTimes(2)

    const [argsA, argsB] = hoist.mockUpsert.mock.calls
    expect(argsA[0]).toEqual(
      expect.objectContaining({
        where: { tugasId_siswaId: { tugasId: "tugas-1", siswaId: "siswa-A" } },
        create: expect.objectContaining({
          tugasId: "tugas-1",
          siswaId: "siswa-A",
          urlFile: "manual-input",
          namaFile: "Input manual (luar aplikasi)",
          status: "DINILAI",
          dinilaiOlehId: "guru-1",
        }),
      })
    )
    // Nilai disimpan sebagai Prisma.Decimal; feedback hanya yang dikirim.
    const createA = argsA[0].create
    expect(createA.nilai).toHaveProperty("value", 85)
    expect(createA.feedback).toBe("Bagus")

    const createB = argsB[0].create
    expect(createB.nilai.value).toBe(90)
    expect(createB.feedback).toBeNull()

    const updateArgs = argsA[0].update
    expect(updateArgs.status).toBe("DINILAI")
    expect(updateArgs.nilai.value).toBe(85)
    expect(updateArgs.dinilaiOlehId).toBe("guru-1")
    expect(updateArgs.waktuPenilaian).toBeInstanceOf(Date)

    expect(hoist.mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/tugas/tugas-1`)
    expect(hoist.mockRevalidatePath).toHaveBeenCalledWith("/dashboard/tugas")
  })

  it("menolak nilai di luar rentang 0-100", async () => {
    const result = await inputNilaiTugasManual({
      tugasId: "tugas-1",
      penilaian: [{ siswaId: "siswa-A", nilai: 150 }],
    })

    expect(result.success).toBe(false)
    expect(hoist.mockTugasFindUnique).not.toHaveBeenCalled()
  })

  it("menolak saat tugas tidak ditemukan", async () => {
    hoist.mockTugasFindUnique.mockResolvedValue(null)

    const result = await inputNilaiTugasManual({
      tugasId: "tugas-tidak-ada",
      penilaian: [{ siswaId: "siswa-A", nilai: 80 }],
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("Tugas tidak ditemukan")
  })

  it("menolak siswa yang tidak terdaftar di kelas tugas", async () => {
    hoist.mockTugasFindUnique.mockResolvedValue({
      id: "tugas-1",
      kelasId: "kelas-1",
      mataPelajaranId: "mapel-1",
      inputManual: true,
      mataPelajaran: { jenisKelamin: null },
    })
    hoist.mockSiswaFindMany.mockResolvedValue([{ id: "siswa-A" }])

    const result = await inputNilaiTugasManual({
      tugasId: "tugas-1",
      penilaian: [
        { siswaId: "siswa-A", nilai: 80 },
        { siswaId: "siswa-PENYUSUP", nilai: 81 },
      ],
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("tidak terdaftar")
    expect(hoist.mockTransaction).not.toHaveBeenCalled()
  })

  it("menolak menimpa nilai yang sudah diinput guru lain (non-wali kelas)", async () => {
    hoist.mockTugasFindUnique.mockResolvedValue({
      id: "tugas-1",
      kelasId: "kelas-1",
      mataPelajaranId: "mapel-1",
      inputManual: true,
      mataPelajaran: { jenisKelamin: null },
    })
    hoist.mockSiswaFindMany.mockResolvedValue([{ id: "siswa-A" }])
    hoist.mockPengumpulanFindMany.mockResolvedValue([
      { siswaId: "siswa-A", dinilaiOlehId: "guru-lain" },
    ])

    const result = await inputNilaiTugasManual({
      tugasId: "tugas-1",
      penilaian: [{ siswaId: "siswa-A", nilai: 70 }],
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("guru lain")
    expect(hoist.mockTransaction).not.toHaveBeenCalled()
  })

  it("wali kelas boleh menimpa nilai manual yang diinput guru lain", async () => {
    hoist.mockVerifyGuruAksesKelas.mockResolvedValue({
      user: { id: "wali-1" },
      guru: { id: "wali-1" },
      roleInKelas: "WALI_KELAS",
    })
    hoist.mockTugasFindUnique.mockResolvedValue({
      id: "tugas-1",
      kelasId: "kelas-1",
      mataPelajaranId: "mapel-1",
      inputManual: true,
      mataPelajaran: { jenisKelamin: null },
    })
    hoist.mockSiswaFindMany.mockResolvedValue([{ id: "siswa-A" }])
    hoist.mockPengumpulanFindMany.mockResolvedValue([
      { siswaId: "siswa-A", dinilaiOlehId: "guru-lain" },
    ])
    hoist.mockUpsert.mockResolvedValue({ id: "pengumpulan-1" })

    const result = await inputNilaiTugasManual({
      tugasId: "tugas-1",
      penilaian: [{ siswaId: "siswa-A", nilai: 70 }],
    })

    expect(result.success).toBe(true)
    expect(hoist.mockUpsert).toHaveBeenCalledTimes(1)
  })

  it("menolak menilai siswa dengan gender yang tidak sesuai target tugas", async () => {
    hoist.mockTugasFindUnique.mockResolvedValue({
      id: "tugas-1",
      kelasId: "kelas-1",
      mataPelajaranId: "mapel-1",
      inputManual: true,
      targetGender: "LAKI_LAKI",
      mataPelajaran: { jenisKelamin: null },
    })
    hoist.mockSiswaFindMany.mockResolvedValue([
      { id: "siswa-A", jenisKelamin: "PEREMPUAN" },
    ])

    const result = await inputNilaiTugasManual({
      tugasId: "tugas-1",
      penilaian: [{ siswaId: "siswa-A", nilai: 70 }],
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("target gender")
    expect(hoist.mockTransaction).not.toHaveBeenCalled()
  })

  it("menolak input manual untuk tugas ONLINE (non-inputManual)", async () => {
    hoist.mockTugasFindUnique.mockResolvedValue({
      id: "tugas-1",
      kelasId: "kelas-1",
      mataPelajaranId: "mapel-1",
      inputManual: false,
      mataPelajaran: { jenisKelamin: null },
    })

    const result = await inputNilaiTugasManual({
      tugasId: "tugas-1",
      penilaian: [{ siswaId: "siswa-A", nilai: 70 }],
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("offline")
    expect(hoist.mockTransaction).not.toHaveBeenCalled()
  })
})

describe("createTugas (penomoran otomatis & inputManual)", () => {
  const payload = {
    judul: "Tugas Observasi IPNU",
    deskripsi: "Amatilah kegiatan organisasi kampus lalu tuliskan hasilnya",
    mataPelajaran: "Aswaja",
    kelasId: "kelas-1",
    periodeAjaranId: "periode-1",
    deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
  }

  beforeEach(() => {
    hoist.mockMapelFindFirst.mockResolvedValue({ id: "mapel-1", jenisKelamin: null })
    hoist.mockPeriodeFindUnique.mockResolvedValue({ id: "periode-1" })
    hoist.mockAggregate.mockResolvedValue({ _max: { nomorTugas: 2 } })
    hoist.mockCreate.mockResolvedValue({ id: "tugas-1", nomorTugas: 3 })
  })

  it("memberi nomor otomatis = max+1 (3) dan menyimpan tanda inputManual", async () => {
    const result = await createTugas({ ...payload, inputManual: true })

    expect(result.success).toBe(true)
    expect(hoist.mockAggregate).toHaveBeenCalledWith({
      where: { kelasId: "kelas-1", mataPelajaranId: "mapel-1", periodeAjaranId: "periode-1" },
      _max: { nomorTugas: true },
    })
    const createData = hoist.mockCreate.mock.calls[0][0].data
    expect(createData.nomorTugas).toBe(3)
    expect(createData.inputManual).toBe(true)
  })

  it("tugas manual tanpa deadline memakai deadline fallback jauh ke depan", async () => {
    const result = await createTugas({
      judul: payload.judul,
      deskripsi: payload.deskripsi,
      mataPelajaran: payload.mataPelajaran,
      kelasId: payload.kelasId,
      periodeAjaranId: payload.periodeAjaranId,
      inputManual: true,
    })

    expect(result.success).toBe(true)
    const createData = hoist.mockCreate.mock.calls[0][0].data
    expect(createData.deadline).toBeInstanceOf(Date)
    expect(createData.deadline.getTime()).toBeGreaterThan(Date.now())
  })

  it("menolak tugas non-manual tanpa deadline", async () => {
    const result = await createTugas({
      judul: payload.judul,
      deskripsi: payload.deskripsi,
      mataPelajaran: payload.mataPelajaran,
      kelasId: payload.kelasId,
      periodeAjaranId: payload.periodeAjaranId,
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("Deadline")
    expect(hoist.mockCreate).not.toHaveBeenCalled()
  })
})