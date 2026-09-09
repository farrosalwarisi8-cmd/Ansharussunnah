// src/actions/dashboard.test.ts
//
// Menguji filter gender di hitungRangkumanSiswa (dipanggil via
// getRangkumanSiswaHome & getRangkumanOrangTuaHome):
// - Ujian/tugas pada dashboard difilter berdasarkan targetGender konten
//   DAN jenisKelamin mata pelajaran sesuai gender siswa/anak.
// - Untuk orang tua, gender yang dipakai adalah gender ANAK (bukan ortu).
// - Guard akses: siswa tanpa kelas & ortu tanpa relasi ParentStudent ditolak.

import { describe, it, expect, vi, beforeEach } from "vitest"
import { Role } from "@prisma/client"
import { AppError } from "@/lib/prisma-error"

const {
  mockRequireRole,
  mockIsAcademicAdminRole,
  mockUjianFindMany,
  mockUjianCount,
  mockTugasFindMany,
  mockAbsensiFindMany,
  mockTagihanFindFirst,
  mockTagihanCount,
  mockSiswaFindUnique,
  mockSiswaCount,
  mockParentStudentFindFirst,
  mockKelasFindMany,
  mockKelasCount,
  mockGuruCount,
  mockMapelCount,
  mockPendaftaranCount,
  mockPengerjaanUjianCount,
  mockPengumpulanTugasCount,
} = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockIsAcademicAdminRole: vi.fn(),
  mockUjianFindMany: vi.fn(),
  mockUjianCount: vi.fn(),
  mockTugasFindMany: vi.fn(),
  mockAbsensiFindMany: vi.fn(),
  mockTagihanFindFirst: vi.fn(),
  mockTagihanCount: vi.fn(),
  mockSiswaFindUnique: vi.fn(),
  mockSiswaCount: vi.fn(),
  mockParentStudentFindFirst: vi.fn(),
  mockKelasFindMany: vi.fn(),
  mockKelasCount: vi.fn(),
  mockGuruCount: vi.fn(),
  mockMapelCount: vi.fn(),
  mockPendaftaranCount: vi.fn(),
  mockPengerjaanUjianCount: vi.fn(),
  mockPengumpulanTugasCount: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    ujian: { findMany: mockUjianFindMany, count: mockUjianCount },
    tugas: { findMany: mockTugasFindMany },
    absensi: { findMany: mockAbsensiFindMany },
    tagihanSiswa: { findFirst: mockTagihanFindFirst, count: mockTagihanCount },
    siswa: { findUnique: mockSiswaFindUnique, count: mockSiswaCount },
    parentStudent: { findFirst: mockParentStudentFindFirst },
    kelas: { findMany: mockKelasFindMany, count: mockKelasCount },
    guru: { count: mockGuruCount },
    mataPelajaran: { count: mockMapelCount },
    pendaftaran: { count: mockPendaftaranCount },
    pengerjaanUjian: { count: mockPengerjaanUjianCount },
    pengumpulanTugas: { count: mockPengumpulanTugasCount },
  },
}))

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
  isAcademicAdminRole: mockIsAcademicAdminRole,
}))

import {
  getRangkumanSiswaHome,
  getRangkumanOrangTuaHome,
  getRangkumanGuruHome,
  getRangkumanAdminHome,
} from "@/actions/dashboard"

function buatUjianRow(overrides: Record<string, unknown> = {}) {
  const now = new Date()
  return {
    id: "ujian-1",
    judul: "Ujian Nahwu",
    kelas: { nama: "7A" },
    mataPelajaran: { nama: "Bahasa Arab" },
    status: "PUBLISHED",
    durasiMenit: 60,
    waktuMulai: new Date(now.getTime() - 24 * 3600 * 1000), // kemarin → sudah dibuka
    waktuSelesai: new Date(now.getTime() + 24 * 3600 * 1000), // besok → belum tutup
    pengerjaan: [],
    _count: { soal: 10 },
    ...overrides,
  }
}

