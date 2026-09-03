// src/actions/verifikasi.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  mockPrismaTransaction,
  mockPendaftaranFindUnique,
  mockPendaftaranUpdate,
  mockDeleteUser,
  mockCreateUser,
  mockListUsers,
  mockUserFindUnique,
  mockUserCreate,
  mockOrangTuaFindUnique,
  mockSiswaFindUnique,
  mockParentStudentCreate,
  mockBuktiTransferUpdate,
  mockKelasFindUnique,
} = vi.hoisted(() => ({
  mockPrismaTransaction: vi.fn(),
  mockPendaftaranFindUnique: vi.fn(),
  mockPendaftaranUpdate: vi.fn(),
  mockDeleteUser: vi.fn().mockResolvedValue({ error: null }),
  mockCreateUser: vi.fn(),
  mockListUsers: vi.fn().mockResolvedValue({
    data: { users: [] },
    error: null,
  }),
  mockUserFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
  mockOrangTuaFindUnique: vi.fn(),
  mockSiswaFindUnique: vi.fn(),
  mockParentStudentCreate: vi.fn(),
  mockBuktiTransferUpdate: vi.fn(),
  mockKelasFindUnique: vi.fn().mockResolvedValue({
    id: "kelas-1",
    nama: "Kelas 1",
    kapasitas: 30,
    _count: { siswa: 5 },
  }),
}))

vi.mock("@/lib/auth", () => ({
  requireGuru: vi.fn().mockResolvedValue({
    id: "guru-1",
    email: "guru@sekolah.sch.id",
    role: "GURU",
  }),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    pendaftaran: {
      findUnique: mockPendaftaranFindUnique,
      update: mockPendaftaranUpdate,
    },
    kelas: {
      findUnique: mockKelasFindUnique,
    },
    buktiTransferPendaftaran: { update: mockBuktiTransferUpdate },
    user: {
      findUnique: mockUserFindUnique,
      findFirst: mockUserFindUnique,
      create: mockUserCreate,
    },
    orangTua: {
      findUnique: mockOrangTuaFindUnique,
    },
    siswa: {
      findUnique: mockSiswaFindUnique,
    },
    parentStudent: {
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
        deleteUser: mockDeleteUser,
        listUsers: mockListUsers,
      },
    },
  }),
}))

vi.mock("@/lib/password", () => ({
  generateSecurePassword: vi.fn().mockReturnValue("RandomSecurePass123!"),
}))

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  buildKredensialEmail: vi.fn().mockReturnValue("<html>Email</html>"),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { verifikasiPendaftaran } from "@/actions/verifikasi"

// ========================================================
// Data dummy — pendaftaran dengan semua field EMIS terisi
// ========================================================

const pendaftaranWithEmis = {
  id: "pend-1",
  nomorPendaftaran: "REG-2026-00001",
  namaLengkap: "Ahmad Fauzi",
  emailOrangTua: "ortu@example.com",
  namaOrangTua: "Bapak Ahmad",
  noHpOrangTua: "081234567890",
  alamatSiswa: "Jl. Mawar No. 10, RT 01/RW 02, Kel. Sukamaju",
  alamatOrangTua: "Jl. Melati No. 5",
  tempatLahir: "Jakarta",
  tanggalLahir: new Date("2015-01-15"),
  jenisKelamin: "LAKI_LAKI",
  nisn: "0081234567",
  // Field EMIS
  agama: "Islam",
  noHpSiswa: "081298765432",
  namaAyahKandung: "Budi Santoso",
  statusAyahKandung: "MASIH_HIDUP",
  nikAyah: "3201011501900001",
  namaIbuKandung: "Siti Rahmawati",
  statusIbuKandung: "MASIH_HIDUP",
  nikIbu: "3201011501900002",
  statusWali: "SAMA_DENGAN_AYAH",
  namaWali: null,
  kewarganegaraan: "WNI",
  kitas: null,
  asalNegara: null,
  kelasTujuanId: "kelas-1",
  buktiTransfer: [{ id: "bt-1" }],
  status: "MENUNGGU_VERIFIKASI",
}

