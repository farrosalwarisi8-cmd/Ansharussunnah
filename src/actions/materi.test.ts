// src/actions/materi.test.ts
//
// Regression tests: materi dengan URL eksternal (Google Drive).
//
// Bug yang dikunci: guru menginput materi dengan URL eksternal → server
// membuatkan signed URL dari string "https://..." (rusak) dan tombol
// "Buka & Unduh Materi" tidak membuka Drive.
//
// Kontrak yang diharapkan:
//   - Path internal (materi/{kelasId}/...) → signedUrl dibuat.
//   - URL eksternal (http/https) → signedUrl KOSONG, url asli diteruskan
//     via urlFile/urlLink ke guru, siswa, dan orang tua.
//   - deleteMateri TIDAK boleh menghapus file dari bucket untuk URL eksternal.

import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  mockPrisma,
  mockGetSignedUrls,
  mockRequireRole,
  mockVerifyGuruAksesKelas,
  mockSupabaseStorageRemove,
  mockSupabaseStorageList,
} = vi.hoisted(() => ({
  mockPrisma: {
    mataPelajaran: {
      findFirst: vi.fn(),
    },
    periodeAjaran: {
      findUnique: vi.fn(),
    },
    materiPembelajaran: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    siswa: {
      findUnique: vi.fn(),
    },
    parentStudent: {
      findFirst: vi.fn(),
    },
  },
  mockGetSignedUrls: vi.fn(),
  mockRequireRole: vi.fn(),
  mockVerifyGuruAksesKelas: vi.fn(),
  mockSupabaseStorageRemove: vi.fn(),
  mockSupabaseStorageList: vi.fn(),
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

// storage helpers dimock — isExternalUrl tetap implementasi ASLI agar
// perilaku guard-nya ikut teruji.
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>()
  return {
    ...actual,
    getSignedUrls: mockGetSignedUrls,
  }
})

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        list: mockSupabaseStorageList,
        remove: mockSupabaseStorageRemove,
      }),
    },
  }),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import {
  createMateri,
  updateMateri,
  deleteMateri,
  getDaftarMateriGuru,
  getDaftarMateriSiswa,
  getDaftarMateriAnak,
} from "@/actions/materi"

// ========================================================
// Dummy data
// ========================================================

const GOOGLE_DRIVE_URL = "https://drive.google.com/file/d/1XyZaBcD/view?usp=sharing"

const mapelDummy = { id: "mapel-1", nama: "Bahasa Arab" }
const periodeDummy = { id: "periode-1", nama: "2026/2027" }

const materiDrive = {
  id: "materi-1",
  judul: "Modul Tashrif",
  deskripsi: "Modul bab 1",
  kelasId: "kelas-1",
  mataPelajaranId: "mapel-1",
  mataPelajaran: mapelDummy,
  periodeAjaran: periodeDummy,
  diunggahOleh: { nama: "Ustadz Guru" },
  urlFile: GOOGLE_DRIVE_URL,
  urlLink: null,
  createdAt: new Date(),
}

const materiInternal = {
  ...materiDrive,
  id: "materi-2",
  judul: "Modul Internal",
  urlFile: "materi/kelas-1/abc123.pdf",
}

const guruSession = {
  id: "guru-user-1",
  role: "GURU",
  siswa: null,
  orangTua: null,
}

const siswaSession = {
  id: "user-siswa-1",
  role: "SISWA",
  siswa: { id: "siswa-1", kelasId: "kelas-1" },
  orangTua: null,
}

const ortuSession = {
  id: "user-ortu-1",
  role: "ORANG_TUA",
  siswa: null,
  orangTua: { id: "ortu-1" },
}

// ========================================================
// 1. createMateri — menerima URL Google Drive
// ========================================================

