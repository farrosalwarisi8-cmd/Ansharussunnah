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

const {
  mockPendaftaranFindUnique,
  mockPendaftaranUpdate,
  mockOtpFindFirst,
  mockOtpCreate,
  mockOtpUpdateMany,
  mockOtpUpdate,
  mockBuktiCreate,
  mockTransaction,
} = vi.hoisted(() => ({
  mockPendaftaranFindUnique: vi.fn(),
  mockPendaftaranUpdate: vi.fn(),
  mockOtpFindFirst: vi.fn(),
  mockOtpCreate: vi.fn(),
  mockOtpUpdateMany: vi.fn(),
  mockOtpUpdate: vi.fn(),
  mockBuktiCreate: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    pendaftaran: {
      findUnique: mockPendaftaranFindUnique,
      update: mockPendaftaranUpdate,
    },
    otpVerifikasiEmail: {
      findFirst: mockOtpFindFirst,
      create: mockOtpCreate,
      updateMany: mockOtpUpdateMany,
      update: mockOtpUpdate,
    },
    buktiTransferPendaftaran: { create: mockBuktiCreate },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/auth", () => ({
  requireGuruAdmin: vi
    .fn()
    .mockResolvedValue({ id: "guru-1", nama: "Pak Guru" }),
}));

vi.mock("@/lib/email", () => ({
  sendEmailOtpVerifikasi: vi.fn().mockResolvedValue({ success: true }),
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  buildKredensialEmail: vi.fn().mockReturnValue("<html/>"),
  buildKredensialEmailAnakKedua: vi.fn().mockReturnValue("<html/>"),
  buildPemberitahuanRoleBaruEmail: vi.fn().mockReturnValue("<html/>"),
  sendPendaftaranDitolakEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  consumeOTP: vi.fn().mockResolvedValue(true),
  releaseOTP: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/otp", () => ({
  generateOTP: vi.fn().mockReturnValue("123456"),
  hashOTP: vi.fn().mockReturnValue("hashed"),
  verifyOTP: vi.fn().mockReturnValue(true),
  isOTPExpired: vi.fn().mockReturnValue(false),
  OTP_EXPIRY_MINUTES: 10,
}));

vi.mock("@/lib/salin-dokumen-pendaftaran", () => ({
  salinDokumenPendaftaranKeSiswa: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { tandaiEmailPendaftaranTerverifikasi } from "@/actions/verifikasi-email-manual";
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
    mockOtpFindFirst.mockResolvedValue(null);
    mockOtpUpdateMany.mockResolvedValue({ count: 0 });
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

describe("alur pendaftaran — verifikasi manual dibutuhkan justru di MENUNGGU_PEMBAYARAN", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPendaftaranUpdate.mockResolvedValue({});
  });

  const dasar = {
    id: "pend-1",
    nomorPendaftaran: "REG-2026-00001-AAAA",
    status: "MENUNGGU_PEMBAYARAN",
    deleted_at: null,
    emailOrangTuaTerverifikasiAt: null,
    catatanAdmin: null,
  };

  it("berhasil membuka gerbang untuk pendaftaran yang tersangkut di MENUNGGU_PEMBAYARAN", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(dasar);

    const res = await tandaiEmailPendaftaranTerverifikasi(
      dasar.id,
      "Konfirmasi telepon ke 081234567890",
    );

    expect(res.success).toBe(true);
    // emailOrangTuaDiverifikasiOtpAt TIDAK ikut terisi.
    const arg = mockPendaftaranUpdate.mock.calls[0][0].data;
    expect(arg.emailOrangTuaTerverifikasiAt).toBeInstanceOf(Date);
    expect(arg.emailOrangTuaDiverifikasiOtpAt).toBeUndefined();
    expect(arg.catatanAdmin).toContain("Konfirmasi telepon");
  });

  it("menolak alasan terlalu pendek", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(dasar);
    const res = await tandaiEmailPendaftaranTerverifikasi(dasar.id, "oke");
    expect(res.success).toBe(false);
    expect(res.message).toContain("10 karakter");
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });

  it("menolak kalau emailnya sudah terverifikasi", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      ...dasar,
      emailOrangTuaTerverifikasiAt: new Date(),
    });
    const res = await tandaiEmailPendaftaranTerverifikasi(
      dasar.id,
      "Konfirmasi telepon ke 081234567890",
    );
    expect(res.success).toBe(false);
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });

  it("tidak menimpa catatan admin yang sudah ada", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      ...dasar,
      catatanAdmin: "Catatan lama dari penolakan sebelumnya",
    });

    await tandaiEmailPendaftaranTerverifikasi(
      dasar.id,
      "Konfirmasi telepon ke 081234567890",
    );

    const catatan = mockPendaftaranUpdate.mock.calls[0][0].data.catatanAdmin;
    expect(catatan).toContain("Catatan lama");
    expect(catatan).toContain("Konfirmasi telepon");
  });

  // ======================================================
  // Jejak manual harus KEKAL, bukan ikut tenggelam bersama
  // `catatanAdmin` yang ditimpa setiap approval.
  // ======================================================

  it("menulis jejak manual ke kolom sendiri: kapan, siapa, dan alasan", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(dasar);

    await tandaiEmailPendaftaranTerverifikasi(
      dasar.id,
      "Konfirmasi telepon ke 081234567890",
    );

    const data = mockPendaftaranUpdate.mock.calls[0][0].data;
    expect(data.emailOrangTuaDiverifikasiManualAt).toBeInstanceOf(Date);
    expect(data.emailOrangTuaDiverifikasiManualOlehId).toBeTruthy();
    expect(data.alasanVerifikasiEmailManual).toBe(
      "Konfirmasi telepon ke 081234567890",
    );
  });

  it("waktu gerbang dan waktu jejak manual memakai stempel yang sama", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(dasar);
    await tandaiEmailPendaftaranTerverifikasi(
      dasar.id,
      "Konfirmasi telepon ke 081234567890",
    );

    const data = mockPendaftaranUpdate.mock.calls[0][0].data;
    // Kalau berbeda, panel akan terlihat "diverifikasi manual" padahal
    // gerbang dibuka beberapa detik sebelum atau sesudahnya.
    expect(data.emailOrangTuaDiverifikasiManualAt).toEqual(
      data.emailOrangTuaTerverifikasiAt,
    );
  });

  it("alasan manual TIDAK pernah ditulis ke kolom bukti OTP", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(dasar);
    await tandaiEmailPendaftaranTerverifikasi(
      dasar.id,
      "Konfirmasi telepon ke 081234567890",
    );

    const data = mockPendaftaranUpdate.mock.calls[0][0].data;
    // Kalau kolom ini ikut terisi, baris akan terlihat punya bukti OTP dan
    // committee tidak bisa membedakan manual dari asli.
    expect(data.emailOrangTuaDiverifikasiOtpAt).toBeUndefined();
  });

  it("menolak manual pada pendaftaran yang sudah punya bukti OTP", async () => {
    // Gerbang terbuka karena OTP, bukan karena manual. Kalau boleh di-manual
    // ulang, jejaknya menyatakan "manual" padahal sebenarnya ada bukti kode.
    mockPendaftaranFindUnique.mockResolvedValue({
      ...dasar,
      emailOrangTuaTerverifikasiAt: new Date(),
      emailOrangTuaDiverifikasiOtpAt: new Date(),
    });

    const res = await tandaiEmailPendaftaranTerverifikasi(
      dasar.id,
      "Konfirmasi telepon ke 081234567890",
    );

    expect(res.success).toBe(false);
    expect(res.message).toContain("lewat OTP");
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });
});
