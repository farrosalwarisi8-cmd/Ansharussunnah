// src/actions/konfirmasi-kontak-wali.test.ts

/**
 * Test Server Action konfirmasi kontak wali — gerbang approval
 * pengganti OTP email.
 *
 * Mencakup: authorization (requireGuruAdmin), validasi metode &
 * panjang catatan, penanganan pendaftaran tidak ditemukan,
 * perlindungan audit konfirmasi ganda, pembatalan hanya sebelum
 * status final, dan revalidasi cache.
 *
 * Konstanta bersama (METODE_KONFIRMASI, MetodeKonfirmasi) diuji
 * di sini karena kini hidup di src/lib/konfirmasi-kontak-wali.ts,
 * BUKAN di file "use server" — mengekspor array dari file
 * "use server" membuat Next.js melempar
 * 'A "use server" file can only export async functions, found object'.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockPendaftaranFindUnique,
  mockPendaftaranUpdate,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockPendaftaranFindUnique: vi.fn(),
  mockPendaftaranUpdate: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

const { mockRequireGuruAdmin } = vi.hoisted(() => ({
  mockRequireGuruAdmin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    pendaftaran: {
      findUnique: mockPendaftaranFindUnique,
      update: mockPendaftaranUpdate,
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireGuruAdmin: mockRequireGuruAdmin,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import {
  konfirmasiKontakWali,
  batalkanKonfirmasiKontakWali,
} from "@/actions/konfirmasi-kontak-wali";
import {
  METODE_KONFIRMASI,
  type MetodeKonfirmasi,
} from "@/lib/konfirmasi-kontak-wali";

const dasar = {
  id: "pend-1",
  nomorPendaftaran: "REG-2026-00001-AAAA",
  status: "MENUNGGU_VERIFIKASI",
  deleted_at: null,
  kontakWaliDikonfirmasiAt: null,
};

describe("konfirmasi kontak wali — konstanta bersama", () => {
  it("METODE_KONFIRMASI berisi tepat WHATSAPP, TELEPON, LANGSUNG", () => {
    expect([...METODE_KONFIRMASI]).toEqual([
      "WHATSAPP",
      "TELEPON",
      "LANGSUNG",
    ]);
  });

  it("tipe MetodeKonfirmasi hanya menerima tiga nilai tersebut", () => {
    const valid: MetodeKonfirmasi[] = ["WHATSAPP", "TELEPON", "LANGSUNG"];
    expect(valid).toHaveLength(3);
    // @ts-expect-error — "SMS" bukan anggota MetodeKonfirmasi
    const bukanMetode: MetodeKonfirmasi = "SMS";
    expect(bukanMetode).toBe("SMS");
  });
});

describe("konfirmasiKontakWali", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireGuruAdmin.mockResolvedValue({
      id: "guru-1",
      nama: "Pak Guru",
    });
    mockPendaftaranFindUnique.mockResolvedValue(dasar);
    mockPendaftaranUpdate.mockResolvedValue({});
  });

  it("admin/guru berwenang dapat menyimpan konfirmasi + audit siapa/kapan/metode/konteks", async () => {
    const res = await konfirmasiKontakWali(
      dasar.id,
      "TELEPON",
      "Dihubungi 081234567890, cocok dengan data formulir",
    );

    expect(res.success, res.message).toBe(true);
    expect(mockPendaftaranUpdate).toHaveBeenCalledWith({
      where: { id: dasar.id },
      data: {
        kontakWaliDikonfirmasiAt: expect.any(Date),
        kontakWaliDikonfirmasiOlehId: "guru-1",
        metodeKonfirmasiKontak: "TELEPON",
        catatanKonfirmasiKontak:
          "Dihubungi 081234567890, cocok dengan data formulir",
      },
    });
  });

  it("memanggil revalidatePath setelah menyimpan", async () => {
    await konfirmasiKontakWali(dasar.id, "WHATSAPP");

    expect(mockRevalidatePath).toHaveBeenCalledWith(
      "/dashboard/verifikasi-pendaftaran",
    );
  });

  it("user tanpa role guru/admin ditolak", async () => {
    mockRequireGuruAdmin.mockRejectedValue(new Error("Akses ditolak"));

    const res = await konfirmasiKontakWali(dasar.id, "WHATSAPP", "tes");

    expect(res.success).toBe(false);
    expect(mockPendaftaranFindUnique).not.toHaveBeenCalled();
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });

  it("metode selain WHATSAPP/TELEPON/LANGSUNG ditolak", async () => {
    const res = await konfirmasiKontakWali(
      dasar.id,
      "SMS" as MetodeKonfirmasi,
    );

    expect(res.success).toBe(false);
    expect(res.message).toContain("tidak valid");
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });

  it("catatan maksimal 500 karakter", async () => {
    const terlaluPanjang = await konfirmasiKontakWali(
      dasar.id,
      "WHATSAPP",
      "x".repeat(501),
    );
    expect(terlaluPanjang.success).toBe(false);
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();

    mockPendaftaranUpdate.mockClear();

    const pas = await konfirmasiKontakWali(
      dasar.id,
      "WHATSAPP",
      "x".repeat(500),
    );
    expect(pas.success, pas.message).toBe(true);
    expect(mockPendaftaranUpdate).toHaveBeenCalledTimes(1);
  });

  it("catatan kosong disimpan sebagai null", async () => {
    await konfirmasiKontakWali(dasar.id, "LANGSUNG");

    const data = mockPendaftaranUpdate.mock.calls[0][0].data;
    expect(data.catatanKonfirmasiKontak).toBeNull();
  });

  it("pendaftaran tidak ditemukan ditangani", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(null);

    const res = await konfirmasiKontakWali(dasar.id, "WHATSAPP");

    expect(res.success).toBe(false);
    expect(res.message).toContain("tidak ditemukan");
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });

  it("pendaftaran soft-deleted dianggap tidak ditemukan", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      ...dasar,
      deleted_at: new Date(),
    });

    const res = await konfirmasiKontakWali(dasar.id, "WHATSAPP");

    expect(res.success).toBe(false);
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });

  it("konfirmasi ganda tidak menimpa audit sebelumnya", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      ...dasar,
      kontakWaliDikonfirmasiAt: new Date("2026-01-01T00:00:00Z"),
    });

    const res = await konfirmasiKontakWali(dasar.id, "WHATSAPP", "ulang");

    expect(res.success).toBe(false);
    expect(res.message).toContain("sudah dikonfirmasi");
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });
});

describe("batalkanKonfirmasiKontakWali", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireGuruAdmin.mockResolvedValue({
      id: "guru-1",
      nama: "Pak Guru",
    });
    mockPendaftaranFindUnique.mockResolvedValue({
      ...dasar,
      kontakWaliDikonfirmasiAt: new Date(),
    });
    mockPendaftaranUpdate.mockResolvedValue({});
  });

  it("mengosongkan jejak konfirmasi sebelum status final", async () => {
    const res = await batalkanKonfirmasiKontakWali(dasar.id);

    expect(res.success, res.message).toBe(true);
    expect(mockPendaftaranUpdate).toHaveBeenCalledWith({
      where: { id: dasar.id },
      data: {
        kontakWaliDikonfirmasiAt: null,
        kontakWaliDikonfirmasiOlehId: null,
        metodeKonfirmasiKontak: null,
        catatanKonfirmasiKontak: null,
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      "/dashboard/verifikasi-pendaftaran",
    );
  });

  it("pembatalan ditolak setelah status final DITERIMA", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      ...dasar,
      status: "DITERIMA",
      kontakWaliDikonfirmasiAt: new Date(),
    });

    const res = await batalkanKonfirmasiKontakWali(dasar.id);

    expect(res.success).toBe(false);
    expect(res.message).toContain("sudah berstatus final");
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });

  it("pembatalan ditolak setelah status final DITOLAK", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      ...dasar,
      status: "DITOLAK",
      kontakWaliDikonfirmasiAt: new Date(),
    });

    const res = await batalkanKonfirmasiKontakWali(dasar.id);

    expect(res.success).toBe(false);
    expect(res.message).toContain("sudah berstatus final");
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });

  it("pembatalan ditolak bila belum ada konfirmasi", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(dasar);

    const res = await batalkanKonfirmasiKontakWali(dasar.id);

    expect(res.success).toBe(false);
    expect(res.message).toContain("belum ada");
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });

  it("pendaftaran tidak ditemukan ditangani", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(null);

    const res = await batalkanKonfirmasiKontakWali(dasar.id);

    expect(res.success).toBe(false);
    expect(res.message).toContain("tidak ditemukan");
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });

  it("user tanpa role guru/admin ditolak", async () => {
    mockRequireGuruAdmin.mockRejectedValue(new Error("Akses ditolak"));

    const res = await batalkanKonfirmasiKontakWali(dasar.id);

    expect(res.success).toBe(false);
    expect(mockPendaftaranFindUnique).not.toHaveBeenCalled();
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });
});