describe("createMateri — URL eksternal (Google Drive)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.mataPelajaran.findFirst.mockResolvedValue(mapelDummy)
    mockPrisma.periodeAjaran.findUnique.mockResolvedValue(periodeDummy)
    mockPrisma.materiPembelajaran.create.mockResolvedValue({ id: "materi-baru" })
  })

  it("harus menerima URL Drive dan menyimpan apa adanya tanpa verifikasi storage", async () => {
    const result = await createMateri({
      judul: "Modul Tashrif",
      mataPelajaran: "Bahasa Arab",
      kelasId: "kelas-1",
      periodeAjaranId: "periode-1",
      urlFile: GOOGLE_DRIVE_URL,
    })

    expect(result.success).toBe(true)
    expect(mockSupabaseStorageList).not.toHaveBeenCalled()

    const createArg = mockPrisma.materiPembelajaran.create.mock.calls[0][0]
    expect(createArg.data.urlFile).toBe(GOOGLE_DRIVE_URL)
  })

  it("harus menolak nilai urlFile yang bukan path internal maupun URL eksternal", async () => {
    const result = await createMateri({
      judul: "Modul Aneh",
      mataPelajaran: "Bahasa Arab",
      kelasId: "kelas-1",
      periodeAjaranId: "periode-1",
      urlFile: "javascript:alert(1)",
    })

    expect(result.success).toBe(false)
    expect(mockPrisma.materiPembelajaran.create).not.toHaveBeenCalled()
  })

  it("harus memverifikasi file di bucket untuk path internal (regresi)", async () => {
    mockSupabaseStorageList.mockResolvedValue({
      data: [{ name: "abc123.pdf" }],
      error: null,
    })

    const result = await createMateri({
      judul: "Modul Internal",
      mataPelajaran: "Bahasa Arab",
      kelasId: "kelas-1",
      periodeAjaranId: "periode-1",
      urlFile: "materi/kelas-1/abc123.pdf",
    })

    expect(result.success).toBe(true)
    expect(mockSupabaseStorageList).toHaveBeenCalledWith("materi/kelas-1")
  })
})

// ========================================================
// 2. updateMateri — mengganti ke / dari URL Drive
// ========================================================

describe("updateMateri — URL eksternal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus menerima URL Drive sebagai urlFile baru", async () => {
    mockPrisma.materiPembelajaran.findUnique.mockResolvedValue(materiInternal)
    mockPrisma.materiPembelajaran.update.mockResolvedValue({ id: "materi-2" })

    const result = await updateMateri("materi-2", {
      urlFile: GOOGLE_DRIVE_URL,
    })

    expect(result.success).toBe(true)
    expect(mockSupabaseStorageList).not.toHaveBeenCalled()
    const updateArg = mockPrisma.materiPembelajaran.update.mock.calls[0][0]
    expect(updateArg.data.urlFile).toBe(GOOGLE_DRIVE_URL)
  })

  it("harus menolak urlFile internal yang melanggar prefix kelas tujuan", async () => {
    mockPrisma.materiPembelajaran.findUnique.mockResolvedValue(materiInternal)

    const result = await updateMateri("materi-2", {
      urlFile: "materi/kelas-LAIN/abc123.pdf",
    })

    expect(result.success).toBe(false)
    expect(mockPrisma.materiPembelajaran.update).not.toHaveBeenCalled()
  })
})

// ========================================================
// 3. deleteMateri — tidak boleh memanggil storage.remove untuk URL eksternal
// ========================================================

describe("deleteMateri — URL eksternal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus TIDAK menghapus file dari bucket untuk materi dengan URL Drive", async () => {
    mockPrisma.materiPembelajaran.findUnique.mockResolvedValue(materiDrive)
    mockPrisma.materiPembelajaran.delete.mockResolvedValue(materiDrive)

    const result = await deleteMateri("materi-1")

    expect(result.success).toBe(true)
    expect(mockPrisma.materiPembelajaran.delete).toHaveBeenCalledOnce()
    expect(mockSupabaseStorageRemove).not.toHaveBeenCalled()
  })

  it("harus tetap menghapus file bucket untuk path internal (regresi)", async () => {
    mockPrisma.materiPembelajaran.findUnique.mockResolvedValue(materiInternal)
    mockPrisma.materiPembelajaran.delete.mockResolvedValue(materiInternal)
    mockSupabaseStorageRemove.mockResolvedValue({ error: null })

    const result = await deleteMateri("materi-2")

    expect(result.success).toBe(true)
    expect(mockSupabaseStorageRemove).toHaveBeenCalledWith([materiInternal.urlFile])
  })
})