function mockRangkumanKosong() {
  mockUjianFindMany.mockResolvedValue([])
  mockTugasFindMany.mockResolvedValue([])
  mockAbsensiFindMany.mockResolvedValue([])
  mockTagihanFindFirst.mockResolvedValue(null)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIsAcademicAdminRole.mockReturnValue(false)
  mockRangkumanKosong()
})

// ========================================================
// HELPER ASSERTION: bentuk filter gender di where clause
// ========================================================

function expectGenderFilterPada(where: {
  kelasId?: unknown
  AND?: Array<Record<string, unknown>>
}, gender: "LAKI_LAKI" | "PEREMPUAN") {
  expect(where.kelasId).toBe("kelas-1")
  expect(where.AND).toEqual(
    expect.arrayContaining([
      {
        OR: [{ targetGender: null }, { targetGender: gender }],
      },
      {
        OR: [
          { mataPelajaran: { jenisKelamin: null } },
          { mataPelajaran: { jenisKelamin: gender } },
        ],
      },
    ])
  )
}

// ========================================================
// 1. SISWA: filter gender pakai jenis kelamin siswa sendiri
// ========================================================

describe("getRangkumanSiswaHome — filter gender", () => {
  it("mengirim filter targetGender & mapel sesuai jenis kelamin siswa LAKI_LAKI", async () => {
    mockRequireRole.mockResolvedValue({
      role: Role.SISWA,
      siswa: { id: "siswa-1", kelasId: "kelas-1", jenisKelamin: "LAKI_LAKI" },
    })

    const result = await getRangkumanSiswaHome()

    expect(result.success).toBe(true)
    expect(mockUjianFindMany).toHaveBeenCalledTimes(1)
    expect(mockTugasFindMany).toHaveBeenCalledTimes(1)

    const ujianWhere = mockUjianFindMany.mock.calls[0][0].where
    expectGenderFilterPada(ujianWhere, "LAKI_LAKI")

    const tugasWhere = mockTugasFindMany.mock.calls[0][0].where
    expectGenderFilterPada(tugasWhere, "LAKI_LAKI")
  })

  it("mengirim filter yang sama untuk siswa PEREMPUAN", async () => {
    mockRequireRole.mockResolvedValue({
      role: Role.SISWA,
      siswa: { id: "siswa-2", kelasId: "kelas-1", jenisKelamin: "PEREMPUAN" },
    })

    const result = await getRangkumanSiswaHome()

    expect(result.success).toBe(true)
    expectGenderFilterPada(mockUjianFindMany.mock.calls[0][0].where, "PEREMPUAN")
    expectGenderFilterPada(mockTugasFindMany.mock.calls[0][0].where, "PEREMPUAN")
  })

  it("tugas yang belum dikumpulkan difilter via pengumpulan.none per siswa", async () => {
    mockRequireRole.mockResolvedValue({
      role: Role.SISWA,
      siswa: { id: "siswa-1", kelasId: "kelas-1", jenisKelamin: "LAKI_LAKI" },
    })

    await getRangkumanSiswaHome()

    const tugasWhere = mockTugasFindMany.mock.calls[0][0].where
    expect(tugasWhere.pengumpulan).toEqual({ none: { siswaId: "siswa-1" } })
    expect(tugasWhere.deadline).toEqual({ gte: expect.any(Date) })
  })

  it("menolak siswa yang belum terdaftar di kelas aktif", async () => {
    mockRequireRole.mockResolvedValue({
      role: Role.SISWA,
      siswa: { id: "siswa-1", kelasId: null, jenisKelamin: "LAKI_LAKI" },
    })

    const result = await getRangkumanSiswaHome()

    expect(result.success).toBe(false)
    expect(result.message).toContain("belum terdaftar di kelas aktif")
    expect(mockUjianFindMany).not.toHaveBeenCalled()
  })

  // --- Perilaku agregasi (menjaga regresi sekaligus memverifikasi shape data) ---

  it("ujian dalam jendela waktu & belum dikerjakan masuk daftar ujian tersedia", async () => {
    mockRequireRole.mockResolvedValue({
      role: Role.SISWA,
      siswa: { id: "siswa-1", kelasId: "kelas-1", jenisKelamin: "LAKI_LAKI" },
    })
    mockUjianFindMany.mockResolvedValue([buatUjianRow()])

    const result = await getRangkumanSiswaHome()

    expect(result.success).toBe(true)
    expect(result.data?.ujianTersedia).toBe(1)
    expect(result.data?.daftarUjianTersedia).toHaveLength(1)
    expect(result.data?.daftarUjianTersedia[0]).toMatchObject({
      id: "ujian-1",
      mapel: "Bahasa Arab",
      kelas: "7A",
    })
  })

  it("ujian yang sudah DINILAI masuk daftar nilai & rata-rata dihitung", async () => {
    mockRequireRole.mockResolvedValue({
      role: Role.SISWA,
      siswa: { id: "siswa-1", kelasId: "kelas-1", jenisKelamin: "LAKI_LAKI" },
    })
    mockUjianFindMany.mockResolvedValue([
      buatUjianRow({
        id: "ujian-1",
        pengerjaan: [
          { status: "DINILAI", waktuSubmit: new Date(), nilaiTotal: "80" },
        ],
      }),
      buatUjianRow({
        id: "ujian-2",
        pengerjaan: [
          { status: "DINILAI", waktuSubmit: new Date(), nilaiTotal: "90" },
        ],
      }),
    ])

    const result = await getRangkumanSiswaHome()

    expect(result.success).toBe(true)
    // Ujian yang sudah dikerjakan tidak muncul lagi di daftar tersedia
    expect(result.data?.ujianTersedia).toBe(0)
    expect(result.data?.daftarNilai).toHaveLength(2)
    expect(result.data?.rataRataNilai).toBe(85)
  })
})

