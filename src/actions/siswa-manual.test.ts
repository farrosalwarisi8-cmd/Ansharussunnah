// src/actions/siswa-manual.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  mockPrismaTransaction,
  mockUserFindFirst,
  mockUserCreate,
  mockOrangTuaFindUnique,
  mockSiswaFindUnique,
  mockParentStudentFindUnique,
  mockParentStudentCreate,
  mockCreateUser,
  mockListUsers,
} = vi.hoisted(() => ({
  mockPrismaTransaction: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockUserCreate: vi.fn(),
  mockOrangTuaFindUnique: vi.fn(),
  mockSiswaFindUnique: vi.fn(),
  mockParentStudentFindUnique: vi.fn(),
  mockParentStudentCreate: vi.fn(),
  mockCreateUser: vi.fn(),
  mockListUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
}))

vi.mock("@/lib/auth", () => ({
  requireGuruAdmin: vi.fn().mockResolvedValue({
    id: "guru-admin-1",
    email: "admin@sekolah.sch.id",
    role: "GURU",
    isAdmin: true,
  }),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findFirst: mockUserFindFirst,
      create: mockUserCreate,
    },
    orangTua: {
      findUnique: mockOrangTuaFindUnique,
    },
    siswa: {
      findUnique: mockSiswaFindUnique,
    },
    parentStudent: {
      findUnique: mockParentStudentFindUnique,
      create: mockParentStudentCreate,
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
      },
    },
  }),
}))

vi.mock("@/lib/password", () => ({
  generateSecurePassword: vi.fn().mockReturnValue("RandomSecurePass123!"),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { createSiswaManual } from "@/actions/siswa-manual"
import type { SiswaManualFormValues } from "@/lib/validations/siswa-manual"

// ========================================================
// Helper: payload valid untuk siswa manual
// ========================================================

function validPayload(overrides: Partial<SiswaManualFormValues> = {}): SiswaManualFormValues {
  return {
    namaLengkap: "Ahmad Fauzi",
    emailSiswa: "",
    nisn: "0081234567",
    nis: "001",
    tempatLahir: "Jakarta",
    tanggalLahir: "2015-01-15",
    jenisKelamin: "LAKI_LAKI",
    agama: "Islam",
    alamatSiswa: "Jl. Mawar No. 10, RT 01/RW 02, Kel. Sukamaju",
    noHpSiswa: "081298765432",
    namaOrangTua: "Bapak Ahmad",
    emailOrangTua: "ortu@example.com",
    noHpOrangTua: "081234567890",
    alamatOrangTua: "Jl. Melati No. 5",
    namaAyahKandung: "Budi Santoso",
    statusAyahKandung: "MASIH_HIDUP",
    nikAyah: "3201011501900001",
    namaIbuKandung: "Siti Rahmawati",
    statusIbuKandung: "MASIH_HIDUP",
    nikIbu: "3201011501900002",
    statusWali: "SAMA_DENGAN_AYAH",
    namaWali: undefined,
    kewarganegaraan: "WNI",
    kitas: undefined,
    asalNegara: undefined,
    kelasId: "kelas-1",
    passwordManual: undefined,
    ...overrides,
  }
}

function setupTransactionMock() {
  mockPrismaTransaction.mockImplementation(
    async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const tx = {
        user: {
          findFirst: mockUserFindFirst,
          create: mockUserCreate,
        },
        orangTua: {
          findUnique: mockOrangTuaFindUnique,
        },
        siswa: {
          findUnique: mockSiswaFindUnique,
        },
        parentStudent: {
          findUnique: mockParentStudentFindUnique,
          create: mockParentStudentCreate,
        },
      }
      return fn(tx)
    }
  )
}

// ========================================================
// 1. Siswa Baru — Orang Tua Baru (First Child)
// ========================================================

describe("createSiswaManual — First Child (New Parent)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus membuat akun siswa, orang tua, dan ParentStudent baru", async () => {
    // prisma.user.findFirst calls in order:
    // 1. check existing siswa email → null (no duplicate)
    // 2. check existing orangTua email → null (new parent)
    mockUserFindFirst
      .mockResolvedValueOnce(null) // siswa email check
      .mockResolvedValueOnce(null) // orangTua check

    // Auth ortu baru + auth siswa baru
    mockCreateUser
      .mockResolvedValueOnce({ data: { user: { id: "auth-ortu-new" } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: "auth-siswa-new" } }, error: null })

    setupTransactionMock()

    // Inside tx:
    // 1. tx.user.findFirst(ortu) → null → create ortu
    // 2. tx.user.create(siswa)
    mockUserFindFirst.mockResolvedValueOnce(null) // tx: ortu not found
    mockUserCreate
      .mockResolvedValueOnce({ id: "user-ortu-1", role: "ORANG_TUA" }) // tx: create ortu
      .mockResolvedValueOnce({ id: "user-siswa-1", role: "SISWA" }) // tx: create siswa
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-1" })
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-1" })
    mockParentStudentFindUnique.mockResolvedValue(null)

    const result = await createSiswaManual(validPayload())

    expect(result.success).toBe(true)
    expect(result.data?.orangTuaBaruDibuat).toBe(true)
    expect(result.data?.passwordOrangTua).toBeDefined()

    // Auth ortu dan siswa harus dibuat
    expect(mockCreateUser).toHaveBeenCalledTimes(2)

    // ParentStudent harus dibuat
    expect(mockParentStudentCreate).toHaveBeenCalledWith({
      data: {
        orangTuaId: "ortu-1",
        siswaId: "siswa-1",
        hubungan: "Orang Tua",
      },
    })
  })
})

