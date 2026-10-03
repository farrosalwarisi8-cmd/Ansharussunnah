// src/actions/reconcile-siswa.test.ts
//
// Test reconciliation admin-only untuk data siswa orphan:
//   - user role SISWA tanpa row siswas
//   - pendaftaran DITERIMA tanpa row siswas
//
// Mencakup: authorization (SUPER_ADMIN/ADMIN_AKADEMIK saja), dry-run tanpa
// menulis, repair membuat tepat satu row, konflik NISN dihentikan, idempotent,
// tidak membuat Auth user duplikat, dan audit log tercatat.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockUserFindUnique,
  mockUserFindFirst,
  mockUserFindMany,
  mockUserCreate,
  mockSiswaFindUnique,
  mockSiswaCreate,
  mockOrangTuaFindUnique,
  mockOrangTuaCreate,
  mockParentStudentFindUnique,
  mockParentStudentCreate,
  mockKelasFindUnique,
  mockPendaftaranFindUnique,
  mockPendaftaranFindMany,
  mockPendaftaranFindFirst,
  mockPrismaTransaction,
  mockCreateUser,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockUserFindMany: vi.fn(),
  mockUserCreate: vi.fn(),
  mockSiswaFindUnique: vi.fn(),
  mockSiswaCreate: vi.fn(),
  mockOrangTuaFindUnique: vi.fn(),
  mockOrangTuaCreate: vi.fn(),
  mockParentStudentFindUnique: vi.fn(),
  mockParentStudentCreate: vi.fn(),
  mockKelasFindUnique: vi.fn(),
  mockPendaftaranFindUnique: vi.fn(),
  mockPendaftaranFindMany: vi.fn().mockResolvedValue([]),
  mockPendaftaranFindFirst: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockCreateUser: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

const mockRequireGuruAdmin = vi.hoisted(() => vi.fn());
const mockIsAcademicAdminRole = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireGuruAdmin: mockRequireGuruAdmin,
  isAcademicAdminRole: mockIsAcademicAdminRole,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: mockUserFindUnique,
      findFirst: mockUserFindFirst,
      findMany: mockUserFindMany,
      create: mockUserCreate,
    },
    siswa: {
      findUnique: mockSiswaFindUnique,
      create: mockSiswaCreate,
    },
    orangTua: {
      findUnique: mockOrangTuaFindUnique,
      create: mockOrangTuaCreate,
    },
    parentStudent: {
      findUnique: mockParentStudentFindUnique,
      create: mockParentStudentCreate,
    },
    kelas: {
      findUnique: mockKelasFindUnique,
    },
    pendaftaran: {
      findUnique: mockPendaftaranFindUnique,
      findFirst: mockPendaftaranFindFirst,
      findMany: mockPendaftaranFindMany,
    },
    $transaction: mockPrismaTransaction,
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: () => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
      },
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { listOrphanSiswaCandidates, reconcileSiswa } from "@/actions/reconcile-siswa";

const adminAkademik = {
  id: "admin-1",
  role: "SUPER_ADMIN",
  isAdmin: true,
};

const guruBiasa = {
  id: "guru-1",
  role: "GURU",
  isAdmin: false,
};

const orphanUser = {
  id: "user-siswa-1",
  email: "siswa.reg202600001@sekolah.internal",
  nama: "Ahmad Fauzi",
  role: "SISWA",
  authId: "auth-siswa-1",
  siswa: null,
};

const pendaftaranDiterima = {
  id: "pend-1",
  nomorPendaftaran: "REG-2026-00001",
  namaLengkap: "Ahmad Fauzi",
  nisn: "0081234567",
  jenisKelamin: "LAKI_LAKI",
  tempatLahir: "Jakarta",
  tanggalLahir: new Date("2015-01-15"),
  alamatSiswa: "Jl. Mawar No. 10",
  noHpSiswa: "081298765432",
  namaAyahKandung: "Budi Santoso",
  statusAyahKandung: "MASIH_HIDUP",
  nikAyah: "3201011501900001",
  namaIbuKandung: "Siti Rahmawati",
  statusIbuKandung: "MASIH_HIDUP",
  nikIbu: "3201011501900002",
  statusWali: "SAMA_DENGAN_AYAH",
  namaWali: null,
  agama: "Islam",
  kewarganegaraan: "WNI",
  kitas: null,
  asalNegara: null,
  kelasTujuanId: "kelas-1",
  emailOrangTua: "ortu@example.com",
  namaOrangTua: "Bapak Ahmad",
  noHpOrangTua: "081234567890",
  alamatOrangTua: "Jl. Melati No. 5",
  status: "DITERIMA",
};

