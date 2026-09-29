// src/actions/verifikasi-email.test.ts

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    pendaftaran: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    otpVerifikasiEmail: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/otp", () => ({
  createOtpWithHash: vi.fn().mockResolvedValue({
    plainOtp: "123456",
    hashedOtp: "$2a$10$hashedvalue",
  }),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  buildOtpVerifikasiPendaftaranEmail: vi
    .fn()
    .mockReturnValue("<html>OTP pendaftaran</html>"),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: vi.fn().mockResolvedValue({ success: true }),
  getClientIpFromHeaders: vi.fn().mockResolvedValue("127.0.0.1"),
}));

import prisma from "@/lib/prisma";
import { verifyOtp } from "@/lib/otp";
import { sendEmail } from "@/lib/email";
import { rateLimitAsync } from "@/lib/rate-limit";
import { hashTokenAkses } from "@/lib/pendaftaran-token";
import {
  requestOtpVerifikasiEmail,
  verifyOtpVerifikasiEmail,
} from "@/actions/verifikasi-email";

const mockOtpCreate = prisma.otpVerifikasiEmail.create as unknown as Mock;
const mockOtpFindFirst = prisma.otpVerifikasiEmail.findFirst as unknown as Mock;
const mockOtpDeleteMany = prisma.otpVerifikasiEmail
  .deleteMany as unknown as Mock;
const mockTransaction = prisma.$transaction as unknown as Mock;

const TOKEN = "71W2jdYzzAV0FR0DUUPXD2X1seYJfY4Z";
const NOMOR = "REG-2026-00001";

function pendaftaranMock(overrides: Record<string, unknown> = {}) {
  return {
    id: "pend-1",
    nomorPendaftaran: NOMOR,
    tokenAksesHash: hashTokenAkses(TOKEN),
    emailOrangTua: "ortu@example.com",
    namaOrangTua: "Bapak Ahmad",
    namaLengkap: "Ahmad Fauzi",
    emailOrangTuaTerverifikasiAt: null,
    // Token akses masih berlaku secara default. verifyOtpVerifikasiEmail
    // kini menegakkan masa berlaku 90 hari, jadi mock harus punya expiry —
    // tanpa ini SETIAP test akan gagal karena dikira token kedaluwarsa.
    tokenAksesExpiraAt: new Date(Date.now() + 30 * 86_400_000),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimitAsync).mockResolvedValue({ success: true } as never);
  mockTransaction.mockImplementation(async (ops: unknown) => ops as never);
});

// ========================================================
// Otorisasi: nomor + token akses
// ========================================================

