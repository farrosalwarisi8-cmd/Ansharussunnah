// src/actions/rapor.test.ts
//
// Menguji perbaikan audit di rapor.ts:
// - updateCatatanRapor mengisi dibuatOlehId dari user session (bukan undefined)
// - Hanya wali kelas / admin yang boleh mengubah catatan rapor
// - revalidatePath diarahkan ke rute nyata /dashboard/rapor

import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  mockVerifyGuruAksesKelas,
  mockCatatanRaporFindUnique,
  mockCatatanRaporUpdate,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockVerifyGuruAksesKelas: vi.fn(),
  mockCatatanRaporFindUnique: vi.fn(),
  mockCatatanRaporUpdate: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    catatanRapor: {
      findUnique: mockCatatanRaporFindUnique,
      update: mockCatatanRaporUpdate,
    },
  },
}))

vi.mock("@/lib/guru-auth", () => ({
  verifyGuruAksesKelas: mockVerifyGuruAksesKelas,
}))

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}))

import { updateCatatanRapor } from "@/actions/rapor"

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