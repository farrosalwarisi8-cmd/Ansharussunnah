// src/actions/ujian-pengerjaan.test.ts
//
// Menguji alur kritis yang TIDAK tercakup di ujian.test.ts:
// - beriNilaiEsai (nilaiTotal null selama esai belum lengkap DINILAI)
// - submitPengerjaanUjian (nilai PG + persist submitTerlambat)
// - tutupPengerjaanUjianKedaluwarsa (auto-close + submitTerlambat true)
// - getDaftarUjianGuru (filter mapel pengajar / admin)
// - getDaftarUjianAnak (validasi relasi ortu + mapel nama)

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Prisma, StatusPengerjaan, StatusUjian } from "@prisma/client"

// ========================================================
// Mocks — di-hoist agar tersedia sebelum import modul
// ========================================================

const {
  mockRequireRole,
  mockVerifyGuruAksesKelas,
  mockGetMapelIdYangDiajarDiKelas,
  mockUjianFindUnique,
  mockUjianFindMany,
  mockPengerjaanFindUnique,
  mockPengerjaanFindMany,
  mockPengerjaanUpdate,
  mockPengerjaanUpsert,
  mockJawabanFindMany,
  mockJawabanFindUnique,
  mockJawabanUpdate,
  mockJawabanCreate,
  mockJawabanUpsert,
  mockParentStudentFindFirst,
  mockSiswaFindUnique,
  mockGetClientIp,
  mockRateLimitAsync,
  mockPrismaTransaction,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockVerifyGuruAksesKelas: vi.fn(),
  mockGetMapelIdYangDiajarDiKelas: vi.fn(),
  mockUjianFindUnique: vi.fn(),
  mockUjianFindMany: vi.fn(),
  mockPengerjaanFindUnique: vi.fn(),
  mockPengerjaanFindMany: vi.fn(),
  mockPengerjaanUpdate: vi.fn(),
  mockPengerjaanUpsert: vi.fn(),
  mockJawabanFindMany: vi.fn(),
  mockJawabanFindUnique: vi.fn(),
  mockJawabanUpdate: vi.fn(),
  mockJawabanCreate: vi.fn(),
  mockJawabanUpsert: vi.fn(),
  mockParentStudentFindFirst: vi.fn(),
  mockSiswaFindUnique: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockRateLimitAsync: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

const tx = {
  jawabanSiswa: {
    findMany: mockJawabanFindMany,
    findUnique: mockJawabanFindUnique,
    update: mockJawabanUpdate,
    create: mockJawabanCreate,
    upsert: mockJawabanUpsert,
  },
  pengerjaanUjian: {
    findMany: mockPengerjaanFindMany,
    update: mockPengerjaanUpdate,
  },
}

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    ujian: {
      findUnique: mockUjianFindUnique,
      findMany: mockUjianFindMany,
    },
    pengerjaanUjian: {
      findUnique: mockPengerjaanFindUnique,
      findMany: mockPengerjaanFindMany,
      update: mockPengerjaanUpdate,
      upsert: mockPengerjaanUpsert,
    },
    jawabanSiswa: {
      findMany: mockJawabanFindMany,
      findUnique: mockJawabanFindUnique,
      update: mockJawabanUpdate,
      create: mockJawabanCreate,
      upsert: mockJawabanUpsert,
    },
    parentStudent: {
      findFirst: mockParentStudentFindFirst,
    },
    siswa: {
      findUnique: mockSiswaFindUnique,
    },
    $transaction: mockPrismaTransaction,
  },
}))

vi.mock("@/lib/guru-auth", () => ({
  verifyGuruAksesKelas: mockVerifyGuruAksesKelas,
  getMapelIdYangDiajarDiKelas: mockGetMapelIdYangDiajarDiKelas,
}))

vi.mock("@/lib/rate-limit", () => ({
  getClientIpFromHeaders: mockGetClientIp,
  rateLimitAsync: mockRateLimitAsync,
}))

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}))

// ========================================================
// Import setelah semua vi.mock() terdaftar
// ========================================================

import {
  beriNilaiEsai,
  submitPengerjaanUjian,
  tutupPengerjaanUjianKedaluwarsa,
  getRekapHasilUjian,
  getDaftarUjianSiswa,
  getDaftarUjianGuru,
  getDaftarUjianAnak,
} from "@/actions/ujian"

// ========================================================
// Helpers
// ========================================================

type UjianRowView = {
  mataPelajaran: string
  deskripsi?: string
  statusPengerjaan?: string
  nilai?: Prisma.Decimal | null
  totalSoal?: number
  totalPeserta?: number
}

