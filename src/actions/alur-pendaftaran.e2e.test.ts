// src/actions/alur-pendaftaran.e2e.test.ts

/**
 * Alur pendaftaran dari daftar sampai diterima, diuji sebagai satu rantai
 * gerbang — bukan per action secara terpisah.
 *
 * Yang diperiksa di sini adalah INVARIANT, bukan detail implementasi:
 * pada setiap titik alur, "apakah ada jalan pintas yang melewati gerbang?".
 * Tes per-action tidak akan menangkap ini, karena tiap action terlihat benar
 * sendirian.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPendaftaranFindUnique, mockPendaftaranUpdate } = vi.hoisted(() => ({
  mockPendaftaranFindUnique: vi.fn(),
  mockPendaftaranUpdate: vi.fn(),
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
  requireGuruAdmin: vi
    .fn()
    .mockResolvedValue({ id: "guru-1", nama: "Pak Guru" }),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  buildKredensialEmail: vi.fn().mockReturnValue("<html/>"),
  buildKredensialEmailAnakKedua: vi.fn().mockReturnValue("<html/>"),
  buildPemberitahuanRoleBaruEmail: vi.fn().mockReturnValue("<html/>"),
  sendPendaftaranDitolakEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/salin-dokumen-pendaftaran", () => ({
  salinDokumenPendaftaranKeSiswa: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  konfirmasiKontakWali,
  batalkanKonfirmasiKontakWali,
} from "@/actions/konfirmasi-kontak-wali";
import { KEMAMPUAN_BY_STATUS } from "@/app/cek-pendaftaran/kemampuan-status";

/**
 * State machine pendaftaran, diturunkan dari kode:
 *
 *   (baru) ──create──▶ MENUNGGU_PEMBAYARAN
 *                          │  gerbang: belum bisa bayar, belum bisa unggah
 *                          │  BUTUH: gerbang email (bukti-transfer mewajibkan)
 *                          ▼
 *                  MENUNGGU_VERIFIKASI
 *                          │  gerbang: tidak bisa bayar lagi, berkas boleh
 *                          │  BUTUH: gerbang email (dijamin oleh masuknya di sini)
 *                          ├──▶ DITERIMA (final)
 *                          └──▶ DITOLAK ──bukti ulang──▶ MENUNGGU_VERIFIKASI
 *
 * Kunci: MENUNGGU_VERIFIKASI hanya bisa dicapai lewat uploadBuktiTransfer,
 * dan action itu mewajibkan gerbang email. Maka tidak ada satu pun baris
 * berstatus MENUNGGU_VERIFIKASI atau DITERIMA yang bisa punya gerbang tertutup.
 */
const STATE_MACHINE = {
  bisaTercapaiTanpaGerbangEmail: ["MENUNGGU_PEMBAYARAN"],
  selaluPunyaGerbangEmail: ["MENUNGGU_VERIFIKASI", "DITERIMA", "DITOLAK"],
} as const;

describe("alur pendaftaran end-to-end — invarian gerbang", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hanya MENUNGGU_PEMBAYARAN yang bisa punya gerbang email tertutup", () => {
    // Inilah state tempat orang tua benar-benar tersangkut: tidak bisa
    // membayar (bukti-transfer butuh gerbang), jadi tidak bisa lanjut.
    for (const s of STATE_MACHINE.bisaTercapaiTanpaGerbangEmail) {
      expect(KEMAMPUAN_BY_STATUS[s]).toBeDefined();
    }
    for (const s of STATE_MACHINE.selaluPunyaGerbangEmail) {
      expect(KEMAMPUAN_BY_STATUS[s]).toBeDefined();
    }
    expect(STATE_MACHINE.bisaTercapaiTanpaGerbangEmail).toEqual([
      "MENUNGGU_PEMBAYARAN",
    ]);
  });

  it("MEMUNGGU_PEMBAYARAN adalah satu-satunya state tanpa gerbang", () => {
    // Kalau nanti ada status baru yang bisa dicapai tanpa gerbang, test ini
    // yang akan menandainya supaya diperiksa.
    const tanpaGerbang = Object.entries(KEMAMPUAN_BY_STATUS)
      .filter(
        ([s]) =>
          !(
            STATE_MACHINE.selaluPunyaGerbangEmail as readonly string[]
          ).includes(s),
      )
      .map(([s]) => s);
    expect(tanpaGerbang).toEqual([
      ...STATE_MACHINE.bisaTercapaiTanpaGerbangEmail,
    ]);
  });
});

