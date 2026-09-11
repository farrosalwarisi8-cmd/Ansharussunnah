// src/actions/tugas.test.ts
//
// Regression tests: pengumpulan tugas dengan URL eksternal (Google Drive).
//
// Bug yang dikunci: guru input materi/tugas dengan URL eksternal → server
// membuatkan signed URL dari string "https://..." (rusak) dan menimpa URL
// aslinya. Akibatnya tombol "Jawaban"/"Buka Materi" tidak membuka Drive.
//
// Kontrak yang diharapkan:
//   - Path internal (submission/..., materi/...) → signedUrl dibuat.
//   - URL eksternal (http/https) → signedUrl KOSONG, url asli diteruskan.

import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  mockPrisma,
  mockGetSignedUrl,
  mockGetSignedUrls,
  mockRequireRole,
  mockVerifyGuruAksesKelas,
} = vi.hoisted(() => ({
  mockPrisma: {
    tugas: {
      findUnique: vi.fn(),
    },
    siswa: {
      findMany: vi.fn(),
    },
    pengumpulanTugas: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    riwayatPengumpulanTugas: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockGetSignedUrl: vi.fn(),
  mockGetSignedUrls: vi.fn(),
  mockRequireRole: vi.fn(),
  mockVerifyGuruAksesKelas: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }))

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}))

vi.mock("@/lib/guru-auth", () => ({
  verifyGuruAksesKelas: mockVerifyGuruAksesKelas.mockResolvedValue({
    user: { id: "guru-user-1" },
  }),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: vi.fn().mockResolvedValue({ success: true }),
  getClientIpFromHeaders: vi.fn().mockResolvedValue("127.0.0.1"),
}))

// storage helpers dimock — isExternalUrl tetap implementasi ASLI agar
// perilaku guard-nya ikut teruji.
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>()
  return {
    ...actual,
    getSignedUrl: mockGetSignedUrl,
    getSignedUrls: mockGetSignedUrls,
  }
})

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { submitTugas, getRekapPengumpulanTugas, getDetailTugasSiswa } from "@/actions/tugas"

// ========================================================
// Dummy data
// ========================================================

const GOOGLE_DRIVE_URL = "https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing"

const tugasDummy = {
  id: "tugas-1",
  judul: "Latihan Tashrif",
  deskripsi: "Kerjakan latihan bab 1",
  kelasId: "kelas-1",
  mataPelajaranId: "mapel-1",
  mataPelajaran: { nama: "Bahasa Arab" },
  kelas: { id: "kelas-1", nama: "Kelas 1" },
  periodeAjaranId: "periode-1",
  lampiranUrl: null,
  deadline: new Date("2099-12-31T23:59:59Z"),
  dibuatOlehId: "guru-user-1",
  createdAt: new Date(),
}

const siswaDummy = {
  id: "siswa-1",
  nisn: "0081234567",
  kelasId: "kelas-1",
  user: { nama: "Ahmad Fauzi" },
}

const pengumpulanInternal = {
  id: "pengumpulan-1",
  siswaId: "siswa-1",
  tugasId: "tugas-1",
  urlFile: `submission/tugas-1/siswa-1/abc123.pdf`,
  namaFile: "abc123.pdf",
  ukuranFile: 1024,
  status: "TEPAT_WAKTU",
  waktuKumpul: new Date(),
  nilai: null,
  feedback: null,
  jumlahRevisi: 0,
  dinilaiOleh: null,
  waktuPenilaian: null,
}

const pengumpulanDrive = {
  ...pengumpulanInternal,
  id: "pengumpulan-2",
  urlFile: GOOGLE_DRIVE_URL,
  namaFile: "1AbCdEfGhIjK",
}

const baseSiswaSession = {
  id: "user-siswa-1",
  role: "SISWA",
  siswa: { id: "siswa-1", kelasId: "kelas-1" },
  orangTua: null,
}

// ========================================================
// 1. submitTugas — menerima URL Google Drive
// ========================================================