function rowData(data: unknown): UjianRowView[] {
  return data as UjianRowView[]
}

type CallArgs = { mock: { calls: unknown[][] } }

function callArg<T>(fn: CallArgs, index = 0): T {
  return (fn.mock.calls as unknown as unknown[][])[index][0] as T
}

type NilaiEsaiUpdateData = {
  status: StatusPengerjaan
  nilaiTotal: Prisma.Decimal | null
  nilaiEsai: Prisma.Decimal | null
}

type SubmitUpdateData = {
  status: StatusPengerjaan
  submitTerlambat: boolean
  nilaiPg: Prisma.Decimal
  nilaiTotal: Prisma.Decimal | null
}

type TutupUpdateData = {
  status: StatusPengerjaan
  submitTerlambat: boolean
  nilaiTotal: Prisma.Decimal | null
}

function jalankanTransaction() {
  mockPrismaTransaction.mockImplementation(
    async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRateLimitAsync.mockResolvedValue({ success: true })
  mockGetClientIp.mockResolvedValue("127.0.0.1")
  mockVerifyGuruAksesKelas.mockResolvedValue({ user: { id: "guru-1" } })
})

afterEach(() => {
  vi.useRealTimers()
})

// ========================================================
// 1. beriNilaiEsai
// ========================================================

describe("beriNilaiEsai — penilaian esai", () => {
  const basePengerjaan = {
    id: "p1",
    ujianId: "uj-1",
    ujian: {
      id: "uj-1",
      kelasId: "7A-IKHWAN",
      mataPelajaranId: "mapel-fiqih",
      soal: [
        { id: "s-pg", tipe: "PILIHAN_GANDA" as const, bobot: 80 },
        { id: "s-esai", tipe: "ESAI" as const, bobot: 20 },
      ],
    },
  }

  it("menghitung nilaiTotal & nilaiEsai dan menandai DINILAI bila seluruh esai sudah dinilai", async () => {
    mockRequireRole.mockResolvedValue({ id: "guru-1" })
    mockPengerjaanFindUnique.mockResolvedValue(basePengerjaan)
    mockPengerjaanUpdate.mockResolvedValue({ id: "p1", status: StatusPengerjaan.DINILAI })

    mockJawabanFindMany.mockResolvedValue([
      { soal: { tipe: "PILIHAN_GANDA" }, nilaiSoal: new Prisma.Decimal("80") },
      { soal: { tipe: "ESAI" }, nilaiSoal: new Prisma.Decimal("18") },
    ])
    jalankanTransaction()

    const result = await beriNilaiEsai({
      pengerjaanId: "p1",
      penilaian: [{ soalId: "s-esai", nilaiSoal: 18, catatanGuru: "Baik" }],
    })

    expect(result.success).toBe(true)
    expect(mockPengerjaanUpdate).toHaveBeenCalled()
    const data = callArg<{ data: NilaiEsaiUpdateData }>(mockPengerjaanUpdate).data
    expect(data.status).toBe(StatusPengerjaan.DINILAI)
    expect(Number(data.nilaiTotal)).toBe(98) // (80+18)/100 * 100
    expect(Number(data.nilaiEsai)).toBe(90) // 18/20 * 100
  })

  it("menyimpan nilaiTotal null & status SELESAI bila masih ada esai yang belum dinilai", async () => {
    mockRequireRole.mockResolvedValue({ id: "guru-1" })
    mockPengerjaanFindUnique.mockResolvedValue({
      ...basePengerjaan,
      ujian: {
        ...basePengerjaan.ujian,
        soal: [
          { id: "s-esai1", tipe: "ESAI" as const, bobot: 20 },
          { id: "s-esai2", tipe: "ESAI" as const, bobot: 20 },
          { id: "s-pg", tipe: "PILIHAN_GANDA" as const, bobot: 60 },
        ],
      },
    })

    mockJawabanFindMany.mockResolvedValue([
      { soal: { tipe: "ESAI" }, nilaiSoal: new Prisma.Decimal("10") },
      { soal: { tipe: "ESAI" }, nilaiSoal: null }, // belum dinilai
      { soal: { tipe: "PILIHAN_GANDA" }, nilaiSoal: new Prisma.Decimal("60") },
    ])
    jalankanTransaction()

    const result = await beriNilaiEsai({
      pengerjaanId: "p1",
      penilaian: [{ soalId: "s-esai1", nilaiSoal: 10 }],
    })

    expect(result.success).toBe(true)
    const data = callArg<{ data: NilaiEsaiUpdateData }>(mockPengerjaanUpdate).data
    expect(data.status).toBe(StatusPengerjaan.SELESAI)
    expect(data.nilaiTotal).toBeNull()
    expect(data.nilaiEsai).toBeNull()
  })

  it("meng-clamp nilai melebihi bobot soal", async () => {
    mockRequireRole.mockResolvedValue({ id: "guru-1" })
    mockPengerjaanFindUnique.mockResolvedValue(basePengerjaan)
    mockJawabanFindMany.mockResolvedValue([
      { soal: { tipe: "PILIHAN_GANDA" }, nilaiSoal: new Prisma.Decimal("80") },
      { soal: { tipe: "ESAI" }, nilaiSoal: new Prisma.Decimal("0") },
    ])
    jalankanTransaction()

    const result = await beriNilaiEsai({
      pengerjaanId: "p1",
      penilaian: [{ soalId: "s-esai", nilaiSoal: 999 }],
    })

    expect(result.success).toBe(true)
    const updateArgs = callArg<{ data: { nilaiSoal: Prisma.Decimal } }>(mockJawabanUpdate)
    expect(updateArgs.data.nilaiSoal.toNumber()).toBe(20)
  })

  it("menolak nilai negatif lewat validasi schema", async () => {
    const result = await beriNilaiEsai({
      pengerjaanId: "p1",
      penilaian: [{ soalId: "s-esai", nilaiSoal: -5 }],
    })
    expect(result.success).toBe(false)
    expect(result.message).toContain("tidak valid")
    expect(mockPengerjaanFindUnique).not.toHaveBeenCalled()
  })
})

