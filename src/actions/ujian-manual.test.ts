// src/actions/ujian-manual.test.ts
//
// Menguji fitur penomoran & input nilai manual ujian offline:
// - inputNilaiUjianManual membuat PengerjaanUjian berstatus DINILAI
// - Validasi: siswa harus terdaftar di kelas ujian
// - createUjian memberi nomorUjian otomatis HANYA untuk ULANGAN_HARIAN;
//   UTS/Ujian Semester bernomor null & tidak memicu agregasi nomor
// - Penomoran & tanda inputManual ikut tersimpan di data ujian

import { describe, it, expect, vi, beforeEach } from "vitest"

const hoist = vi.hoisted(() => ({
  mockUjianFindUnique: vi.fn(),
  mockSiswaFindMany: vi.fn(),
  mockPengerjaanFindMany: vi.fn(),
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
    ujian: { findUnique: hoist.mockUjianFindUnique },
    siswa: { findMany: hoist.mockSiswaFindMany },
    pengerjaanUjian: { findMany: hoist.mockPengerjaanFindMany },
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
  class BaseError {
    constructor(public message: string, public code = "") {}
  }
  return {
    Prisma: {
      Decimal,
      PrismaClientKnownRequestError: BaseError,
      PrismaClientValidationError: BaseError,
      PrismaClientInitializationError: BaseError,
      PrismaClientRustPanicError: BaseError,
      PrismaClientUnknownRequestError: BaseError,
    },
    Role: { GURU: "GURU", SISWA: "SISWA", SUPER_ADMIN: "SUPER_ADMIN", ADMIN_AKADEMIK: "ADMIN_AKADEMIK", ADMIN_KEUANGAN: "ADMIN_KEUANGAN", ORANG_TUA: "ORANG_TUA" },
    StatusPengumpulan: { DINILAI: "DINILAI", BELUM_DIKUMPULKAN: "BELUM_DIKUMPULKAN" },
    StatusPengerjaan: {
      SEDANG_MENGERJAKAN: "SEDANG_MENGERJAKAN",
      SELESAI: "SELESAI",
      DINILAI: "DINILAI",
    },
    StatusUjian: { DRAFT: "DRAFT", PUBLISHED: "PUBLISHED", SELESAI: "SELESAI" },
    JenisUjian: {
      ULANGAN_HARIAN: "ULANGAN_HARIAN",
      UJIAN_TENGAH_SEMESTER: "UJIAN_TENGAH_SEMESTER",
      UJIAN_SEMESTER: "UJIAN_SEMESTER",
    },
  }
})

vi.mock("next/cache", () => ({ revalidatePath: hoist.mockRevalidatePath }))

import {
  inputNilaiUjianManual,
  createUjian,
} from "@/actions/ujian"

const mockTx = {
  pengerjaanUjian: { upsert: hoist.mockUpsert },
  ujian: { aggregate: hoist.mockAggregate, create: hoist.mockCreate },
}

beforeEach(() => {
  vi.clearAllMocks()
  hoist.mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mockTx))
  hoist.mockVerifyGuruAksesKelas.mockResolvedValue({
    user: { id: "guru-1" },
    guru: { id: "guru-1" },
    roleInKelas: "PENGAJAR",
  })
  hoist.mockPengerjaanFindMany.mockResolvedValue([])
})