// ========================================================
// 2. ORANG TUA: filter gender pakai jenis kelamin ANAK
// ========================================================

describe("getRangkumanOrangTuaHome — filter gender anak", () => {
  it("memakai jenis kelamin ANAK (bukan orang tua) untuk filter ujian & tugas", async () => {
    mockRequireRole.mockResolvedValue({
      role: Role.ORANG_TUA,
      orangTua: { id: "ortu-1" },
      siswa: null,
    })
    mockParentStudentFindFirst.mockResolvedValue({ id: "relasi-1" })
    mockSiswaFindUnique.mockResolvedValue({
      kelasId: "kelas-1",
      jenisKelamin: "PEREMPUAN",
    })

    const result = await getRangkumanOrangTuaHome("anak-1")

    expect(result.success).toBe(true)
    // Gender dari record siswa (anak), bukan dari user orang tua
    expect(mockSiswaFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "anak-1", deleted_at: null },
      })
    )
    expectGenderFilterPada(mockUjianFindMany.mock.calls[0][0].where, "PEREMPUAN")
    expectGenderFilterPada(mockTugasFindMany.mock.calls[0][0].where, "PEREMPUAN")
  })

  it("menolak akses jika siswa bukan anak orang tua (guard ParentStudent)", async () => {
    mockRequireRole.mockResolvedValue({
      role: Role.ORANG_TUA,
      orangTua: { id: "ortu-1" },
      siswa: null,
    })
    mockParentStudentFindFirst.mockResolvedValue(null)

    const result = await getRangkumanOrangTuaHome("bukan-anak")

    expect(result.success).toBe(false)
    expect(result.message).toContain("bukan anak Anda")
    // Tidak boleh ada query data akademik sama sekali
    expect(mockSiswaFindUnique).not.toHaveBeenCalled()
    expect(mockUjianFindMany).not.toHaveBeenCalled()
    expect(mockTugasFindMany).not.toHaveBeenCalled()
  })

  it("menolak jika anak tidak punya kelas aktif", async () => {
    mockRequireRole.mockResolvedValue({
      role: Role.ORANG_TUA,
      orangTua: { id: "ortu-1" },
      siswa: null,
    })
    mockParentStudentFindFirst.mockResolvedValue({ id: "relasi-1" })
    mockSiswaFindUnique.mockResolvedValue({ kelasId: null, jenisKelamin: "LAKI_LAKI" })

    const result = await getRangkumanOrangTuaHome("anak-1")

    expect(result.success).toBe(false)
    expect(result.message).toContain("kelas")
    expect(mockUjianFindMany).not.toHaveBeenCalled()
  })
})