// ========================================================
// 2. submitPengerjaanUjian
// ========================================================

describe("submitPengerjaanUjian — grading PG + submitTerlambat", () => {
  const pengerjaan = {
    id: "p1",
    ujianId: "uj-1",
    status: StatusPengerjaan.SEDANG_MENGERJAKAN,
    waktuMulai: new Date("2024-06-01T08:00:00Z"),
    ujian: {
      id: "uj-1",
      durasiMenit: 60,
      waktuSelesai: new Date("2024-06-01T09:00:00Z"),
      soal: [
        {
          id: "s-pg",
          tipe: "PILIHAN_GANDA",
          bobot: 100,
          opsi: [
            { id: "opsi-a", benar: false },
            { id: "opsi-b", benar: true },
          ],
        },
      ],
    },
  }

  const jawabanPayload = [{ soalId: "s-pg", opsiDipilihId: "opsi-b" }]

  beforeEach(() => {
    mockRequireRole.mockResolvedValue({ student: null, siswa: { id: "siswa-1" } })
    mockPengerjaanFindUnique.mockResolvedValue(pengerjaan)
    mockPengerjaanUpdate.mockResolvedValue({
      ...pengerjaan,
      status: StatusPengerjaan.DINILAI,
      nilaiTotal: new Prisma.Decimal("100.00"),
    })
    mockJawabanUpsert.mockResolvedValue({})
    jalankanTransaction()
  })

  it("menilai PG benar, menandai submit tepat waktu, dan menetapkan DINILAI", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-01T08:30:00Z"))

    const result = await submitPengerjaanUjian({ ujianId: "uj-1", jawaban: jawabanPayload })

    expect(result.success).toBe(true)
    expect((result.data as { submitTerlambat?: boolean }).submitTerlambat).toBe(false)
    expect(mockJawabanUpsert).toHaveBeenCalled()
    const data = callArg<{ data: SubmitUpdateData }>(mockPengerjaanUpdate).data
    expect(data.status).toBe(StatusPengerjaan.DINILAI)
    expect(data.submitTerlambat).toBe(false)
    expect(data.nilaiPg.toNumber()).toBe(100)
    expect(Number(data.nilaiTotal)).toBe(100)
    expect(result.message).toContain("Nilai Anda: 100")
  })

  it("mencatat submitTerlambat = true bila melewati deadlineFinal", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-01T09:05:00Z"))

    const result = await submitPengerjaanUjian({ ujianId: "uj-1", jawaban: jawabanPayload })

    expect(result.success).toBe(true)
    expect((result.data as { submitTerlambat?: boolean }).submitTerlambat).toBe(true)
    const data = callArg<{ data: SubmitUpdateData }>(mockPengerjaanUpdate).data
    expect(data.submitTerlambat).toBe(true)
    expect(result.message).toContain("terlambat")
  })

  it("menolak submit ganda (status bukan SEDANG_MENGERJAKAN)", async () => {
    mockPengerjaanFindUnique.mockResolvedValue({
      ...pengerjaan,
      status: StatusPengerjaan.SELESAI,
    })

    const result = await submitPengerjaanUjian({ ujianId: "uj-1", jawaban: jawabanPayload })

    expect(result.success).toBe(false)
    expect(result.message).toContain("sudah pernah dikumpulkan")
    expect(mockPengerjaanUpdate).not.toHaveBeenCalled()
  })

  it("menolak saat rate limit tercapai", async () => {
    mockRateLimitAsync.mockResolvedValue({ success: false })

    const result = await submitPengerjaanUjian({ ujianId: "uj-1", jawaban: jawabanPayload })

    expect(result.success).toBe(false)
    expect(result.message).toContain("Terlalu banyak request")
    expect(mockPengerjaanFindUnique).not.toHaveBeenCalled()
  })
})

