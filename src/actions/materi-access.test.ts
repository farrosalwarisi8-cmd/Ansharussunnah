// src/actions/materi-access.test.ts
//
// Regression tests: akses Materi untuk Super Admin/Admin Akademik tanpa record Guru.
//
// Kontrak yang diuji:
//   - Super Admin tanpa profil Guru dapat memuat daftar Materi
//   - Admin Akademik tanpa profil Guru dapat memuat daftar Materi
//   - Guru tanpa akses ditolak
//   - URL eksternal tidak dibuatkan signed URL
//   - Signed URL gagal tidak mematikan seluruh daftar
//   - Relasi legacy tidak menyebabkan uncaught exception
//   - Materi kosong menghasilkan empty state

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/prisma-error";

const {
  mockPrisma,
  mockGetSignedUrls,
  mockRequireRole,
  mockVerifyGuruAksesKelas,
} = vi.hoisted(() => ({
  mockPrisma: {
    mataPelajaran: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
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
      count: vi.fn(),
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
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/guru-auth", () => ({
  verifyGuruAksesKelas: mockVerifyGuruAksesKelas,
  getMapelIdYangDiajarDiKelas: vi.fn().mockResolvedValue("ALL"),
}));

vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
    getSignedUrls: mockGetSignedUrls,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createMateri,
  updateMateri,
  deleteMateri,
  getDaftarMateriGuru,
  getDaftarMateriSiswa,
  getDaftarMateriAnak,
} from "@/actions/materi";

/** Ambil `items` dari respons paginated (data bertipe unknown di ActionResponse). */
function itemsOf(result: { success: boolean; data?: unknown }): Record<string, unknown>[] {
  const data = result.data as { items?: Record<string, unknown>[] } | undefined;
  return data?.items ?? [];
}

describe("Materi Access - Super Admin & Admin Akademik", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Super Admin tanpa profil Guru dapat memuat daftar Materi", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN" },
      guru: null,
      roleInKelas: "ADMIN",
    });
    mockPrisma.materiPembelajaran.findMany.mockResolvedValue([]);
    mockPrisma.materiPembelajaran.count.mockResolvedValue(0);

    const result = await getDaftarMateriGuru("kelas-1");

    expect(result.success).toBe(true);
    expect(itemsOf(result)).toEqual([]);
  });

  it("Admin Akademik tanpa profil Guru dapat memuat daftar Materi", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({
      user: { id: "user-1", role: "ADMIN_AKADEMIK" },
      guru: null,
      roleInKelas: "ADMIN",
    });
    mockPrisma.materiPembelajaran.findMany.mockResolvedValue([]);
    mockPrisma.materiPembelajaran.count.mockResolvedValue(0);

    const result = await getDaftarMateriGuru("kelas-1");

    expect(result.success).toBe(true);
    expect(itemsOf(result)).toEqual([]);
  });

  it("Guru tanpa akses ditolak", async () => {
    // Guard asli (verifyGuruAksesKelas) melempar AppError — pesannya diteruskan
    // utuh ke UI oleh toUserFriendlyError, sedangkan Error generik disanitasi.
    mockVerifyGuruAksesKelas.mockRejectedValue(
      new AppError("Forbidden: Anda tidak memiliki wewenang mengajar/mengelola kelas ini"),
    );

    const result = await getDaftarMateriGuru("kelas-1");

    expect(result.success).toBe(false);
    expect(result.message).toContain("tidak memiliki wewenang");
  });

  it("URL eksternal tidak dibuatkan signed URL", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN" },
      guru: null,
      roleInKelas: "ADMIN",
    });
    mockPrisma.materiPembelajaran.findMany.mockResolvedValue([
      {
        id: "materi-1",
        judul: "Materi Test",
        deskripsi: "Deskripsi",
        mataPelajaranId: "mapel-1",
        kelasId: "kelas-1",
        targetGender: null,
        periodeAjaranId: "periode-1",
        diunggahOlehId: "user-1",
        urlFile: "https://drive.google.com/file/d/123/view",
        urlLink: null,
        createdAt: new Date(),
        mataPelajaran: { nama: "Bahasa Arab", jenisKelamin: null },
        periodeAjaran: { nama: "2024/2025" },
        diunggahOleh: { nama: "Ustadz Test" },
      },
    ]);
    mockPrisma.materiPembelajaran.count.mockResolvedValue(1);

    const result = await getDaftarMateriGuru("kelas-1");

    expect(result.success).toBe(true);
    // URL eksternal TIDAK pernah dikirim ke storage untuk dibuatkan signed URL.
    const pathsArg = mockGetSignedUrls.mock.calls[0]?.[1] as string[] | undefined;
    expect(pathsArg ?? []).not.toContain(
      "https://drive.google.com/file/d/123/view",
    );
  });

  it("Signed URL gagal tidak mematikan seluruh daftar", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN" },
      guru: null,
      roleInKelas: "ADMIN",
    });
    mockPrisma.materiPembelajaran.findMany.mockResolvedValue([
      {
        id: "materi-1",
        judul: "Materi Test",
        deskripsi: "Deskripsi",
        mataPelajaranId: "mapel-1",
        kelasId: "kelas-1",
        targetGender: null,
        periodeAjaranId: "periode-1",
        diunggahOlehId: "user-1",
        urlFile: "materi/kelas-1/file.pdf",
        urlLink: null,
        createdAt: new Date(),
        mataPelajaran: { nama: "Bahasa Arab", jenisKelamin: null },
        periodeAjaran: { nama: "2024/2025" },
        diunggahOleh: { nama: "Ustadz Test" },
      },
    ]);
    mockPrisma.materiPembelajaran.count.mockResolvedValue(1);
    mockGetSignedUrls.mockResolvedValue(new Map([["materi/kelas-1/file.pdf", null]]));

    const result = await getDaftarMateriGuru("kelas-1");

    expect(result.success).toBe(true);
    expect(itemsOf(result)[0].signedUrl).toBeNull();
  });

  it("Relasi legacy tidak menyebabkan uncaught exception", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN" },
      guru: null,
      roleInKelas: "ADMIN",
    });
    mockPrisma.materiPembelajaran.findMany.mockResolvedValue([
      {
        id: "materi-1",
        judul: "Materi Test",
        deskripsi: "Deskripsi",
        mataPelajaranId: "mapel-1",
        kelasId: "kelas-1",
        targetGender: null,
        periodeAjaranId: "periode-1",
        diunggahOlehId: "user-1",
        urlFile: null,
        urlLink: null,
        createdAt: new Date(),
        mataPelajaran: null,
        periodeAjaran: null,
        diunggahOleh: null,
      },
    ]);
    mockPrisma.materiPembelajaran.count.mockResolvedValue(1);

    const result = await getDaftarMateriGuru("kelas-1");

    expect(result.success).toBe(true);
    expect(itemsOf(result)[0].mataPelajaran).toBe("Mata pelajaran tidak tersedia");
    expect(itemsOf(result)[0].periode).toBe("Periode tidak tersedia");
    expect(itemsOf(result)[0].diunggahOleh).toBe("Pengunggah tidak tersedia");
  });

  it("Materi kosong menghasilkan empty state", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN" },
      guru: null,
      roleInKelas: "ADMIN",
    });
    mockPrisma.materiPembelajaran.findMany.mockResolvedValue([]);
    mockPrisma.materiPembelajaran.count.mockResolvedValue(0);

    const result = await getDaftarMateriGuru("kelas-1");

    expect(result.success).toBe(true);
    expect(itemsOf(result)).toEqual([]);
  });
});

