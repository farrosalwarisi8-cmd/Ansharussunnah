// src/actions/rapor.test.ts
//
// Menguji perbaikan audit di rapor.ts:
// - updateCatatanRapor mengisi dibuatOlehId dari user session (bukan undefined)
// - Hanya wali kelas / admin yang boleh mengubah catatan rapor
// - revalidatePath diarahkan ke rute nyata /dashboard/rapor
// - createOrUpdateCatatanRapor menyimpan rapor bulanan (bulan × sikap)

import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  mockVerifyGuruAksesKelas,
  mockCatatanRaporFindUnique,
  mockCatatanRaporUpdate,
  mockCatatanRaporUpsert,
  mockSiswaFindUnique,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockVerifyGuruAksesKelas: vi.fn(),
  mockCatatanRaporFindUnique: vi.fn(),
  mockCatatanRaporUpdate: vi.fn(),
  mockCatatanRaporUpsert: vi.fn(),
  mockSiswaFindUnique: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    siswa: { findUnique: mockSiswaFindUnique },
    catatanRapor: {
      findUnique: mockCatatanRaporFindUnique,
      update: mockCatatanRaporUpdate,
      upsert: mockCatatanRaporUpsert,
    },
  },
}))

vi.mock("@/lib/guru-auth", () => ({
  verifyGuruAksesKelas: mockVerifyGuruAksesKelas,
}))

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}))

import { createOrUpdateCatatanRapor, getCatatanRaporDetail, updateCatatanRapor } from "@/actions/rapor"

const baseCatatan = {
  id: "catatan-1",
  catatan: "Catatan lama",
  ranking: 3,
  siswa: {
    id: "siswa-1",
    kelas: { id: "7A-IKHWAN" },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCatatanRaporFindUnique.mockResolvedValue(baseCatatan)
  mockSiswaFindUnique.mockResolvedValue({ id: "siswa-1", kelas: { id: "7A-IKHWAN" } })
  mockVerifyGuruAksesKelas.mockResolvedValue({
    user: { id: "guru-wali-1" },
    guru: { id: "guru-wali-1" },
    roleInKelas: "WALI_KELAS",
  })
})