// ========================================================
// 3. tutupPengerjaanUjianKedaluwarsa
// ========================================================

describe("tutupPengerjaanUjianKedaluwarsa — auto-close", () => {
  const sesiExpired = {
    id: "p1",
    siswaId: "siswa-1",
    ujianId: "uj-1",
    status: StatusPengerjaan.SEDANG_MENGERJAKAN,
    waktuMulai: new Date("2024-06-01T08:00:00Z"),
    ujian: {
      durasiMenit: 60,
      waktuSelesai: new Date("2024-06-01T09:00:00Z"),
      soal: [
        { id: "s-pg", tipe: "PILIHAN_GANDA", bobot: 100 },
        { id: "s-esai", tipe: "ESAI", bobot: 0 },
      ],
    },
  }

  beforeEach(() => {
    mockUjianFindUnique.mockResolvedValue({
      id: "uj-1",
      kelasId: "7A-IKHWAN",
      mataPelajaranId: "mapel-fiqih",
    })
    mockPengerjaanFindMany.mockResolvedValue([sesiExpired])
    mockJawabanFindUnique.mockResolvedValue(null)
    mockJawabanFindMany.mockResolvedValue([])
    mockJawabanCreate.mockResolvedValue({})
    mockPengerjaanUpdate.mockResolvedValue({ id: "p1", status: StatusPengerjaan.SELESAI })
    jalankanTransaction()
  })

  it("menutup sesi yang lewat deadline dan menandai submitTerlambat = true", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-01T09:30:00Z"))

    const result = await tutupPengerjaanUjianKedaluwarsa("uj-1")

    expect(result.success).toBe(true)
    expect((result.data as { totalDitutup: number }).totalDitutup).toBe(1)
    expect(mockJawabanCreate).toHaveBeenCalled()
    const data = callArg<{ data: TutupUpdateData }>(mockPengerjaanUpdate).data
    expect(data.submitTerlambat).toBe(true)
    expect(data.status).toBe(StatusPengerjaan.SELESAI) // masih ada esai
    expect(data.nilaiTotal).toBeNull()
  })

  it("tidak menutup sesi yang belum lewat deadline", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-01T08:30:00Z"))

    const result = await tutupPengerjaanUjianKedaluwarsa("uj-1")

    expect(result.success).toBe(true)
    expect((result.data as { totalDitutup: number }).totalDitutup).toBe(0)
    expect(mockPengerjaanUpdate).not.toHaveBeenCalled()
  })

  it("mengembalikan error bila ujian tidak ditemukan (mode per-ujian)", async () => {
    mockUjianFindUnique.mockResolvedValue(null)

    const result = await tutupPengerjaanUjianKedaluwarsa("uj-tidak-ada")

    expect(result.success).toBe(false)
    expect(result.message).toContain("Ujian tidak ditemukan")
  })

  it("membatalkan ketika guru tidak punya akses kelas (mode per-ujian)", async () => {
    mockUjianFindUnique.mockResolvedValue({ id: "uj-1", kelasId: "kelas-X", mataPelajaranId: "mapel-Y" })
    mockVerifyGuruAksesKelas.mockRejectedValue(new Error("Akses ditolak"))

    const result = await tutupPengerjaanUjianKedaluwarsa("uj-1")

    expect(result.success).toBe(false)
    expect(result.message).toBe("Akses ditolak")
  })
})

// ========================================================
// 4. getDaftarUjianGuru — filter mapel
// ========================================================