const pendaftaranMinimal = {
  id: "pend-2",
  nomorPendaftaran: "REG-2026-00002",
  namaLengkap: "Siswa Minimal",
  emailOrangTua: "ortumin@example.com",
  namaOrangTua: "Orang Tua Minimal",
  noHpOrangTua: "085612345678",
  alamatSiswa: "Jl. Kenanga No. 20, RT 05/RW 03, Kel. Sukamaju",
  alamatOrangTua: null,
  tempatLahir: "Bandung",
  tanggalLahir: new Date("2012-03-10"),
  jenisKelamin: "PEREMPUAN",
  nisn: null,
  // Field EMIS semua kosong/null
  agama: null,
  noHpSiswa: null,
  namaAyahKandung: null,
  statusAyahKandung: null,
  nikAyah: null,
  namaIbuKandung: null,
  statusIbuKandung: null,
  nikIbu: null,
  statusWali: null,
  namaWali: null,
  kewarganegaraan: "WNI",
  kitas: null,
  asalNegara: null,
  kelasTujuanId: null,
  buktiTransfer: [{ id: "bt-2" }],
  status: "MENUNGGU_VERIFIKASI",
}

const pendaftaranWna = {
  id: "pend-3",
  nomorPendaftaran: "REG-2026-00003",
  namaLengkap: "Ahmad Al-Farisi",
  emailOrangTua: "mohammed@email.com",
  namaOrangTua: "Mohammed Al-Farisi",
  noHpOrangTua: "081234567890",
  alamatSiswa: "Jl. Internasional No. 10, Jakarta Selatan",
  alamatOrangTua: null,
  tempatLahir: "Kuala Lumpur",
  tanggalLahir: new Date("2010-06-15"),
  jenisKelamin: "LAKI_LAKI",
  nisn: null,
  agama: "Islam",
  noHpSiswa: null,
  namaAyahKandung: "Mohammed Al-Farisi",
  statusAyahKandung: "MASIH_HIDUP",
  nikAyah: null,
  namaIbuKandung: "Fatimah Al-Farisi",
  statusIbuKandung: "MASIH_HIDUP",
  nikIbu: null,
  statusWali: "SAMA_DENGAN_AYAH",
  namaWali: null,
  kewarganegaraan: "WNA",
  kitas: "KITAS-2024-001",
  asalNegara: "Malaysia",
  kelasTujuanId: "kelas-1",
  buktiTransfer: [{ id: "bt-3" }],
  status: "MENUNGGU_VERIFIKASI",
}

// ========================================================
// Helper: setup transaction mock yang mengeksekusi callback
// ========================================================

function setupTransactionMock() {
  mockPrismaTransaction.mockImplementation(
    async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const tx = {
        user: {
          findUnique: mockUserFindUnique,
          findFirst: mockUserFindUnique,
          create: mockUserCreate,
        },
        orangTua: {
          findUnique: mockOrangTuaFindUnique,
        },
        siswa: {
          findUnique: mockSiswaFindUnique,
        },
        parentStudent: {
          create: mockParentStudentCreate,
        },
        pendaftaran: {
          update: mockPendaftaranUpdate,
        },
        buktiTransferPendaftaran: {
          update: mockBuktiTransferUpdate,
        },
      }
      return fn(tx)
    }
  )
}

function setupAuthMocks(ortuEmail = "ortu@example.com") {
  mockCreateUser
    .mockResolvedValueOnce({
      data: { user: { id: "auth-ortu-uuid", email: ortuEmail } },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { user: { id: "auth-siswa-uuid" } },
      error: null,
    })
}

// ========================================================
// 1. EMIS Fields Copy — Field Lengkap
// ========================================================