describe("submitTugas — URL eksternal (Google Drive)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireRole.mockResolvedValue(baseSiswaSession)
  })

  it("harus menerima URL Google Drive dan menyimpan url asli tanpa perlu verifikasi storage", async () => {
    mockPrisma.tugas.findUnique.mockResolvedValue(tugasDummy)
    mockPrisma.pengumpulanTugas.findUnique.mockResolvedValue(null)
    mockPrisma.pengumpulanTugas.create.mockResolvedValue({ id: "p-new" })

    const result = await submitTugas({
      tugasId: "tugas-1",
      urlFile: GOOGLE_DRIVE_URL,
      namaFile: "1AbCdEfGhIjK",
      ukuranFile: 1024,
    })

    expect(result.success).toBe(true)

    // Verifikasi storage TIDAK dipanggil untuk URL eksternal
    expect(mockPrisma.pengumpulanTugas.create).toHaveBeenCalledOnce()
    const createArg = mockPrisma.pengumpulanTugas.create.mock.calls[0][0]
    expect(createArg.data.urlFile).toBe(GOOGLE_DRIVE_URL)
  })

  it("harus tetap menandai TERLAMBAT jika submit setelah deadline", async () => {
    mockPrisma.tugas.findUnique.mockResolvedValue({
      ...tugasDummy,
      deadline: new Date("2020-01-01T00:00:00Z"), // sudah lewat
    })
    mockPrisma.pengumpulanTugas.findUnique.mockResolvedValue(null)
    mockPrisma.pengumpulanTugas.create.mockResolvedValue({ id: "p-new" })

    const result = await submitTugas({
      tugasId: "tugas-1",
      urlFile: GOOGLE_DRIVE_URL,
      namaFile: "1AbCdEfGhIjK",
      ukuranFile: 1024,
    })

    expect(result.success).toBe(true)
    expect(result.message).toContain("TERLAMBAT")
    const createArg = mockPrisma.pengumpulanTugas.create.mock.calls[0][0]
    // Status dihitung eksplisit di aplikasi berdasarkan waktuKumpul vs deadline
    expect(createArg.data.status).toBe("TERLAMBAT")
    expect(createArg.data.waktuKumpul).toBeInstanceOf(Date)
  })

  it("harus menolak path internal yang tidak sesuai prefix per-siswa", async () => {
    mockPrisma.tugas.findUnique.mockResolvedValue(tugasDummy)

    const result = await submitTugas({
      tugasId: "tugas-1",
      urlFile: "submission/tugas-1/siswa-LAIN/abc.pdf",
      namaFile: "abc.pdf",
      ukuranFile: 1024,
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("Path file tidak valid")
    expect(mockPrisma.pengumpulanTugas.create).not.toHaveBeenCalled()
  })

  it("harus resubmit (revisi) dengan URL Drive baru dan arsipkan riwayat", async () => {
    mockPrisma.tugas.findUnique.mockResolvedValue(tugasDummy)
    mockPrisma.pengumpulanTugas.findUnique.mockResolvedValue(pengumpulanInternal)
    mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma))

    const result = await submitTugas({
      tugasId: "tugas-1",
      urlFile: GOOGLE_DRIVE_URL,
      namaFile: "1AbCdEfGhIjK",
      ukuranFile: 1024,
    })

    expect(result.success).toBe(true)
    expect(result.message).toContain("dikirim ulang")
    expect(mockPrisma.riwayatPengumpulanTugas.create).toHaveBeenCalledOnce()
    expect(mockPrisma.pengumpulanTugas.update).toHaveBeenCalledOnce()
    const updateArg = mockPrisma.pengumpulanTugas.update.mock.calls[0][0]
    expect(updateArg.data.urlFile).toBe(GOOGLE_DRIVE_URL)
    expect(updateArg.data.jumlahRevisi).toStrictEqual({ increment: 1 })
  })
})

// ========================================================
// 2. getRekapPengumpulanTugas — guru melihat pengumpulan URL Drive
// ========================================================