// ========================================================
// 3. GURU: guard role, profil guru, & scope kelas
// ========================================================

describe("getRangkumanGuruHome — guard & scope", () => {
  const buatTugasRow = (overrides: Record<string, unknown> = {}) => ({
    id: "tugas-1",
    judul: "Tugas Sharaf",
    kelas: { nama: "7A" },
    mataPelajaran: { nama: "Sharaf" },
    deadline: new Date("2026-09-15T00:00:00Z"),
    _count: { pengumpulan: 2 },
    ...overrides,
  })

  it("menolak role di luar GURU/SUPER_ADMIN/ADMIN_AKADEMIK tanpa query apa pun", async () => {
    mockRequireRole.mockRejectedValue(
      new AppError(
        "Forbidden: Anda tidak memiliki akses. Role yang dibutuhkan: GURU, SUPER_ADMIN, ADMIN_AKADEMIK"
      )
    )

    const result = await getRangkumanGuruHome()

    expect(result.success).toBe(false)
    expect(result.message).toContain("Forbidden")
    expect(mockRequireRole).toHaveBeenCalledWith([
      Role.GURU,
      Role.SUPER_ADMIN,
      Role.ADMIN_AKADEMIK,
    ])
    expect(mockKelasFindMany).not.toHaveBeenCalled()
    expect(mockSiswaCount).not.toHaveBeenCalled()
    expect(mockUjianFindMany).not.toHaveBeenCalled()
  })

  it("guru non-admin tanpa profil guru ditolak sebelum query kelas", async () => {
    mockRequireRole.mockResolvedValue({
      role: Role.GURU,
      isAdmin: false,
      guru: null,
    })
    mockIsAcademicAdminRole.mockReturnValue(false)

    const result = await getRangkumanGuruHome()

    expect(result.success).toBe(false)
    expect(result.message).toContain("Profil guru tidak ditemukan")
    expect(mockKelasFindMany).not.toHaveBeenCalled()
  })

  it("admin akademik melihat seluruh kelas aktif tanpa filter penugasan", async () => {
    mockRequireRole.mockResolvedValue({
      role: Role.ADMIN_AKADEMIK,
      isAdmin: false,
      guru: { id: "guru-admin" },
    })
    mockIsAcademicAdminRole.mockReturnValue(true)
    mockKelasFindMany.mockResolvedValue([{ id: "kelas-1" }, { id: "kelas-2" }])
    mockSiswaCount.mockResolvedValue(25)
    mockUjianCount.mockResolvedValue(2)
    mockPengerjaanUjianCount.mockResolvedValue(3)
    mockUjianFindMany.mockResolvedValue([buatUjianRow()])
    mockTugasFindMany.mockResolvedValue([buatTugasRow()])

    const result = await getRangkumanGuruHome()

    expect(result.success).toBe(true)
    // Scope admin: hanya { aktif: true }, TANPA OR waliKelas/guruMengajar
    expect(mockKelasFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { aktif: true },
      })
    )
    const where = mockKelasFindMany.mock.calls[0][0].where as Record<string, unknown>
    expect(where).not.toHaveProperty("OR")

    expect(result.data?.jumlahKelas).toBe(2)
    expect(result.data?.jumlahSantri).toBe(25)
    expect(result.data?.ujianAktif).toBe(2)
    expect(result.data?.ujianPerluDinilai).toBe(3)
    expect(result.data?.tugasPerluDinilai).toBe(2)
    expect(result.data?.daftarUjian[0]).toMatchObject({
      id: "ujian-1",
      mapel: "Bahasa Arab",
      kelas: "7A",
    })
    expect(result.data?.daftarTugas[0]).toMatchObject({
      judul: "Tugas Sharaf",
      pending: 2,
    })
  })

  it("guru non-admin hanya melihat kelas yang diwali/diajarnya (filter OR)", async () => {
    mockRequireRole.mockResolvedValue({
      role: Role.GURU,
      isAdmin: false,
      guru: { id: "guru-1" },
    })
    mockIsAcademicAdminRole.mockReturnValue(false)
    mockKelasFindMany.mockResolvedValue([{ id: "kelas-1" }])
    mockSiswaCount.mockResolvedValue(10)
    mockUjianCount.mockResolvedValue(1)
    mockPengerjaanUjianCount.mockResolvedValue(0)
    mockUjianFindMany.mockResolvedValue([])
    mockTugasFindMany.mockResolvedValue([])

    const result = await getRangkumanGuruHome()

    expect(result.success).toBe(true)
    expect(mockKelasFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          aktif: true,
          OR: [
            { waliKelasId: "guru-1" },
            { guruMengajar: { some: { guruId: "guru-1" } } },
          ],
        },
      })
    )
    expect(result.data?.jumlahKelas).toBe(1)
    expect(result.data?.jumlahSantri).toBe(10)
  })

  it("guru tanpa kelas apa pun mendapat rangkuman kosong tanpa query lanjutan", async () => {
    mockRequireRole.mockResolvedValue({
      role: Role.GURU,
      isAdmin: false,
      guru: { id: "guru-1" },
    })
    mockKelasFindMany.mockResolvedValue([])

    const result = await getRangkumanGuruHome()

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      jumlahKelas: 0,
      jumlahSantri: 0,
      ujianAktif: 0,
      ujianPerluDinilai: 0,
      tugasPerluDinilai: 0,
      daftarUjian: [],
      daftarTugas: [],
    })
    expect(mockSiswaCount).not.toHaveBeenCalled()
    expect(mockUjianCount).not.toHaveBeenCalled()
    expect(mockUjianFindMany).not.toHaveBeenCalled()
    expect(mockTugasFindMany).not.toHaveBeenCalled()
  })
})

