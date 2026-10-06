// src/lib/guru-auth.test.ts
//
// Regression tests: guard authorization akademik TERPUSAT
// (verifyGuruAksesKelas & verifyAcademicClassAccess).
//
// Kontrak yang diuji (konsisten untuk Materi, Tugas, Ujian, Mapel, Absensi,
// Rapor, Rekap Nilai — semuanya memakai helper ini):
//   - SUPER_ADMIN tanpa record Guru → authorized, roleInKelas ADMIN
//   - ADMIN_AKADEMIK tanpa record Guru → authorized, roleInKelas ADMIN
//   - Super Admin/Admin Akademik tetap divalidasi mapel aktif bila mapel dikirim
//   - Guru tanpa record Guru → ditolak
//   - Guru dengan record tapi tanpa penugasan/wali kelas → ditolak
//   - Guru wali kelas → authorized (WALI_KELAS)
//   - Role selain akademik → ditolak

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role } from "@prisma/client";

const { mockRequireGuru, mockPrisma } = vi.hoisted(() => ({
  mockRequireGuru: vi.fn(),
  mockPrisma: {
    kelas: { findFirst: vi.fn() },
    guruKelas: { findFirst: vi.fn(), findMany: vi.fn() },
    mataPelajaran: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireGuru: mockRequireGuru,
  // Dipakai modul lain; tidak dipakai test ini.
  requireRole: vi.fn(),
  // Replika implementasi asli (Role.SUPER_ADMIN || Role.ADMIN_AKADEMIK).
  isAcademicAdminRole: (role: Role) =>
    role === Role.SUPER_ADMIN || role === Role.ADMIN_AKADEMIK,
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import {
  verifyGuruAksesKelas,
  verifyAcademicClassAccess,
  getMapelIdYangDiajarDiKelas,
} from "@/lib/guru-auth";

const adminTanpaGuru = {
  id: "user-admin",
  role: Role.SUPER_ADMIN,
  isAdmin: false,
  guru: null,
};

const adminAkademikTanpaGuru = {
  id: "user-aa",
  role: Role.ADMIN_AKADEMIK,
  isAdmin: false,
  guru: null,
};

const guruBiasa = {
  id: "user-guru",
  role: Role.GURU,
  isAdmin: false,
  guru: { id: "guru-1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: tidak ada mapel yang cocok (aman untuk kasus tanpa mapel).
  mockPrisma.mataPelajaran.findFirst.mockResolvedValue(null);
  mockPrisma.mataPelajaran.findUnique.mockResolvedValue(null);
});

describe("verifyGuruAksesKelas — admin akademik tanpa record Guru", () => {
  it("SUPER_ADMIN tanpa profil Guru mendapat akses penuh (ADMIN)", async () => {
    mockRequireGuru.mockResolvedValue(adminTanpaGuru);

    const hasil = await verifyGuruAksesKelas("kelas-1");

    expect(hasil.roleInKelas).toBe("ADMIN");
    expect(hasil.guru).toBeNull();
    // Tidak boleh melempar "Profil guru tidak ditemukan".
  });

  it("ADMIN_AKADEMIK tanpa profil Guru mendapat akses penuh (ADMIN)", async () => {
    mockRequireGuru.mockResolvedValue(adminAkademikTanpaGuru);

    const hasil = await verifyGuruAksesKelas("kelas-1");

    expect(hasil.roleInKelas).toBe("ADMIN");
    expect(hasil.guru).toBeNull();
  });

  it("Super Admin tetap divalidasi mapel aktif saat mapel dikirim", async () => {
    mockRequireGuru.mockResolvedValue(adminTanpaGuru);
    mockPrisma.mataPelajaran.findFirst.mockResolvedValue(null);

    await expect(
      verifyGuruAksesKelas("kelas-1", "Mapel Tidak Ada"),
    ).rejects.toThrow("tidak ditemukan");
  });

  it("Super Admin lolos bila mapel yang dikirim aktif", async () => {
    mockRequireGuru.mockResolvedValue(adminTanpaGuru);
    mockPrisma.mataPelajaran.findFirst.mockResolvedValue({ id: "mapel-1" });

    const hasil = await verifyGuruAksesKelas("kelas-1", "Bahasa Arab");

    expect(hasil.roleInKelas).toBe("ADMIN");
    expect(mockPrisma.mataPelajaran.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ nama: "Bahasa Arab", aktif: true }) }),
    );
  });
});