function setupTransactionMock() {
  mockPrismaTransaction.mockImplementation(
    async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const tx = {
        siswa: {
          findUnique: mockSiswaFindUnique,
          findFirst: mockSiswaFindUnique,
          create: mockSiswaCreate,
        },
        user: {
          findFirst: mockUserFindFirst,
        },
        orangTua: {
          findUnique: mockOrangTuaFindUnique,
          create: mockOrangTuaCreate,
        },
        parentStudent: {
          findUnique: mockParentStudentFindUnique,
          create: mockParentStudentCreate,
        },
      };
      return fn(tx);
    },
  );
}

describe("reconcileSiswa — authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireGuruAdmin.mockResolvedValue(guruBiasa);
    mockIsAcademicAdminRole.mockReturnValue(false);
  });

  it("menolak user tanpa role admin akademik/super admin", async () => {
    const result = await reconcileSiswa({
      mode: "DRY_RUN",
      userId: "user-siswa-1",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Akses ditolak");
    expect(mockSiswaCreate).not.toHaveBeenCalled();
  });
});

describe("listOrphanSiswaCandidates — read-only review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireGuruAdmin.mockResolvedValue(adminAkademik);
    mockIsAcademicAdminRole.mockReturnValue(true);
  });

  it("mengembalikan kandidat orphan tanpa mengubah data apa pun", async () => {
    mockUserFindMany.mockResolvedValue([
      { id: "user-siswa-1", nama: "Ahmad Fauzi", email: "siswa.reg202600001@sekolah.internal", role: "SISWA", siswa: null },
      { id: "user-siswa-2", nama: "Budi", email: "siswa.reg202600002@sekolah.internal", role: "SISWA", siswa: { id: "siswa-ada" } },
    ]);
    mockPendaftaranFindMany.mockResolvedValue([]);
    mockPendaftaranFindFirst.mockResolvedValue({
      id: "pend-1",
      nomorPendaftaran: "REG-2026-00001",
      status: "DITERIMA",
      deleted_at: null,
    });

    const result = await listOrphanSiswaCandidates();

    expect(result.success).toBe(true);
    expect(result.data?.summary.total).toBe(1);
    expect(result.data?.summary.review).toBe(1);
    expect(result.data?.candidates[0]).toMatchObject({
      userId: "user-siswa-1",
      tipe: "USER_TANPA_SISWA",
      safeToRepair: true,
    });
    expect(mockSiswaCreate).not.toHaveBeenCalled();
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });
});

