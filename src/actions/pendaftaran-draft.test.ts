// src/actions/pendaftaran-draft.test.ts
//
// Test wajib draft (BAGIAN B): lifecycle create → save → resume → delete,
// keamanan token, TTL, dan idempotensi finalisasi.

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockDraftCreate,
  mockDraftFindUnique,
  mockDraftUpdate,
  mockDraftDelete,
  mockDraftUpdateMany,
  mockRateLimitAsync,
  mockGetClientIp,
} = vi.hoisted(() => ({
  mockDraftCreate: vi.fn(),
  mockDraftFindUnique: vi.fn(),
  mockDraftUpdate: vi.fn(),
  mockDraftDelete: vi.fn(),
  mockDraftUpdateMany: vi.fn(),
  mockRateLimitAsync: vi.fn(),
  mockGetClientIp: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    pendaftaranDraft: {
      create: mockDraftCreate,
      findUnique: mockDraftFindUnique,
      update: mockDraftUpdate,
      delete: mockDraftDelete,
      updateMany: mockDraftUpdateMany,
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: (...args: unknown[]) => mockRateLimitAsync(...args),
  getClientIpFromHeaders: (...args: unknown[]) => mockGetClientIp(...args),
}));

import {
  createPendaftaranDraft,
  resumePendaftaranDraft,
  savePendaftaranDraft,
  deletePendaftaranDraft,
  finalizeDraftRow,
} from "@/actions/pendaftaran-draft";
import { hashTokenAkses } from "@/lib/pendaftaran-token";

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimitAsync.mockResolvedValue({
    success: true,
    remaining: 5,
    resetAt: Date.now() + 60_000,
  });
  mockGetClientIp.mockResolvedValue("127.0.0.1");
  mockDraftCreate.mockResolvedValue({ id: "draft-1" });
  mockDraftUpdate.mockResolvedValue({ updatedAt: new Date() });
  mockDraftUpdateMany.mockResolvedValue({ count: 1 });
});

describe("createPendaftaranDraft", () => {
  it("membuat draft kosong: payload boleh objek kosong", async () => {
    const res = await createPendaftaranDraft({}, 1);

    expect(res.success).toBe(true);
    expect(res.data?.resumeToken).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    // Yang tersimpan hanya hash, bukan plaintext.
    expect(mockDraftCreate.mock.calls[0][0].data.resumeTokenHash).toBe(
      hashTokenAkses(res.data!.resumeToken)
    );
  });

  it("menyimpan draft parsial (field wajib masih kosong)", async () => {
    const res = await createPendaftaranDraft({ namaLengkap: "Ah", step1: undefined } as never, 2);

    expect(res.success).toBe(true);
    const payload = mockDraftCreate.mock.calls[0][0].data.payload;
    expect(payload.namaLengkap).toBe("Ah");
  });

  it("menolak field dengan format salah (NISN 5 digit)", async () => {
    const res = await createPendaftaranDraft({ nisn: "12345" }, 1);
    expect(res.success).toBe(false);
    expect(mockDraftCreate).not.toHaveBeenCalled();
  });

  it("menolak payload berupa array / non-object", async () => {
    const res = await createPendaftaranDraft(["x"] as never, 1);
    expect(res.success).toBe(false);
  });

  it("step di luar 1..5 dipaksa ke rentang", async () => {
    await createPendaftaranDraft({}, 99);
    expect(mockDraftCreate.mock.calls[0][0].data.lastStep).toBe(5);
    await createPendaftaranDraft({}, 0);
    expect(mockDraftCreate.mock.calls[1][0].data.lastStep).toBe(1);
  });

  it("ditolak saat rate limit habis", async () => {
    mockRateLimitAsync.mockResolvedValue({ success: false, remaining: 0, resetAt: 0 });
    const res = await createPendaftaranDraft({}, 1);
    expect(res.success).toBe(false);
    expect(res.message).toContain("Terlalu banyak");
  });
});