describe("getDaftarUjianGuru — filter akses mapel", () => {
  const ujianRow = {
    id: "uj-1",
    judul: "UAS Fiqih",
    deskripsi: "Ujian akhir",
    kelasId: "7A-IKHWAN",
    targetGender: null,
    durasiMenit: 60,
    waktuMulai: new Date("2024-06-01T08:00:00Z"),
    waktuSelesai: new Date("2024-06-01T09:00:00Z"),
    status: StatusUjian.PUBLISHED,
    mapelJenis: null,
    mataPelajaran: { nama: "Fiqih Ibadah", jenisKelamin: null },
    periodeAjaran: { nama: "2024/2025 - Ganjil" },
    dibuatOleh: { nama: "Ustadz Ahmad" },
    _count: { soal: 5, pengerjaan: 3 },
  }

  it("membatasi daftar untuk pengajar non-wali sesuai mapel yang diampu", async () => {
    mockGetMapelIdYangDiajarDiKelas.mockResolvedValue(["mapel-fiqih"])
    mockUjianFindMany.mockResolvedValue([ujianRow])
    mockRequireRole.mockResolvedValue({ id: "guru-1" })

    const result = await getDaftarUjianGuru("7A-IKHWAN")

    expect(result.success).toBe(true)
    const where = callArg<{ where: Record<string, unknown> }>(mockUjianFindMany).where
    expect(where).toEqual(
      expect.objectContaining({ mataPelajaranId: { in: ["mapel-fiqih"] } })
    )
    const rows = rowData(result.data)
    expect(rows[0].mataPelajaran).toBe("Fiqih Ibadah")
    expect(rows[0].deskripsi).toBe("Ujian akhir")
    expect(rows[0].totalSoal).toBe(5)
    expect(rows[0].totalPeserta).toBe(3)
  })

  it("admin (ALL) tidak menerapkan filter mapel", async () => {
    mockGetMapelIdYangDiajarDiKelas.mockResolvedValue("ALL")
    mockUjianFindMany.mockResolvedValue([ujianRow])
    mockRequireRole.mockResolvedValue({ id: "guru-1" })

    const result = await getDaftarUjianGuru("7A-IKHWAN")

    expect(result.success).toBe(true)
    const where = callArg<{ where: Record<string, unknown> }>(mockUjianFindMany).where
    expect(where).not.toHaveProperty("mataPelajaranId")
  })

  it("mengembalikan daftar kosong bila pengajar tidak mengampu mapel apa pun di kelas itu", async () => {
    mockGetMapelIdYangDiajarDiKelas.mockResolvedValue([])
    mockRequireRole.mockResolvedValue({ id: "guru-1" })

    const result = await getDaftarUjianGuru("7A-IKHWAN")

    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
    expect(mockUjianFindMany).not.toHaveBeenCalled()
  })

  it("menolak guru tanpa akses ke kelas", async () => {
    mockVerifyGuruAksesKelas.mockRejectedValue(new Error("Akses ditolak"))
    mockRequireRole.mockResolvedValue({ id: "guru-1" })

    const result = await getDaftarUjianGuru("kelas-X")

    expect(result.success).toBe(false)
    expect(result.message).toBe("Akses ditolak")
  })
})

// ========================================================
// 5. getDaftarUjianAnak — orang tua
// ========================================================

describe("getDaftarUjianAnak — orang tua", () => {
  const ujianAnak = {
    id: "uj-1",
    judul: "UAS Fiqih",
    deskripsi: "Ujian akhir",
    durasiMenit: 60,
    waktuMulai: new Date("2024-06-01T08:00:00Z"),
    waktuSelesai: new Date("2024-06-01T09:00:00Z"),
    targetGender: null,
    mataPelajaran: { nama: "Fiqih Ibadah" },
    periodeAjaran: { nama: "2024/2025 - Ganjil" },
    dibuatOleh: { nama: "Ustadz Ahmad" },
    pengerjaan: [],
    _count: { soal: 5 },
  }

  beforeEach(() => {
    mockRequireRole.mockResolvedValue({ orangTua: { id: "ortu-1" } })
    mockParentStudentFindFirst.mockResolvedValue({ id: "rel-1" })
    mockSiswaFindUnique.mockResolvedValue({
      id: "siswa-1",
      kelasId: "7A-IKHWAN",
      jenisKelamin: "LAKI_LAKI",
    })
    mockPengerjaanFindMany.mockResolvedValue([])
    mockUjianFindMany.mockResolvedValue([ujianAnak])
  })

  it("menampilkan nama mapel & status BELUM_MULAI untuk anak tanpa pengerjaan", async () => {
    const result = await getDaftarUjianAnak("siswa-1")

    expect(result.success).toBe(true)
    const rows = rowData(result.data)
    expect(rows[0].mataPelajaran).toBe("Fiqih Ibadah")
    expect(rows[0].statusPengerjaan).toBe("BELUM_MULAI")
    expect(rows[0].nilai).toBeNull()
    expect(rows[0].totalSoal).toBe(5)
  })

  it("menolak bila siswa bukan anak dari orang tua tersebut", async () => {
    mockParentStudentFindFirst.mockResolvedValue(null)

    const result = await getDaftarUjianAnak("siswa-lain")

    expect(result.success).toBe(false)
    expect(result.message).toContain("bukan anak Anda")
    expect(mockUjianFindMany).not.toHaveBeenCalled()
  })

  it("menampilkan nilai bila pengerjaan sudah DINILAI", async () => {
    mockUjianFindMany.mockResolvedValue([
      {
        ...ujianAnak,
        pengerjaan: [
          {
            id: "p1",
            status: StatusPengerjaan.DINILAI,
            waktuMulai: new Date("2024-06-01T08:00:00Z"),
            waktuSubmit: new Date("2024-06-01T08:45:00Z"),
            nilaiTotal: new Prisma.Decimal("87.50"),
          },
        ],
      },
    ])

    const result = await getDaftarUjianAnak("siswa-1")

    expect(result.success).toBe(true)
    const rows = rowData(result.data)
    expect(rows[0].statusPengerjaan).toBe(StatusPengerjaan.DINILAI)
    expect(rows[0].nilai?.toNumber()).toBe(87.5)
  })

  it("menolak ketika role bukan orang tua", async () => {
    mockRequireRole.mockResolvedValue({ orangTua: undefined })

    const result = await getDaftarUjianAnak("siswa-1")

    expect(result.success).toBe(false)
    expect(result.message).toContain("Data orang tua tidak ditemukan")
  })
})

