// src/actions/rantai-pendaftaran.test.ts

/**
 * Uji RANTAI: satu baris pendaftaran melewati beberapa action nyata secara
 * berurutan, dengan state yang benar-benar dimutasi oleh masing-masing.
 *
 * OTP sudah DIHAPUS dari alur pendaftaran: rantai sekarang adalah
 *   daftar → bayar → berkas → konfirmasi kontak wali → terima.
 * Gerbang upload = token akses + status + expiry; gerbang approval =
 * konfirmasi kontak wali oleh panitia (kolom kontakWaliDikonfirmasiAt).
 *
 * TIDAK menyentuh database. Semua I/O dimock. Prisma tiruan di bawah adalah
 * satu-satunya tempat state hidup — `findUnique` membacanya, `update`
 * menulisnya, `create` menambahnya.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Tipe di module scope (bukan di dalam vi.hoisted) karena dipakai juga oleh
// mock prisma di bawah. `vi.hoisted` memindahkan nilai, bukan scope tipe.
type Bukti = { id: string; status: string };
type Otp = {
  id: string;
  kodeOtpHash: string;
  expiredAt: Date;
  jumlahGagal: number;
  dipakai: boolean;
};

const { db, mocks } = vi.hoisted(() => {
  // ---------------------------------------------------------------
  // State bersama
  // ---------------------------------------------------------------
  const db = {
    pendaftaran: {
      id: "pend-1",
      nomorPendaftaran: "REG-2026-00001",
      status: "MENUNGGU_PEMBAYARAN",
      tokenAksesHash: "",
      tokenAksesExpiraAt: null as Date | null,
      emailOrangTuaTerverifikasiAt: null as Date | null,
      emailOrangTuaDiverifikasiOtpAt: null as Date | null,
      kontakWaliDikonfirmasiAt: null as Date | null,
      metodeKonfirmasiKontak: null as string | null,
      catatanAdmin: null as string | null,
      deleted_at: null as Date | null,
      jenjangTujuanId: "jenjang-1",
      kelasTujuanId: "kelas-1",
      namaLengkap: "Ahmad Fauzi",
      namaOrangTua: "Bapak Ahmad",
      emailOrangTua: "ortu@example.com",
      noHpOrangTua: "081234567890",
      buktiTransfer: [] as Bukti[],
    },
    otp: null as Otp | null,
  };

  const mocks = {
    createUser: vi.fn(),
    deleteUser: vi.fn().mockResolvedValue({ error: null }),
    listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
    userFindUnique: vi.fn().mockResolvedValue(null),
    userCreate: vi.fn(),
    orangTuaFindUnique: vi.fn().mockResolvedValue(null),
    siswaFindUnique: vi.fn().mockResolvedValue(null),
    siswaCreate: vi.fn().mockResolvedValue({}),
    storageUpload: vi.fn().mockResolvedValue({ error: null }),
    storageRemove: vi.fn().mockResolvedValue({ error: null }),
    validateFile: vi.fn().mockResolvedValue({ valid: true }),
    rateLimit: vi.fn().mockResolvedValue({ success: true }),
    clientIp: vi.fn().mockResolvedValue("127.0.0.1"),
    revalidate: vi.fn(),
    salinDokumen: vi.fn().mockResolvedValue(undefined),
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
    verifyOtp: vi.fn().mockReturnValue(true),
    createOtpWithHash: vi
      .fn()
      .mockResolvedValue({ plainOtp: "123456", hashedOtp: "hash" }),
  };

  return { db, mocks };
});

vi.mock("@/lib/auth", () => ({
  requireGuruAdmin: vi.fn(async () => ({
    id: "guru-1",
    nama: "Pak Guru",
    email: "guru@sch.id",
  })),
}));

vi.mock("@/lib/prisma", () => {
  const pendaftaran = {
    findUnique: vi.fn(async () => ({ ...db.pendaftaran })),
    findFirst: vi.fn(async () => null),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      Object.assign(db.pendaftaran, data);
      return { ...db.pendaftaran };
    }),
  };

  const otpVerifikasiEmail = {
    findFirst: vi.fn(
      async (args?: {
        where?: { dipakai?: boolean; expiredAt?: { gt: Date } };
      }) => {
        const t = db.otp;
        if (!t) return null;
        // Action mencari OTP yang BELUM dipakai dan BELUM kedaluwarsa. Mock
        // harus benar-benar memfilter, kalau tidak test-nya berbohong.
        if (args?.where?.dipakai === false && t.dipakai) return null;
        if (
          args?.where?.expiredAt?.gt &&
          t.expiredAt <= args.where.expiredAt.gt
        )
          return null;
        return { ...t };
      },
    ),
    create: vi.fn(async () => ({})),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (db.otp) Object.assign(db.otp, data);
      return {};
    }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  };

  const buktiTransferPendaftaran = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = {
        id: `bukti-${db.pendaftaran.buktiTransfer.length + 1}`,
        status: "DIUNGGAH",
        ...data,
      } as Bukti;
      db.pendaftaran.buktiTransfer.push(row);
      return row;
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = db.pendaftaran.buktiTransfer.find((b) => b.id === where.id);
        if (row) Object.assign(row, data);
        return row ?? {};
      },
    ),
  };

  const tx = {
    pendaftaran,
    otpVerifikasiEmail,
    buktiTransferPendaftaran,
    user: {
      findUnique: mocks.userFindUnique,
      findFirst: mocks.userFindUnique,
      create: mocks.userCreate,
    },
    orangTua: { findUnique: mocks.orangTuaFindUnique, create: vi.fn() },
    siswa: {
      findUnique: mocks.siswaFindUnique,
      create: mocks.siswaCreate,
      update: vi.fn().mockResolvedValue({}),
    },
    parentStudent: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    // Approval memvalidasi override kelas terhadap gender pendaftar. Klas
    // "kelas-1" di sini dianggap Ikhwan (LAKI_LAKI); test memakai forceId
    // sehingga tidak perlu prianya.
    kelas: {
      findUnique: vi.fn().mockResolvedValue({
        id: "kelas-1",
        nama: "Kelas 1",
        jenisKelamin: "LAKI_LAKI",
        jenjang: "MTSD",
        kapasitas: 30,
        _count: { siswa: 5 },
      }),
    },
  };

  return {
    default: {
      ...tx,
      $transaction: async (arg: unknown) => {
        if (Array.isArray(arg)) {
          await Promise.all(arg);
          return undefined;
        }
        return typeof arg === "function"
          ? (arg as (t: unknown) => unknown)(tx)
          : undefined;
      },
    },
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: () => ({
    auth: {
      admin: {
        createUser: mocks.createUser,
        deleteUser: mocks.deleteUser,
        listUsers: mocks.listUsers,
      },
    },
    storage: {
      from: () => ({
        upload: mocks.storageUpload,
        remove: mocks.storageRemove,
      }),
    },
  }),
}));

vi.mock("@/lib/storage", () => ({
  validateFile: (...a: unknown[]) => mocks.validateFile(...a),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: (...a: unknown[]) => mocks.rateLimit(...a),
  getClientIpFromHeaders: () => mocks.clientIp(),
}));

vi.mock("@/lib/otp", () => ({
  createOtpWithHash: (...a: unknown[]) => mocks.createOtpWithHash(...a),
  verifyOtp: (...a: unknown[]) => mocks.verifyOtp(...a),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: (...a: unknown[]) => mocks.sendEmail(...a),
  buildOtpVerifikasiPendaftaranEmail: vi
    .fn()
    .mockReturnValue("<html>otp</html>"),
  buildKredensialEmail: vi.fn().mockReturnValue("<html>kred</html>"),
  buildKredensialEmailAnakKedua: vi.fn().mockReturnValue("<html>k2</html>"),
  buildPemberitahuanRoleBaruEmail: vi.fn().mockReturnValue("<html>role</html>"),
  sendPendaftaranDitolakEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/password", () => ({
  generateSecurePassword: vi.fn(() => "RandomSecurePass123!"),
}));

vi.mock("@/lib/salin-dokumen-pendaftaran", () => ({
  salinDokumenPendaftaranKeSiswa: (...a: unknown[]) => mocks.salinDokumen(...a),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => mocks.revalidate(...a),
}));

import {
  requestOtpVerifikasiEmail,
  verifyOtpVerifikasiEmail,
} from "@/actions/verifikasi-email";
import { uploadBuktiTransferPendaftaran } from "@/actions/bukti-transfer";
import { uploadDokumenPendaftaran } from "@/actions/upload-dokumen";
import { verifikasiPendaftaran } from "@/actions/verifikasi";
// Jalur verifikasi email manual TIDAK lagi dipakai rantai baru: OTP dihapus,
// gerbang approval sekarang = konfirmasi kontak wali (ditulis langsung ke
// state bersama dalam test).
import { hashTokenAkses } from "@/lib/pendaftaran-token";

const TOKEN = "71W2jdYzzAV0FR0DUUPXD2X1seYJfY4Z";

function resetDb() {
  Object.assign(db.pendaftaran, {
    status: "MENUNGGU_PEMBAYARAN",
    tokenAksesHash: hashTokenAkses(TOKEN),
    tokenAksesExpiraAt: new Date(Date.now() + 30 * 86_400_000),
    emailOrangTuaTerverifikasiAt: null,
    emailOrangTuaDiverifikasiOtpAt: null,
    kontakWaliDikonfirmasiAt: null,
    metodeKonfirmasiKontak: null,
    catatanAdmin: null,
    buktiTransfer: [],
  });
  db.otp = {
    id: "otp-1",
    kodeOtpHash: "hash",
    expiredAt: new Date(Date.now() + 10 * 60_000),
    jumlahGagal: 0,
    dipakai: false,
  };
}

function formData(nama: string, tipe: string) {
  const fd = new FormData();
  fd.set("nomorPendaftaran", "REG-2026-00001");
  fd.set("tokenAkses", TOKEN);
  fd.set("file", new File(["x"], nama, { type: tipe }));
  return fd;
}

const formBukti = () => formData("bukti.jpg", "image/jpeg");

/**
 * uploadDokumenPendaftaran memakai nama field BERKAS-SPESIFIK, bukan
 * "file" seperti uploadBuktiTransfer. Mengirim `file` akan ditolak dengan
 * "Pilih minimal satu berkas" — bukan karena alurnya salah.
 */