// ========================================================
// 2. Siswa Baru — Orang Tua Sudah Ada (Second Child)
// ========================================================

describe("createSiswaManual — Second Child (Existing Parent)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus reuse akun orang tua yang sudah ada dan membuat ParentStudent baru", async () => {
    // prisma.user.findFirst calls in order:
    // 1. check existing siswa email → null (no duplicate for new student)
    // 2. check existing orangTua email → found!
    mockUserFindFirst
      .mockResolvedValueOnce(null) // siswa email check → no duplicate
      .mockResolvedValueOnce({
        id: "user-ortu-existing",
        email: "ortu@example.com",
        role: "ORANG_TUA",
        authId: "existing-ortu-auth",
      }) // orangTua check → found

    // Auth siswa baru saja (ortu reuse existing)
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-siswa-new" } },
      error: null,
    })

    setupTransactionMock()

    // Inside tx:
    // 1. tx.user.findFirst(ortu) → found → skip create
    // 2. tx.user.create(siswa)
    mockUserFindFirst.mockResolvedValueOnce({
      id: "user-ortu-existing",
      role: "ORANG_TUA",
    }) // tx: ortu found
    mockUserCreate.mockResolvedValueOnce({
      id: "user-siswa-new",
      role: "SISWA",
    }) // tx: create siswa
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-existing" })
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-new" })
    mockParentStudentFindUnique.mockResolvedValue(null)

    const result = await createSiswaManual(
      validPayload({
        namaLengkap: "Saudara Ahmad",
        nisn: "0081234568",
      })
    )

    expect(result.success).toBe(true)

    // Hanya auth siswa yang dibuat (ortu reuse)
    expect(mockCreateUser).toHaveBeenCalledTimes(1)

    // Password ortu tidak dikembalikan (sudah ada)
    expect(result.data?.passwordOrangTua).toBeUndefined()
    expect(result.data?.orangTuaBaruDibuat).toBe(false)

    // ParentStudent link dibuat
    expect(mockParentStudentCreate).toHaveBeenCalledWith({
      data: {
        orangTuaId: "ortu-existing",
        siswaId: "siswa-new",
        hubungan: "Orang Tua",
      },
    })
  })

  it("harus reuse auth ortu dari Supabase jika email sudah terdaftar di auth tapi belum di DB", async () => {
    // prisma.user.findFirst calls:
    // 1. siswa email check → null
    // 2. orangTua check → null (not in DB yet)
    mockUserFindFirst
      .mockResolvedValueOnce(null) // siswa email check
      .mockResolvedValueOnce(null) // orangTua check → not in DB

    // Tapi sudah ada di Supabase Auth
    mockCreateUser.mockResolvedValueOnce({
      data: null,
      error: { message: "User already been registered" },
    })
    mockListUsers.mockResolvedValueOnce({
      data: {
        users: [{ id: "existing-supabase-auth", email: "ortu@example.com" }],
      },
      error: null,
    })
    // Auth siswa baru
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-siswa-new" } },
      error: null,
    })

    setupTransactionMock()

    // Inside tx: ortu not found in DB → create new
    mockUserFindFirst.mockResolvedValueOnce(null) // tx: ortu not found
    mockUserCreate
      .mockResolvedValueOnce({ id: "user-ortu-new", role: "ORANG_TUA" })
      .mockResolvedValueOnce({ id: "user-siswa-new", role: "SISWA" })
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-new" })
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-new" })
    mockParentStudentFindUnique.mockResolvedValue(null)

    const result = await createSiswaManual(validPayload())

    expect(result.success).toBe(true)

    // listUsers dipanggil untuk resolve existing auth
    expect(mockListUsers).toHaveBeenCalledTimes(1)

    // ParentStudent tetap dibuat
    expect(mockParentStudentCreate).toHaveBeenCalled()
  })
})