// ========================================================
// 6. tutupPengerjaanUjianKedaluwarsa — mode cron & edge case
// ========================================================

describe("tutupPengerjaanUjianKedaluwarsa — mode cron & edge case", () => {
  function buatSesi(overrides: Record<string, unknown> = {}) {
    return {
      id: "p-exp",
      siswaId: "siswa-1",
      ujianId: "uj-1",
      status: StatusPengerjaan.SEDANG_MENGERJAKAN,
      waktuMulai: new Date("2024-06-01T08:00:00Z"),
      ujian: {
        durasiMenit: 60,
        waktuSelesai: new Date("2024-06-01T09:00:00Z"),
        soal: [{ id: "s-pg", tipe: "PILIHAN_GANDA", bobot: 100 }],
      },
      ...overrides,
    }
  }

  function setupSesiBerjalan() {
    mockJawabanFindUnique.mockResolvedValue(null)
    mockJawabanCreate.mockResolvedValue({})
    mockJawabanFindMany.mockResolvedValue([])
    mockPengerjaanUpdate.mockResolvedValue({ id: "p-exp" })
    jalankanTransaction()
  }

  it("mode cron (tanpa ujianId): tanpa verifikasi guru, where global, tetap menutup sesi", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-01T09:30:00Z"))
    mockPengerjaanFindMany.mockResolvedValue([buatSesi()])
    setupSesiBerjalan()

    const result = await tutupPengerjaanUjianKedaluwarsa()

    expect(result.success).toBe(true)
    // Mode cron: tidak ada otorisasi guru & tidak lookup ujian
    expect(mockVerifyGuruAksesKelas).not.toHaveBeenCalled()
    expect(mockUjianFindUnique).not.toHaveBeenCalled()
    // Where clause TANPA ujianId — memproses semua ujian
    const args = callArg<{ where: Record<string, unknown> }>(mockPengerjaanFindMany)
    expect(args.where).toEqual({ status: StatusPengerjaan.SEDANG_MENGERJAKAN })
    expect((result.data as { totalDitutup: number }).totalDitutup).toBe(1)
  })

  it("ujian hanya PG: status DINILAI & nilaiTotal = nilaiPg (bukan null)", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-01T09:30:00Z"))
    mockPengerjaanFindMany.mockResolvedValue([
      buatSesi({
        ujian: {
          durasiMenit: 60,
          waktuSelesai: new Date("2024-06-01T09:00:00Z"),
          soal: [
            { id: "s1", tipe: "PILIHAN_GANDA", bobot: 30 },
            { id: "s2", tipe: "PILIHAN_GANDA", bobot: 70 },
          ],
        },
      }),
    ])
    mockJawabanFindUnique.mockResolvedValue(null)
    mockJawabanCreate.mockResolvedValue({})
    // Siswa sempat menjawab: s1 benar, s2 salah → poin 30 dari bobot 100
    mockJawabanFindMany.mockResolvedValue([
      { soal: { tipe: "PILIHAN_GANDA", bobot: 30 }, benar: true },
      { soal: { tipe: "PILIHAN_GANDA", bobot: 70 }, benar: false },
    ])
    mockPengerjaanUpdate.mockResolvedValue({ id: "p-exp" })
    jalankanTransaction()

    const result = await tutupPengerjaanUjianKedaluwarsa("uj-1")

    expect(result.success).toBe(true)
    const data = callArg<{
      data: {
        status: StatusPengerjaan
        nilaiPg: Prisma.Decimal
        nilaiTotal: Prisma.Decimal | null
        submitTerlambat: boolean
      }
    }>(mockPengerjaanUpdate).data
    expect(data.status).toBe(StatusPengerjaan.DINILAI)
    expect(data.submitTerlambat).toBe(true)
    expect(data.nilaiPg.toNumber()).toBe(30)
    expect(data.nilaiTotal).not.toBeNull()
    expect(Number(data.nilaiTotal)).toBe(30)
  })

  it("jawaban yang sudah ada tidak dibuat ulang (tanpa duplikat record kosong)", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-01T09:30:00Z"))
    mockPengerjaanFindMany.mockResolvedValue([
      buatSesi({
        ujian: {
          durasiMenit: 60,
          waktuSelesai: new Date("2024-06-01T09:00:00Z"),
          soal: [
            { id: "s-ada", tipe: "PILIHAN_GANDA", bobot: 50 },
            { id: "s-kosong", tipe: "PILIHAN_GANDA", bobot: 50 },
          ],
        },
      }),
    ])
    // s-ada sudah punya jawaban tersimpan, s-kosong belum
    mockJawabanFindUnique.mockImplementation(
      async (args: { where: { pengerjaanId_soalId: { soalId: string } } }) =>
        args.where.pengerjaanId_soalId.soalId === "s-ada" ? { id: "j-1" } : null
    )
    mockJawabanCreate.mockResolvedValue({})
    mockJawabanFindMany.mockResolvedValue([])
    mockPengerjaanUpdate.mockResolvedValue({ id: "p-exp" })
    jalankanTransaction()

    const result = await tutupPengerjaanUjianKedaluwarsa("uj-1")

    expect(result.success).toBe(true)
    expect(mockJawabanCreate).toHaveBeenCalledTimes(1)
    const created = callArg<{ data: { soalId: string } }>(mockJawabanCreate)
    expect(created.data.soalId).toBe("s-kosong")
  })

  it("menutup sesi yang durasinya habis meski jendela ujian masih terbuka (min deadline)", async () => {
    // Ujian buka sampai 10:00, durasi siswa 60 menit dari 08:00 → deadline 09:00
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-01T09:05:00Z"))
    mockPengerjaanFindMany.mockResolvedValue([
      buatSesi({
        ujian: {
          durasiMenit: 60,
          waktuSelesai: new Date("2024-06-01T10:00:00Z"),
          soal: [{ id: "s-pg", tipe: "PILIHAN_GANDA", bobot: 100 }],
        },
      }),
    ])
    setupSesiBerjalan()

    const result = await tutupPengerjaanUjianKedaluwarsa("uj-1")

    expect(result.success).toBe(true)
    expect((result.data as { totalDitutup: number }).totalDitutup).toBe(1)
    expect(mockPengerjaanUpdate).toHaveBeenCalled()
  })

  it("tidak menutup sesi saat jendela ujian berakhir lebih dulu dari durasi & belum lewat", async () => {
    // Ujian selesai 08:30 (lebih awal dari deadline durasi 09:00); now 08:20 → masih terbuka
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-01T08:20:00Z"))
    mockPengerjaanFindMany.mockResolvedValue([
      buatSesi({
        ujian: {
          durasiMenit: 60,
          waktuSelesai: new Date("2024-06-01T08:30:00Z"),
          soal: [{ id: "s-pg", tipe: "PILIHAN_GANDA", bobot: 100 }],
        },
      }),
    ])
    setupSesiBerjalan()

    const result = await tutupPengerjaanUjianKedaluwarsa("uj-1")

    expect(result.success).toBe(true)
    expect((result.data as { totalDitutup: number }).totalDitutup).toBe(0)
    expect(mockPengerjaanUpdate).not.toHaveBeenCalled()
  })

  it("totalDitutup & detail hanya menghitung sesi kedaluwarsa", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-01T09:30:00Z"))
    mockPengerjaanFindMany.mockResolvedValue([
      buatSesi({ id: "p-1" }), // deadline 09:00 → kedaluwarsa
      buatSesi({
        id: "p-2",
        waktuMulai: new Date("2024-06-01T09:00:00Z"),
        ujian: {
          durasiMenit: 60,
          waktuSelesai: new Date("2024-06-01T09:45:00Z"),
          soal: [{ id: "s-pg", tipe: "PILIHAN_GANDA", bobot: 100 }],
        },
      }), // deadline 09:45 → belum
      buatSesi({ id: "p-3" }), // kedaluwarsa
    ])
    setupSesiBerjalan()

    const result = await tutupPengerjaanUjianKedaluwarsa("uj-1")

    const data = result.data as { totalDitutup: number; detail: string[] }
    expect(data.totalDitutup).toBe(2)
    expect(data.detail).toHaveLength(2)
    expect(data.detail[0]).toContain("p-1")
    expect(data.detail[1]).toContain("p-3")
  })
})