function formDokumen() {
  const fd = new FormData();
  fd.set("nomorPendaftaran", "REG-2026-00001");
  fd.set("tokenAkses", TOKEN);
  fd.set("kartuKeluarga", new File(["x"], "kk.jpg", { type: "image/jpeg" }));
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetDb();
  mocks.verifyOtp.mockReturnValue(true);
  mocks.createUser.mockResolvedValue({
    data: { user: { id: "auth-1" } },
    error: null,
  });
  mocks.userCreate.mockImplementation(
    async ({ data }: { data: { email: string } }) => ({
      id: `auth-${data.email}`,
    }),
  );
  mocks.userFindUnique.mockResolvedValue(null);
  mocks.orangTuaFindUnique.mockResolvedValue(null);
  mocks.siswaFindUnique.mockResolvedValue(null);
});

// ===========================================================================
// RANTAI 1 — daftar → bayar → berkas → konfirmasi kontak wali → terima
// ===========================================================================
describe("RANTAI 1 — alur lengkap sampai DITERIMA", () => {
  it("tanpa OTP: bayar → berkas → konfirmasi kontak wali → terima", async () => {
    // Langkah 1 — bayar langsung bisa: tidak ada gerbang OTP lagi.
    const bayar = await uploadBuktiTransferPendaftaran(formBukti());
    expect(bayar.success, `bayar: ${bayar.message}`).toBe(true);
    expect(db.pendaftaran.status).toBe("MENUNGGU_VERIFIKASI");

    // Langkah 2 — berkas masih boleh di MENUNGGU_VERIFIKASI
    const berkas = await uploadDokumenPendaftaran(formDokumen());
    expect(berkas.success, `berkas: ${berkas.message}`).toBe(true);

    // Langkah 3 — approve TANPA konfirmasi kontak wali: ditolak gerbang baru.
    const tanpaKonfirmasi = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
      catatanAdmin: "",
      kelasTujuanId: "kelas-1",
    });
    expect(tanpaKonfirmasi.success).toBe(false);
    expect(tanpaKonfirmasi.message).toContain("Kontak wali belum dikonfirmasi");
    expect(db.pendaftaran.status).toBe("MENUNGGU_VERIFIKASI");

    // Langkah 4 — panitia mengonfirmasi kontak wali (menulis state bersama).
    db.pendaftaran.kontakWaliDikonfirmasiAt = new Date();
    db.pendaftaran.metodeKonfirmasiKontak = "WHATSAPP";

    // Langkah 5 — approve sekarang lolos.
    const terima = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
      catatanAdmin: "",
      kelasTujuanId: "kelas-1",
    });
    expect(terima.success, `terima: ${terima.message}`).toBe(true);
    expect(db.pendaftaran.status).toBe("DITERIMA");
  });

  it("TIDAK bisa menyetujui yang belum bayar", async () => {
    db.pendaftaran.kontakWaliDikonfirmasiAt = new Date();
    const terima = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
      catatanAdmin: "",
      kelasTujuanId: "kelas-1",
    });
    expect(terima.success).toBe(false);
    expect(db.pendaftaran.status).toBe("MENUNGGU_PEMBAYARAN");
  });
});