describe("resumePendaftaranDraft", () => {
  const draftRow = {
    id: "draft-1",
    resumeTokenHash: hashTokenAkses("token-benar-123456"),
    payload: { namaLengkap: "Ahmad" },
    lastStep: 3,
    expiresAt: FUTURE,
    finalizedAt: null,
    updatedAt: new Date(),
  };

  it("membaca draft dengan token benar + mengembalikan lastStep", async () => {
    mockDraftFindUnique.mockResolvedValue(draftRow);

    const res = await resumePendaftaranDraft("token-benar-123456");

    expect(res.success).toBe(true);
    expect(res.data?.payload).toEqual({ namaLengkap: "Ahmad" });
    expect(res.data?.lastStep).toBe(3);
    // Lookup memakai hash, bukan plaintext.
    expect(mockDraftFindUnique.mock.calls[0][0].where.resumeTokenHash).toBe(
      hashTokenAkses("token-benar-123456")
    );
  });

  it("menolak token salah", async () => {
    mockDraftFindUnique.mockResolvedValue(null);

    const res = await resumePendaftaranDraft("token-salah-000000");
    expect(res.success).toBe(false);
  });

  it("menolak draft yang expired", async () => {
    mockDraftFindUnique.mockResolvedValue({
      ...draftRow,
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await resumePendaftaranDraft("token-benar-123456");
    expect(res.success).toBe(false);
    expect(res.message).toContain("kedaluwarsa");
  });

  it("menolak draft yang sudah difinalisasi", async () => {
    mockDraftFindUnique.mockResolvedValue({
      ...draftRow,
      finalizedAt: new Date(),
      nomorPendaftaran: "REG-2026-00001",
    });

    const res = await resumePendaftaranDraft("token-benar-123456");
    expect(res.success).toBe(false);
    expect(res.message).toContain("difinalisasi");
  });

  it("menolak token kosong tanpa menyentuh DB", async () => {
    const res = await resumePendaftaranDraft("");
    expect(res.success).toBe(false);
    expect(mockDraftFindUnique).not.toHaveBeenCalled();
  });
});

describe("savePendaftaranDraft", () => {
  const draftRow = {
    id: "draft-1",
    finalizedAt: null,
    expiresAt: FUTURE,
  };

  it("menyimpan perubahan setelah refresh (simulasi reload)", async () => {
    mockDraftFindUnique.mockResolvedValue(draftRow);

    const res = await savePendaftaranDraft(
      "token-benar-123456",
      { namaLengkap: "Ahmad Fauzi", emailOrangTua: "budi@example.com" },
      3
    );

    expect(res.success).toBe(true);
    const data = mockDraftUpdate.mock.calls[0][0].data;
    expect(data.lastStep).toBe(3);
    expect(data.payload.namaLengkap).toBe("Ahmad Fauzi");
    // TTL diperpanjang saat disimpan.
    expect((data.expiresAt as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it("menolak menyimpan ke draft yang sudah difinalisasi", async () => {
    mockDraftFindUnique.mockResolvedValue({ ...draftRow, finalizedAt: new Date() });

    const res = await savePendaftaranDraft("token-benar-123456", {}, 1);
    expect(res.success).toBe(false);
    expect(res.message).toContain("difinalisasi");
    expect(mockDraftUpdate).not.toHaveBeenCalled();
  });

  it("menolak payload dengan data berbahaya (field asing dibuang, format tetap divalidasi)", async () => {
    const res = await savePendaftaranDraft(
      "token-benar-123456",
      { namaLengkap: "Budi", authId: "injeksi", noHpOrangTua: "abc" },
      1
    );
    // noHpOrangTua format salah → ditolak; field asing tidak ikut.
    expect(res.success).toBe(false);
  });
});

describe("deletePendaftaranDraft", () => {
  it("menghapus draft dengan token benar", async () => {
    mockDraftFindUnique.mockResolvedValue({ id: "draft-1" });

    const res = await deletePendaftaranDraft("token-benar-123456");
    expect(res.success).toBe(true);
    expect(mockDraftDelete).toHaveBeenCalledWith({ where: { id: "draft-1" } });
  });

  it("token salah tetap success (tidak membocorkan keberadaan draft)", async () => {
    mockDraftFindUnique.mockResolvedValue(null);

    const res = await deletePendaftaranDraft("token-salah-000000");
    expect(res.success).toBe(true);
    expect(mockDraftDelete).not.toHaveBeenCalled();
  });
});

describe("finalizeDraftRow (idempotensi finalisasi)", () => {
  it("menandai finalized + nomor pendaftaran", async () => {
    const tx = { pendaftaranDraft: { updateMany: mockDraftUpdateMany } };

    const hasil = await finalizeDraftRow(tx as never, "token-x-123456789", "REG-2026-00001");

    expect(hasil).toBe(true);
    expect(mockDraftUpdateMany).toHaveBeenCalledWith({
      where: {
        resumeTokenHash: hashTokenAkses("token-x-123456789"),
        finalizedAt: null,
      },
      data: {
        finalizedAt: expect.any(Date),
        nomorPendaftaran: "REG-2026-00001",
      },
    });
  });

  it("retry finalisasi pada draft yang sudah final: count 0 → false (tidak ada update kedua)", async () => {
    const tx = {
      pendaftaranDraft: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };

    const hasil = await finalizeDraftRow(tx as never, "token-x-123456789", "REG-2026-00001");
    expect(hasil).toBe(false);
  });

  it("tanpa token: tidak melakukan apa-apa", async () => {
    const tx = { pendaftaranDraft: { updateMany: mockDraftUpdateMany } };
    const hasil = await finalizeDraftRow(tx as never, null, "REG-2026-00001");
    expect(hasil).toBe(false);
    expect(mockDraftUpdateMany).not.toHaveBeenCalled();
  });
});
