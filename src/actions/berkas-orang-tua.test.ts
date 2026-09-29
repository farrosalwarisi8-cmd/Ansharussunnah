// src/actions/berkas-orang-tua.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  mockParentStudentFindFirst,
  mockRequireRole,
  mockReadBerkas,
  mockWriteBerkas,
  mockRemoveBerkas,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockParentStudentFindFirst: vi.fn(),
  mockRequireRole: vi.fn(),
  mockReadBerkas: vi.fn(),
  mockWriteBerkas: vi.fn(),
  mockRemoveBerkas: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    parentStudent: {
      findFirst: mockParentStudentFindFirst,
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}))

vi.mock("@/lib/berkas-siswa-service", () => ({
  readBerkasSiswa: (...args: unknown[]) => mockReadBerkas(...args),
  writeBerkasSiswa: (...args: unknown[]) => mockWriteBerkas(...args),
  removeBerkasSiswa: (...args: unknown[]) => mockRemoveBerkas(...args),
}))

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

import {
  getBerkasAnak,
  uploadBerkasAnak,
  hapusBerkasAnak,
} from "@/actions/berkas-orang-tua"
import { Role } from "@prisma/client"

const ORTU_ID = "ortu-1"
const SISWA_ID = "siswa-1"
const SISWA_LAIN = "siswa-2"

function makeFormData(): FormData {
  const fd = new FormData()
  fd.append("file", new File(["x"], "kk.jpg", { type: "image/jpeg" }))
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireRole.mockResolvedValue({
    id: "user-1",
    role: Role.ORANG_TUA,
    orangTua: { id: ORTU_ID },
  })
  mockParentStudentFindFirst.mockResolvedValue({ id: "rel-1" })
  mockReadBerkas.mockResolvedValue({ success: true, message: "ok", data: {} })
  mockWriteBerkas.mockResolvedValue({ success: true, message: "ok" })
  mockRemoveBerkas.mockResolvedValue({ success: true, message: "ok" })
})

describe("berkas-orang-tua — Otorisasi", () => {
  it("hanya menerima role ORANG_TUA", async () => {
    const result = await getBerkasAnak(SISWA_ID)

    expect(mockRequireRole).toHaveBeenCalledWith([Role.ORANG_TUA])
    expect(result.success).toBe(true)
  })

  it("menolak sesi tanpa profil orangTua", async () => {
    mockRequireRole.mockResolvedValue({ id: "user-1", role: Role.ORANG_TUA })

    const result = await getBerkasAnak(SISWA_ID)

    expect(result.success).toBe(false)
    expect(result.message).toContain("Data orang tua tidak ditemukan")
    expect(mockReadBerkas).not.toHaveBeenCalled()
  })

  it("menolak siswa yang bukan anaknya (anti IDOR baca)", async () => {
    mockParentStudentFindFirst.mockResolvedValue(null)

    const result = await getBerkasAnak(SISWA_LAIN)

    expect(result.success).toBe(false)
    expect(result.message).toContain("tidak memiliki akses")
    expect(mockReadBerkas).not.toHaveBeenCalled()
  })

  it("memakai orangTuaId dari sesi, bukan dari input klien", async () => {
    await getBerkasAnak(SISWA_LAIN)

    expect(mockParentStudentFindFirst).toHaveBeenCalledWith({
      where: { orangTuaId: ORTU_ID, siswaId: SISWA_LAIN },
      select: { id: true },
    })
  })

  it("menolak upload untuk siswa yang bukan anaknya (anti IDOR tulis)", async () => {
    mockParentStudentFindFirst.mockResolvedValue(null)

    const result = await uploadBerkasAnak(SISWA_LAIN, "kartuKeluarga", makeFormData())

    expect(result.success).toBe(false)
    expect(result.message).toContain("tidak memiliki akses")
    expect(mockWriteBerkas).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it("menolak hapus untuk siswa yang bukan anaknya (anti IDOR hapus)", async () => {
    mockParentStudentFindFirst.mockResolvedValue(null)

    const result = await hapusBerkasAnak(SISWA_LAIN, "kartuKeluarga")

    expect(result.success).toBe(false)
    expect(result.message).toContain("tidak memiliki akses")
    expect(mockRemoveBerkas).not.toHaveBeenCalled()
  })
})

describe("berkas-orang-tua — Validasi Input", () => {
  it("menolak siswaId kosong tanpa memanggil service", async () => {
    const result = await getBerkasAnak("")

    expect(result.success).toBe(false)
    expect(result.message).toContain("ID siswa tidak valid")
    expect(mockReadBerkas).not.toHaveBeenCalled()
  })

  it("menolak upload dengan siswaId kosong", async () => {
    const result = await uploadBerkasAnak("", "kartuKeluarga", makeFormData())

    expect(result.success).toBe(false)
    expect(result.message).toContain("ID siswa tidak valid")
    expect(mockWriteBerkas).not.toHaveBeenCalled()
  })

  it("menolak hapus dengan siswaId kosong", async () => {
    const result = await hapusBerkasAnak("", "lainnya", "path")

    expect(result.success).toBe(false)
    expect(result.message).toContain("ID siswa tidak valid")
    expect(mockRemoveBerkas).not.toHaveBeenCalled()
  })
})

describe("berkas-orang-tua — Revalidasi", () => {
  it("merevalidasi /dashboard/berkas setelah upload & hapus sukses", async () => {
    await uploadBerkasAnak(SISWA_ID, "kartuKeluarga", makeFormData())
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/berkas")

    mockRevalidatePath.mockClear()

    await hapusBerkasAnak(SISWA_ID, "kartuKeluarga")
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/berkas")
  })

  it("tidak merevalidasi saat operasi gagal", async () => {
    mockWriteBerkas.mockResolvedValue({ success: false, message: "gagal" })

    const result = await uploadBerkasAnak(SISWA_ID, "kartuKeluarga", makeFormData())

    expect(result.success).toBe(false)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})

describe("berkas-orang-tua — Error Handling", () => {
  it("mengembalikan pesan ramah saat service melempar error", async () => {
    mockReadBerkas.mockRejectedValue(new Error("boom"))

    const result = await getBerkasAnak(SISWA_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBeTruthy()
  })

  it("mengembalikan pesan ramah saat upload melempar error", async () => {
    mockWriteBerkas.mockRejectedValue(new Error("boom"))

    const result = await uploadBerkasAnak(SISWA_ID, "kartuKeluarga", makeFormData())

    expect(result.success).toBe(false)
    expect(result.message).toBeTruthy()
  })
})