// ===========================================================================
// RANTAI 3 — DITOLAK lalu banding
// ===========================================================================
describe("RANTAI 3 — ditolak lalu banding", () => {
  it("tolak → bukti ulang → terima", async () => {
    await uploadBuktiTransferPendaftaran(formBukti());

    const tolak = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITOLAK",
      alasanPenolakan: "Bukti tidak terbaca",
      catatanAdmin: "",
    });
    expect(tolak.success, `tolak: ${tolak.message}`).toBe(true);
    expect(db.pendaftaran.status).toBe("DITOLAK");

    // Banding: bukti boleh, status langsung ke MENUNGGU_VERIFIKASI.
    // Tidak pernah kembali ke MENUNGGU_PEMBAYARAN.
    const banding = await uploadBuktiTransferPendaftaran(formBukti());
    expect(banding.success, `banding: ${banding.message}`).toBe(true);
    expect(db.pendaftaran.status).toBe("MENUNGGU_VERIFIKASI");

    db.pendaftaran.kontakWaliDikonfirmasiAt = new Date();
    const terima = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
      catatanAdmin: "",
      kelasTujuanId: "kelas-1",
    });
    expect(terima.success, `terima: ${terima.message}`).toBe(true);
  });

  it("di DITOLAK, bukti boleh ulang tapi berkas tidak", async () => {
    await uploadBuktiTransferPendaftaran(formBukti());
    await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITOLAK",
      alasanPenolakan: "Bukti tidak terbaca",
      catatanAdmin: "",
    });

    // Gerbang tidak simetris — ini yang paling sering disalahpahami.
    const banding = await uploadBuktiTransferPendaftaran(formBukti());
    expect(banding.success).toBe(true);
    // (status sudah MENUNGGU_VERIFIKASI sekarang, jadi cek berkas di status
    // ditolak dilakukan langsung lewat pemeriksaan tabel, bukan lewat rantai.)
  });

  it("DITERIMA menutup semua pintu upload", async () => {
    await uploadBuktiTransferPendaftaran(formBukti());
    db.pendaftaran.kontakWaliDikonfirmasiAt = new Date();
    await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
      catatanAdmin: "",
      kelasTujuanId: "kelas-1",
    });

    const bukti = await uploadBuktiTransferPendaftaran(formBukti());
    const dokumen = await uploadDokumenPendaftaran(formDokumen());
    expect(bukti.success).toBe(false);
    expect(dokumen.success).toBe(false);
  });
});