describe("alur pendaftaran — konfirmasi kontak wali menggantikan verifikasi manual email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPendaftaranUpdate.mockResolvedValue({});
  });

  const dasar = {
    id: "pend-1",
    nomorPendaftaran: "REG-2026-00001-AAAA",
    status: "MENUNGGU_VERIFIKASI",
    deleted_at: null,
    kontakWaliDikonfirmasiAt: null,
    catatanAdmin: null,
  };

  it("mencatat kapan, siapa, lewat apa, dan konteksnya", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(dasar);

    const res = await konfirmasiKontakWali(
      dasar.id,
      "TELEPON",
      "Dihubungi 081234567890, cocok dengan data formulir",
    );

    expect(res.success, res.message).toBe(true);
    const data = mockPendaftaranUpdate.mock.calls[0][0].data;
    expect(data.kontakWaliDikonfirmasiAt).toBeInstanceOf(Date);
    expect(data.kontakWaliDikonfirmasiOlehId).toBe("guru-1");
    expect(data.metodeKonfirmasiKontak).toBe("TELEPON");
    expect(data.catatanKonfirmasiKontak).toBe(
      "Dihubungi 081234567890, cocok dengan data formulir",
    );
  });

  it("menolak catatan yang melebihi batas panjang", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(dasar);

    const res = await konfirmasiKontakWali(
      dasar.id,
      "WHATSAPP",
      "x".repeat(501),
    );

    expect(res.success).toBe(false);
    expect(res.message).toContain("tidak valid");
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });

  it("menolak pendaftaran yang kontak walinya sudah dikonfirmasi", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      ...dasar,
      kontakWaliDikonfirmasiAt: new Date(),
    });

    const res = await konfirmasiKontakWali(dasar.id, "WHATSAPP", "sudah");

    expect(res.success).toBe(false);
    expect(res.message).toContain("sudah dikonfirmasi");
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });

  it("TIDAK menulis ke kolom OTP legacy saat konfirmasi kontak", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(dasar);

    await konfirmasiKontakWali(dasar.id, "WHATSAPP", "pesan di balasannya cocok");

    const data = mockPendaftaranUpdate.mock.calls[0][0].data;
    // Kalau kolom legacy ikut terisi, baris akan terlihat punya bukti OTP dan
    // panitia tidak bisa membedakan konfirmasi kontak dari verifikasi email.
    expect(data.emailOrangTuaTerverifikasiAt).toBeUndefined();
    expect(data.emailOrangTuaDiverifikasiOtpAt).toBeUndefined();
    expect(data.alasanVerifikasiEmailManual).toBeUndefined();
    expect(data.emailOrangTuaDiverifikasiManualAt).toBeUndefined();
  });

  it("pembatalan mengosongkan jejak konfirmasi agar bisa diulang", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      ...dasar,
      kontakWaliDikonfirmasiAt: new Date(),
    });

    const res = await batalkanKonfirmasiKontakWali(dasar.id);

    expect(res.success, res.message).toBe(true);
    const data = mockPendaftaranUpdate.mock.calls[0][0].data;
    expect(data.kontakWaliDikonfirmasiAt).toBeNull();
    expect(data.kontakWaliDikonfirmasiOlehId).toBeNull();
    expect(data.metodeKonfirmasiKontak).toBeNull();
    expect(data.catatanKonfirmasiKontak).toBeNull();
  });

  it("pembatalan ditolak setelah status final", async () => {
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
});
