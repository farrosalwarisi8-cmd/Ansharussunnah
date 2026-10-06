// src/actions/approval-flow.test.ts
//
// Regression tests: approval flow tanpa verifikasi email/OTP.
//
// Kontrak yang diuji:
//   - Bukti pembayaran ada + email belum terverifikasi → approval berhasil
//   - Bukti pembayaran tidak ada → approval ditolak dengan pesan jelas
//   - Status MENUNGGU_PEMBAYARAN → approval ditolak
//   - Status MENUNGGU_VERIFIKASI → tombol Terima dapat diproses
//   - Bukti terakhir diubah menjadi DITERIMA saat approval sukses
//   - Tidak ada double approval
//   - NISN duplikat ditolak tanpa membuat akun baru
//   - Kelas invalid ditolak tanpa membuat akun baru
//   - Kapasitas kelas penuh ditolak

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockPrismaTransaction,
  mockPendaftaranFindUnique,
  mockPendaftaranFindFirst,
  mockPendaftaranUpdate,
  mockPendaftaranUpdateMany,
  mockDeleteUser,
  mockCreateUser,
  mockListUsers,
  mockUserFindUnique,
  mockUserCreate,
  mockOrangTuaFindUnique,
  mockSiswaFindUnique,
  mockSiswaCreate,
  mockParentStudentCreate,
  mockParentStudentFindUnique,
  mockBuktiTransferUpdate,
  mockSiswaUpdate,
  mockSalinDokumen,
  mockStorageRemove,
  mockKelasFindUnique,
} = vi.hoisted(() => ({
  mockPrismaTransaction: vi.fn(),
  mockPendaftaranFindUnique: vi.fn(),
  mockPendaftaranFindFirst: vi.fn().mockResolvedValue(null),
  mockPendaftaranUpdate: vi.fn(),
  mockPendaftaranUpdateMany: vi.fn().mockResolvedValue({ count: 1 }),
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
  mockSiswaCreate: vi.fn(),
  mockParentStudentCreate: vi.fn(),
  mockParentStudentFindUnique: vi.fn().mockResolvedValue(null),
  mockBuktiTransferUpdate: vi.fn(),
  mockSiswaUpdate: vi.fn(),
  mockSalinDokumen: vi.fn(),
  mockStorageRemove: vi.fn().mockResolvedValue({ error: null }),
  mockKelasFindUnique: vi.fn().mockResolvedValue({
    id: "kelas-1",
    nama: "Kelas 1",
    kapasitas: 30,
    _count: { siswa: 5 },
  }),
}));

vi.mock("@/lib/auth", () => ({
  requireGuruAdmin: vi.fn().mockResolvedValue({
    id: "guru-1",
    email: "guru@sekolah.sch.id",
    role: "GURU",
  }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    pendaftaran: {
      findUnique: mockPendaftaranFindUnique,
      findFirst: mockPendaftaranFindFirst,
      update: mockPendaftaranUpdate,
      updateMany: mockPendaftaranUpdateMany,
      count: vi.fn().mockResolvedValue(0),
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
      create: mockSiswaCreate,
      update: mockSiswaUpdate,
    },
    parentStudent: {
      create: mockParentStudentCreate,
      findUnique: mockParentStudentFindUnique,
    },
    $transaction: mockPrismaTransaction,
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: () => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
        listUsers: mockListUsers,
      },
    },
    storage: {
      from: () => ({
        remove: mockStorageRemove,
      }),
    },
  }),
}));