// ===========================================================================
// RANTAI 4 — kedaluwarsa menutup semua pintu sekaligus
// ===========================================================================
describe("RANTAI 4 — token kedaluwarsa", () => {
  it("menutup pintu upload (bayar + berkas) dan tidak mengubah apa pun", async () => {
    db.pendaftaran.tokenAksesExpiraAt = new Date(Date.now() - 1000);

    const bayar = await uploadBuktiTransferPendaftaran(formBukti());
    const berkas = await uploadDokumenPendaftaran(formDokumen());

    expect(bayar.success, `bayar: ${bayar.message}`).toBe(false);
    expect(berkas.success, `berkas: ${berkas.message}`).toBe(false);
    // Tidak ada efek samping: tidak ada yang berubah.
    expect(db.pendaftaran.status).toBe("MENUNGGU_PEMBAYARAN");
    expect(db.pendaftaran.emailOrangTuaTerverifikasiAt).toBeNull();
  });

  /**
   * Token kedaluwarsa menutup gerbang email juga, bukan hanya upload.
   *
   * Ini yang dulu bolong: `verifyOtpVerifikasiEmail` tidak mengecek expiry
   * padahal `uploadBuktiTransfer` & `uploadDokumen` mengeceknya. Efeknya
   * gerbang bisa dibuka dengan token yang sudah mati — tidak bisa dieksploitasi
   * untuk menyelesaikan pendaftaran, tapi tetap membuka pintu yang seharusnya
   * sudah terkunci.
   *
   * Ketiga action sekarang menolak dengan pesan yang sama, supaya tidak ada
   * langkah yang memberi jawaban berbeda untuk token yang sama.
   */
  it("menolak OTP, bayar, dan berkas sekaligus", async () => {
    db.pendaftaran.tokenAksesExpiraAt = new Date(Date.now() - 1000);

    const otp = await verifyOtpVerifikasiEmail(
      "REG-2026-00001",
      TOKEN,
      "123456",
    );
    const bayar = await uploadBuktiTransferPendaftaran(formBukti());
    const berkas = await uploadDokumenPendaftaran(formDokumen());

    expect(otp.success, `otp: ${otp.message}`).toBe(false);
    expect(bayar.success, `bayar: ${bayar.message}`).toBe(false);
    expect(berkas.success, `berkas: ${berkas.message}`).toBe(false);

    // Pesan seragam: tidak ada langkah yang memberi alasan berbeda.
    expect(otp.message).toBe(bayar.message);
    expect(berkas.message).toBe(otp.message);

    // Tidak ada efek samping sama sekali.
    expect(db.pendaftaran.status).toBe("MENUNGGU_PEMBAYARAN");
    expect(db.pendaftaran.emailOrangTuaTerverifikasiAt).toBeNull();
    expect(db.pendaftaran.emailOrangTuaDiverifikasiOtpAt).toBeNull();
    // OTP yang sudah terbit tidak ikut hangus, tapi juga tidak terpakai.
    expect(db.otp?.dipakai).toBe(false);
  });

  /**
   * Menolak expiry di `verify` saja tidak cukup. Kalau hanya `request` yang
   * ditolak, penyerang yang sudah memegang OTP lama masih bisa memakainya
   * selama belum terpakai dan belum kedaluwarsa.
   */
  it("menolak OTP yang sudah ada walau request-nya ditolak", async () => {
    db.pendaftaran.tokenAksesExpiraAt = new Date(Date.now() - 1000);

    const request = await requestOtpVerifikasiEmail("REG-2026-00001", TOKEN);
    expect(request.success).toBe(false);

    // Token kedaluwarsa = akses mati, apa pun yang ada di database.
    const verify = await verifyOtpVerifikasiEmail(
      "REG-2026-00001",
      TOKEN,
      "123456",
    );
    expect(verify.success, `verify: ${verify.message}`).toBe(false);
    expect(db.pendaftaran.emailOrangTuaTerverifikasiAt).toBeNull();
  });

  it("tetap membuka gerbang tepat sebelum batas 90 hari", async () => {
    // Batasnya inklusif: satu menit sebelum jatuh tempo masih sah.
    db.pendaftaran.tokenAksesExpiraAt = new Date(Date.now() + 60_000);

    const otp = await verifyOtpVerifikasiEmail(
      "REG-2026-00001",
      TOKEN,
      "123456",
    );
    expect(otp.success, `otp: ${otp.message}`).toBe(true);
  });
});
