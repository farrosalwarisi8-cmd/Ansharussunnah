// src/actions/bukti-transfer.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockPendaftaranFindUnique,
  mockBuktiCreate,
  mockPendaftaranUpdate,
  mockPrismaTransaction,
  mockStorageUpload,
  mockStorageRemove,
  mockValidateFile,
  mockRateLimitAsync,
  mockGetClientIp,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockPendaftaranFindUnique: vi.fn(),
  mockBuktiCreate: vi.fn(),
  mockPendaftaranUpdate: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockStorageUpload: vi.fn(),
  mockStorageRemove: vi.fn(),
  mockValidateFile: vi.fn(),
  mockRateLimitAsync: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    pendaftaran: {
      findUnique: mockPendaftaranFindUnique,
    },
    buktiTransferPendaftaran: {
      create: mockBuktiCreate,
    },
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
      }),
    },
  }),
}));

vi.mock("@/lib/storage", () => ({
  validateFile: (...args: unknown[]) => mockValidateFile(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: (...args: unknown[]) => mockRateLimitAsync(...args),
  getClientIpFromHeaders: (...args: unknown[]) => mockGetClientIp(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

import { uploadBuktiTransferPendaftaran } from "@/actions/bukti-transfer";
import { hashTokenAkses } from "@/lib/pendaftaran-token";

const TOKEN_PLAIN = "71W2jdYzzAV0FR0DUUPXD2X1seYJfY4Z";

const mockPendaftaran = {
  id: "pend-1",
  nomorPendaftaran: "REG-2026-00001",
  tokenAksesHash: hashTokenAkses(TOKEN_PLAIN),
  status: "MENUNGGU_PEMBAYARAN",
  tokenAksesExpiraAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  // Default test: gerbang verifikasi email sudah dilewati; test gerbang
  // menimpanya dengan null.
  emailOrangTuaTerverifikasiAt: new Date("2026-01-01"),
};

function makeFormData(overrides: Record<string, File | string> = {}): FormData {
  const fd = new FormData();
  fd.set("nomorPendaftaran", "REG-2026-00001");
  fd.set("tokenAkses", TOKEN_PLAIN);
  fd.set("file", new File(["dummy"], "bukti.jpg", { type: "image/jpeg" }));
  for (const [key, value] of Object.entries(overrides)) {
    fd.set(key, value);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimitAsync.mockResolvedValue({ success: true });
  mockGetClientIp.mockResolvedValue("127.0.0.1");
  mockPendaftaranFindUnique.mockResolvedValue(mockPendaftaran);
  mockValidateFile.mockResolvedValue({ valid: true });
  mockStorageUpload.mockResolvedValue({ error: null });
  mockStorageRemove.mockResolvedValue({ error: null });
  mockBuktiCreate.mockResolvedValue({});
  mockPendaftaranUpdate.mockResolvedValue({});
  mockPrismaTransaction.mockImplementation(async (cb: unknown) => {
    if (typeof cb === "function") {
      return cb({
        buktiTransferPendaftaran: { create: mockBuktiCreate },
        pendaftaran: { update: mockPendaftaranUpdate },
      });
    }
    return undefined;
  });
});

describe("uploadBuktiTransferPendaftaran — Masa Berlaku Token", () => {
  it("menerima upload saat token masih berlaku", async () => {
    const result = await uploadBuktiTransferPendaftaran(makeFormData());

    expect(result.success).toBe(true);
    expect(mockStorageUpload).toHaveBeenCalledOnce();
  });

  it("menolak token yang sudah lewat 90 hari", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      ...mockPendaftaran,
      tokenAksesExpiraAt: new Date(Date.now() - 1000),
    });

    const result = await uploadBuktiTransferPendaftaran(makeFormData());

    expect(result.success).toBe(false);
    expect(result.message).toContain("90 hari");
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("menolak token dengan expiry NULL (fail-closed)", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      ...mockPendaftaran,
      tokenAksesExpiraAt: null,
    });

    const result = await uploadBuktiTransferPendaftaran(makeFormData());

    expect(result.success).toBe(false);
    expect(result.message).toContain("90 hari");
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });
});

describe("uploadBuktiTransferPendaftaran — Status & Token", () => {
  it("tetap mengizinkan DITOLAK agar pendaftaran bisa dihidupkan ulang", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      ...mockPendaftaran,
      status: "DITOLAK",
    });

    const result = await uploadBuktiTransferPendaftaran(makeFormData());

    expect(result.success).toBe(true);
    // Status dikembalikan ke MENUNGGU_VERIFIKASI
    expect(mockPendaftaranUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "MENUNGGU_VERIFIKASI" }),
      }),
    );
  });

  it("menolak status DITERIMA", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      ...mockPendaftaran,
      status: "DITERIMA",
    });

    const result = await uploadBuktiTransferPendaftaran(makeFormData());

    expect(result.success).toBe(false);
    expect(result.message).toContain("DITERIMA");
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("menolak token salah sebelum pesan status (tidak membocorkan status)", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      ...mockPendaftaran,
      status: "DITERIMA",
    });

    const result = await uploadBuktiTransferPendaftaran(
      makeFormData({ tokenAkses: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Kredensial akses");
    expect(result.message).not.toContain("DITERIMA");
  });

  it("path file ditentukan server, bukan dari klien", async () => {
    const result = await uploadBuktiTransferPendaftaran(makeFormData());

    expect(result.success).toBe(true);
    const [path, , options] = mockStorageUpload.mock.calls[0];
    expect(path).toMatch(/^transfer\/REG-2026-00001\//);
    expect(path.endsWith(".jpg")).toBe(true);
    expect(options.upsert).toBe(false);
  });

  it("membersihkan file bila transaction DB gagal", async () => {
    mockPrismaTransaction.mockRejectedValue(new Error("db down"));

    const result = await uploadBuktiTransferPendaftaran(makeFormData());

    expect(result.success).toBe(false);
    expect(mockStorageRemove).toHaveBeenCalled();
  });
});

// ========================================================
// Gerbang verifikasi email
// ========================================================

// OTP DIHAPUS dari alur: gerbang upload bukti tidak lagi membaca
// emailOrangTuaTerverifikasiAt. Test menjaga kontrak baru.
describe("uploadBuktiTransferPendaftaran — Tanpa Gerbang OTP", () => {
  it("meneruskan upload bukti meski kolom verifikasi email warisan null", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      ...mockPendaftaran,
      emailOrangTuaTerverifikasiAt: null,
      emailOrangTuaDiverifikasiOtpAt: null,
    } as never);

    const hasil = await uploadBuktiTransferPendaftaran(makeFormData());

    expect(hasil.success).toBe(true);
    expect(mockStorageUpload).toHaveBeenCalledOnce();
  });

  it("upload tetap sukses ketika email sudah terverifikasi (pendaftaran lama)", async () => {
    const hasil = await uploadBuktiTransferPendaftaran(makeFormData());

    expect(hasil.success).toBe(true);
    expect(mockStorageUpload).toHaveBeenCalledOnce();
  });

  it("token salah tetap ditolak lebih dulu (perlindungan token tidak berubah)", async () => {
    const hasil = await uploadBuktiTransferPendaftaran(
      makeFormData({ tokenAkses: "Z".repeat(32) }),
    );

    expect(hasil.message).toBe("Kredensial akses pendaftaran tidak valid");
  });
});