describe("verifikasiPendaftaran — EMIS Fields Copy (Field Lengkap)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus copy SEMUA field EMIS dari Pendaftaran ke Siswa saat approve", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis)
    setupAuthMocks()
    setupTransactionMock()

    mockUserFindUnique
      .mockResolvedValueOnce(null) // ortu tidak ada → buat baru
    // user.create untuk ortu
    mockUserCreate
      .mockResolvedValueOnce({ id: "user-ortu-1", role: "ORANG_TUA" })
      // user.create untuk siswa
      .mockResolvedValueOnce({ id: "user-siswa-1", role: "SISWA" })
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-1" })
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-1" })

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    })

    expect(result.success).toBe(true)

    const userCreateCalls = mockUserCreate.mock.calls
    // find the user.create call for SISWA (nested under data)
    const siswaCreateCall = userCreateCalls.find(
      (call) => call[0]?.data?.role === "SISWA"
    )

    expect(siswaCreateCall).toBeDefined()
    const siswaData = siswaCreateCall![0].data.siswa.create

    // ✅ Verifikasi SEMUA field EMIS ter-copy dengan benar
    expect(siswaData.agama).toBe("Islam")
    expect(siswaData.noHpSiswa).toBe("081298765432")
    expect(siswaData.namaAyahKandung).toBe("Budi Santoso")
    expect(siswaData.statusAyahKandung).toBe("MASIH_HIDUP")
    expect(siswaData.nikAyah).toBe("3201011501900001")
    expect(siswaData.namaIbuKandung).toBe("Siti Rahmawati")
    expect(siswaData.statusIbuKandung).toBe("MASIH_HIDUP")
    expect(siswaData.nikIbu).toBe("3201011501900002")
    expect(siswaData.statusWali).toBe("SAMA_DENGAN_AYAH")
    expect(siswaData.namaWali).toBeNull()
    expect(siswaData.kewarganegaraan).toBe("WNI")
    expect(siswaData.kitas).toBeNull()
    expect(siswaData.asalNegara).toBeNull()

    // Field dasar juga harus ter-copy
    expect(siswaData.nisn).toBe("0081234567")
    expect(siswaData.tempatLahir).toBe("Jakarta")
    expect(siswaData.jenisKelamin).toBe("LAKI_LAKI")
    expect(siswaData.alamat).toBe(pendaftaranWithEmis.alamatSiswa)
    expect(siswaData.kelasId).toBe("kelas-1")
    expect(siswaData.pendaftaranId).toBe("pend-1")
  })

  it("harus copy field EMIS dengan null jika tidak diisi di pendaftaran", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranMinimal)
    setupAuthMocks("ortumin@example.com")
    setupTransactionMock()

    mockUserFindUnique
      .mockResolvedValueOnce(null)
    mockUserCreate
      .mockResolvedValueOnce({ id: "user-ortu-2", role: "ORANG_TUA" })
      .mockResolvedValueOnce({ id: "user-siswa-2", role: "SISWA" })
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-2" })
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-2" })

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-2",
      status: "DITERIMA",
    })

    expect(result.success).toBe(true)

    const userCreateCalls = mockUserCreate.mock.calls
    const siswaCreateCall = userCreateCalls.find(
      (call) => call[0]?.data?.role === "SISWA"
    )
    const siswaData = siswaCreateCall![0].data.siswa.create

    // ✅ Semua field EMIS harus null
    expect(siswaData.agama).toBeNull()
    expect(siswaData.noHpSiswa).toBeNull()
    expect(siswaData.namaAyahKandung).toBeNull()
    expect(siswaData.statusAyahKandung).toBeNull()
    expect(siswaData.nikAyah).toBeNull()
    expect(siswaData.namaIbuKandung).toBeNull()
    expect(siswaData.statusIbuKandung).toBeNull()
    expect(siswaData.nikIbu).toBeNull()
    expect(siswaData.statusWali).toBeNull()
    expect(siswaData.namaWali).toBeNull()
    expect(siswaData.kewarganegaraan).toBe("WNI")
    expect(siswaData.kitas).toBeNull()
    expect(siswaData.asalNegara).toBeNull()
  })

  it("harus copy field WNA (KITAS + asalNegara) dan NIK null ke Siswa", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWna)
    setupAuthMocks("mohammed@email.com")
    setupTransactionMock()

    mockUserFindUnique
      .mockResolvedValueOnce(null)
    mockUserCreate
      .mockResolvedValueOnce({ id: "user-ortu-3", role: "ORANG_TUA" })
      .mockResolvedValueOnce({ id: "user-siswa-3", role: "SISWA" })
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-3" })
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-3" })

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-3",
      status: "DITERIMA",
    })

    expect(result.success).toBe(true)

    const userCreateCalls = mockUserCreate.mock.calls
    const siswaCreateCall = userCreateCalls.find(
      (call) => call[0]?.data?.role === "SISWA"
    )
    const siswaData = siswaCreateCall![0].data.siswa.create

    // ✅ Field WNA ter-copy
    expect(siswaData.kewarganegaraan).toBe("WNA")
    expect(siswaData.kitas).toBe("KITAS-2024-001")
    expect(siswaData.asalNegara).toBe("Malaysia")
    // NIK ayah/ibu null untuk WNA
    expect(siswaData.nikAyah).toBeNull()
    expect(siswaData.nikIbu).toBeNull()
    // Agama tetap ter-copy
    expect(siswaData.agama).toBe("Islam")
    expect(siswaData.namaAyahKandung).toBe("Mohammed Al-Farisi")
    expect(siswaData.namaIbuKandung).toBe("Fatimah Al-Farisi")
  })
})