// ========================================================
// 4. ADMIN: guard role ketat SUPER_ADMIN/ADMIN_AKADEMIK
// ========================================================

describe("getRangkumanAdminHome — guard admin", () => {
  it("menolak Role.GURU — hanya SUPER_ADMIN/ADMIN_AKADEMIK — tanpa query", async () => {
    mockRequireRole.mockRejectedValue(
      new AppError(
        "Forbidden: Anda tidak memiliki akses. Role yang dibutuhkan: SUPER_ADMIN, ADMIN_AKADEMIK"
      )
    )

    const result = await getRangkumanAdminHome()

    expect(result.success).toBe(false)
    expect(result.message).toContain("SUPER_ADMIN, ADMIN_AKADEMIK")
    expect(mockRequireRole).toHaveBeenCalledWith([Role.SUPER_ADMIN, Role.ADMIN_AKADEMIK])
    expect(mockSiswaCount).not.toHaveBeenCalled()
    expect(mockGuruCount).not.toHaveBeenCalled()
    expect(mockUjianFindMany).not.toHaveBeenCalled()
  })

  it("super admin mendapat rangkuman lengkap semua metrik", async () => {
    mockRequireRole.mockResolvedValue({ role: Role.SUPER_ADMIN })
    mockSiswaCount.mockResolvedValue(120)
    mockGuruCount.mockResolvedValue(15)
    mockKelasCount.mockResolvedValue(8)
    mockMapelCount.mockResolvedValue(10)
    mockPendaftaranCount.mockResolvedValue(4)
    mockPengerjaanUjianCount.mockResolvedValue(6)
    mockPengumpulanTugasCount.mockResolvedValue(9)
    mockTagihanCount.mockResolvedValue(11)
    mockUjianFindMany.mockResolvedValue([buatUjianRow()])

    const result = await getRangkumanAdminHome()

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      jumlahSantri: 120,
      jumlahGuru: 15,
      jumlahKelas: 8,
      jumlahMapel: 10,
      pendaftarMenunggu: 4,
      ujianPerluDinilai: 6,
      tugasPerluDinilai: 9,
      tagihanBelumBayar: 11,
    })
    expect(result.data?.daftarUjian).toHaveLength(1)
    expect(result.data?.daftarUjian[0]).toMatchObject({
      id: "ujian-1",
      mapel: "Bahasa Arab",
      kelas: "7A",
      totalSoal: 10,
    })
  })
})
