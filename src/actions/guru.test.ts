// src/actions/guru.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

// ========================================================
// Mocks — di-hoist agar tersedia sebelum import modul
// ========================================================

const {
  mockRequireGuru,
  mockRequireGuruAdmin,
  mockUserFindUnique,
  mockUserFindFirst,
  mockUserCreate,
  mockUserUpdate,
  mockUserDelete,
  mockUserCount,
  mockGuruFindUnique,
  mockGuruCreate,
  mockGuruKelasCreateMany,
  mockMapelFindMany,
  mockKelasFindMany,
  mockPrismaTransaction,
  mockGuruUpdate,
  mockCreateUser,
  mockListUsers,
  mockDeleteUserAuth,
  mockSendEmail,
} = vi.hoisted(() => ({
  mockRequireGuru: vi.fn(),
  mockRequireGuruAdmin: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockUserCreate: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockUserDelete: vi.fn(),
  mockUserCount: vi.fn(),
  mockGuruFindUnique: vi.fn(),
  mockGuruCreate: vi.fn(),
  mockGuruKelasCreateMany: vi.fn(),
  mockMapelFindMany: vi.fn(),
  mockKelasFindMany: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockGuruUpdate: vi.fn(),
  mockCreateUser: vi.fn(),
  mockListUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
  mockDeleteUserAuth: vi.fn(),
  mockSendEmail: vi.fn().mockResolvedValue({}),
}))

vi.mock("@/lib/auth", () => ({
  requireGuru: mockRequireGuru,
  requireGuruAdmin: mockRequireGuruAdmin,
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: mockUserFindUnique,
      findFirst: mockUserFindFirst,
      create: mockUserCreate,
      update: mockUserUpdate,
      delete: mockUserDelete,
      count: mockUserCount,
    },
    guru: {
      findUnique: mockGuruFindUnique,
      create: mockGuruCreate,
      update: mockGuruUpdate,
    },
    mataPelajaran: {
      findMany: mockMapelFindMany,
    },
    kelas: {
      findMany: mockKelasFindMany,
    },
    guruKelas: {
      createMany: mockGuruKelasCreateMany,
    },
    $transaction: mockPrismaTransaction,
  },
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: () => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        listUsers: mockListUsers,
        deleteUser: mockDeleteUserAuth,
      },
    },
  }),
}))

vi.mock("@/lib/password", () => ({
  generateSecurePassword: vi.fn().mockReturnValue("Guru132!xYzQweR"),
}))