// ========================================================
// 2. Atomicity Check — Rollback
// ========================================================

describe("verifikasiPendaftaran - DITERIMA (Atomicity check)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus menghapus user auth yang baru dibuat jika database transaction gagal", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranMinimal)

    mockCreateUser
      .mockResolvedValueOnce({
        data: { user: { id: "auth-ortu-uuid", email: "ortumin@example.com" } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: "auth-siswa-uuid" } },
        error: null,
      })

    mockPrismaTransaction.mockRejectedValue(new Error("Database connection timeout"))

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-2",
      status: "DITERIMA",
    })

    expect(result.success).toBe(false)
    expect(result.message).toBeTruthy()

    expect(mockDeleteUser).toHaveBeenCalledTimes(2)
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-ortu-uuid")
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-siswa-uuid")
  })

  it("harus menghapus hanya siswa jika ortu sudah ada sebelumnya", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranMinimal)

    mockCreateUser
      .mockResolvedValueOnce({
        data: null,
        error: { message: "User already been registered" },
      })

    mockListUsers.mockResolvedValueOnce({
      data: {
        users: [{ id: "existing-ortu-uuid", email: "ortumin@example.com" }],
      },
      error: null,
    })

    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-siswa-uuid" } },
      error: null,
    })

    mockPrismaTransaction.mockRejectedValue(new Error("DB Error"))

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-2",
      status: "DITERIMA",
    })

    expect(result.success).toBe(false)

    expect(mockDeleteUser).toHaveBeenCalledTimes(1)
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-siswa-uuid")
    expect(mockDeleteUser).not.toHaveBeenCalledWith("existing-ortu-uuid")
  })
})

// ========================================================
// 3. Penolakan Pendaftaran
// ========================================================

describe("verifikasiPendaftaran — DITOLAK", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus berhasil menolak pendaftaran dengan alasan", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis)
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        return fn({
          pendaftaran: { update: mockPendaftaranUpdate },
          buktiTransferPendaftaran: { update: mockBuktiTransferUpdate },
        })
      }
    )

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITOLAK",
      alasanPenolakan: "Dokumen tidak lengkap",
    })

    expect(result.success).toBe(true)
    expect(result.message).toContain("DITOLAK")
    expect(mockPendaftaranUpdate).toHaveBeenCalledOnce()
    expect(mockBuktiTransferUpdate).toHaveBeenCalledOnce()
  })

  it("harus gagal menolak tanpa alasanPenolakan", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis)

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITOLAK",
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("Alasan penolakan wajib diisi")
    expect(mockPrismaTransaction).not.toHaveBeenCalled()
  })
})

