// src/actions/academic-guard.test.ts
//
// Regression tests: konsistensi guard role di Tugas, Ujian, dan Materi.
//
// Kontrak yang diuji (Bagian F):
//   - Guard role KONSISTEN dengan Materi: Super Admin/Admin Akademik tanpa
//     record Guru dapat memuat daftar Tugas/Ujian.
//   - Guru tanpa akses ditolak dengan pesan UI yang jelas (bukan global error).
//   - Siswa HANYA melihat tugas/ujian kelasnya sendiri (kelasId dari session,
//     bukan input client) — siswa tanpa kelas ditolak dengan pesan jelas.
//   - Error server dikembalikan sebagai { success: false, message } (response
//     terstruktur), bukan exception yang mengarahkan user ke global error.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/prisma-error";

const {
  mockVerifyGuruAksesKelas,
  mockGetMapelIdYangDiajarDiKelas,
  mockRequireRole,
  mockTugasFindMany,
  mockTugasCount,
  mockUjianFindMany,
  mockUjianCount,
  mockTutupSesi,
} = vi.hoisted(() => ({
  mockVerifyGuruAksesKelas: vi.fn(),
  mockGetMapelIdYangDiajarDiKelas: vi.fn(),
  mockRequireRole: vi.fn(),
  mockTugasFindMany: vi.fn(),
  mockTugasCount: vi.fn(),
  mockUjianFindMany: vi.fn(),
  mockUjianCount: vi.fn(),
  mockTutupSesi: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
  requireGuru: vi.fn(),
  requireGuruAdmin: vi.fn(),
}));

vi.mock("@/lib/guru-auth", () => ({
  verifyGuruAksesKelas: mockVerifyGuruAksesKelas,
  getMapelIdYangDiajarDiKelas: mockGetMapelIdYangDiajarDiKelas,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    tugas: {
      findMany: mockTugasFindMany,
      count: mockTugasCount,
    },
    ujian: {
      findMany: mockUjianFindMany,
      count: mockUjianCount,
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: vi.fn().mockResolvedValue({ success: true }),
  getClientIpFromHeaders: vi.fn().mockResolvedValue("127.0.0.1"),
}));

vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
    getSignedUrl: vi.fn().mockResolvedValue(null),
    getSignedUrls: vi.fn().mockResolvedValue(new Map()),
    validateFile: vi.fn().mockResolvedValue({ valid: true }),
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({
  isCronAuthorized: vi.fn().mockResolvedValue(false),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { getDaftarTugasGuru, getDaftarTugasSiswa } from "@/actions/tugas";
import { getDaftarUjianGuru, getDaftarUjianSiswa } from "@/actions/ujian";

function itemsOf(result: { success: boolean; data?: unknown }): unknown[] {
  const data = result.data as { items?: unknown[] } | unknown[] | undefined;
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyGuruAksesKelas.mockResolvedValue({
    user: { id: "user-1", role: "SUPER_ADMIN" },
    guru: null,
    roleInKelas: "ADMIN",
  });
  mockGetMapelIdYangDiajarDiKelas.mockResolvedValue("ALL");
  mockTugasFindMany.mockResolvedValue([]);
  mockTugasCount.mockResolvedValue(0);
  mockUjianFindMany.mockResolvedValue([]);
  mockUjianCount.mockResolvedValue(0);
  mockTutupSesi.mockResolvedValue(undefined);
});

// ========================================================
// Tugas — guard konsisten dengan Materi
// ========================================================

describe("Tugas — guard role konsisten dengan Materi", () => {
  it("Super Admin tanpa record Guru dapat memuat daftar tugas", async () => {
    const result = await getDaftarTugasGuru("kelas-1");

    expect(result.success).toBe(true);
    expect(itemsOf(result)).toEqual([]);
    expect(mockVerifyGuruAksesKelas).toHaveBeenCalledWith("kelas-1");
  });

  it("Admin Akademik tanpa record Guru dapat memuat daftar tugas", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({
      user: { id: "user-2", role: "ADMIN_AKADEMIK" },
      guru: null,
      roleInKelas: "ADMIN",
    });

    const result = await getDaftarTugasGuru("kelas-1");

    expect(result.success).toBe(true);
  });

  it("guru tanpa akses ditolak dengan pesan UI, bukan exception", async () => {
    mockVerifyGuruAksesKelas.mockRejectedValue(
      new AppError("Forbidden: Anda tidak memiliki wewenang mengajar/mengelola kelas ini"),
    );

    const result = await getDaftarTugasGuru("kelas-1");

    expect(result.success).toBe(false);
    expect(result.message).toContain("tidak memiliki wewenang");
    // Query daftar tidak boleh dijalankan setelah guard menolak.
    expect(mockTugasFindMany).not.toHaveBeenCalled();
  });

  it("error server tak terduga kembali sebagai response terstruktur", async () => {
    mockVerifyGuruAksesKelas.mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN" },
      guru: null,
      roleInKelas: "ADMIN",
    });
    mockGetMapelIdYangDiajarDiKelas.mockResolvedValue("ALL");
    mockTugasFindMany.mockRejectedValue(new Error("koneksi DB putus"));

    const result = await getDaftarTugasGuru("kelas-1");

    expect(result.success).toBe(false);
    // Detail teknis tidak bocor ke UI.
    expect(result.message).not.toContain("koneksi DB putus");
    expect(typeof result.message).toBe("string");
  });
});