vi.mock("@/lib/email", () => ({
  sendEmail: mockSendEmail,
  buildKredensialGuruEmail: vi.fn(() => "<p>kredensial</p>"),
  buildPemberitahuanRoleBaruEmail: vi.fn(() => "<p>pemberitahuan</p>"),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

// ========================================================
// Import setelah semua vi.mock() terdaftar
// ========================================================

import { createAkunGuru, updateAkunGuru, hapusAkunGuruPermanent, setGuruAdmin } from "@/actions/guru"

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
    mockPrismaTransaction.mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
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

    mockPrismaTransaction.mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
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

    mockPrismaTransaction.mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
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

    mockPrismaTransaction.mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
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

// ========================================================
// createAkunGuru — Penugasan Otomatis Guru Baru
// ========================================================

describe("createAkunGuru - Otorisasi & Penugasan Otomatis", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupCreateTransaction() {
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        return fn({
          user: { create: mockUserCreate, findFirst: mockUserFindFirst },
          guru: { create: mockGuruCreate },
          guruKelas: { createMany: mockGuruKelasCreateMany },
        })
      }
    )
  }

  // --------------------------------------------------------
  // KASUS 1: Guru baru non-admin → otomatis ditugaskan ke semua mapel & kelas aktif
  // --------------------------------------------------------
  it("harus otomatis menugaskan guru non-admin ke semua mapel aktif di semua kelas aktif", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "admin-1", isAdmin: true })
    mockUserFindFirst.mockResolvedValue(null) // email tidak duplikat
    mockGuruFindUnique.mockResolvedValue(null) // NIP tidak duplikat

    // 2 mapel aktif x 2 kelas aktif = 4 penugasan
    mockMapelFindMany.mockResolvedValue([{ id: "mapel-1" }, { id: "mapel-2" }])
    mockKelasFindMany.mockResolvedValue([{ id: "kelas-1" }, { id: "kelas-2" }])

    mockCreateUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null })

    setupCreateTransaction()
    mockUserCreate.mockResolvedValue({ id: "user-1" })
    mockGuruCreate.mockResolvedValue({ id: "guru-1" })
    mockGuruKelasCreateMany.mockResolvedValue({ count: 4 })

    const result = await createAkunGuru({
      nama: "Guru Baru",
      email: "gurubaru@sekolah.sch.id",
      isAdmin: false,
    })

    expect(result.success).toBe(true)
    expect(result.message).toContain("otomatis ditugaskan")

    // Penugasan default = mapel x kelas
    const createManyCall = mockGuruKelasCreateMany.mock.calls[0][0]
    expect(createManyCall.data).toHaveLength(4)
    expect(createManyCall.skipDuplicates).toBe(true)
    expect(createManyCall.data).toEqual(
      expect.arrayContaining([
        { guruId: "guru-1", kelasId: "kelas-1", mataPelajaranId: "mapel-1" },
        { guruId: "guru-1", kelasId: "kelas-2", mataPelajaranId: "mapel-2" },
      ])
    )
    // Kredensial dikirim via email
    expect(mockSendEmail).toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 1b: Guru Ikhwan → hanya kelas Ikhwan & Campuran yang ditugaskan
  // --------------------------------------------------------
  it("harus menugaskan guru Ikhwan hanya ke kelas Ikhwan & Campuran", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "admin-1", isAdmin: true })
    mockUserFindFirst.mockResolvedValue(null)
    mockGuruFindUnique.mockResolvedValue(null)

    // 1 mapel x 3 kelas = 3 kandidat, namun kelas Akhwat (PEREMPUAN) harus tersingkir
    mockMapelFindMany.mockResolvedValue([{ id: "mapel-1" }])
    mockKelasFindMany.mockResolvedValue([
      { id: "kelas-ikhwan", jenisKelamin: "LAKI_LAKI" },
      { id: "kelas-akhwat", jenisKelamin: "PEREMPUAN" },
      { id: "kelas-campuran", jenisKelamin: null },
    ])

    mockCreateUser.mockResolvedValue({ data: { user: { id: "auth-1b" } }, error: null })

    setupCreateTransaction()
    mockUserCreate.mockResolvedValue({ id: "user-1b" })
    mockGuruCreate.mockResolvedValue({ id: "guru-1b" })
    mockGuruKelasCreateMany.mockResolvedValue({ count: 2 })

    const result = await createAkunGuru({
      nama: "Ustadz Ikhwan",
      email: "ikhwan@sekolah.sch.id",
      jenisKelamin: "LAKI_LAKI",
      isAdmin: false,
    })

    expect(result.success).toBe(true)
    const createManyCall = mockGuruKelasCreateMany.mock.calls[0][0]
    expect(createManyCall.data).toHaveLength(2)
    expect(createManyCall.data).toEqual(
      expect.arrayContaining([
        { guruId: "guru-1b", kelasId: "kelas-ikhwan", mataPelajaranId: "mapel-1" },
        { guruId: "guru-1b", kelasId: "kelas-campuran", mataPelajaranId: "mapel-1" },
      ])
    )
    // Kelas Akhwat tidak boleh muncul sama sekali
    const kelasTerverifikasi = createManyCall.data.map((d: { kelasId: string }) => d.kelasId)
    expect(kelasTerverifikasi).not.toContain("kelas-akhwat")
  })

  // --------------------------------------------------------
  // KASUS 2: Guru admin → TIDAK perlu penugasan otomatis
  // --------------------------------------------------------
  it("harus melewati penugasan otomatis untuk guru admin", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "admin-1", isAdmin: true })
    mockUserFindFirst.mockResolvedValue(null)
    mockGuruFindUnique.mockResolvedValue(null)
    mockCreateUser.mockResolvedValue({ data: { user: { id: "auth-2" } }, error: null })

    setupCreateTransaction()
    mockUserCreate.mockResolvedValue({ id: "user-admin" })
    mockGuruCreate.mockResolvedValue({ id: "guru-admin" })

    const result = await createAkunGuru({
      nama: "Guru Admin",
      email: "guruadmin@sekolah.sch.id",
      isAdmin: true,
    })

    expect(result.success).toBe(true)
    expect(result.message).not.toContain("otomatis")
    expect(mockMapelFindMany).not.toHaveBeenCalled()
    expect(mockKelasFindMany).not.toHaveBeenCalled()
    expect(mockGuruKelasCreateMany).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 2B: Guru admin dibuat dengan role ADMIN_AKADEMIK (bukan GURU)
  // agar konsisten dengan constraint DB chk_admin_role_consistency
  // --------------------------------------------------------
  it("harus membuat user ber-role ADMIN_AKADEMIK untuk guru dengan hak admin", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "admin-1", isAdmin: true })
    mockUserFindFirst.mockResolvedValue(null)
    mockGuruFindUnique.mockResolvedValue(null)
    mockCreateUser.mockResolvedValue({ data: { user: { id: "auth-2" } }, error: null })

    setupCreateTransaction()
    mockUserCreate.mockResolvedValue({ id: "user-admin" })
    mockGuruCreate.mockResolvedValue({ id: "guru-admin" })

    const result = await createAkunGuru({
      nama: "Guru Admin",
      email: "guruadmin@sekolah.sch.id",
      isAdmin: true,
    })

    expect(result.success).toBe(true)
    const userCreateData = mockUserCreate.mock.calls[0][0].data
    expect(userCreateData.role).toBe("ADMIN_AKADEMIK")
    expect(userCreateData.isAdmin).toBe(true)
  })

  // --------------------------------------------------------
  // KASUS 3: Tidak ada mapel/kelas aktif → sukses tanpa penugasan
  // --------------------------------------------------------
  it("harus tetap sukses meski tidak ada mapel atau kelas aktif", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "admin-1", isAdmin: true })
    mockUserFindFirst.mockResolvedValue(null)
    mockGuruFindUnique.mockResolvedValue(null)
    mockCreateUser.mockResolvedValue({ data: { user: { id: "auth-3" } }, error: null })

    mockMapelFindMany.mockResolvedValue([])
    mockKelasFindMany.mockResolvedValue([{ id: "kelas-1" }])

    setupCreateTransaction()
    mockUserCreate.mockResolvedValue({ id: "user-3" })
    mockGuruCreate.mockResolvedValue({ id: "guru-3" })

    const result = await createAkunGuru({
      nama: "Guru Tiga",
      email: "gurutiga@sekolah.sch.id",
      isAdmin: false,
    })

    expect(result.success).toBe(true)
    expect(mockGuruKelasCreateMany).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 4: Payload tidak valid → gagal sebelum menyentuh database
  // --------------------------------------------------------
  it("harus menolak payload yang tidak valid", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "admin-1", isAdmin: true })

    const result = await createAkunGuru({
      nama: "X",
      email: "bukan-email",
      isAdmin: false,
    })

    expect(result.success).toBe(false)
    expect(result.errors).toBeDefined()
    expect(mockUserFindFirst).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 5: Email sudah dipakai role GURU → ditolak
  // --------------------------------------------------------
  it("harus menolak email yang sudah terdaftar role GURU", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "admin-1", isAdmin: true })
    mockUserFindFirst.mockResolvedValue({
      id: "user-ada",
      email: "gurubaru@sekolah.sch.id",
      role: "GURU",
    })

    const result = await createAkunGuru({
      nama: "Guru Baru",
      email: "gurubaru@sekolah.sch.id",
      isAdmin: false,
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("Email sudah terdaftar")
  })
})