// ========================================================
// Siswa: HANYA kelasnya sendiri (siswaId/kelasId dari session, bukan input client)
// ========================================================

describe("Materi Access - Siswa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("siswa tanpa kelas ditolak (bukan error global)", async () => {
    mockRequireRole.mockResolvedValue({
      id: "user-siswa",
      role: "SISWA",
      siswa: { kelasId: null, jenisKelamin: "LAKI_LAKI" },
    });

    const result = await getDaftarMateriSiswa();

    expect(result.success).toBe(false);
    expect(result.message).toContain("kelas");
    expect(mockPrisma.materiPembelajaran.findMany).not.toHaveBeenCalled();
  });

  it("daftar materi difilter ke kelas SISWA dari session (bukan input client)", async () => {
    mockRequireRole.mockResolvedValue({
      id: "user-siswa",
      role: "SISWA",
      siswa: { kelasId: "kelas-siswa-1", jenisKelamin: "LAKI_LAKI" },
    });
    mockPrisma.materiPembelajaran.findMany.mockResolvedValue([]);
    mockPrisma.materiPembelajaran.count.mockResolvedValue(0);

    const result = await getDaftarMateriSiswa();

    expect(result.success).toBe(true);
    const queryArg = mockPrisma.materiPembelajaran.findMany.mock.calls[0][0];
    expect(queryArg.where.kelasId).toBe("kelas-siswa-1");
  });
});

// ========================================================
// Orang tua: HANYA anak yang punya relasi ParentStudent valid
// ========================================================

describe("Materi Access - Orang Tua", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("orang tua ditolak mengakses siswa yang bukan anaknya", async () => {
    mockRequireRole.mockResolvedValue({
      id: "user-ortu",
      role: "ORANG_TUA",
      orangTua: { id: "ortu-1" },
    });
    // Relasi ParentStudent tidak ada → bukan anaknya.
    mockPrisma.parentStudent.findFirst.mockResolvedValue(null);

    const result = await getDaftarMateriAnak("siswa-bukan-anak")

    expect(result.success).toBe(false);
    expect(result.message).toContain("bukan anak Anda");
    expect(mockPrisma.materiPembelajaran.findMany).not.toHaveBeenCalled();
  });

  it("orang tua dengan relasi valid melihat materi kelas anaknya", async () => {
    mockRequireRole.mockResolvedValue({
      id: "user-ortu",
      role: "ORANG_TUA",
      orangTua: { id: "ortu-1" },
    });
    mockPrisma.parentStudent.findFirst.mockResolvedValue({ id: "ps-1" });
    mockPrisma.siswa.findUnique.mockResolvedValue({
      id: "siswa-1",
      kelasId: "kelas-anak",
      jenisKelamin: "LAKI_LAKI",
      deleted_at: null,
    });
    mockPrisma.materiPembelajaran.findMany.mockResolvedValue([]);
    mockPrisma.materiPembelajaran.count.mockResolvedValue(0);

    const result = await getDaftarMateriAnak("siswa-1");

    expect(result.success).toBe(true);
    const queryArg = mockPrisma.materiPembelajaran.findMany.mock.calls[0][0];
    expect(queryArg.where.kelasId).toBe("kelas-anak");
  });
});
