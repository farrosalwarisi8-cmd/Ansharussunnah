// src/actions/pendaftaran.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

// ========================================================
// Mocks — di-hoist agar tersedia sebelum import modul
// ========================================================

const {
  mockPendaftaranCreate,
  mockJenjangFindUnique,
  mockKelasFindFirst,
  mockGenerateNomorPendaftaran,
  mockRateLimitAsync,
  mockGetClientIp,
} = vi.hoisted(() => ({
  mockPendaftaranCreate: vi.fn(),
  mockJenjangFindUnique: vi.fn(),
  mockKelasFindFirst: vi.fn(),
  mockGenerateNomorPendaftaran: vi.fn(),
  mockRateLimitAsync: vi.fn(),
  mockGetClientIp: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    pendaftaran: {
      create: mockPendaftaranCreate,
    },
    jenjang: {
      findUnique: mockJenjangFindUnique,
    },
    kelas: {
      findFirst: mockKelasFindFirst,
    },
  },
}))

vi.mock("@/lib/registration-number", () => ({
  generateNomorPendaftaran: (...args: unknown[]) =>
    mockGenerateNomorPendaftaran(...args),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: (...args: unknown[]) => mockRateLimitAsync(...args),
  getClientIpFromHeaders: (...args: unknown[]) =>
    mockGetClientIp(...args),
}))

// ========================================================
// Import setelah semua vi.mock() terdaftar
// ========================================================

import { createPendaftaran } from "@/actions/pendaftaran"
import { Prisma } from "@prisma/client"

// ========================================================
// Helper: buat FormData dari object plain
// ========================================================

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value)
  }
  return fd
}

// ========================================================
// Data dummy
// ========================================================

const baseData = {
  namaLengkap: "Ahmad Fauzi",
  tempatLahir: "Jakarta",
  tanggalLahir: "2010-01-15",
  jenisKelamin: "LAKI_LAKI",
  alamatSiswa: "Jl. Mawar No. 10, RT 01/RW 02, Kel. Sukamaju",
  namaOrangTua: "Budi Santoso",
  noHpOrangTua: "081234567890",
  emailOrangTua: "budi@example.com",
  jenjangTujuanId: "jenjang-1",
}

const baseEmisFields = {
  agama: "Islam",
  noHpSiswa: "081298765432",
  namaAyahKandung: "Budi Santoso",
  statusAyahKandung: "MASIH_HIDUP",
  nikAyah: "3201011501900001",
  namaIbuKandung: "Siti Rahmawati",
  statusIbuKandung: "MASIH_HIDUP",
  nikIbu: "3201011501900002",
  statusWali: "SAMA_DENGAN_AYAH",
  namaWali: "",
  kewarganegaraan: "WNI",
  kitas: "",
  asalNegara: "",
}

const mockJenjang = { id: "jenjang-1", nama: "Madrasah Ibtidaiyyah" }
const mockPendaftaranCreated = {
  id: "pend-1",
  nomorPendaftaran: "REG-2026-00001",
}

// ========================================================
// Setup
// ========================================================

beforeEach(() => {
  vi.clearAllMocks()

  // Default: rate limit lolos
  mockRateLimitAsync.mockResolvedValue({ success: true })
  mockGetClientIp.mockResolvedValue("127.0.0.1")

  // Default: jenjang ditemukan
  mockJenjangFindUnique.mockResolvedValue(mockJenjang)

  // Default: kelas tidak perlu divalidasi (_kelasTujuanId tidak dikirim)
  mockKelasFindFirst.mockResolvedValue(null)

  // Default: generate nomor pendaftaran
  mockGenerateNomorPendaftaran.mockResolvedValue("REG-2026-00001")

  // Default: create berhasil
  mockPendaftaranCreate.mockResolvedValue(mockPendaftaranCreated)
})

// ========================================================
// 1. Kasus Sukses
// ========================================================