// ========================================================
// hapusAkunGuruPermanent — Hard Delete
// ========================================================

describe("hapusAkunGuruPermanent - Hard Delete", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const zeroCounts = {
    guru: { _count: { waliKelas: 0, catatanRapor: 0, ekskulDibina: 0 } },
    _count: {
      ujianDibuat: 0,
      tugasDibuat: 0,
      materiDiunggah: 0,
      absensiDiinput: 0,
      nilaiRaporDiinput: 0,
      catatanRaporDibuat: 0,
      transaksiDibuat: 0,
      transaksiDibatalkan: 0,
      pembayaranDikonfirmasi: 0,
      verifikasiPendaftaran: 0,
    },
  }

  const targetGuru = {
    id: "guru-2",
    nama: "Guru Dua",
    role: "GURU",
    authId: "auth-guru-2",
    guru: {
      id: "guru-record-2",
      _count: zeroCounts.guru._count,
    },
    _count: zeroCounts._count,
  }

  // --------------------------------------------------------
  // KASUS 1: Berhasil hapus permanen (bukan akun sendiri)
  // --------------------------------------------------------
  it("harus berhasil menghapus guru secara permanen", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "guru-admin-1", isAdmin: true })
    mockUserFindUnique.mockResolvedValue(targetGuru)
    // authId tidak dipakai role lain
    mockUserCount.mockResolvedValue(0)
    mockDeleteUserAuth.mockResolvedValue({ error: null })

    const result = await hapusAkunGuruPermanent("guru-2")

    expect(result.success).toBe(true)
    expect(result.message).toContain("berhasil dihapus secara permanen")

    // Auth dihapus, user dihapus (cascade)
    expect(mockDeleteUserAuth).toHaveBeenCalledWith("auth-guru-2")
    expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: "guru-2" } })
  })

  // --------------------------------------------------------
  // KASUS 2: Menolak menghapus akun diri sendiri
  // --------------------------------------------------------
  it("harus menolak menghapus akun diri sendiri", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "guru-admin-1", isAdmin: true })
    mockUserFindUnique.mockResolvedValue({
      ...targetGuru,
      id: "guru-admin-1",
    })

    const result = await hapusAkunGuruPermanent("guru-admin-1")

    expect(result.success).toBe(false)
    expect(result.message).toContain("diri sendiri")
    expect(mockUserDelete).not.toHaveBeenCalled()
    expect(mockDeleteUserAuth).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 3: Ditolak jika guru masih jadi wali kelas
  // --------------------------------------------------------
  it("harus menolak jika guru masih menjadi wali kelas", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "guru-admin-1", isAdmin: true })
    mockUserFindUnique.mockResolvedValue({
      ...targetGuru,
      guru: {
        id: "guru-record-2",
        _count: { waliKelas: 1, catatanRapor: 0, ekskulDibina: 0 },
      },
    })

    const result = await hapusAkunGuruPermanent("guru-2")

    expect(result.success).toBe(false)
    expect(result.message).toContain("wali kelas")
    expect(mockUserDelete).not.toHaveBeenCalled()
    expect(mockDeleteUserAuth).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 4: Ditolak jika guru memiliki riwayat membuat data
  // --------------------------------------------------------
  it("harus menolak jika guru memiliki riwayat data", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "guru-admin-1", isAdmin: true })
    mockUserFindUnique.mockResolvedValue({
      ...targetGuru,
      _count: {
        ...zeroCounts._count,
        ujianDibuat: 2,
        absensiDiinput: 1,
      },
    })

    const result = await hapusAkunGuruPermanent("guru-2")

    expect(result.success).toBe(false)
    expect(result.message).toContain("membuat ujian")
    expect(result.message).toContain("mengisi absensi")
    expect(mockUserDelete).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 5: Target user bukan role GURU → ditolak
  // --------------------------------------------------------
  it("harus menolak target yang bukan role GURU", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "guru-admin-1", isAdmin: true })
    mockUserFindUnique.mockResolvedValue({ id: "user-siswa", role: "SISWA" })

    const result = await hapusAkunGuruPermanent("user-siswa")

    expect(result.success).toBe(false)
    expect(result.message).toBe("Akun guru tidak ditemukan")
  })

  // --------------------------------------------------------
  // KASUS 6: requireGuruAdmin menolak (bukan admin) → error di-catch
  // --------------------------------------------------------
  it("harus gagal jika bukan guru admin", async () => {
    mockRequireGuruAdmin.mockRejectedValue(
      new Error("Akses ditolak: Fitur ini hanya untuk admin")
    )

    const result = await hapusAkunGuruPermanent("guru-2")

    expect(result.success).toBe(false)
    expect(result.message).toContain("hanya untuk admin")
    expect(mockUserFindUnique).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------
  // KASUS 7: Tidak menghapus auth Supabase jika authId dipakai role lain
  // --------------------------------------------------------
  it("harus tidak menghapus auth if dipakai role lain (multi-role)", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "guru-admin-1", isAdmin: true })
    mockUserFindUnique.mockResolvedValue(targetGuru)
    // 1 user lain pakai authId yang sama (multi-role)
    mockUserCount.mockResolvedValue(1)

    const result = await hapusAkunGuruPermanent("guru-2")

    expect(result.success).toBe(true)
    expect(mockDeleteUserAuth).not.toHaveBeenCalled()
    expect(mockUserDelete).toHaveBeenCalled()
  })
})

