// src/actions/verifikasi.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  mockPrismaTransaction,
  mockPendaftaranFindUnique,
  mockPendaftaranUpdate,
  mockDeleteUser,
  mockCreateUser,
  mockListUsers,
} = vi.hoisted(() => ({
  mockPrismaTransaction: vi.fn(),
  mockPendaftaranFindUnique: vi.fn(),
  mockPendaftaranUpdate: vi.fn(),
  mockDeleteUser: vi.fn().mockResolvedValue({ error: null }),
  mockCreateUser: vi.fn(),
  mockListUsers: vi.fn().mockResolvedValue({ 
    data: { users: [] },
    error: null 
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
    buktiTransferPendaftaran: { update: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    orangTua: { findUnique: vi.fn() },
    siswa: { findUnique: vi.fn() },
    parentStudent: { create: vi.fn() },
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

const mockPendaftaran = {
  id: "pend-1",
  nomorPendaftaran: "REG-2026-00001",
  namaLengkap: "Ahmad",
  emailOrangTua: "ortu@example.com",
  namaOrangTua: "Bapak Ahmad",
  noHpOrangTua: "081234567890",
  alamatSiswa: "Jakarta",
  alamatOrangTua: null,
  tempatLahir: "Jakarta",
  tanggalLahir: new Date("2015-01-01"),
  jenisKelamin: "LAKI_LAKI",
  nisn: null,
  kelasTujuanId: "kelas-1",
  buktiTransfer: [{ id: "bt-1" }],
  status: "MENUNGGU_VERIFIKASI",
}

describe("verifikasiPendaftaran - DITERIMA (Atomicity check)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus menghapus user auth yang baru dibuat jika database transaction gagal", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(mockPendaftaran)

    mockCreateUser
      .mockResolvedValueOnce({
        data: { user: { id: "auth-ortu-uuid", email: "ortu@example.com" } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: "auth-siswa-uuid", email: "siswa.reg202600001@sekolah.internal" } },
        error: null,
      })

    mockPrismaTransaction.mockRejectedValue(new Error("Database connection timeout"))

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    })

    // Pastikan verifikasi gagal
    expect(result.success).toBe(false)
    expect(result.message).toBeTruthy() // Ada error message

    // ✅ YANG PENTING: Pastikan rollback deleteUser dipanggil (2 kali: ortu + siswa)
    expect(mockDeleteUser).toHaveBeenCalledTimes(2)
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-ortu-uuid")
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-siswa-uuid")
  })

  it("harus menghapus hanya siswa jika ortu sudah ada sebelumnya", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(mockPendaftaran)

    mockCreateUser
      .mockResolvedValueOnce({
        data: null,
        error: { message: "User already been registered" },
      })

    mockListUsers.mockResolvedValueOnce({
      data: { 
        users: [{ id: "existing-ortu-uuid", email: "ortu@example.com" }] 
      },
      error: null,
    })

    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-siswa-uuid" } },
      error: null,
    })

    mockPrismaTransaction.mockRejectedValue(new Error("DB Error"))

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    })

    expect(result.success).toBe(false)

    // ✅ Hanya siswa yang di-rollback (karena ortu sudah ada sebelumnya)
    expect(mockDeleteUser).toHaveBeenCalledTimes(1)
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-siswa-uuid")
    expect(mockDeleteUser).not.toHaveBeenCalledWith("existing-ortu-uuid")
  })
})