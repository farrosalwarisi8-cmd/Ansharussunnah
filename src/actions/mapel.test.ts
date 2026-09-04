// src/actions/mapel.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

// ========================================================
// Mocks — di-hoist agar tersedia sebelum import modul
// ========================================================

const {
  mockRequireGuru,
  mockMataPelajaranFindMany,
  mockMataPelajaranFindFirst,
  mockMataPelajaranFindUnique,
  mockMataPelajaranCreate,
  mockMataPelajaranUpdate,
  mockMataPelajaranDelete,
  mockMapelKelasDeleteMany,
  mockMapelKelasCreateMany,
  mockTransaction,
  mockJenjangFindMany,
  mockKelasFindMany,
} = vi.hoisted(() => ({
  mockRequireGuru: vi.fn(),
  mockMataPelajaranFindMany: vi.fn(),
  mockMataPelajaranFindFirst: vi.fn(),
  mockMataPelajaranFindUnique: vi.fn(),
  mockMataPelajaranCreate: vi.fn(),
  mockMataPelajaranUpdate: vi.fn(),
  mockMataPelajaranDelete: vi.fn(),
  mockMapelKelasDeleteMany: vi.fn(),
  mockMapelKelasCreateMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockJenjangFindMany: vi.fn(),
  mockKelasFindMany: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireGuru: mockRequireGuru,
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    mataPelajaran: {
      findMany: mockMataPelajaranFindMany,
      findFirst: mockMataPelajaranFindFirst,
      findUnique: mockMataPelajaranFindUnique,
      create: mockMataPelajaranCreate,
      update: mockMataPelajaranUpdate,
      delete: mockMataPelajaranDelete,
    },
    mapelKelas: {
      deleteMany: mockMapelKelasDeleteMany,
      createMany: mockMapelKelasCreateMany,
    },
    $transaction: mockTransaction,
    jenjang: {
      findMany: mockJenjangFindMany,
    },
    kelas: {
      findMany: mockKelasFindMany,
    },
  },
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

// ========================================================
// Import setelah semua vi.mock() terdaftar
// ========================================================

import {
  getMapelAktif,
  getJenjangList,
  getKelasByJenjang,
  getAdminMapelList,
  createMapel,
  updateMapel,
  deleteMapel,
} from "@/actions/mapel"

// ========================================================
// Data dummy
// ========================================================

const mockUser = {
  id: "user-1",
  email: "admin@sekolah.sch.id",
  role: "SUPER_ADMIN",
  guru: { id: "guru-1" },
}

const mockMapel = {
  id: "mapel-1",
  kode: "MTK",
  nama: "Matematika",
  kelompok: "A",
  jenjangId: "jenjang-1",
  aktif: true,
}

// ========================================================
// Test Suite: getMapelAktif
// ========================================================

describe("getMapelAktif", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return active mapels with jenjangId", async () => {
    mockMataPelajaranFindMany.mockResolvedValue([
      { id: "1", kode: "MTK", nama: "Matematika", kelompok: "A", jenjangId: "jenjang-1" },
      { id: "2", kode: "BIN", nama: "B. Indonesia", kelompok: "A", jenjangId: "jenjang-1" },
    ])

    const result = await getMapelAktif()

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(result.data![0].jenjangId).toBe("jenjang-1")
  })

  it("should return error on failure", async () => {
    mockMataPelajaranFindMany.mockRejectedValue(new Error("DB Error"))

    const result = await getMapelAktif()

    expect(result.success).toBe(false)
    expect(result.message).toContain("Gagal")
  })
})

// ========================================================
// Test Suite: getJenjangList
// ========================================================

describe("getJenjangList", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return active jenjangs", async () => {
    mockJenjangFindMany.mockResolvedValue([
      { id: "j1", nama: "SD", urutan: 1 },
      { id: "j2", nama: "SMP", urutan: 2 },
    ])

    const result = await getJenjangList()

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(result.data![0].nama).toBe("SD")
  })
})

// ========================================================
// Test Suite: getKelasByJenjang
// ========================================================

describe("getKelasByJenjang", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return active kelas for a jenjang", async () => {
    mockKelasFindMany.mockResolvedValue([
      { id: "k1", nama: "Kelas 1" },
      { id: "k2", nama: "Kelas 2" },
    ])

    const result = await getKelasByJenjang("jenjang-1")

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(mockKelasFindMany).toHaveBeenCalledWith({
      where: { jenjangId: "jenjang-1", aktif: true },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true },
    })
  })
})

