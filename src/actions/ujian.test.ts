// src/actions/ujian.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

// ========================================================
// Mocks — di-hoist agar tersedia sebelum import modul
// ========================================================

const {
  mockVerifyGuruAksesKelas,
  mockUjianFindUnique,
} = vi.hoisted(() => ({
  mockVerifyGuruAksesKelas: vi.fn(),
  mockUjianFindUnique: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    ujian: {
      findUnique: mockUjianFindUnique,
    },
  },
}))

vi.mock("@/lib/guru-auth", () => ({
  verifyGuruAksesKelas: mockVerifyGuruAksesKelas,
}))

vi.mock("@/lib/rate-limit", () => ({
  getClientIpFromHeaders: vi.fn(),
  rateLimitAsync: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

// ========================================================
// Import setelah semua vi.mock() terdaftar
// ========================================================

import { getUjianDetail } from "@/actions/ujian"

// ========================================================
// Data dummy
// ========================================================

const mockUjian = {
  id: "ujian-001",
  judul: "Penilaian Akhir Semester - Fiqih",
  deskripsi: "Ujian akhir semester untuk mata pelajaran Fiqih",
  kelasId: "7A-IKHWAN",
  mataPelajaranId: "mapel-fiqih",
  periodeAjaranId: "periode-2024",
  durasiMenit: 60,
  waktuMulai: new Date("2024-06-01T08:00:00Z"),
  waktuSelesai: new Date("2024-06-01T09:00:00Z"),
  status: "DRAFT",
  mataPelajaran: { nama: "Fiqih Ibadah" },
  soal: [
    {
      id: "soal-1",
      nomorSoal: 1,
      pertanyaan: "Berapakah jumlah rukun wudhu?",
      tipe: "PILIHAN_GANDA",
      bobot: 5,
      kunciEsai: null,
      opsi: [
        { id: "opsi-1a", label: "A", teks: "4 Rukun", benar: false },
        { id: "opsi-1b", label: "B", teks: "6 Rukun", benar: true },
        { id: "opsi-1c", label: "C", teks: "8 Rukun", benar: false },
        { id: "opsi-1d", label: "D", teks: "10 Rukun", benar: false },
      ],
    },
    {
      id: "soal-2",
      nomorSoal: 2,
      pertanyaan: "Jelaskan perbedaan najis mukhaffafah dan mutawassithah",
      tipe: "ESAI",
      bobot: 20,
      kunciEsai: "Najis mukhaffafah adalah najis ringan...",
      opsi: [],
    },
  ],
}

// ========================================================
// Tests
// ========================================================

describe("getUjianDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus mengembalikan data ujian dengan soal dan opsi yang benar", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({ user: { id: "guru-1" } })
    mockUjianFindUnique.mockResolvedValue(mockUjian)

    const result = await getUjianDetail("ujian-001")

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const data = result.data as {
      id: string
      judul: string
      deskripsi: string
      mataPelajaran: string
      kelasId: string
      durasiMenit: number
      waktuMulai: string
      waktuSelesai: string
      soal: {
        id: string
        nomor: number
        tipe: "PILIHAN_GANDA" | "ESAI"
        pertanyaan: string
        bobotNilai: number
        opsi: { id?: string; teks: string; benar: boolean }[]
      }[]
    }

    expect(data.id).toBe("ujian-001")
    expect(data.judul).toBe("Penilaian Akhir Semester - Fiqih")
    expect(data.mataPelajaran).toBe("Fiqih Ibadah")
    expect(data.kelasId).toBe("7A-IKHWAN")
    expect(data.durasiMenit).toBe(60)

    // Verifikasi soal
    expect(data.soal).toHaveLength(2)

    // Soal PG
    expect(data.soal[0].tipe).toBe("PILIHAN_GANDA")
    expect(data.soal[0].nomor).toBe(1)
    expect(data.soal[0].pertanyaan).toBe("Berapakah jumlah rukun wudhu?")
    expect(data.soal[0].bobotNilai).toBe(5)
    expect(data.soal[0].opsi).toHaveLength(4)
    expect(data.soal[0].opsi[1].teks).toBe("6 Rukun")
    expect(data.soal[0].opsi[1].benar).toBe(true)

    // Soal Esai
    expect(data.soal[1].tipe).toBe("ESAI")
    expect(data.soal[1].opsi).toHaveLength(1)
    expect(data.soal[1].opsi[0].teks).toBe("Najis mukhaffafah adalah najis ringan...")
  })

  it("harus memanggil verifyGuruAksesKelas dengan kelasId dan mataPelajaranId", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({ user: { id: "guru-1" } })
    mockUjianFindUnique.mockResolvedValue(mockUjian)

    await getUjianDetail("ujian-001")

    expect(mockVerifyGuruAksesKelas).toHaveBeenCalledWith("7A-IKHWAN", "mapel-fiqih")
  })

  it("harus mengembalikan error jika ujian tidak ditemukan", async () => {
    mockUjianFindUnique.mockResolvedValue(null)

    const result = await getUjianDetail("ujian-tidak-ada")

    expect(result.success).toBe(false)
    expect(result.message).toContain("Ujian tidak ditemukan")
    expect(mockVerifyGuruAksesKelas).not.toHaveBeenCalled()
  })

  it("harus gagal jika guru tidak punya akses ke kelas", async () => {
    mockVerifyGuruAksesKelas.mockRejectedValue(
      new Error("Anda tidak memiliki akses ke kelas ini")
    )
    mockUjianFindUnique.mockResolvedValue(mockUjian)

    const result = await getUjianDetail("ujian-001")

    expect(result.success).toBe(false)
    expect(result.message).toContain("Anda tidak memiliki akses ke kelas ini")
  })

  it("harus mengembalikan error message saat database error", async () => {
    mockUjianFindUnique.mockRejectedValue(new Error("Database connection timeout"))

    const result = await getUjianDetail("ujian-001")

    expect(result.success).toBe(false)
    expect(result.message).toContain("Database connection timeout")
  })

  it("harus handle ujian tanpa soal", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({ user: { id: "guru-1" } })
    mockUjianFindUnique.mockResolvedValue({
      ...mockUjian,
      soal: [],
    })

    const result = await getUjianDetail("ujian-001")

    expect(result.success).toBe(true)
    const data = result.data as { soal: unknown[] }
    expect(data.soal).toHaveLength(0)
  })

  it("harus handle esai tanpa kunciEsai (opsi kosong)", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({ user: { id: "guru-1" } })
    mockUjianFindUnique.mockResolvedValue({
      ...mockUjian,
      soal: [
        {
          id: "soal-esai-1",
          nomorSoal: 1,
          pertanyaan: "Esai tanpa kunci",
          tipe: "ESAI",
          bobot: 15,
          kunciEsai: null,
          opsi: [],
        },
      ],
    })

    const result = await getUjianDetail("ujian-001")

    expect(result.success).toBe(true)
    const data = result.data as {
      soal: { tipe: string; opsi: unknown[] }[]
    }
    expect(data.soal[0].tipe).toBe("ESAI")
    expect(data.soal[0].opsi).toHaveLength(0)
  })
})