describe("createPendaftaran — Kasus Sukses", () => {
  it("harus berhasil membuat pendaftaran dengan data dasar saja (field EMIS kosong)", async () => {
    const formData = makeFormData(baseData)
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(true)
    expect(result.data?.nomorPendaftaran).toBe("REG-2026-00001")
    expect(mockPendaftaranCreate).toHaveBeenCalledOnce()
  })

  it("harus berhasil menyimpan SEMUA field EMIS ke database", async () => {
    const formData = makeFormData({ ...baseData, ...baseEmisFields })
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(true)

    // Verify prisma.create dipanggil dengan data lengkap
    const createCall = mockPendaftaranCreate.mock.calls[0][0]
    const createdData = createCall.data

    // Field dasar
    expect(createdData.namaLengkap).toBe("Ahmad Fauzi")
    expect(createdData.tempatLahir).toBe("Jakarta")
    expect(createdData.jenisKelamin).toBe("LAKI_LAKI")
    expect(createdData.namaOrangTua).toBe("Budi Santoso")
    expect(createdData.noHpOrangTua).toBe("081234567890")
    expect(createdData.emailOrangTua).toBe("budi@example.com")
    expect(createdData.jenjangTujuanId).toBe("jenjang-1")

    // Field EMIS
    expect(createdData.agama).toBe("Islam")
    expect(createdData.noHpSiswa).toBe("081298765432")
    expect(createdData.namaAyahKandung).toBe("Budi Santoso")
    expect(createdData.statusAyahKandung).toBe("MASIH_HIDUP")
    expect(createdData.nikAyah).toBe("3201011501900001")
    expect(createdData.namaIbuKandung).toBe("Siti Rahmawati")
    expect(createdData.statusIbuKandung).toBe("MASIH_HIDUP")
    expect(createdData.nikIbu).toBe("3201011501900002")
    expect(createdData.statusWali).toBe("SAMA_DENGAN_AYAH")
    expect(createdData.kewarganegaraan).toBe("WNI")

    // Status default
    expect(createdData.status).toBe("MENUNGGU_PEMBAYARAN")
  })

  it("harus berhasil dengan WNA + KITAS + asal negara", async () => {
    const formData = makeFormData({
      ...baseData,
      agama: "Islam",
      kewarganegaraan: "WNA",
      kitas: "KITAS-2024-001",
      asalNegara: "Malaysia",
      // NIK ayah/ibu tidak wajib untuk WNA
      namaAyahKandung: "Mohammed Al-Farisi",
      statusAyahKandung: "MASIH_HIDUP",
      // nikAyah kosong — OK untuk WNA
      namaIbuKandung: "Fatimah Al-Farisi",
      statusIbuKandung: "MASIH_HIDUP",
      // nikIbu kosong — OK untuk WNA
    })
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(true)

    const createCall = mockPendaftaranCreate.mock.calls[0][0]
    expect(createCall.data.kewarganegaraan).toBe("WNA")
    expect(createCall.data.kitas).toBe("KITAS-2024-001")
    expect(createCall.data.asalNegara).toBe("Malaysia")
    expect(createCall.data.nikAyah).toBeNull()
    expect(createCall.data.nikIbu).toBeNull()
  })

  it("harus berhasil dengan status wali = LAINNYA + nama wali", async () => {
    const formData = makeFormData({
      ...baseData,
      statusWali: "LAINNYA",
      namaWali: "Paman Ahmad",
    })
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(true)

    const createCall = mockPendaftaranCreate.mock.calls[0][0]
    expect(createCall.data.statusWali).toBe("LAINNYA")
    expect(createCall.data.namaWali).toBe("Paman Ahmad")
  })

  it("harus set kewarganegaraan default WNI jika tidak dikirim", async () => {
    const formData = makeFormData(baseData)
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(true)

    const createCall = mockPendaftaranCreate.mock.calls[0][0]
    expect(createCall.data.kewarganegaraan).toBe("WNI")
  })

  it("harus set field EMIS opsional ke null jika tidak dikirim", async () => {
    const formData = makeFormData(baseData)
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(true)

    const createCall = mockPendaftaranCreate.mock.calls[0][0]
    expect(createCall.data.agama).toBeNull()
    expect(createCall.data.noHpSiswa).toBeNull()
    expect(createCall.data.namaAyahKandung).toBeNull()
    expect(createCall.data.statusAyahKandung).toBeNull()
    expect(createCall.data.nikAyah).toBeNull()
    expect(createCall.data.namaIbuKandung).toBeNull()
    expect(createCall.data.statusIbuKandung).toBeNull()
    expect(createCall.data.nikIbu).toBeNull()
    expect(createCall.data.statusWali).toBeNull()
    expect(createCall.data.namaWali).toBeNull()
    expect(createCall.data.kitas).toBeNull()
    expect(createCall.data.asalNegara).toBeNull()
  })

  it("harus memanggil generateNomorPendaftaran dan menyimpannya", async () => {
    mockGenerateNomorPendaftaran.mockResolvedValue("REG-2026-00099")

    const formData = makeFormData(baseData)
    await createPendaftaran(formData)

    expect(mockGenerateNomorPendaftaran).toHaveBeenCalledOnce()

    const createCall = mockPendaftaranCreate.mock.calls[0][0]
    expect(createCall.data.nomorPendaftaran).toBe("REG-2026-00099")
  })
})