// ========================================================
// 4. Daftar materi — Drive URL diteruskan, signedUrl kosong
// ========================================================

describe("getDaftarMateriGuru / getDaftarMateriSiswa / getDaftarMateriAnak — URL Drive", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("guru: harus menerima urlFile Drive + signedUrl null, tanpa mengirim Drive ke Supabase", async () => {
    mockPrisma.materiPembelajaran.findMany.mockResolvedValue([materiDrive])
    mockGetSignedUrls.mockResolvedValue(new Map())

    const result = await getDaftarMateriGuru("kelas-1")

    if (!result.success) throw new Error(result.message)
    const list = result.data as Array<Record<string, unknown>>
    expect(list).toHaveLength(1)
    expect(list[0].urlFile).toBe(GOOGLE_DRIVE_URL)
    expect(list[0].signedUrl).toBeNull()

    const pathsArg = mockGetSignedUrls.mock.calls[0][1] as string[]
    expect(pathsArg).not.toContain(GOOGLE_DRIVE_URL)
  })

  it("siswa: harus melihat materi Drive dengan url asli (bukan signed)", async () => {
    mockRequireRole.mockResolvedValue(siswaSession)
    mockPrisma.materiPembelajaran.findMany.mockResolvedValue([materiDrive])
    mockGetSignedUrls.mockResolvedValue(new Map())

    const result = await getDaftarMateriSiswa()

    if (!result.success) throw new Error(result.message)
    const list = result.data as Array<Record<string, unknown>>
    expect(list[0].urlFile).toBe(GOOGLE_DRIVE_URL)
    expect(list[0].signedUrl).toBeNull()
  })

  it("siswa: harus tetap membuat signedUrl untuk path internal (regresi)", async () => {
    mockRequireRole.mockResolvedValue(siswaSession)
    mockPrisma.materiPembelajaran.findMany.mockResolvedValue([materiInternal])
    mockGetSignedUrls.mockResolvedValue(
      new Map([[materiInternal.urlFile, "https://supabase.co/signed?token=y"]])
    )

    const result = await getDaftarMateriSiswa()

    if (!result.success) throw new Error(result.message)
    const list = result.data as Array<Record<string, unknown>>
    expect(list[0].signedUrl).toBe("https://supabase.co/signed?token=y")
  })

  it("orang tua: harus melihat materi Drive anaknya dengan url asli", async () => {
    mockRequireRole.mockResolvedValue(ortuSession)
    mockPrisma.parentStudent.findFirst.mockResolvedValue({ id: "ps-1" })
    mockPrisma.siswa.findUnique.mockResolvedValue({
      id: "siswa-1",
      kelasId: "kelas-1",
    })
    mockPrisma.materiPembelajaran.findMany.mockResolvedValue([
      materiDrive,
      materiInternal,
    ])
    mockGetSignedUrls.mockResolvedValue(
      new Map([[materiInternal.urlFile, "https://supabase.co/signed?token=y"]])
    )

    const result = await getDaftarMateriAnak("siswa-1")

    if (!result.success) throw new Error(result.message)
    const list = result.data as Array<Record<string, unknown>>
    expect(list).toHaveLength(2)

    const byJudul = new Map(list.map((m) => [m.judul, m]))
    expect(byJudul.get("Modul Tashrif")!.urlFile).toBe(GOOGLE_DRIVE_URL)
    expect(byJudul.get("Modul Tashrif")!.signedUrl).toBeNull()
    expect(byJudul.get("Modul Internal")!.signedUrl).toBe(
      "https://supabase.co/signed?token=y"
    )

    // Hanya path internal yang dikirim ke Supabase
    const pathsArg = mockGetSignedUrls.mock.calls[0][1] as string[]
    expect(pathsArg).toEqual([materiInternal.urlFile])
  })
})