describe("inputNilaiUjianManual", () => {
  it("menyimpan PengerjaanUjian berstatus DINILAI dengan nilaiTotal", async () => {
    hoist.mockUjianFindUnique.mockResolvedValue({
      id: "ujian-1",
      kelasId: "kelas-1",
      mataPelajaranId: "mapel-1",
      inputManual: true,
      mataPelajaran: { jenisKelamin: null },
    })
    hoist.mockSiswaFindMany.mockResolvedValue([{ id: "siswa-A" }, { id: "siswa-B" }])
    hoist.mockUpsert.mockResolvedValue({ id: "pengerjaan-1" })

    const result = await inputNilaiUjianManual({
      ujianId: "ujian-1",
      penilaian: [
        { siswaId: "siswa-A", nilai: 78 },
        { siswaId: "siswa-B", nilai: 92 },
      ],
    })

    expect(result.success).toBe(true)
    expect(hoist.mockUpsert).toHaveBeenCalledTimes(2)

    const [argsA, argsB] = hoist.mockUpsert.mock.calls
    expect(argsA[0]).toEqual(
      expect.objectContaining({
        where: { ujianId_siswaId: { ujianId: "ujian-1", siswaId: "siswa-A" } },
        create: expect.objectContaining({
          ujianId: "ujian-1",
          siswaId: "siswa-A",
          status: "DINILAI",
          submitTerlambat: false,
          dinilaiOlehId: "guru-1",
          waktuSubmit: expect.any(Date) as unknown,
        }),
      })
    )
    expect(argsA[0].create.nilaiTotal.value).toBe(78)
    expect(argsA[0].update.status).toBe("DINILAI")
    expect(argsA[0].update.dinilaiOlehId).toBe("guru-1")
    expect(argsB[0].create.nilaiTotal.value).toBe(92)

    expect(hoist.mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/ujian/ujian-1/rekap`)
    expect(hoist.mockRevalidatePath).toHaveBeenCalledWith("/dashboard/ujian")
  })

  it("menolak nilai di luar rentang 0-100", async () => {
    const result = await inputNilaiUjianManual({
      ujianId: "ujian-1",
      penilaian: [{ siswaId: "siswa-A", nilai: -5 }],
    })

    expect(result.success).toBe(false)
    expect(hoist.mockUjianFindUnique).not.toHaveBeenCalled()
  })

  it("menolak ujian yang tidak ditemukan", async () => {
    hoist.mockUjianFindUnique.mockResolvedValue(null)

    const result = await inputNilaiUjianManual({
      ujianId: "ujian-tidak-ada",
      penilaian: [{ siswaId: "siswa-A", nilai: 80 }],
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("tidak ditemukan")
  })

  it("menolak input manual untuk ujian ONLINE (non-inputManual)", async () => {
    hoist.mockUjianFindUnique.mockResolvedValue({
      id: "ujian-online",
      kelasId: "kelas-1",
      mataPelajaranId: "mapel-1",
      inputManual: false,
      mataPelajaran: { jenisKelamin: null },
    })

    const result = await inputNilaiUjianManual({
      ujianId: "ujian-online",
      penilaian: [{ siswaId: "siswa-A", nilai: 80 }],
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("offline")
    expect(hoist.mockTransaction).not.toHaveBeenCalled()
  })

  it("menolak siswa yang tidak terdaftar di kelas ujian", async () => {
    hoist.mockUjianFindUnique.mockResolvedValue({
      id: "ujian-1",
      kelasId: "kelas-1",
      mataPelajaranId: "mapel-1",
      inputManual: true,
      mataPelajaran: { jenisKelamin: null },
    })
    hoist.mockSiswaFindMany.mockResolvedValue([{ id: "siswa-A" }])

    const result = await inputNilaiUjianManual({
      ujianId: "ujian-1",
      penilaian: [{ siswaId: "siswa-PENYUSUP", nilai: 81 }],
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("tidak terdaftar")
    expect(hoist.mockTransaction).not.toHaveBeenCalled()
  })

  it("menolak menimpa pengerjaan online yang sudah dinilai guru lain", async () => {
    hoist.mockUjianFindUnique.mockResolvedValue({
      id: "ujian-1",
      kelasId: "kelas-1",
      mataPelajaranId: "mapel-1",
      inputManual: true,
      mataPelajaran: { jenisKelamin: null },
    })
    hoist.mockSiswaFindMany.mockResolvedValue([{ id: "siswa-A" }])
    hoist.mockPengerjaanFindMany.mockResolvedValue([
      {
        siswaId: "siswa-A",
        status: "DINILAI",
        jawaban: [{ dinilaiOlehId: "guru-lain" }],
      },
    ])

    const result = await inputNilaiUjianManual({
      ujianId: "ujian-1",
      penilaian: [{ siswaId: "siswa-A", nilai: 70 }],
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("guru lain")
    expect(hoist.mockTransaction).not.toHaveBeenCalled()
  })

  it("guru yang sama boleh mengedit ulang nilai manualnya (tanpa jawaban)", async () => {
    hoist.mockUjianFindUnique.mockResolvedValue({
      id: "ujian-1",
      kelasId: "kelas-1",
      mataPelajaranId: "mapel-1",
      inputManual: true,
      mataPelajaran: { jenisKelamin: null },
    })
    hoist.mockSiswaFindMany.mockResolvedValue([{ id: "siswa-A" }])
    hoist.mockPengerjaanFindMany.mockResolvedValue([
      {
        siswaId: "siswa-A",
        status: "DINILAI",
        dinilaiOlehId: "guru-1",
        jawaban: [],
      },
    ])
    hoist.mockUpsert.mockResolvedValue({ id: "pengerjaan-1" })

    const result = await inputNilaiUjianManual({
      ujianId: "ujian-1",
      penilaian: [{ siswaId: "siswa-A", nilai: 65 }],
    })

    expect(result.success).toBe(true)
    expect(hoist.mockUpsert).toHaveBeenCalledTimes(1)
  })

  it("menolak menimpa nilai manual yang diinput guru lain (tanpa jawaban)", async () => {
    hoist.mockUjianFindUnique.mockResolvedValue({
      id: "ujian-1",
      kelasId: "kelas-1",
      mataPelajaranId: "mapel-1",
      inputManual: true,
      mataPelajaran: { jenisKelamin: null },
    })
    hoist.mockSiswaFindMany.mockResolvedValue([{ id: "siswa-A" }])
    hoist.mockPengerjaanFindMany.mockResolvedValue([
      {
        siswaId: "siswa-A",
        status: "DINILAI",
        dinilaiOlehId: "guru-lain",
        jawaban: [],
      },
    ])

    const result = await inputNilaiUjianManual({
      ujianId: "ujian-1",
      penilaian: [{ siswaId: "siswa-A", nilai: 60 }],
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("guru lain")
    expect(hoist.mockTransaction).not.toHaveBeenCalled()
  })

  it("wali kelas boleh menimpa nilai manual guru lain", async () => {
    hoist.mockVerifyGuruAksesKelas.mockResolvedValue({
      user: { id: "guru-1" },
      guru: { id: "guru-1" },
      roleInKelas: "WALI_KELAS",
    })
    hoist.mockUjianFindUnique.mockResolvedValue({
      id: "ujian-1",
      kelasId: "kelas-1",
      mataPelajaranId: "mapel-1",
      inputManual: true,
      mataPelajaran: { jenisKelamin: null },
    })
    hoist.mockSiswaFindMany.mockResolvedValue([{ id: "siswa-A" }])
    hoist.mockPengerjaanFindMany.mockResolvedValue([
      {
        siswaId: "siswa-A",
        status: "DINILAI",
        dinilaiOlehId: "guru-lain",
        jawaban: [],
      },
    ])
    hoist.mockUpsert.mockResolvedValue({ id: "pengerjaan-1" })

    const result = await inputNilaiUjianManual({
      ujianId: "ujian-1",
      penilaian: [{ siswaId: "siswa-A", nilai: 75 }],
    })

    expect(result.success).toBe(true)
    expect(hoist.mockUpsert).toHaveBeenCalledTimes(1)
  })

  it("menolak menilai siswa dengan gender yang tidak sesuai target ujian", async () => {
    hoist.mockUjianFindUnique.mockResolvedValue({
      id: "ujian-1",
      kelasId: "kelas-1",
      mataPelajaranId: "mapel-1",
      inputManual: true,
      targetGender: "LAKI_LAKI",
      mataPelajaran: { jenisKelamin: null },
    })
    hoist.mockSiswaFindMany.mockResolvedValue([
      { id: "siswa-A", jenisKelamin: "PEREMPUAN" },
    ])

    const result = await inputNilaiUjianManual({
      ujianId: "ujian-1",
      penilaian: [{ siswaId: "siswa-A", nilai: 70 }],
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("target gender")
    expect(hoist.mockTransaction).not.toHaveBeenCalled()
  })
})

describe("createUjian (penomoran & jenis ujian)", () => {
  const base = {
    judul: "Ujian Semester Fiqih",
    deskripsi: "Ujian tulis akhir semester",
    mataPelajaran: "Fiqih",
    kelasId: "kelas-1",
    periodeAjaranId: "periode-1",
    waktuMulai: new Date(Date.now() + 86400000).toISOString(),
    waktuSelesai: new Date(Date.now() + 3 * 86400000).toISOString(),
    durasiMenit: 90,
  }

  beforeEach(() => {
    hoist.mockMapelFindFirst.mockResolvedValue({ id: "mapel-1", jenisKelamin: null })
    hoist.mockPeriodeFindUnique.mockResolvedValue({ id: "periode-1" })
    hoist.mockAggregate.mockResolvedValue({ _max: { nomorUjian: 1 } })
    hoist.mockCreate.mockResolvedValue({ id: "ujian-1" })
  })

  it("ULANGAN_HARIAN mendapat nomorUjian otomatis (max+1 = 2)", async () => {
    const result = await createUjian({ ...base, jenisUjian: "ULANGAN_HARIAN", inputManual: true })

    expect(result.success).toBe(true)
    expect(hoist.mockAggregate).toHaveBeenCalledWith({
      where: { kelasId: "kelas-1", mataPelajaranId: "mapel-1", periodeAjaranId: "periode-1" },
      _max: { nomorUjian: true },
    })
    const createData = hoist.mockCreate.mock.calls[0][0].data
    expect(createData.nomorUjian).toBe(2)
    expect(createData.jenisUjian).toBe("ULANGAN_HARIAN")
    expect(createData.inputManual).toBe(true)
  })

  it("UJIAN_SEMESTER bernomor null dan TIDAK memicu agregasi nomor", async () => {
    const result = await createUjian({ ...base, jenisUjian: "UJIAN_SEMESTER" })

    expect(result.success).toBe(true)
    expect(hoist.mockAggregate).not.toHaveBeenCalled()
    const createData = hoist.mockCreate.mock.calls[0][0].data
    expect(createData.nomorUjian).toBeNull()
    expect(createData.jenisUjian).toBe("UJIAN_SEMESTER")
  })

  it("default jenis ujian ULANGAN_HARIAN bila tidak dikirim", async () => {
    const result = await createUjian(base)

    expect(result.success).toBe(true)
    const createData = hoist.mockCreate.mock.calls[0][0].data
    expect(createData.jenisUjian).toBe("ULANGAN_HARIAN")
    expect(createData.inputManual).toBe(false)
  })
})