// ========================================================
// 4. Edge Cases
// ========================================================

describe("verifikasiPendaftaran — Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus gagal jika pendaftaran tidak ditemukan", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(null)

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-inexist",
      status: "DITERIMA",
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("tidak ditemukan")
    expect(mockPrismaTransaction).not.toHaveBeenCalled()
  })

  it("harus gagal dengan payload tidak valid", async () => {
    const result = await verifikasiPendaftaran({
      pendaftaranId: "",
      status: "INVALID",
    } as any)

    expect(result.success).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it("harus default kewarganegaraan ke WNI jika null di pendaftaran", async () => {
    const pendaftaranTanpaKewarganegaraan = {
      ...pendaftaranMinimal,
      kewarganegaraan: null,
    }
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranTanpaKewarganegaraan)
    setupAuthMocks("ortumin@example.com")
    setupTransactionMock()

    mockUserFindUnique
      .mockResolvedValueOnce(null)
    mockUserCreate
      .mockResolvedValueOnce({ id: "user-ortu-4", role: "ORANG_TUA" })
      .mockResolvedValueOnce({ id: "user-siswa-4", role: "SISWA" })
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-4" })
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-4" })

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-2",
      status: "DITERIMA",
    })

    expect(result.success).toBe(true)

    const userCreateCalls = mockUserCreate.mock.calls
    const siswaCreateCall = userCreateCalls.find(
      (call) => call[0]?.data?.role === "SISWA"
    )
    const siswaData = siswaCreateCall![0].data.siswa.create

    expect(siswaData.kewarganegaraan).toBe("WNI")
  })
})

// ========================================================
// 5. Multi-Child — Satu Email Orang Tua, Banyak Anak
// ========================================================