describe("verifyGuruAksesKelas — guru biasa tetap dibatasi", () => {
  it("guru tanpa record Guru ditolak", async () => {
    mockRequireGuru.mockResolvedValue({ ...guruBiasa, guru: null });

    await expect(verifyGuruAksesKelas("kelas-1")).rejects.toThrow(
      "Profil guru tidak ditemukan",
    );
  });

  it("guru tanpa penugasan & bukan wali kelas ditolak", async () => {
    mockRequireGuru.mockResolvedValue(guruBiasa);
    mockPrisma.kelas.findFirst.mockResolvedValue(null);
    mockPrisma.guruKelas.findFirst.mockResolvedValue(null);

    await expect(verifyGuruAksesKelas("kelas-1")).rejects.toThrow(
      "tidak memiliki wewenang",
    );
  });

  it("wali kelas mendapat roleInKelas WALI_KELAS", async () => {
    mockRequireGuru.mockResolvedValue(guruBiasa);
    mockPrisma.kelas.findFirst.mockResolvedValue({ id: "kelas-1" });

    const hasil = await verifyGuruAksesKelas("kelas-1");

    expect(hasil.roleInKelas).toBe("WALI_KELAS");
    expect(hasil.guru?.id).toBe("guru-1");
  });

  it("pengajar dengan penugasan GuruKelas mendapat roleInKelas PENGAJAR", async () => {
    mockRequireGuru.mockResolvedValue(guruBiasa);
    mockPrisma.kelas.findFirst.mockResolvedValue(null);
    mockPrisma.guruKelas.findFirst.mockResolvedValue({ id: "gk-1" });

    const hasil = await verifyGuruAksesKelas("kelas-1");

    expect(hasil.roleInKelas).toBe("PENGAJAR");
  });
});

describe("verifyAcademicClassAccess — helper terpusat", () => {
  it("SUPER_ADMIN tanpa record Guru → authorized ADMIN", async () => {
    mockRequireGuru.mockResolvedValue(adminTanpaGuru);

    const hasil = await verifyAcademicClassAccess("kelas-1");

    expect(hasil.status).toBe("authorized");
    if (hasil.status === "authorized") {
      expect(hasil.roleInKelas).toBe("ADMIN");
      expect(hasil.guruId).toBeNull();
    }
  });

  it("ADMIN_AKADEMIK dengan mataPelajaranId tidak aktif → forbidden", async () => {
    mockRequireGuru.mockResolvedValue(adminAkademikTanpaGuru);
    mockPrisma.mataPelajaran.findUnique.mockResolvedValue({
      id: "mapel-1",
      aktif: false,
    });

    const hasil = await verifyAcademicClassAccess("kelas-1", null, "mapel-1");

    expect(hasil.status).toBe("forbidden");
    if (hasil.status === "forbidden") {
      expect(hasil.reason).toContain("Mata pelajaran");
    }
  });

  it("guru tanpa akses kelas → forbidden dengan pesan aman", async () => {
    mockRequireGuru.mockResolvedValue(guruBiasa);
    mockPrisma.guruKelas.findFirst.mockResolvedValue(null);
    mockPrisma.kelas.findFirst.mockResolvedValue(null);

    const hasil = await verifyAcademicClassAccess("kelas-1");

    expect(hasil.status).toBe("forbidden");
    if (hasil.status === "forbidden") {
      expect(hasil.reason).toContain("tidak memiliki akses");
    }
  });

  it("role selain akademik → forbidden", async () => {
    mockRequireGuru.mockResolvedValue({
      id: "user-siswa",
      role: Role.SISWA,
      isAdmin: false,
      guru: null,
    });

    const hasil = await verifyAcademicClassAccess("kelas-1");

    expect(hasil.status).toBe("forbidden");
  });
});

describe("getMapelIdYangDiajarDiKelas", () => {
  it("admin akademik tanpa profil Guru → ALL", async () => {
    mockRequireGuru.mockResolvedValue(adminTanpaGuru);

    await expect(getMapelIdYangDiajarDiKelas("kelas-1")).resolves.toBe("ALL");
  });

  it("guru tanpa record Guru → daftar kosong (bukan exception)", async () => {
    mockRequireGuru.mockResolvedValue({ ...guruBiasa, guru: null });

    await expect(getMapelIdYangDiajarDiKelas("kelas-1")).resolves.toEqual([]);
  });

  it("wali kelas → ALL", async () => {
    mockRequireGuru.mockResolvedValue(guruBiasa);
    mockPrisma.kelas.findFirst.mockResolvedValue({ id: "kelas-1" });

    await expect(getMapelIdYangDiajarDiKelas("kelas-1")).resolves.toBe("ALL");
  });
});
