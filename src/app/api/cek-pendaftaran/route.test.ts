// src/app/api/cek-pendaftaran/route.test.ts
//
// Endpoint /api/cek-pendaftaran adalah SATU-SATUNYA sumber data status dokumen
// untuk halaman cek status publik. Email konfirmasi pendaftaran menjanjikan
// "status berkas tertera di halaman cek status" — test ini menjaga janji itu:
// response WAJIB memuat status kelengkapan dokumen dalam bentuk boolean, dan
// TIDAK boleh membocorkan path file di bucket (endpoint ini publik).

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPendaftaranFindUnique, mockRateLimitAsync } = vi.hoisted(() => ({
  mockPendaftaranFindUnique: vi.fn(),
  mockRateLimitAsync: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    pendaftaran: {
      findUnique: (...args: unknown[]) => mockPendaftaranFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: (...args: unknown[]) => mockRateLimitAsync(...args),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { GET } from "@/app/api/cek-pendaftaran/route";
import type { NextRequest } from "next/server";

function makeRequest(nomor: string | null): NextRequest {
  const url = new URL(
    nomor
      ? `http://localhost/api/cek-pendaftaran?nomor=${encodeURIComponent(nomor)}`
      : "http://localhost/api/cek-pendaftaran",
  );
  return { url } as unknown as NextRequest;
}

const mockPendaftaran = {
  nomorPendaftaran: "REG-2026-00001-A1B2",
  namaLengkap: "Ahmad Fauzi Saputra",
  status: "MENUNGGU_VERIFIKASI",
  alasanPenolakan: null,
  emailOrangTuaTerverifikasiAt: new Date("2026-09-01"),
  // Path bucket yang BENAR-BENAR tersimpan — tidak boleh muncul di response.
  dokKartuKeluarga: "dokumen-pendaftaran/pendaftaran/pend-1/abc123.jpg",
  dokAkteLahir: null,
  dokFoto: "dokumen-pendaftaran/pendaftaran/pend-1/foto456.png",
  dokLainnya: ["dokumen-pendaftaran/pendaftaran/pend-1/surat789.pdf"],
  jenjangTujuan: { nama: "Madrasah Ibtidaiyyah" },
  kelasTujuan: null,
  createdAt: new Date("2026-08-30"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimitAsync.mockResolvedValue({
    success: true,
    remaining: 5,
    resetAt: Date.now() + 60_000,
  });
  mockPendaftaranFindUnique.mockResolvedValue(mockPendaftaran);
});

describe("GET /api/cek-pendaftaran", () => {
  it("memuat status kelengkapan dokumen sebagai boolean + jumlah lainnya", async () => {
    const res = await GET(makeRequest("REG-2026-00001-A1B2"));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.data.dokumen).toEqual({
      kartuKeluarga: true,
      akteLahir: false,
      foto: true,
      lainnya: 1,
      jumlahLengkap: 2,
    });
  });

  it("TIDAK lagi membocorkan status verifikasi email", async () => {
    // Verifikasi email tidak lagi jadi gerbang apa pun. Kalau field ini masih
    // muncul, berarti ada jalur yang diam-diam masih bergantung padanya.
    const res = await GET(makeRequest("REG-2026-00001-A1B2"));
    const body = await res.json();

    expect(body.data).not.toHaveProperty("emailTerverifikasi");
  });

  it("TIDAK membocorkan path file bucket ke response publik", async () => {
    const res = await GET(makeRequest("REG-2026-00001-A1B2"));
    const raw = JSON.stringify(await res.json());

    expect(raw).not.toContain("dokumen-pendaftaran/");
  });

  it("dokumen kosong tetap tampil sebagai false, bukan hilang dari response", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      ...mockPendaftaran,
      dokKartuKeluarga: null,
      dokFoto: null,
      dokLainnya: [],
    });

    const res = await GET(makeRequest("REG-2026-00001-A1B2"));
    const body = await res.json();

    expect(body.data.dokumen).toEqual({
      kartuKeluarga: false,
      akteLahir: false,
      foto: false,
      lainnya: 0,
      jumlahLengkap: 0,
    });
  });

  it("menolak request tanpa nomor", async () => {
    const res = await GET(makeRequest(null));

    expect(res.status).toBe(400);
  });

  it("404 bila pendaftaran tidak ditemukan", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("REG-9999-00000-XXXX"));

    expect(res.status).toBe(404);
  });

  it("429 bila rate limit terlampaui", async () => {
    mockRateLimitAsync.mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const res = await GET(makeRequest("REG-2026-00001-A1B2"));

    expect(res.status).toBe(429);
  });
});