// ========================================================
// setGuruAdmin — Naik/Turunkan Hak Admin Guru + role consistency
// ========================================================

describe("setGuruAdmin - Role Consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus mengubah role ke ADMIN_AKADEMIK saat guru diangkat admin", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "admin-1", isAdmin: true })
    mockUserFindUnique.mockResolvedValue({
      id: "guru-2",
      nama: "Guru Dua",
      role: "GURU",
      guru: { id: "guru-record-2" },
    })
    mockUserUpdate.mockResolvedValue({})

    const result = await setGuruAdmin("guru-2", true)

    expect(result.success).toBe(true)
    expect(result.message).toContain("diangkat menjadi admin")
    const updateData = mockUserUpdate.mock.calls[0][0].data
    expect(updateData.isAdmin).toBe(true)
    expect(updateData.role).toBe("ADMIN_AKADEMIK")
  })

  it("harus mengembalikan role ke GURU saat admin diturunkan", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "admin-1", isAdmin: true })
    mockUserFindUnique.mockResolvedValue({
      id: "guru-2",
      nama: "Guru Dua",
      role: "ADMIN_AKADEMIK",
      guru: { id: "guru-record-2" },
    })
    mockUserUpdate.mockResolvedValue({})

    const result = await setGuruAdmin("guru-2", false)

    expect(result.success).toBe(true)
    expect(result.message).toContain("diturunkan dari admin")
    const updateData = mockUserUpdate.mock.calls[0][0].data
    expect(updateData.isAdmin).toBe(false)
    expect(updateData.role).toBe("GURU")
  })

  it("harus menolak target yang bukan role GURU", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "admin-1", isAdmin: true })
    mockUserFindUnique.mockResolvedValue({ id: "user-siswa", role: "SISWA" })

    const result = await setGuruAdmin("user-siswa", true)

    expect(result.success).toBe(false)
    expect(result.message).toBe("Akun guru tidak ditemukan")
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it("harus menolak mengubah status admin diri sendiri", async () => {
    mockRequireGuruAdmin.mockResolvedValue({ id: "admin-1", isAdmin: true })
    mockUserFindUnique.mockResolvedValue({
      id: "admin-1",
      nama: "Admin Satu",
      role: "GURU",
      guru: { id: "guru-record-1" },
    })

    const result = await setGuruAdmin("admin-1", true)

    expect(result.success).toBe(false)
    expect(result.message).toContain("diri sendiri")
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it("harus gagal jika dipanggil oleh non-admin", async () => {
    mockRequireGuruAdmin.mockRejectedValue(
      new Error("Akses ditolak: Fitur ini hanya untuk admin")
    )

    const result = await setGuruAdmin("guru-2", true)

    expect(result.success).toBe(false)
    expect(result.message).toContain("hanya untuk admin")
    expect(mockUserFindUnique).not.toHaveBeenCalled()
  })
})