describe("reconcileSiswa — dry-run & repair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireGuruAdmin.mockResolvedValue(adminAkademik);
    mockIsAcademicAdminRole.mockReturnValue(true);
    setupTransactionMock();
    mockKelasFindUnique.mockResolvedValue({
      id: "kelas-1",
      nama: "7A",
    });
  });

  afterEach(() => {
    mockUserFindUnique.mockReset();
    mockSiswaFindUnique.mockReset();
    mockSiswaCreate.mockReset();
    mockPendaftaranFindUnique.mockReset();
    mockPendaftaranFindMany.mockReset().mockResolvedValue([]);
    mockParentStudentFindUnique.mockReset().mockResolvedValue(null);
  });

  it("dry-run tidak mengubah data", async () => {
    mockUserFindUnique.mockResolvedValue(orphanUser);
    mockPendaftaranFindMany.mockResolvedValue([
      { id: "pend-1", nomorPendaftaran: "REG-2026-00001" },
    ]);
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranDiterima);
    mockSiswaFindUnique.mockResolvedValue(null);

    const result = await reconcileSiswa({
      mode: "DRY_RUN",
      userId: "user-siswa-1",
    });

    expect(result.success).toBe(true);
    expect(result.data?.mode).toBe("DRY_RUN");
    expect(result.data?.dapatDiperbaiki).toBe(true);
    expect(mockSiswaCreate).not.toHaveBeenCalled();
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it("repair valid membuat tepat satu row siswa", async () => {
    mockUserFindUnique.mockResolvedValue(orphanUser);
    // Lookup pendaftaran dari email siswa.internal: REG-2026-00001 → reg202600001
    mockPendaftaranFindMany.mockResolvedValue([
      { id: "pend-1", nomorPendaftaran: "REG-2026-00001" },
    ]);
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranDiterima);
    mockSiswaFindUnique.mockResolvedValue(null);
    mockSiswaCreate.mockResolvedValue({ id: "siswa-baru-1" });
    mockUserFindFirst.mockResolvedValue(null); // ortu belum ada
    mockParentStudentFindUnique.mockResolvedValue(null);

    const result = await reconcileSiswa({
      mode: "REPAIR_ONE",
      userId: "user-siswa-1",
    });

    expect(result.success).toBe(true);
    expect(result.data?.siswaIdBaru).toBe("siswa-baru-1");
    expect(mockSiswaCreate).toHaveBeenCalledTimes(1);
    expect(mockSiswaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-siswa-1",
          pendaftaranId: "pend-1",
        }),
      }),
    );
  });

  it("konflik NISN dihentikan", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranDiterima);
    mockUserFindFirst.mockResolvedValue(orphanUser);
    mockSiswaFindUnique
      .mockResolvedValueOnce(null) // cek siswa by pendaftaranId → belum ada
      .mockResolvedValue({ id: "siswa-lain" }); // cek NISN → dipakai siswa lain

    const result = await reconcileSiswa({
      mode: "REPAIR_ONE",
      pendaftaranId: "pend-1",
    });

    expect(result.data?.requiresReview).toBe(true);
    expect(result.data?.konflik).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ jenis: "NISN_DIPAKAI" }),
      ]),
    );
    expect(mockSiswaCreate).not.toHaveBeenCalled();
  });

  it("repair kedua idempotent — siswa sudah ada tidak dibuat ulang", async () => {
    mockUserFindUnique.mockResolvedValue({
      ...orphanUser,
      siswa: { id: "siswa-ada", deleted_at: null },
    });

    const result = await reconcileSiswa({
      mode: "REPAIR_ONE",
      userId: "user-siswa-1",
    });

    expect(result.success).toBe(true);
    expect(mockSiswaCreate).not.toHaveBeenCalled();
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it("tidak membuat Auth user baru", async () => {
    mockUserFindUnique.mockResolvedValue(orphanUser);
    mockSiswaFindUnique.mockResolvedValue(null);
    mockSiswaCreate.mockResolvedValue({ id: "siswa-baru-1" });
    mockUserFindFirst.mockResolvedValue(null);

    await reconcileSiswa({
      mode: "REPAIR_ONE",
      userId: "user-siswa-1",
    });

    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("audit log tercatat saat repair", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockUserFindUnique.mockResolvedValue(orphanUser);
    mockPendaftaranFindMany.mockResolvedValue([
      { id: "pend-1", nomorPendaftaran: "REG-2026-00001" },
    ]);
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranDiterima);
    mockSiswaFindUnique.mockResolvedValue(null);
    mockSiswaCreate.mockResolvedValue({ id: "siswa-baru-1" });
    mockUserFindFirst.mockResolvedValue(null);

    await reconcileSiswa({
      mode: "REPAIR_ONE",
      userId: "user-siswa-1",
    });

    const auditLog = logSpy.mock.calls.find((c) =>
      String(c[0]).includes("[student-reconcile] repaired"),
    );
    expect(auditLog).toBeDefined();
    expect(String(auditLog![0])).toContain("admin=admin-1");
    expect(String(auditLog![0])).toContain("userId=user-siswa-1");
    expect(String(auditLog![0])).toContain("siswaIdBaru=siswa-baru-1");
    logSpy.mockRestore();
  });

  it("kelas tujuan tidak ditemukan → REQUIRES_REVIEW", async () => {
    mockUserFindUnique.mockResolvedValue(orphanUser);
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranDiterima);
    mockKelasFindUnique.mockResolvedValue(null);

    const result = await reconcileSiswa({
      mode: "REPAIR_ONE",
      pendaftaranId: "pend-1",
    });

    expect(result.data?.requiresReview).toBe(true);
    expect(result.data?.alasanReview).toContain("Kelas tujuan");
    expect(mockSiswaCreate).not.toHaveBeenCalled();
  });

  it("user SISWA tidak ditemukan dari pendaftaran → REQUIRES_REVIEW", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranDiterima);
    mockUserFindFirst.mockResolvedValue(null); // user siswa tidak ada

    const result = await reconcileSiswa({
      mode: "REPAIR_ONE",
      pendaftaranId: "pend-1",
    });

    expect(result.data?.requiresReview).toBe(true);
    expect(result.data?.konflik).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ jenis: "USER_SISWA_TIDAK_ADA" }),
      ]),
    );
    expect(mockSiswaCreate).not.toHaveBeenCalled();
  });
});