// ========================================================
// 2. Validasi Gagal (Zod)
// ========================================================

describe("createPendaftaran — Validasi Gagal", () => {
  it("harus gagal jika field wajib tidak diisi", async () => {
    const formData = makeFormData({
      // Semua field wajib dikosongkan
      namaLengkap: "",
      tempatLahir: "",
      tanggalLahir: "",
      jenisKelamin: "",
      alamatSiswa: "",
      namaOrangTua: "",
      noHpOrangTua: "",
      emailOrangTua: "",
      jenjangTujuanId: "",
    })
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(false)
    expect(result.message).toBe("Data pendaftaran tidak valid")
    expect(result.errors).toBeDefined()
    // Pastikan TIDAK ada prisma.create (fail-fast)
    expect(mockPendaftaranCreate).not.toHaveBeenCalled()
  })

  it("harus MENOLAK NIK ayah jika statusAyahKandung = MASIH_HIDUP & WNI tapi NIK kosong", async () => {
    const formData = makeFormData({
      ...baseData,
      statusAyahKandung: "MASIH_HIDUP",
      kewarganegaraan: "WNI",
      // nikAyah tidak dikirim
    })
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(false)
    expect(result.errors?.nikAyah).toBeDefined()
    expect(mockPendaftaranCreate).not.toHaveBeenCalled()
  })

  it("harus MENOLAK NIK ayah jika bukan 16 digit", async () => {
    const formData = makeFormData({
      ...baseData,
      statusAyahKandung: "MASIH_HIDUP",
      kewarganegaraan: "WNI",
      nikAyah: "12345",
    })
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(false)
    expect(result.errors?.nikAyah).toBeDefined()
    expect(mockPendaftaranCreate).not.toHaveBeenCalled()
  })

  it("harus MENOLAK nama wali jika statusWali = LAINNYA tapi nama kosong", async () => {
    const formData = makeFormData({
      ...baseData,
      statusWali: "LAINNYA",
      // namaWali tidak dikirim
    })
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(false)
    expect(result.errors?.namaWali).toBeDefined()
    expect(mockPendaftaranCreate).not.toHaveBeenCalled()
  })

  it("harus MENOLAK KITAS jika kewarganegaraan = WNA tapi KITAS kosong", async () => {
    const formData = makeFormData({
      ...baseData,
      kewarganegaraan: "WNA",
      // kitas tidak dikirim
      asalNegara: "Malaysia",
    })
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(false)
    expect(result.errors?.kitas).toBeDefined()
    expect(mockPendaftaranCreate).not.toHaveBeenCalled()
  })

  it("harus MENOLAK asalNegara jika kewarganegaraan = WNA tapi kosong", async () => {
    const formData = makeFormData({
      ...baseData,
      kewarganegaraan: "WNA",
      kitas: "KITAS123",
      // asalNegara tidak dikirim
    })
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(false)
    expect(result.errors?.asalNegara).toBeDefined()
    expect(mockPendaftaranCreate).not.toHaveBeenCalled()
  })

  it("harus MENOLAK asalNegara jika mengandung angka", async () => {
    const formData = makeFormData({
      ...baseData,
      kewarganegaraan: "WNA",
      kitas: "KITAS123",
      asalNegara: "Singapura123",
    })
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(false)
    expect(result.errors?.asalNegara).toBeDefined()
    expect(mockPendaftaranCreate).not.toHaveBeenCalled()
  })

  it("harus MENOLAK agama jika opsi tidak valid", async () => {
    const formData = makeFormData({
      ...baseData,
      agama: "Yahudi",
    })
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(false)
    expect(result.errors?.agama).toBeDefined()
    expect(mockPendaftaranCreate).not.toHaveBeenCalled()
  })

  it("harus lolos jika NIK ayah tidak wajib untuk WNA meski status = MASIH_HIDUP", async () => {
    const formData = makeFormData({
      ...baseData,
      statusAyahKandung: "MASIH_HIDUP",
      kewarganegaraan: "WNA",
      // nikAyah kosong — OK untuk WNA
      kitas: "KITAS123",
      asalNegara: "Malaysia",
    })
    const result = await createPendaftaran(formData)

    // Harus lolos validasi (NIK tidak wajib untuk WNA)
    expect(result.success).toBe(true)
    expect(mockPendaftaranCreate).toHaveBeenCalledOnce()
  })
})