describe("getRekapPengumpulanTugas — pengumpulan via Google Drive", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus mengembalikan signedUrl null + urlFile asli untuk pengumpulan Drive", async () => {
    mockPrisma.tugas.findUnique.mockResolvedValue(tugasDummy)
    mockPrisma.siswa.findMany.mockResolvedValue([siswaDummy])
    mockPrisma.pengumpulanTugas.findMany.mockResolvedValue([pengumpulanDrive])
    mockGetSignedUrls.mockResolvedValue(new Map()) // Drive URL di-skip oleh guard

    const result = await getRekapPengumpulanTugas("tugas-1")

    if (!result.success) throw new Error(result.message)
    const rekap = (result.data as { rekap: Array<Record<string, unknown>> }).rekap
    expect(rekap).toHaveLength(1)

    const item = rekap[0]
    expect(item.urlFile).toBe(GOOGLE_DRIVE_URL)
    expect(item.signedUrl).toBeNull()

    // Guard getSignedUrls: URL Drive TIDAK boleh dikirim ke Supabase
    expect(mockGetSignedUrls).toHaveBeenCalledOnce()
    const pathsArg = mockGetSignedUrls.mock.calls[0][1] as string[]
    expect(pathsArg).not.toContain(GOOGLE_DRIVE_URL)
  })

  it("harus tetap membuat signedUrl untuk path internal (regresi)", async () => {
    mockPrisma.tugas.findUnique.mockResolvedValue(tugasDummy)
    mockPrisma.siswa.findMany.mockResolvedValue([siswaDummy])
    mockPrisma.pengumpulanTugas.findMany.mockResolvedValue([pengumpulanInternal])
    mockGetSignedUrls.mockResolvedValue(
      new Map([[pengumpulanInternal.urlFile, "https://supabase.co/signed?token=x"]])
    )

    const result = await getRekapPengumpulanTugas("tugas-1")

    if (!result.success) throw new Error(result.message)
    const rekap = (result.data as { rekap: Array<Record<string, unknown>> }).rekap
    const item = rekap[0]
    expect(item.urlFile).toBe(pengumpulanInternal.urlFile)
    expect(item.signedUrl).toBe("https://supabase.co/signed?token=x")
  })

  it("harus menampilkan keduanya: internal + Drive dalam satu rekap", async () => {
    mockPrisma.tugas.findUnique.mockResolvedValue(tugasDummy)
    mockPrisma.siswa.findMany.mockResolvedValue([
      siswaDummy,
      { ...siswaDummy, id: "siswa-2", user: { nama: "Siswa Dua" } },
    ])
    mockPrisma.pengumpulanTugas.findMany.mockResolvedValue([
      pengumpulanInternal,
      { ...pengumpulanDrive, siswaId: "siswa-2" },
    ])
    mockGetSignedUrls.mockResolvedValue(
      new Map([[pengumpulanInternal.urlFile, "https://supabase.co/signed?token=x"]])
    )

    const result = await getRekapPengumpulanTugas("tugas-1")

    if (!result.success) throw new Error(result.message)
    const rekap = (result.data as { rekap: Array<Record<string, unknown>> }).rekap
    const bySiswa = new Map(rekap.map((r) => [r.siswaId, r]))

    expect(bySiswa.get("siswa-1")!.signedUrl).toBe("https://supabase.co/signed?token=x")
    expect(bySiswa.get("siswa-2")!.signedUrl).toBeNull()
    expect(bySiswa.get("siswa-2")!.urlFile).toBe(GOOGLE_DRIVE_URL)
  })
})

// ========================================================
// 3. getDetailTugasSiswa — jawaban Drive diteruskan apa adanya
// ========================================================

describe("getDetailTugasSiswa — jawaban eksternal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireRole.mockResolvedValue(baseSiswaSession)
  })

  it("harus meneruskan URL Drive sebagai jawabanUrl (bukan null / bukan signed)", async () => {
    mockPrisma.tugas.findUnique.mockResolvedValue({
      ...tugasDummy,
      pengumpulan: [{ ...pengumpulanDrive, riwayat: [] }],
      dibuatOleh: { nama: "Ustadz Guru" },
      periodeAjaran: { nama: "2026/2027" },
    })

    const result = await getDetailTugasSiswa("tugas-1")

    expect(result.success).toBe(true)
    const data = result.data as { pengumpulan: { jawabanUrl: string | null } }
    expect(data.pengumpulan.jawabanUrl).toBe(GOOGLE_DRIVE_URL)
    // getSignedUrl tidak boleh dipanggil untuk URL eksternal
    expect(mockGetSignedUrl).not.toHaveBeenCalled()
  })

  it("harus membuat signedUrl untuk jawaban path internal", async () => {
    mockPrisma.tugas.findUnique.mockResolvedValue({
      ...tugasDummy,
      pengumpulan: [{ ...pengumpulanInternal, riwayat: [] }],
      dibuatOleh: { nama: "Ustadz Guru" },
      periodeAjaran: { nama: "2026/2027" },
    })
    mockGetSignedUrl.mockResolvedValue("https://supabase.co/signed?token=x")

    const result = await getDetailTugasSiswa("tugas-1")

    expect(result.success).toBe(true)
    const data = result.data as { pengumpulan: { jawabanUrl: string | null } }
    expect(data.pengumpulan.jawabanUrl).toBe("https://supabase.co/signed?token=x")
    expect(mockGetSignedUrl).toHaveBeenCalledOnce()
  })
})
