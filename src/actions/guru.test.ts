// src/actions/guru.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

// ========================================================
// Mocks — di-hoist agar tersedia sebelum import modul
// ========================================================

const {
  mockRequireGuru,
  mockUserFindUnique,
  mockGuruFindUnique,
  mockPrismaTransaction,
  mockUserUpdate,
  mockGuruUpdate,
} = vi.hoisted(() => ({
  mockRequireGuru: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockGuruFindUnique: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockGuruUpdate: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireGuru: mockRequireGuru,
  requireGuruAdmin: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
    guru: {
      findUnique: mockGuruFindUnique,
      update: mockGuruUpdate,
    },
    $transaction: mockPrismaTransaction,
  },
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

// ========================================================
// Import setelah semua vi.mock() terdaftar
// ========================================================

import { updateAkunGuru } from "@/actions/guru"

// ========================================================
// Data dummy
// ========================================================

const currentUser = {
  id: "guru-1",
  email: "guru1@sekolah.sch.id",
  role: "GURU",
  isAdmin: false,
}

const currentUserAdmin = {
  id: "guru-admin-1",
  email: "admin@sekolah.sch.id",
  role: "GURU",
  isAdmin: true,
}

const targetUser = {
  id: "guru-2",
  nama: "Guru Dua",
  role: "GURU",
  guru: {
    id: "guru-record-2",
    nip: "1234567890",
    jabatan: "Wali Kelas",
    noHp: "081234567890",
  },
}

const validPayload = {
  nama: "Guru Dua Updated",
  nip: "1234567890",
  jabatan: "Kepala Sekolah",
  noHp: "0899999999",
}

// ========================================================
// Test Suite
// ========================================================

describe("updateAkunGuru - Otorisasi", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --------------------------------------------------------
  // KASUS 1: Guru mengedit profil sendiri → HARUS BERHASIL
  // --------------------------------------------------------
  it("harus mengizinkan guru mengedit profil sendiri", async () => {
    // requireGuru mengembalikan currentUser (id: guru-1)
    mockRequireGuru.mockResolvedValue(currentUser)

    // userId yang diedit = currentUser.id (guru-1)
    mockUserFindUnique.mockResolvedValue({
      ...targetUser,
      id: "guru-1",
      guru: { ...targetUser.guru, id: "guru-record-1" },
    })

    // NIP tidak berubah → tidak perlu cek duplikasi
    mockGuruFindUnique.mockResolvedValue(null)

    // Transaction berhasil
    mockPrismaTransaction.mockImplementation(async (fn: Function) => {
      return fn({
        user: { update: mockUserUpdate.mockResolvedValue({}) },
        guru: { update: mockGuruUpdate.mockResolvedValue({}) },
      })
    })

    const result = await updateAkunGuru("guru-1", validPayload)

    expect(result.success).toBe(true)
    expect(result.message).toContain("berhasil diperbarui")

    // Pastikan requireGuru dipanggil
    expect(mockRequireGuru).toHaveBeenCalledOnce()
  })

  // --------------------------------------------------------
  // KASUS 2: Guru admin mengedit profil guru lain → HARUS BERHASIL
  // --------------------------------------------------------
  it("harus mengizinkan guru admin mengedit profil guru lain", async () => {
    mockRequireGuru.mockResolvedValue(currentUserAdmin)

    // userId yang diedit = guru-2 (bukan admin sendiri)
    mockUserFindUnique.mockResolvedValue(targetUser)
    mockGuruFindUnique.mockResolvedValue(null)

    mockPrismaTransaction.mockImplementation(async (fn: Function) => {
      return fn({
        user: { update: mockUserUpdate.mockResolvedValue({}) },
        guru: { update: mockGuruUpdate.mockResolvedValue({}) },
      })
    })

    const result = await updateAkunGuru("guru-2", validPayload)

    expect(result.success).toBe(true)
    expect(result.message).toContain("berhasil diperbarui")
  })

  // --------------------------------------------------------
  // KASUS 3: Guru BUKAN admin mengedit profil guru lain → HARUS DITOLAK
  // --------------------------------------------------------
  it("harus menolak guru non-admin yang mengedit profil guru lain", async () => {
    mockRequireGuru.mockResolvedValue(currentUser)

    const result = await updateAkunGuru("guru-2", validPayload)

    expect(result.success).toBe(false)
    expect(result.message).toBe(
      "Akses ditolak: Anda hanya bisa mengedit profil sendiri"
    )

    // Pastikan TIDAK ada query database sama sekali (fail-fast)
    expect(mockUserFindUnique).not.toHaveBeenCalled()
    expect(mockPrismaTransaction).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 4: requireGuru throw (bukan role GURU) → error di-catch
  // --------------------------------------------------------
  it("harus gagal jika requireGuru melempar error (bukan role GURU)", async () => {
    mockRequireGuru.mockRejectedValue(
      new Error("Forbidden: Anda tidak memiliki akses")
    )

    const result = await updateAkunGuru("guru-2", validPayload)

    expect(result.success).toBe(false)
    expect(result.message).toContain("Forbidden")
    expect(mockUserFindUnique).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 5: Guru mengedit profil sendiri dengan data invalid → gagal validasi
  // --------------------------------------------------------
  it("harus menolak payload yang tidak valid", async () => {
    mockRequireGuru.mockResolvedValue(currentUser)

    // Payload tanpa field apapun → tetap valid (semua optional),
    // tapi nama dengan 1 karakter → tidak valid
    const invalidPayload = { nama: "A" }

    const result = await updateAkunGuru("guru-1", invalidPayload)

    expect(result.success).toBe(false)
    expect(result.message).toBe("Data update tidak valid")
    expect(result.errors).toBeDefined()
    expect(mockPrismaTransaction).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 6: Target user tidak ditemukan → gagal
  // (Pakai admin supaya lolos auth check, lalu test validasi DB)
  // --------------------------------------------------------
  it("harus gagal jika target user tidak ditemukan", async () => {
    mockRequireGuru.mockResolvedValue(currentUserAdmin)
    mockUserFindUnique.mockResolvedValue(null)

    const result = await updateAkunGuru("guru-999", validPayload)

    expect(result.success).toBe(false)
    expect(result.message).toBe("Akun guru tidak ditemukan")
    expect(mockPrismaTransaction).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 7: Target user bukan role GURU → gagal
  // --------------------------------------------------------
  it("harus gagal jika target user bukan role GURU", async () => {
    mockRequireGuru.mockResolvedValue(currentUserAdmin)
    mockUserFindUnique.mockResolvedValue({
      id: "user-siswa-1",
      role: "SISWA",
      guru: null,
    })

    const result = await updateAkunGuru("user-siswa-1", validPayload)

    expect(result.success).toBe(false)
    expect(result.message).toBe("Akun guru tidak ditemukan")
    expect(mockPrismaTransaction).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 8: Target user tidak punya record Guru → gagal
  // --------------------------------------------------------
  it("harus gagal jika target user tidak punya profil guru", async () => {
    mockRequireGuru.mockResolvedValue(currentUserAdmin)
    mockUserFindUnique.mockResolvedValue({
      id: "guru-tanpa-profil",
      nama: "Guru Tanpa Profil",
      role: "GURU",
      guru: null,
    })

    const result = await updateAkunGuru("guru-tanpa-profil", validPayload)

    expect(result.success).toBe(false)
    expect(result.message).toBe("Profil guru tidak ditemukan")
    expect(mockPrismaTransaction).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 9: NIP duplikat saat update → gagal
  // --------------------------------------------------------
  it("harus menolak NIP yang sudah digunakan guru lain", async () => {
    mockRequireGuru.mockResolvedValue(currentUserAdmin)

    // Target user punya NIP lama "1234567890"
    mockUserFindUnique.mockResolvedValue(targetUser)

    // Payload mengubah NIP ke "9999999999" yang sudah dipakai guru lain
    const payloadNipBaru = { ...validPayload, nip: "9999999999" }

    // findUnique mengembalikan guru lain yang pakai NIP tersebut
    mockGuruFindUnique.mockResolvedValue({ id: "guru-record-other" })

    const result = await updateAkunGuru("guru-2", payloadNipBaru)

    expect(result.success).toBe(false)
    expect(result.message).toBe("NIP sudah digunakan oleh guru lain")
    expect(mockPrismaTransaction).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 10: Guru admin mengedit profil sendiri → HARUS BERHASIL
  // --------------------------------------------------------
  it("harus mengizinkan guru admin mengedit profil sendiri", async () => {
    mockRequireGuru.mockResolvedValue(currentUserAdmin)

    // userId = currentUserAdmin.id → self-edit
    mockUserFindUnique.mockResolvedValue({
      ...targetUser,
      id: "guru-admin-1",
      guru: { ...targetUser.guru, id: "guru-record-admin" },
    })
    mockGuruFindUnique.mockResolvedValue(null)

    mockPrismaTransaction.mockImplementation(async (fn: Function) => {
      return fn({
        user: { update: mockUserUpdate.mockResolvedValue({}) },
        guru: { update: mockGuruUpdate.mockResolvedValue({}) },
      })
    })

    const result = await updateAkunGuru("guru-admin-1", validPayload)

    expect(result.success).toBe(true)
  })

  // --------------------------------------------------------
  // KASUS 11: Transaction database gagal → error di-catch
  // --------------------------------------------------------
  it("harus gagal jika transaction database error", async () => {
    mockRequireGuru.mockResolvedValue(currentUser)
    mockUserFindUnique.mockResolvedValue({
      ...targetUser,
      id: "guru-1",
      guru: { ...targetUser.guru, id: "guru-record-1" },
    })
    mockGuruFindUnique.mockResolvedValue(null)

    mockPrismaTransaction.mockRejectedValue(
      new Error("Database connection timeout")
    )

    const result = await updateAkunGuru("guru-1", validPayload)

    expect(result.success).toBe(false)
    expect(result.message).toContain("Database connection timeout")
  })

  // --------------------------------------------------------
  // KASUS 12: NIP tidak berubah → skip pengecekan duplikasi
  // --------------------------------------------------------
  it("harus skip pengecekan duplikasi NIP jika NIP tidak diubah", async () => {
    mockRequireGuru.mockResolvedValue(currentUser)

    // Target user sudah punya NIP "1234567890", payload juga "1234567890"
    mockUserFindUnique.mockResolvedValue({
      ...targetUser,
      id: "guru-1",
      guru: { ...targetUser.guru, id: "guru-record-1" },
    })

    // findUnique NIP tidak dipanggil karena NIP tidak berubah
    mockGuruFindUnique.mockResolvedValue(null)

    mockPrismaTransaction.mockImplementation(async (fn: Function) => {
      return fn({
        user: { update: mockUserUpdate.mockResolvedValue({}) },
        guru: { update: mockGuruUpdate.mockResolvedValue({}) },
      })
    })

    const result = await updateAkunGuru("guru-1", validPayload)

    expect(result.success).toBe(true)
    // NIP sama → findUnique tidak dipanggil
    expect(mockGuruFindUnique).not.toHaveBeenCalled()
  })
})