// ========================================================
// 3. Validasi Data Referensi
// ========================================================

describe("createPendaftaran — Validasi Data Referensi", () => {
  it("harus gagal jika jenjang tujuan tidak ditemukan", async () => {
    mockJenjangFindUnique.mockResolvedValue(null)

    const formData = makeFormData(baseData)
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(false)
    expect(result.message).toBe("Jenjang tujuan tidak ditemukan")
    expect(mockPendaftaranCreate).not.toHaveBeenCalled()
  })

  it("harus gagal jika kelas tujuan tidak valid untuk jenjang", async () => {
    mockKelasFindFirst.mockResolvedValue(null)

    const formData = makeFormData({
      ...baseData,
      kelasTujuanId: "kelas-invalid",
    })
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(false)
    expect(result.message).toBe(
      "Kelas tujuan tidak valid untuk jenjang yang dipilih"
    )
    expect(mockPendaftaranCreate).not.toHaveBeenCalled()
  })
})

// ========================================================
// 4. Rate Limiting
// ========================================================

describe("createPendaftaran — Rate Limiting", () => {
  it("harus menolak jika rate limit terlampaui", async () => {
    mockRateLimitAsync.mockResolvedValue({ success: false })

    const formData = makeFormData(baseData)
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(false)
    expect(result.message).toContain("Terlalu banyak")
    // Pastikan tidak ada query database sama sekali
    expect(mockJenjangFindUnique).not.toHaveBeenCalled()
    expect(mockPendaftaranCreate).not.toHaveBeenCalled()
  })
})

// ========================================================
// 5. Database Error
// ========================================================

describe("createPendaftaran — Database Error", () => {
  it("harus mengembalikan error jika prisma.create gagal", async () => {
    mockPendaftaranCreate.mockRejectedValue(
      new Error("Database connection error")
    )

    const formData = makeFormData(baseData)
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(false)
    expect(result.message).toContain("Gagal memproses")
  })
})

// ========================================================
// 6. Retry Logic (nomor pendaftaran duplicate)
// ========================================================

describe("createPendaftaran — Retry Logic", () => {
  it("harus retry jika nomor pendaftaran bentrok (P2002) dan berhasil di attempt berikutnya", async () => {
    // Attempt 1: P2002 (duplicate key) — harus instance PrismaClientKnownRequestError
    const duplicateError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "0.0.0", meta: { target: ["nomor_pendaftaran"] } }
    )
    // Attempt 2: berhasil
    mockPendaftaranCreate
      .mockRejectedValueOnce(duplicateError)
      .mockResolvedValueOnce({ ...mockPendaftaranCreated, nomorPendaftaran: "REG-2026-00002" })

    mockGenerateNomorPendaftaran
      .mockResolvedValueOnce("REG-2026-00001")
      .mockResolvedValueOnce("REG-2026-00002")

    const formData = makeFormData(baseData)
    const result = await createPendaftaran(formData)

    expect(result.success).toBe(true)
    expect(result.data?.nomorPendaftaran).toBe("REG-2026-00002")
    expect(mockPendaftaranCreate).toHaveBeenCalledTimes(2)
    expect(mockGenerateNomorPendaftaran).toHaveBeenCalledTimes(2)
  })
})