describe("requestOtpVerifikasiEmail — otorisasi", () => {
  it("menolak token yang salah tanpa mengirim email", async () => {
    vi.mocked(prisma.pendaftaran.findUnique).mockResolvedValue(
      pendaftaranMock() as never,
    );

    const hasil = await requestOtpVerifikasiEmail(NOMOR, "A".repeat(32));

    expect(hasil.success).toBe(false);
    expect(hasil.message).toBe("Kredensial akses pendaftaran tidak valid");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.otpVerifikasiEmail.create).not.toHaveBeenCalled();
  });

  it("menolak nomor yang tidak ada", async () => {
    vi.mocked(prisma.pendaftaran.findUnique).mockResolvedValue(null);

    const hasil = await requestOtpVerifikasiEmail(
      "REG-9999-99999-XXXXX",
      TOKEN,
    );

    expect(hasil.success).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("menolak token dengan bentuk tidak valid tanpa query database", async () => {
    const hasil = await requestOtpVerifikasiEmail(NOMOR, "pendek");

    expect(hasil.success).toBe(false);
    expect(prisma.pendaftaran.findUnique).not.toHaveBeenCalled();
  });

  it("memberi pesan yang sama untuk token salah dan nomor tidak ada (anti enumerasi)", async () => {
    vi.mocked(prisma.pendaftaran.findUnique).mockResolvedValue(null);
    const tanpaNomor = await requestOtpVerifikasiEmail("REG-9999", TOKEN);

    vi.mocked(prisma.pendaftaran.findUnique).mockResolvedValue(
      pendaftaranMock() as never,
    );
    const tokenSalah = await requestOtpVerifikasiEmail(NOMOR, "B".repeat(32));

    expect(tanpaNomor.message).toBe(tokenSalah.message);
  });
});

// ========================================================
// Request OTP
// ========================================================

describe("requestOtpVerifikasiEmail — pengiriman", () => {
  beforeEach(() => {
    vi.mocked(prisma.pendaftaran.findUnique).mockResolvedValue(
      pendaftaranMock() as never,
    );
    vi.mocked(prisma.otpVerifikasiEmail.findFirst).mockResolvedValue(null);
  });

  it("menyimpan hash OTP (bukan plaintext) dan mengirim ke email orang tua", async () => {
    const hasil = await requestOtpVerifikasiEmail(NOMOR, TOKEN);

    expect(hasil.success).toBe(true);
    const createCall = mockOtpCreate.mock.calls[0][0];
    expect(createCall.data.kodeOtpHash).toBe("$2a$10$hashedvalue");
    expect(JSON.stringify(createCall.data)).not.toContain("123456");
    expect(createCall.data.pendaftaranId).toBe("pend-1");

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ortu@example.com" }),
    );
  });

  it("menjatuhkan OTP lama sebelum menerbitkan yang baru", async () => {
    await requestOtpVerifikasiEmail(NOMOR, TOKEN);

    expect(prisma.otpVerifikasiEmail.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pendaftaranId: "pend-1", digunakan: false },
        data: { digunakan: true },
      }),
    );
  });

  it("menolak resend dalam masa cooldown tanpa mengirim email baru", async () => {
    vi.mocked(prisma.otpVerifikasiEmail.findFirst).mockResolvedValue({
      id: "otp-lama",
      createdAt: new Date(),
    } as never);

    const hasil = await requestOtpVerifikasiEmail(NOMOR, TOKEN);

    expect(hasil.success).toBe(false);
    expect(hasil.message).toContain("Kode masih aktif");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.otpVerifikasiEmail.create).not.toHaveBeenCalled();
  });

  it("idempoten: tidak mengirim ulang bila email sudah punya bukti OTP", async () => {
    vi.mocked(prisma.pendaftaran.findUnique).mockResolvedValue(
      pendaftaranMock({
        emailOrangTuaDiverifikasiOtpAt: new Date("2026-01-01"),
      }) as never,
    );

    const hasil = await requestOtpVerifikasiEmail(NOMOR, TOKEN);

    expect(hasil.success).toBe(true);
    expect(hasil.message).toContain("sudah terverifikasi");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("dibatasi per-IP", async () => {
    vi.mocked(rateLimitAsync).mockResolvedValue({ success: false } as never);

    const hasil = await requestOtpVerifikasiEmail(NOMOR, TOKEN);

    expect(hasil.success).toBe(false);
    expect(hasil.message).toContain("Terlalu banyak permintaan");
    expect(prisma.pendaftaran.findUnique).not.toHaveBeenCalled();
  });
});

// ========================================================
// Verifikasi OTP
// ========================================================