describe("updateCatatanRapor", () => {
  it("menyimpan dibuatOlehId dari user yang mengubah saat wali kelas", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({
      user: { id: "guru-wali-1" },
      roleInKelas: "WALI_KELAS",
    })
    mockCatatanRaporUpdate.mockResolvedValue({ id: "catatan-1" })

    const result = await updateCatatanRapor({
      catatanId: "catatan-1",
      catatan: "Catatan baru",
      ranking: 2,
    })

    expect(result.success).toBe(true)
    expect(mockCatatanRaporUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          catatan: "Catatan baru",
          ranking: 2,
          dibuatOlehId: "guru-wali-1",
        }),
      })
    )
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/rapor`)
  })

  it("mengizinkan admin akademik mengubah catatan", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({
      user: { id: "admin-1" },
      roleInKelas: "ADMIN",
    })
    mockCatatanRaporUpdate.mockResolvedValue({ id: "catatan-1" })

    const result = await updateCatatanRapor({
      catatanId: "catatan-1",
      catatan: "Catatan oleh admin",
    })

    expect(result.success).toBe(true)
    expect(mockCatatanRaporUpdate).toHaveBeenCalled()
  })

  it("menolak guru non-wali kelas (roleInKelas bukan WALI_KELAS/ADMIN)", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({
      user: { id: "guru-biasa-1" },
      roleInKelas: "PENGAJAR",
    })

    const result = await updateCatatanRapor({
      catatanId: "catatan-1",
      catatan: "Catatan gaboleh",
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("Hanya wali kelas")
    expect(mockCatatanRaporUpdate).not.toHaveBeenCalled()
  })

  it("mengembalikan error bila catatan tidak ditemukan", async () => {
    mockCatatanRaporFindUnique.mockResolvedValue(null)

    const result = await updateCatatanRapor({
      catatanId: "catatan-null",
      catatan: "Apa pun",
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("Catatan rapor tidak ditemukan")
  })

  it("menolak payload dengan catatan kosong", async () => {
    const result = await updateCatatanRapor({
      catatanId: "catatan-1",
      catatan: "",
    })

    expect(result.success).toBe(false)
    expect(mockCatatanRaporFindUnique).not.toHaveBeenCalled()
  })
})

describe("createOrUpdateCatatanRapor", () => {
  it("upsert rapor bulanan dengan = [siswa, periode, bulan] dan menyimpan nilai sikap", async () => {
    mockCatatanRaporUpsert.mockResolvedValue({ id: "catatan-2" })

    const result = await createOrUpdateCatatanRapor({
      siswaId: "siswa-1",
      periodeAjaranId: "periode-1",
      bulan: 2,
      catatan: "Perkembangan baik",
      ranking: 4,
      kedisiplinan: 85,
      kemandirian: 90,
      tingkahLaku: "Berperilaku baik dan santun",
      prestasi: "Juara hafalan juz 30",
    })

    expect(result.success).toBe(true)
    expect(mockCatatanRaporUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          siswaId_periodeAjaranId_bulan: { siswaId: "siswa-1", periodeAjaranId: "periode-1", bulan: 2 },
        },
        create: expect.objectContaining({
          siswaId: "siswa-1",
          periodeAjaranId: "periode-1",
          bulan: 2,
          catatan: "Perkembangan baik",
          kedisiplinan: 85,
          kemandirian: 90,
          tingkahLaku: "Berperilaku baik dan santun",
          prestasi: "Juara hafalan juz 30",
        }),
      })
    )
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/rapor`)
  })

  it("default rapor akhir semester (bulan = 0) saat bulan tidak dikirim", async () => {
    mockCatatanRaporUpsert.mockResolvedValue({ id: "catatan-3" })

    const result = await createOrUpdateCatatanRapor({
      siswaId: "siswa-1",
      periodeAjaranId: "periode-1",
      catatan: "Catatan akhir semester",
    })

    expect(result.success).toBe(true)
    expect(mockCatatanRaporUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          siswaId_periodeAjaranId_bulan: { siswaId: "siswa-1", periodeAjaranId: "periode-1", bulan: 0 },
        },
      })
    )
  })

  it("menolak guru yg bukan wali kelas / admin", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({
      user: { id: "guru-biasa-1" },
      guru: { id: "guru-biasa-1" },
      roleInKelas: "PENGAJAR",
    })

    const result = await createOrUpdateCatatanRapor({
      siswaId: "siswa-1",
      periodeAjaranId: "periode-1",
      catatan: "Coba isi",
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("Hanya wali kelas")
    expect(mockCatatanRaporUpsert).not.toHaveBeenCalled()
  })
})

describe("getCatatanRaporDetail", () => {
  it("mengembalikan catatan null saat rapor bulan dipilih belum diisi", async () => {
    mockCatatanRaporFindUnique.mockResolvedValue(null)

    const result = await getCatatanRaporDetail("siswa-1", "periode-1", 3)

    expect(result.success).toBe(true)
    const data = result.data as unknown as { bulan: number; jenisRapor: string; catatan: unknown }
    expect(data.bulan).toBe(3)
    expect(data.jenisRapor).toContain("Maret")
    expect(data.catatan).toBeNull()
  })

  it("membebankan data sikap yang sudah tersimpan", async () => {
    mockCatatanRaporFindUnique.mockResolvedValue({
      id: "catatan-1",
      catatan: "Tetap semangat",
      ranking: 2,
      kedisiplinan: 80,
      kemandirian: 88,
      tingkahLaku: "Santun",
      prestasi: "Nilai terbaik mapel matematika",
    })

    const result = await getCatatanRaporDetail("siswa-1", "periode-1", 0)

    expect(result.success).toBe(true)
    const data = result.data as unknown as {
      jenisRapor: string
      catatan: { catatan: string; kedisiplinan: number; kemandirian: number; tingkahLaku: string }
    }
    expect(data.jenisRapor).toContain("Akhir Semester")
    expect(data.catatan.catatan).toBe("Tetap semangat")
    expect(data.catatan.kedisiplinan).toBe(80)
    expect(data.catatan.kemandirian).toBe(88)
    expect(data.catatan.tingkahLaku).toBe("Santun")
  })

  it("menolak akses guru non-wali kelas", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({
      user: { id: "guru-biasa-1" },
      roleInKelas: "PENGAJAR",
    })

    const result = await getCatatanRaporDetail("siswa-1", "periode-1", 1)

    expect(result.success).toBe(false)
    expect(result.message).toContain("Hanya wali kelas")
  })
})