// ========================================================
// 3. Duplicate ParentStudent Guard
// ========================================================

describe("createSiswaManual — Duplicate ParentStudent Guard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus skip ParentStudent create jika relasi sudah ada", async () => {
    // prisma.user.findFirst calls:
    // 1. siswa email check → null
    // 2. orangTua check → found
    mockUserFindFirst
      .mockResolvedValueOnce(null) // siswa email check
      .mockResolvedValueOnce({
        id: "user-ortu-existing",
        email: "ortu@example.com",
        role: "ORANG_TUA",
        authId: "existing-ortu-auth",
      })

    // Auth siswa baru
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-siswa-new" } },
      error: null,
    })

    setupTransactionMock()

    // Inside tx
    mockUserFindFirst.mockResolvedValueOnce({
      id: "user-ortu-existing",
      role: "ORANG_TUA",
    })
    mockUserCreate.mockResolvedValueOnce({
      id: "user-siswa-new",
      role: "SISWA",
    })
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-existing" })
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-new" })

    // Relasi sudah ada
    mockParentStudentFindUnique.mockResolvedValue({
      id: "ps-existing",
      orangTuaId: "ortu-existing",
      siswaId: "siswa-new",
    })

    const result = await createSiswaManual(validPayload())

    expect(result.success).toBe(true)

    // ParentStudent create TIDAK dipanggil karena relasi sudah ada
    expect(mockParentStudentCreate).not.toHaveBeenCalled()
  })
})

// ========================================================
// 4. Tiga Anak — Satu Email Orang Tua
// ========================================================

describe("createSiswaManual — Three Children, Same Parent Email", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus bisa membuat 3 siswa berbeda dengan 1 email orang tua", async () => {
    const students = [
      { nama: "Anak Pertama", nisn: "0081000001" },
      { nama: "Anak Kedua", nisn: "0081000002" },
      { nama: "Anak Ketiga", nisn: "0081000003" },
    ]

    for (let i = 0; i < students.length; i++) {
      vi.clearAllMocks()

      // prisma.user.findFirst calls:
      // 1. siswa email check → null
      // 2. orangTua check → found (after first iteration)
      mockUserFindFirst
        .mockResolvedValueOnce(null) // siswa email check
        .mockResolvedValueOnce({
          id: "user-ortu-existing",
          email: "ortu@example.com",
          role: "ORANG_TUA",
          authId: "existing-ortu-auth",
        }) // orangTua check → found

      // Auth siswa baru
      mockCreateUser.mockResolvedValueOnce({
        data: { user: { id: `auth-siswa-${i}` } },
        error: null,
      })

      setupTransactionMock()

      // Inside tx
      mockUserFindFirst.mockResolvedValueOnce({
        id: "user-ortu-existing",
        role: "ORANG_TUA",
      })
      mockUserCreate.mockResolvedValueOnce({
        id: `user-siswa-${i}`,
        role: "SISWA",
      })
      mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-existing" })
      mockSiswaFindUnique.mockResolvedValue({ id: `siswa-${i}` })
      mockParentStudentFindUnique.mockResolvedValue(null)

      const result = await createSiswaManual(
        validPayload({
          namaLengkap: students[i].nama,
          nisn: students[i].nisn,
          emailSiswa: "",
        })
      )

      expect(result.success).toBe(true)

      // Hanya auth siswa yang dibuat (ortu reuse)
      expect(mockCreateUser).toHaveBeenCalledTimes(1)

      // ParentStudent link dibuat
      expect(mockParentStudentCreate).toHaveBeenCalledWith({
        data: {
          orangTuaId: "ortu-existing",
          siswaId: `siswa-${i}`,
          hubungan: "Orang Tua",
        },
      })
    }
  })
})