// ========================================================
// Test Suite: getAdminMapelList
// ========================================================

describe("getAdminMapelList", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireGuru.mockResolvedValue(mockUser)
  })

  it("should return mapels with jenjang and kelas info", async () => {
    mockMataPelajaranFindMany.mockResolvedValue([
      {
        ...mockMapel,
        jenjang: { nama: "SD" },
        mapelKelas: [
          { kelas: { id: "k1", nama: "Kelas 1" } },
          { kelas: { id: "k2", nama: "Kelas 2" } },
        ],
        _count: { guruKelas: 2, ujian: 1, tugas: 3, materi: 0, nilaiRapor: 5 },
      },
    ])

    const result = await getAdminMapelList()

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data![0].jenjangNama).toBe("SD")
    expect(result.data![0].kelasList).toHaveLength(2)
    expect(result.data![0].kelasList[0].nama).toBe("Kelas 1")
  })
})

// ========================================================
// Test Suite: createMapel
// ========================================================

describe("createMapel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireGuru.mockResolvedValue(mockUser)
  })

  it("should create mapel with jenjangId and kelasIds", async () => {
    mockMataPelajaranFindFirst.mockResolvedValue(null) // No duplicate
    mockMataPelajaranCreate.mockResolvedValue(mockMapel)
    mockMapelKelasCreateMany.mockResolvedValue({ count: 2 })
    mockKelasFindMany.mockResolvedValue([{ id: "kelas-1" }, { id: "kelas-2" }])

    const result = await createMapel({
      kode: "MTK",
      nama: "Matematika",
      kelompok: "A",
      jenjangId: "jenjang-1",
      kelasIds: ["kelas-1", "kelas-2"],
    })

    expect(result.success).toBe(true)
    expect(mockMataPelajaranCreate).toHaveBeenCalledWith({
      data: {
        kode: "MTK",
        nama: "Matematika",
        kelompok: "A",
        jenjangId: "jenjang-1",
        aktif: true,
        mapelKelas: {
          create: [
            { kelasId: "kelas-1" },
            { kelasId: "kelas-2" },
          ],
        },
      },
    })
  })

  it("should create mapel without kelasIds", async () => {
    mockMataPelajaranFindFirst.mockResolvedValue(null)
    mockMataPelajaranCreate.mockResolvedValue(mockMapel)

    const result = await createMapel({
      kode: "BIN",
      nama: "B. Indonesia",
      kelompok: "A",
      jenjangId: "jenjang-1",
      kelasIds: [],
    })

    expect(result.success).toBe(true)
    expect(mockMataPelajaranCreate).toHaveBeenCalledWith({
      data: {
        kode: "BIN",
        nama: "B. Indonesia",
        kelompok: "A",
        jenjangId: "jenjang-1",
        aktif: true,
        mapelKelas: undefined,
      },
    })
  })

  it("should reject duplicate or invalid kelasIds", async () => {
    mockMataPelajaranFindFirst.mockResolvedValue(null)
    mockKelasFindMany.mockResolvedValue([{ id: "kelas-1" }])

    const result = await createMapel({
      kode: "IPA",
      nama: "Ilmu Pengetahuan Alam",
      jenjangId: "jenjang-1",
      kelasIds: ["kelas-1", "kelas-1", "kelas-2"],
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("tidak boleh dipilih lebih dari sekali")
    expect(mockMataPelajaranCreate).not.toHaveBeenCalled()
  })

  it("should reject duplicate kode", async () => {
    mockMataPelajaranFindFirst.mockResolvedValue({ kode: "MTK", nama: "Other" })

    const result = await createMapel({
      kode: "MTK",
      nama: "Matematika",
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("sudah digunakan")
  })

  it("should reject duplicate nama", async () => {
    mockMataPelajaranFindFirst.mockResolvedValue({ kode: "OTH", nama: "Matematika" })

    const result = await createMapel({
      kode: "NEW",
      nama: "Matematika",
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("sudah digunakan")
  })
})

// ========================================================
// Test Suite: updateMapel
// ========================================================

describe("updateMapel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireGuru.mockResolvedValue(mockUser)
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        mapelKelas: {
          deleteMany: mockMapelKelasDeleteMany,
          createMany: mockMapelKelasCreateMany,
        },
        mataPelajaran: { update: mockMataPelajaranUpdate },
      })
    )
  })

  it("should update mapel jenjangId and replace kelasIds", async () => {
    mockMataPelajaranFindUnique.mockResolvedValue(mockMapel)
    mockMataPelajaranFindFirst.mockResolvedValue(null) // No duplicate
    mockMapelKelasDeleteMany.mockResolvedValue({ count: 0 })
    mockMapelKelasCreateMany.mockResolvedValue({ count: 1 })
    mockMataPelajaranUpdate.mockResolvedValue(mockMapel)
    mockKelasFindMany.mockResolvedValue([{ id: "kelas-3" }])

    const result = await updateMapel("mapel-1", {
      jenjangId: "jenjang-2",
      kelasIds: ["kelas-3"],
    })

    expect(result.success).toBe(true)
    expect(mockMapelKelasDeleteMany).toHaveBeenCalledWith({
      where: { mapelId: "mapel-1" },
    })
    expect(mockMapelKelasCreateMany).toHaveBeenCalledWith({
      data: [{ mapelId: "mapel-1", kelasId: "kelas-3" }],
    })
    expect(mockMataPelajaranUpdate).toHaveBeenCalledWith({
      where: { id: "mapel-1" },
      data: expect.objectContaining({
        jenjangId: "jenjang-2",
      }),
    })
  })

  it("should clear kelasIds when empty array provided", async () => {
    mockMataPelajaranFindUnique.mockResolvedValue(mockMapel)
    mockMataPelajaranFindFirst.mockResolvedValue(null)
    mockMapelKelasDeleteMany.mockResolvedValue({ count: 2 })
    mockMataPelajaranUpdate.mockResolvedValue(mockMapel)

    const result = await updateMapel("mapel-1", {
      kelasIds: [],
    })

    expect(result.success).toBe(true)
    expect(mockMapelKelasDeleteMany).toHaveBeenCalled()
    expect(mockMapelKelasCreateMany).not.toHaveBeenCalled()
  })

  it("should not update kelasIds if not provided", async () => {
    mockMataPelajaranFindUnique.mockResolvedValue(mockMapel)
    mockMataPelajaranFindFirst.mockResolvedValue(null)
    mockMataPelajaranUpdate.mockResolvedValue(mockMapel)

    const result = await updateMapel("mapel-1", {
      nama: "Matematika Updated",
    })

    expect(result.success).toBe(true)
    expect(mockMapelKelasDeleteMany).not.toHaveBeenCalled()
    expect(mockMapelKelasCreateMany).not.toHaveBeenCalled()
  })

  it("should fail if mapel not found", async () => {
    mockMataPelajaranFindUnique.mockResolvedValue(null)

    const result = await updateMapel("nonexistent", {
      nama: "Test",
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("tidak ditemukan")
  })
})