describe("verifikasiPendaftaran — Multi-Child (Same Parent Email)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus reuse akun orang tua yang sudah ada saat approve pendaftaran anak kedua dengan email yang sama", async () => {
    // Pendaftaran anak kedua dengan email orang tua yang sama
    const pendaftaranAnakKedua = {
      ...pendaftaranMinimal,
      id: "pend-child-2",
      nomorPendaftaran: "REG-2026-00003",
      namaLengkap: "Saudara Ahmad",
      emailOrangTua: "ortu@example.com", // email sama dengan pendaftaranWithEmis
      namaOrangTua: "Bapak Ahmad",
    }
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranAnakKedua)

    // Supabase Auth: email sudah terdaftar → error "already been registered"
    mockCreateUser.mockResolvedValueOnce({
      data: null,
      error: { message: "User already been registered" },
    })
    mockListUsers.mockResolvedValueOnce({
      data: {
        users: [{ id: "existing-ortu-auth-uuid", email: "ortu@example.com" }],
      },
      error: null,
    })
    // Auth siswa baru
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-siswa-child2-uuid" } },
      error: null,
    })

    setupTransactionMock()

    // findFirst(ortu) → sudah ada (anak baru)
    mockUserFindUnique.mockResolvedValueOnce({ id: "user-ortu-existing", role: "ORANG_TUA" })
    mockUserCreate.mockResolvedValueOnce({ id: "user-siswa-child2", role: "SISWA" })
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-existing" })
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-child2" })

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-child-2",
      status: "DITERIMA",
    })

    expect(result.success).toBe(true)

    // Verify: tidak membuat auth orang tua baru
    // mockCreateUser dipanggil 2x: 1x ortu (gagal already exists), 1x siswa
    expect(mockCreateUser).toHaveBeenCalledTimes(2)

    // Verify: listUsers dipanggil untuk resolve existing auth
    expect(mockListUsers).toHaveBeenCalledTimes(1)

    // Verify: User.findFirst dipanggil untuk ortu (found existing)
    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: "ORANG_TUA",
        }),
      })
    )

    // Verify: ParentStudent link dibuat untuk anak kedua
    expect(mockParentStudentCreate).toHaveBeenCalledWith({
      data: {
        orangTuaId: "ortu-existing",
        siswaId: "siswa-child2",
        hubungan: "Orang Tua",
      },
    })

    // Verify: tidak membuat User baru untuk ortu (reuse existing)
    const ortuCreateCalls = mockUserCreate.mock.calls.filter(
      (call) => call[0]?.data?.role === "ORANG_TUA"
    )
    expect(ortuCreateCalls).toHaveLength(0)
  })

  it("harus membuat ParentStudent baru meskipun ortu sudah link ke anak lain", async () => {
    // Skenario: ortu sudah punya 1 anak, sekarang daftarkan anak ke-2
    const pendaftaranAnakKetiga = {
      ...pendaftaranMinimal,
      id: "pend-child-3",
      nomorPendaftaran: "REG-2026-00004",
      namaLengkap: "Anak Ketiga",
      emailOrangTua: "ortu@example.com",
      namaOrangTua: "Bapak Ahmad",
    }
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranAnakKetiga)

    // Auth ortu sudah ada
    mockCreateUser.mockResolvedValueOnce({
      data: null,
      error: { message: "User already been registered" },
    })
    mockListUsers.mockResolvedValueOnce({
      data: {
        users: [{ id: "existing-ortu-auth-uuid", email: "ortu@example.com" }],
      },
      error: null,
    })
    // Auth siswa baru
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-siswa-child3-uuid" } },
      error: null,
    })

    setupTransactionMock()

    mockUserFindUnique.mockResolvedValueOnce({ id: "user-ortu-existing", role: "ORANG_TUA" })
    mockUserCreate.mockResolvedValueOnce({ id: "user-siswa-child3", role: "SISWA" })
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-existing" })
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-child3" })

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-child-3",
      status: "DITERIMA",
    })

    expect(result.success).toBe(true)

    // ParentStudent harus dibuat dengan ortu yang sama, siswa yang baru
    expect(mockParentStudentCreate).toHaveBeenCalledWith({
      data: {
        orangTuaId: "ortu-existing",
        siswaId: "siswa-child3",
        hubungan: "Orang Tua",
      },
    })
  })

  it("harus skip buktiTransfer update jika latestBuktiId null (anak kedua tanpa bukti baru)", async () => {
    const pendaftaranTanpaBukti = {
      ...pendaftaranMinimal,
      id: "pend-child-4",
      nomorPendaftaran: "REG-2026-00005",
      namaLengkap: "Anak Keempat",
      emailOrangTua: "ortu@example.com",
      namaOrangTua: "Bapak Ahmad",
      buktiTransfer: [], // tidak ada bukti transfer
    }
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranTanpaBukti)

    mockCreateUser.mockResolvedValueOnce({
      data: null,
      error: { message: "User already been registered" },
    })
    mockListUsers.mockResolvedValueOnce({
      data: {
        users: [{ id: "existing-ortu-auth-uuid", email: "ortu@example.com" }],
      },
      error: null,
    })
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-siswa-child4-uuid" } },
      error: null,
    })

    setupTransactionMock()

    mockUserFindUnique.mockResolvedValueOnce({ id: "user-ortu-existing", role: "ORANG_TUA" })
    mockUserCreate.mockResolvedValueOnce({ id: "user-siswa-child4", role: "SISWA" })
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-existing" })
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-child4" })

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-child-4",
      status: "DITERIMA",
    })

    expect(result.success).toBe(true)

    // buktiTransfer update tidak dipanggil karena tidak ada bukti
    expect(mockBuktiTransferUpdate).not.toHaveBeenCalled()

    // ParentStudent tetap dibuat
    expect(mockParentStudentCreate).toHaveBeenCalled()
  })
})