// ========================================================
// 7. Lazy-close trigger dari alur rekap & daftar
// ========================================================

describe("lazy-close trigger — getRekapHasilUjian & getDaftarUjianSiswa", () => {
  it("getRekapHasilUjian memicu tutup per-ujian sebelum rekap", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-01T09:30:00Z"))
    mockUjianFindUnique.mockResolvedValue({
      id: "uj-1",
      kelasId: "7A-IKHWAN",
      mataPelajaranId: "mapel-fiqih",
      kelas: { nama: "7A" },
      soal: [],
    })
    // Panggilan 1 = lazy-close (sesi SEDANG_MENGERJAKAN), panggilan 2 = rekap
    mockPengerjaanFindMany.mockResolvedValue([])
    mockJawabanFindUnique.mockResolvedValue(null)
    mockJawabanFindMany.mockResolvedValue([])
    mockJawabanCreate.mockResolvedValue({})
    mockPengerjaanUpdate.mockResolvedValue({ id: "p-1" })
    jalankanTransaction()

    const result = await getRekapHasilUjian("uj-1")

    expect(result.success).toBe(true)
    expect(mockPengerjaanFindMany).toHaveBeenCalledTimes(2)
    const argsTutup = callArg<{ where: Record<string, unknown> }>(
      mockPengerjaanFindMany,
      0
    )
    expect(argsTutup.where).toEqual({
      ujianId: "uj-1",
      status: StatusPengerjaan.SEDANG_MENGERJAKAN,
    })
  })

  it("getDaftarUjianSiswa memicu tutup global (semua ujian) sebelum daftar", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-01T09:30:00Z"))
    mockRequireRole.mockResolvedValue({
      siswa: { id: "siswa-1", kelasId: "kelas-1", jenisKelamin: "LAKI_LAKI" },
    })
    mockPengerjaanFindMany.mockResolvedValue([])
    mockUjianFindMany.mockResolvedValue([
      {
        id: "uj-1",
        judul: "Ujian",
        deskripsi: null,
        mataPelajaran: { nama: "Fiqih" },
        durasiMenit: 60,
        waktuMulai: new Date("2024-06-01T08:00:00Z"),
        waktuSelesai: new Date("2024-06-01T09:00:00Z"),
        pengerjaan: [],
        _count: { soal: 5 },
        dibuatOleh: { nama: "Guru" },
      },
    ])

    const result = await getDaftarUjianSiswa()

    expect(result.success).toBe(true)
    // Panggilan pertama pengerjaanFindMany = lazy-close global tanpa ujianId
    const argsTutup = callArg<{ where: Record<string, unknown> }>(
      mockPengerjaanFindMany,
      0
    )
    expect(argsTutup.where).toEqual({ status: StatusPengerjaan.SEDANG_MENGERJAKAN })
  })

  it("kegagalan lazy-close tidak menggagalkan getDaftarUjianAnak (non-fatal)", async () => {
    mockRequireRole.mockResolvedValue({ orangTua: { id: "ortu-1" } })
    mockParentStudentFindFirst.mockResolvedValue({ id: "rel-1" })
    mockSiswaFindUnique.mockResolvedValue({
      id: "siswa-1",
      kelasId: "7A-IKHWAN",
      jenisKelamin: "LAKI_LAKI",
    })
    // Lazy-close gagal — ditangkap internal (success:false), daftar tetap dimuat
    mockPengerjaanFindMany.mockRejectedValue(new Error("DB timeout"))
    mockUjianFindMany.mockResolvedValue([
      {
        id: "uj-1",
        judul: "Ujian",
        deskripsi: null,
        mataPelajaran: { nama: "Fiqih" },
        durasiMenit: 60,
        waktuMulai: new Date("2024-06-01T08:00:00Z"),
        waktuSelesai: new Date("2024-06-01T09:00:00Z"),
        pengerjaan: [],
        _count: { soal: 5 },
        dibuatOleh: { nama: "Guru" },
      },
    ])

    const result = await getDaftarUjianAnak("siswa-1")

    expect(result.success).toBe(true)
    expect(mockUjianFindMany).toHaveBeenCalled()
  })
})