// ========================================================
// Test Suite: deleteMapel
// ========================================================

describe("deleteMapel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireGuru.mockResolvedValue(mockUser)
  })

  it("should delete mapel with no relations", async () => {
    mockMataPelajaranFindUnique.mockResolvedValue({
      ...mockMapel,
      _count: { guruKelas: 0, mapelKelas: 0, ujian: 0, tugas: 0, materi: 0, nilaiRapor: 0 },
    })
    mockMataPelajaranDelete.mockResolvedValue(mockMapel)

    const result = await deleteMapel("mapel-1")

    expect(result.success).toBe(true)
    expect(mockMataPelajaranDelete).toHaveBeenCalledWith({ where: { id: "mapel-1" } })
  })

  it("should reject delete if mapelKelas exists", async () => {
    mockMataPelajaranFindUnique.mockResolvedValue({
      ...mockMapel,
      _count: { guruKelas: 0, mapelKelas: 3, ujian: 0, tugas: 0, materi: 0, nilaiRapor: 0 },
    })

    const result = await deleteMapel("mapel-1")

    expect(result.success).toBe(false)
    expect(result.message).toContain("kelas")
    expect(mockMataPelajaranDelete).not.toHaveBeenCalled()
  })

  it("should reject delete if any relation exists", async () => {
    mockMataPelajaranFindUnique.mockResolvedValue({
      ...mockMapel,
      _count: { guruKelas: 1, mapelKelas: 0, ujian: 0, tugas: 0, materi: 0, nilaiRapor: 0 },
    })

    const result = await deleteMapel("mapel-1")

    expect(result.success).toBe(false)
    expect(result.message).toContain("terhubung")
  })
})