describe("verifyOtpVerifikasiEmail — verifikasi", () => {
  const tokenAktif = {
    id: "otp-1",
    kodeOtpHash: "$2a$10$hashed",
    jumlahGagal: 0,
  };

  beforeEach(() => {
    vi.mocked(prisma.pendaftaran.findUnique).mockResolvedValue(
      pendaftaranMock() as never,
    );
    vi.mocked(prisma.otpVerifikasiEmail.findFirst).mockResolvedValue(
      tokenAktif as never,
    );
  });

  it("menandai pendaftaran terverifikasi & memakai token dalam satu transaksi", async () => {
    vi.mocked(verifyOtp).mockResolvedValue(true);

    const hasil = await verifyOtpVerifikasiEmail(NOMOR, TOKEN, "123456");

    expect(hasil.success).toBe(true);
    const [ops] = mockTransaction.mock.calls[0];
    expect(ops).toHaveLength(2);
    expect(prisma.otpVerifikasiEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "otp-1" },
        data: { digunakan: true },
      }),
    );
    expect(prisma.pendaftaran.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pend-1" },
        data: {
          emailOrangTuaTerverifikasiAt: expect.any(Date),
          emailOrangTuaDiverifikasiOtpAt: expect.any(Date),
        },
      }),
    );
  });

  it("upgrade: gerbang grandfather tetap utuh, hanya kolom bukti yang diisi", async () => {
    // Grandfathered: gerbang sudah terisi sejak migrasi, tapi belum pernah ada
    // bukti OTP. Setelah upgrade, timestamp gerbang TIDAK boleh berubah —
    // kalau berubah, kita menghilangkan jejak bahwa ini cuma warisan.
    const grandfathered = new Date("2026-01-01");
    vi.mocked(prisma.pendaftaran.findUnique).mockResolvedValue(
      pendaftaranMock({
        emailOrangTuaTerverifikasiAt: grandfathered,
        emailOrangTuaDiverifikasiOtpAt: null,
      }) as never,
    );
    vi.mocked(verifyOtp).mockResolvedValue(true);

    const hasil = await verifyOtpVerifikasiEmail(NOMOR, TOKEN, "123456");

    expect(hasil.success).toBe(true);
    const data = vi.mocked(prisma.pendaftaran.update).mock.calls[0][0].data;
    expect(data.emailOrangTuaTerverifikasiAt).toEqual(grandfathered);
    expect(data.emailOrangTuaDiverifikasiOtpAt).toEqual(expect.any(Date));
  });

  it("upgrade: pendaftaran lama tetap boleh meminta kode meski gerbangnya terbuka", async () => {
    vi.mocked(prisma.pendaftaran.findUnique).mockResolvedValue(
      pendaftaranMock({
        emailOrangTuaTerverifikasiAt: new Date("2026-01-01"),
        emailOrangTuaDiverifikasiOtpAt: null,
      }) as never,
    );
    mockOtpFindFirst.mockResolvedValue(null);

    const hasil = await requestOtpVerifikasiEmail(NOMOR, TOKEN);

    expect(hasil.success).toBe(true);
    expect(mockOtpCreate).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalled();
  });

  it("menambah counter gagal saat kode salah, tanpa menandai terverifikasi", async () => {
    vi.mocked(verifyOtp).mockResolvedValue(false);

    const hasil = await verifyOtpVerifikasiEmail(NOMOR, TOKEN, "000000");

    expect(hasil.success).toBe(false);
    expect(hasil.message).toBe("Kode verifikasi tidak valid");
    expect(prisma.otpVerifikasiEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "otp-1" },
        data: { jumlahGagal: 1, digunakan: false },
      }),
    );
    expect(prisma.pendaftaran.update).not.toHaveBeenCalled();
  });

  it("membatalkan token setelah batas percobaan habis", async () => {
    vi.mocked(verifyOtp).mockResolvedValue(false);
    vi.mocked(prisma.otpVerifikasiEmail.findFirst).mockResolvedValue({
      ...tokenAktif,
      jumlahGagal: 2,
    } as never);

    const hasil = await verifyOtpVerifikasiEmail(NOMOR, TOKEN, "000000");

    expect(hasil.success).toBe(false);
    expect(hasil.message).toContain("Terlalu banyak percobaan");
    expect(prisma.otpVerifikasiEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { jumlahGagal: 3, digunakan: true },
      }),
    );
  });

  it("menolak kode yang tidak 6 digit tanpa menyentuh bcrypt", async () => {
    const hasil = await verifyOtpVerifikasiEmail(NOMOR, TOKEN, "12ab");

    expect(hasil.success).toBe(false);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("memberi pesan yang sama untuk kode salah dan tidak ada token aktif", async () => {
    vi.mocked(verifyOtp).mockResolvedValue(false);
    const kodeSalah = await verifyOtpVerifikasiEmail(NOMOR, TOKEN, "000000");

    vi.mocked(prisma.otpVerifikasiEmail.findFirst).mockResolvedValue(null);
    const tanpaToken = await verifyOtpVerifikasiEmail(NOMOR, TOKEN, "000000");

    expect(tanpaToken.message).toBe(kodeSalah.message);
  });

  it("idempoten: pendaftaran yang sudah punya bukti OTP tidak perlu OTP lagi", async () => {
    vi.mocked(prisma.pendaftaran.findUnique).mockResolvedValue(
      pendaftaranMock({
        emailOrangTuaDiverifikasiOtpAt: new Date("2026-01-01"),
      }) as never,
    );

    const hasil = await verifyOtpVerifikasiEmail(NOMOR, TOKEN, "123456");

    expect(hasil.success).toBe(true);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("dibatasi per-IP sebelum memverifikasi", async () => {
    vi.mocked(rateLimitAsync).mockResolvedValue({ success: false } as never);

    const hasil = await verifyOtpVerifikasiEmail(NOMOR, TOKEN, "123456");

    expect(hasil.success).toBe(false);
    expect(hasil.message).toContain("Terlalu banyak percobaan");
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

// ========================================================
// Kebersihan tabel
// ========================================================

describe("requestOtpVerifikasiEmail — pembersihan", () => {
  it("membuang OTP kedaluwarsa milik pendaftaran tersebut sebelum menerbitkan yang baru", async () => {
    vi.mocked(prisma.pendaftaran.findUnique).mockResolvedValue(
      pendaftaranMock() as never,
    );
    mockOtpFindFirst.mockResolvedValue(null);

    await requestOtpVerifikasiEmail(NOMOR, TOKEN);

    expect(mockOtpDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ pendaftaranId: "pend-1" }),
      }),
    );
  });
});

// ========================================================
// Masa berlaku token akses (90 hari)
// ========================================================

describe("Masa berlaku token akses", () => {
  const EXPIRED = new Date(Date.now() - 1000);

  it("requestOtp menolak token kedaluwarsa tanpa mengirim email", async () => {
    vi.mocked(prisma.pendaftaran.findUnique).mockResolvedValue(
      pendaftaranMock({ tokenAksesExpiraAt: EXPIRED }) as never,
    );

    const hasil = await requestOtpVerifikasiEmail(NOMOR, TOKEN);

    expect(hasil.success).toBe(false);
    expect(hasil.message).toContain("90 hari");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("verifyOtp menolak token kedaluwarsa tanpa membuka gerbang", async () => {
    vi.mocked(prisma.pendaftaran.findUnique).mockResolvedValue(
      pendaftaranMock({ tokenAksesExpiraAt: EXPIRED }) as never,
    );

    const hasil = await verifyOtpVerifikasiEmail(NOMOR, TOKEN, "123456");

    expect(hasil.success).toBe(false);
    expect(hasil.message).toContain("90 hari");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("tolak token kedaluwarsa memakai pesan yang sama di kedua fungsi", async () => {
    vi.mocked(prisma.pendaftaran.findUnique).mockResolvedValue(
      pendaftaranMock({ tokenAksesExpiraAt: EXPIRED }) as never,
    );
    const request = await requestOtpVerifikasiEmail(NOMOR, TOKEN);
    const verify = await verifyOtpVerifikasiEmail(NOMOR, TOKEN, "123456");

    expect(request.message).toBe(verify.message);
  });

  it("tolak token kedaluwarsa TIDAK membocorkan ke pennyang tanpa token", async () => {
    // Token salah harus tetap dapat pesan "tidak valid" yang generik, bukan
    // pesan expiry — kalau dibalik, penyerang bisa memetakan token mana
    // yang masih hidup.
    const hasil = await verifyOtpVerifikasiEmail(
      NOMOR,
      "TOKEN-SALAH",
      "123456",
    );
    expect(hasil.message).not.toContain("90 hari");
  });

  it("token tepat sebelum jatuh tempo masih diterima", async () => {
    vi.mocked(prisma.pendaftaran.findUnique).mockResolvedValue(
      pendaftaranMock({
        tokenAksesExpiraAt: new Date(Date.now() + 60_000),
      }) as never,
    );
    mockOtpFindFirst.mockResolvedValue({
      id: "otp-1",
      kodeOtpHash: "hash",
      jumlahGagal: 0,
    } as never);
    vi.mocked(verifyOtp).mockResolvedValue(true);

    const hasil = await verifyOtpVerifikasiEmail(NOMOR, TOKEN, "123456");
    expect(hasil.success, `verify: ${hasil.message}`).toBe(true);
  });
});