// ========================================================
// Ujian — guard konsisten dengan Materi
// ========================================================

describe("Ujian — guard role konsisten dengan Materi", () => {
  it("Super Admin tanpa record Guru dapat memuat daftar ujian", async () => {
    const result = await getDaftarUjianGuru("kelas-1");

    expect(result.success).toBe(true);
    expect(itemsOf(result)).toEqual([]);
    expect(mockVerifyGuruAksesKelas).toHaveBeenCalledWith("kelas-1");
  });

  it("guru tanpa akses ditolak dengan pesan UI, bukan exception", async () => {
    mockVerifyGuruAksesKelas.mockRejectedValue(
      new AppError("Forbidden: Anda tidak memiliki wewenang mengajar/mengelola kelas ini"),
    );

    const result = await getDaftarUjianGuru("kelas-1");

    expect(result.success).toBe(false);
    expect(result.message).toContain("tidak memiliki wewenang");
    expect(mockUjianFindMany).not.toHaveBeenCalled();
  });

  it("pengajar tanpa penugasan mapel mendapat daftar kosong (bukan error)", async () => {
    mockGetMapelIdYangDiajarDiKelas.mockResolvedValue([]);

    const result = await getDaftarUjianGuru("kelas-1");

    expect(result.success).toBe(true);
    expect(itemsOf(result)).toEqual([]);
    expect(mockUjianFindMany).not.toHaveBeenCalled();
  });
});

// ========================================================
// Siswa — kelas dari SESSION, bukan input client
// ========================================================

describe("Daftar siswa — kelas dari session", () => {
  it("tugas: siswa tanpa kelas ditolak dengan pesan jelas", async () => {
    mockRequireRole.mockResolvedValue({
      id: "user-siswa",
      role: "SISWA",
      siswa: { id: "siswa-1", kelasId: null, jenisKelamin: "LAKI_LAKI" },
    });

    const result = await getDaftarTugasSiswa();

    expect(result.success).toBe(false);
    expect(result.message).toContain("kelas");
    expect(mockTugasFindMany).not.toHaveBeenCalled();
  });

  it("tugas: filter memakai kelasId dari session", async () => {
    mockRequireRole.mockResolvedValue({
      id: "user-siswa",
      role: "SISWA",
      siswa: { id: "siswa-1", kelasId: "kelas-saya", jenisKelamin: "LAKI_LAKI" },
    });

    const result = await getDaftarTugasSiswa();

    expect(result.success).toBe(true);
    const queryArg = mockTugasFindMany.mock.calls[0][0];
    expect(queryArg.where.kelasId).toBe("kelas-saya");
  });

  it("ujian: siswa tanpa kelas ditolak dengan pesan jelas", async () => {
    mockRequireRole.mockResolvedValue({
      id: "user-siswa",
      role: "SISWA",
      siswa: { id: "siswa-1", kelasId: null, jenisKelamin: "LAKI_LAKI" },
    });

    const result = await getDaftarUjianSiswa();

    expect(result.success).toBe(false);
    expect(result.message).toContain("kelas");
    expect(mockUjianFindMany).not.toHaveBeenCalled();
  });

  it("ujian: filter memakai kelasId dari session", async () => {
    mockRequireRole.mockResolvedValue({
      id: "user-siswa",
      role: "SISWA",
      siswa: { id: "siswa-1", kelasId: "kelas-saya", jenisKelamin: "LAKI_LAKI" },
    });

    const result = await getDaftarUjianSiswa();

    expect(result.success).toBe(true);
    const queryArg = mockUjianFindMany.mock.calls[0][0];
    expect(queryArg.where.kelasId).toBe("kelas-saya");
  });
});