vi.mock("@/lib/password", () => ({
  generateSecurePassword: vi.fn().mockReturnValue("RandomSecurePass123!"),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  buildKredensialEmail: vi.fn().mockReturnValue("<html>Email</html>"),
  buildKredensialEmailAnakKedua: vi
    .fn()
    .mockReturnValue("<html>Email Anak Kedua</html>"),
  buildPemberitahuanRoleBaruEmail: vi
    .fn()
    .mockReturnValue("<html>Pemberitahuan Role</html>"),
  sendPendaftaranDitolakEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/salin-dokumen-pendaftaran", () => ({
  salinDokumenPendaftaranKeSiswa: (...args: unknown[]) =>
    mockSalinDokumen(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { verifikasiPendaftaran } from "@/actions/verifikasi";

function setupBaseMocks() {
  mockPendaftaranFindUnique.mockReset().mockResolvedValue({
    id: "pend-1",
    nomorPendaftaran: "REG-2026-00001",
    namaLengkap: "Ahmad Fauzi",
    emailOrangTua: "ortu@example.com",
    namaOrangTua: "Bapak Ahmad",
    noHpOrangTua: "081234567890",
    alamatSiswa: "Jl. Mawar No. 10, RT 01/RW 02, Kel. Sukamaju",
    tempatLahir: "Jakarta",
    tanggalLahir: new Date("2015-01-15"),
    jenisKelamin: "LAKI_LAKI",
    nisn: "0081234567",
    kelasTujuanId: "kelas-1",
    buktiTransfer: [{ id: "bt-1" }],
    status: "MENUNGGU_VERIFIKASI",
    kontakWaliDikonfirmasiAt: null,
  });
  mockPendaftaranFindFirst.mockReset().mockResolvedValue(null);
  mockPendaftaranUpdate.mockReset().mockResolvedValue({});
  mockPendaftaranUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  mockKelasFindUnique.mockReset().mockResolvedValue({
    id: "kelas-1",
    nama: "Kelas 1",
    kapasitas: 30,
    _count: { siswa: 5 },
  });
  mockBuktiTransferUpdate.mockReset().mockResolvedValue({});
  mockUserFindUnique.mockReset().mockResolvedValue(null);
  mockUserCreate
    .mockReset()
    .mockResolvedValueOnce({ id: "user-ortu-1", role: "ORANG_TUA" })
    .mockResolvedValueOnce({ id: "user-siswa-1", role: "SISWA" });
  mockOrangTuaFindUnique.mockReset().mockResolvedValue({ id: "ortu-1" });
  mockSiswaFindUnique
    .mockReset()
    .mockResolvedValueOnce(null)
    .mockResolvedValue({ id: "siswa-1", userId: "user-siswa-1" });
  mockSiswaCreate.mockReset().mockResolvedValue({
    id: "siswa-1",
    userId: "user-siswa-1",
  });
  mockParentStudentFindUnique.mockReset().mockResolvedValue(null);
  mockParentStudentCreate.mockReset().mockResolvedValue({ id: "ps-1" });
  mockCreateUser
    .mockReset()
    .mockResolvedValueOnce({
      data: { user: { id: "auth-ortu-uuid", email: "ortu@example.com" } },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { user: { id: "auth-siswa-uuid" } },
      error: null,
    });
  mockListUsers.mockReset().mockResolvedValue({
    data: { users: [] },
    error: null,
  });
  mockDeleteUser.mockReset().mockResolvedValue({ error: null });
  mockStorageRemove.mockReset().mockResolvedValue({ error: null });
  mockSalinDokumen.mockReset().mockResolvedValue({
    kartuKeluarga: "berkas-siswa/siswa-1/kartuKeluarga/kk.jpg",
    akteLahir: "berkas-siswa/siswa-1/akteLahir/akte.pdf",
    foto: "berkas-siswa/siswa-1/foto/foto.png",
    lainnya: [],
    tersalin: [],
    gagal: [],
  });
  mockPrismaTransaction.mockReset().mockImplementation(
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
          create: mockSiswaCreate,
          update: mockSiswaUpdate,
        },
        parentStudent: {
          create: mockParentStudentCreate,
          findUnique: mockParentStudentFindUnique,
        },
        pendaftaran: {
          findFirst: mockPendaftaranFindFirst,
          findUnique: mockPendaftaranFindUnique,
          update: mockPendaftaranUpdate,
          updateMany: mockPendaftaranUpdateMany,
        },
        buktiTransferPendaftaran: {
          update: mockBuktiTransferUpdate,
        },
        kelas: {
          findUnique: mockKelasFindUnique,
        },
      };
      return fn(tx);
    },
  );
}

describe("Approval Flow - Tanpa Verifikasi Email/OTP", () => {
  beforeEach(() => {
    setupBaseMocks();
  });

  it("approval berhasil ketika bukti pembayaran ada dan email belum terverifikasi", async () => {
    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("DITERIMA");
  });

  it("approval ditolak ketika bukti pembayaran tidak ada", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      id: "pend-1",
      nomorPendaftaran: "REG-2026-00001",
      namaLengkap: "Ahmad Fauzi",
      emailOrangTua: "ortu@example.com",
      namaOrangTua: "Bapak Ahmad",
      noHpOrangTua: "081234567890",
      alamatSiswa: "Jl. Mawar No. 10, RT 01/RW 02, Kel. Sukamaju",
      tempatLahir: "Jakarta",
      tanggalLahir: new Date("2015-01-15"),
      jenisKelamin: "LAKI_LAKI",
      nisn: "0081234567",
      kelasTujuanId: "kelas-1",
      buktiTransfer: [],
      status: "MENUNGGU_VERIFIKASI",
      kontakWaliDikonfirmasiAt: null,
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Bukti pembayaran belum tersedia");
  });

  it("approval ditolak ketika status masih MENUNGGU_PEMBAYARAN", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      id: "pend-1",
      nomorPendaftaran: "REG-2026-00001",
      namaLengkap: "Ahmad Fauzi",
      emailOrangTua: "ortu@example.com",
      namaOrangTua: "Bapak Ahmad",
      noHpOrangTua: "081234567890",
      alamatSiswa: "Jl. Mawar No. 10, RT 01/RW 02, Kel. Sukamaju",
      tempatLahir: "Jakarta",
      tanggalLahir: new Date("2015-01-15"),
      jenisKelamin: "LAKI_LAKI",
      nisn: "0081234567",
      kelasTujuanId: "kelas-1",
      buktiTransfer: [{ id: "bt-1" }],
      status: "MENUNGGU_PEMBAYARAN",
      kontakWaliDikonfirmasiAt: null,
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("MENUNGGU_PEMBAYARAN");
  });

  it("bukti terakhir diubah menjadi DITERIMA saat approval berhasil", async () => {
    await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(mockBuktiTransferUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bt-1" },
        data: expect.objectContaining({
          status: "DITERIMA",
        }),
      }),
    );
  });

  it("tidak ada double approval - approval ulang bersifat idempotent", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      id: "pend-1",
      nomorPendaftaran: "REG-2026-00001",
      namaLengkap: "Ahmad Fauzi",
      emailOrangTua: "ortu@example.com",
      namaOrangTua: "Bapak Ahmad",
      noHpOrangTua: "081234567890",
      alamatSiswa: "Jl. Mawar No. 10, RT 01/RW 02, Kel. Sukamaju",
      tempatLahir: "Jakarta",
      tanggalLahir: new Date("2015-01-15"),
      jenisKelamin: "LAKI_LAKI",
      nisn: "0081234567",
      kelasTujuanId: "kelas-1",
      buktiTransfer: [{ id: "bt-1" }],
      status: "DITERIMA",
      kontakWaliDikonfirmasiAt: null,
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("sudah DITERIMA");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("NISN duplikat ditolak tanpa membuat akun baru", async () => {
    // Panggilan PERTAMA ke siswa.findUnique pada alur approval adalah cek NISN
    // (sebelum klaim & pembuatan akun) — rest-nya tidak terpakai karena langsung
    // ditolak.
    mockSiswaFindUnique.mockReset().mockResolvedValue({
      id: "siswa-existing",
      user: { nama: "Santri Lama", id: "user-lama" },
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("NISN");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("kelas invalid ditolak tanpa membuat akun baru", async () => {
    mockKelasFindUnique.mockResolvedValue(null);

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
      kelasTujuanId: "kelas-tidak-ada",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Kelas tujuan tidak ditemukan");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("kapasitas kelas penuh ditolak", async () => {
    mockKelasFindUnique.mockResolvedValue({
      id: "kelas-1",
      nama: "Kelas 1",
      kapasitas: 30,
      _count: { siswa: 30 },
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("sudah penuh");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });
});
