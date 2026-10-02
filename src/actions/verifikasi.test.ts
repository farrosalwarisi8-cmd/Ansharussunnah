// src/actions/verifikasi.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockPrismaTransaction,
  mockPendaftaranFindUnique,
  mockPendaftaranFindFirst,
  mockPendaftaranUpdate,
  mockPendaftaranUpdateMany,
  mockDeleteUser,
  mockCreateUser,
  mockListUsers,
  mockUserFindUnique,
  mockUserCreate,
  mockOrangTuaFindUnique,
  mockSiswaFindUnique,
  mockSiswaCreate,
  mockParentStudentCreate,
  mockParentStudentFindUnique,
  mockBuktiTransferUpdate,
  mockSiswaUpdate,
  mockSalinDokumen,
  mockStorageRemove,
  mockKelasFindUnique,
} = vi.hoisted(() => ({
  mockPrismaTransaction: vi.fn(),
  mockPendaftaranFindUnique: vi.fn(),
  mockPendaftaranFindFirst: vi.fn().mockResolvedValue(null),
  mockPendaftaranUpdate: vi.fn(),
  mockPendaftaranUpdateMany: vi.fn().mockResolvedValue({ count: 1 }),
  mockDeleteUser: vi.fn().mockResolvedValue({ error: null }),
  mockCreateUser: vi.fn(),
  mockListUsers: vi.fn().mockResolvedValue({
    data: { users: [] },
    error: null,
  }),
  mockUserFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
  mockOrangTuaFindUnique: vi.fn(),
  mockSiswaFindUnique: vi.fn(),
  mockSiswaCreate: vi.fn(),
  mockParentStudentCreate: vi.fn(),
  mockParentStudentFindUnique: vi.fn().mockResolvedValue(null),
  mockBuktiTransferUpdate: vi.fn(),
  mockSiswaUpdate: vi.fn(),
  mockSalinDokumen: vi.fn(),
  mockStorageRemove: vi.fn().mockResolvedValue({ error: null }),
  mockKelasFindUnique: vi.fn().mockResolvedValue({
    id: "kelas-1",
    nama: "Kelas 1",
    kapasitas: 30,
    _count: { siswa: 5 },
  }),
}));

vi.mock("@/lib/auth", () => ({
  requireGuruAdmin: vi.fn().mockResolvedValue({
    id: "guru-1",
    email: "guru@sekolah.sch.id",
    role: "GURU",
  }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    pendaftaran: {
      findUnique: mockPendaftaranFindUnique,
      findFirst: mockPendaftaranFindFirst,
      update: mockPendaftaranUpdate,
      // Klaim atomik (updateMany) dipakai di luar transaksi:
      // MENUNGGU_VERIFIKASI → SEDANG_DIPROSES (claim) dan
      // pemulihan klaim stale. Mock default mengembalikan
      // { count: 1 } (claim berhasil).
      updateMany: mockPendaftaranUpdateMany,
      count: vi.fn().mockResolvedValue(0),
    },
    kelas: {
      findUnique: mockKelasFindUnique,
    },
    buktiTransferPendaftaran: { update: mockBuktiTransferUpdate },
    user: {
      findUnique: mockUserFindUnique,
      findFirst: mockUserFindUnique,
      create: mockUserCreate,
    },
    orangTua: {
      findUnique: mockOrangTuaFindUnique,
    },
    siswa: {
      findUnique: mockSiswaFindUnique,
      create: mockSiswaCreate,
      update: mockSiswaUpdate,
    },
    parentStudent: {
      create: mockParentStudentCreate,
      findUnique: mockParentStudentFindUnique,
    },
    $transaction: mockPrismaTransaction,
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: () => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
        listUsers: mockListUsers,
      },
    },
    storage: {
      from: () => ({
        remove: mockStorageRemove,
      }),
    },
  }),
}));

vi.mock("@/lib/password", () => ({
  generateSecurePassword: vi.fn().mockReturnValue("RandomSecurePass123!"),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  buildKredensialEmail: vi.fn().mockReturnValue("<html>Email</html>"),
  buildKredensialEmailAnakKedua: vi
    .fn()
    .mockReturnValue("<html>Email Anak Kedua</html>"),
  buildPemberitahuanRoleBaruEmail: vi
    .fn()
    .mockReturnValue("<html>Pemberitahuan Role</html>"),
  sendPendaftaranDitolakEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/salin-dokumen-pendaftaran", () => ({
  salinDokumenPendaftaranKeSiswa: (...args: unknown[]) =>
    mockSalinDokumen(...args),
}));

import { verifikasiPendaftaran } from "@/actions/verifikasi";
import { sendPendaftaranDitolakEmail } from "@/lib/email";

// ========================================================
// Data dummy — pendaftaran dengan semua field EMIS terisi
// ========================================================

const pendaftaranWithEmis = {
  id: "pend-1",
  nomorPendaftaran: "REG-2026-00001",
  namaLengkap: "Ahmad Fauzi",
  emailOrangTua: "ortu@example.com",
  namaOrangTua: "Bapak Ahmad",
  noHpOrangTua: "081234567890",
  // GERBANG APPROVAL BARU: konfirmasi kontak wali oleh panitia (pengganti
  // OTP yang dihapus dari alur). Fixture dasar mewakili pendaftaran yang
  // sudah dikonfirmasi; kasus "belum dikonfirmasi" diuji terpisah.
  kontakWaliDikonfirmasiAt: new Date("2026-01-01"),
  metodeKonfirmasiKontak: "WHATSAPP",
  emailOrangTuaTerverifikasiAt: new Date("2026-01-01"),
  emailOrangTuaDiverifikasiOtpAt: new Date("2026-01-01"),
  alamatSiswa: "Jl. Mawar No. 10, RT 01/RW 02, Kel. Sukamaju",
  alamatOrangTua: "Jl. Melati No. 5",
  tempatLahir: "Jakarta",
  tanggalLahir: new Date("2015-01-15"),
  jenisKelamin: "LAKI_LAKI",
  nisn: "0081234567",
  // Field EMIS
  agama: "Islam",
  noHpSiswa: "081298765432",
  namaAyahKandung: "Budi Santoso",
  statusAyahKandung: "MASIH_HIDUP",
  nikAyah: "3201011501900001",
  namaIbuKandung: "Siti Rahmawati",
  statusIbuKandung: "MASIH_HIDUP",
  nikIbu: "3201011501900002",
  statusWali: "SAMA_DENGAN_AYAH",
  namaWali: null,
  kewarganegaraan: "WNI",
  kitas: null,
  asalNegara: null,
  kelasTujuanId: "kelas-1",
  buktiTransfer: [{ id: "bt-1" }],
  status: "MENUNGGU_VERIFIKASI",
};

const pendaftaranMinimal = {
  id: "pend-2",
  nomorPendaftaran: "REG-2026-00002",
  namaLengkap: "Siswa Minimal",
  emailOrangTua: "ortumin@example.com",
  namaOrangTua: "Orang Tua Minimal",
  noHpOrangTua: "085612345678",
  kontakWaliDikonfirmasiAt: new Date("2026-01-01"),
  metodeKonfirmasiKontak: "TELEPON",
  emailOrangTuaTerverifikasiAt: new Date("2026-01-01"),
  emailOrangTuaDiverifikasiOtpAt: new Date("2026-01-01"),
  alamatSiswa: "Jl. Kenanga No. 20, RT 05/RW 03, Kel. Sukamaju",
  alamatOrangTua: null,
  tempatLahir: "Bandung",
  tanggalLahir: new Date("2012-03-10"),
  jenisKelamin: "PEREMPUAN",
  nisn: null,
  // Field EMIS semua kosong/null
  agama: null,
  noHpSiswa: null,
  namaAyahKandung: null,
  statusAyahKandung: null,
  nikAyah: null,
  namaIbuKandung: null,
  statusIbuKandung: null,
  nikIbu: null,
  statusWali: null,
  namaWali: null,
  kewarganegaraan: "WNI",
  kitas: null,
  asalNegara: null,
  kelasTujuanId: null,
  buktiTransfer: [{ id: "bt-2" }],
  status: "MENUNGGU_VERIFIKASI",
};

const pendaftaranWna = {
  id: "pend-3",
  nomorPendaftaran: "REG-2026-00003",
  namaLengkap: "Ahmad Al-Farisi",
  emailOrangTua: "mohammed@email.com",
  namaOrangTua: "Mohammed Al-Farisi",
  noHpOrangTua: "081234567890",
  kontakWaliDikonfirmasiAt: new Date("2026-01-01"),
  metodeKonfirmasiKontak: "LANGSUNG",
  emailOrangTuaTerverifikasiAt: new Date("2026-01-01"),
  emailOrangTuaDiverifikasiOtpAt: new Date("2026-01-01"),
  alamatSiswa: "Jl. Internasional No. 10, Jakarta Selatan",
  alamatOrangTua: null,
  tempatLahir: "Kuala Lumpur",
  tanggalLahir: new Date("2010-06-15"),
  jenisKelamin: "LAKI_LAKI",
  nisn: null,
  agama: "Islam",
  noHpSiswa: null,
  namaAyahKandung: "Mohammed Al-Farisi",
  statusAyahKandung: "MASIH_HIDUP",
  nikAyah: null,
  namaIbuKandung: "Fatimah Al-Farisi",
  statusIbuKandung: "MASIH_HIDUP",
  nikIbu: null,
  statusWali: "SAMA_DENGAN_AYAH",
  namaWali: null,
  kewarganegaraan: "WNA",
  kitas: "KITAS-2024-001",
  asalNegara: "Malaysia",
  kelasTujuanId: "kelas-1",
  buktiTransfer: [{ id: "bt-3" }],
  status: "MENUNGGU_VERIFIKASI",
};

// ========================================================
// Helper: setup transaction mock yang mengeksekusi callback
// ========================================================

function setupTransactionMock() {
  mockPrismaTransaction.mockImplementation(
    async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const tx = {
        user: {
          findUnique: mockUserFindUnique,
          findFirst: mockUserFindUnique,
          create: mockUserCreate,
        },
        orangTua: {
          findUnique: mockOrangTuaFindUnique,
        },
        siswa: {
          findUnique: mockSiswaFindUnique,
          create: mockSiswaCreate,
        },
        parentStudent: {
          create: mockParentStudentCreate,
          findUnique: mockParentStudentFindUnique,
        },
        pendaftaran: {
          findFirst: mockPendaftaranFindFirst,
          findUnique: mockPendaftaranFindUnique,
          update: mockPendaftaranUpdate,
          // Klaim status atomik (MENUNGGU_VERIFIKASI → final). Mock harus
          // mengembalikan { count } — action membaca claimed.count.
          updateMany: mockPendaftaranUpdateMany,
        },
        buktiTransferPendaftaran: {
          update: mockBuktiTransferUpdate,
        },
        kelas: {
          findUnique: mockKelasFindUnique,
        },
      };
      return fn(tx);
    },
  );
}

function setupAuthMocks(ortuEmail = "ortu@example.com") {
  mockCreateUser
    .mockResolvedValueOnce({
      data: { user: { id: "auth-ortu-uuid", email: ortuEmail } },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { user: { id: "auth-siswa-uuid" } },
      error: null,
    });
}

/** Default salin: semua dokumen berhasil, path tujuan sudah di bucket berkas-siswa. */
function setupSalinMocks(overrides: Partial<Record<string, unknown>> = {}) {
  mockSalinDokumen.mockResolvedValue({
    kartuKeluarga: "berkas-siswa/siswa-1/kartuKeluarga/kk.jpg",
    akteLahir: "berkas-siswa/siswa-1/akteLahir/akte.pdf",
    foto: "berkas-siswa/siswa-1/foto/foto.png",
    lainnya: ["berkas-siswa/siswa-1/lainnya/lain-1.webp"],
    tersalin: [],
    gagal: [],
    ...overrides,
  });
}

/** Pendaftaran + mocks minimum agar cabang DITERIMA jalan sampai selesai. */
function setupDiterimaMinimal(
  pendaftaran: Record<string, unknown>,
  siswaId = "siswa-1",
) {
  mockPendaftaranFindUnique.mockResolvedValue(pendaftaran);
  setupAuthMocks();
  setupTransactionMock();
  setupSalinMocks();
  mockUserFindUnique.mockResolvedValueOnce(null); // user ORANG_TUA belum ada
  mockUserCreate.mockResolvedValueOnce({
    id: "user-ortu-1",
    role: "ORANG_TUA",
  });
  mockUserFindUnique.mockResolvedValueOnce(null); // user SISWA belum ada
  mockUserCreate.mockResolvedValueOnce({ id: "user-siswa-1", role: "SISWA" });
  mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-1" });
  // Call #1: validasi NISN duplikat (harus null). Call #2: ambil siswaRecord.
  mockSiswaFindUnique
    .mockResolvedValueOnce(null)
    .mockResolvedValue({ id: siswaId, userId: "user-siswa-1" });
}

// ========================================================
// 1. EMIS Fields Copy — Field Lengkap
// ========================================================

describe("verifikasiPendaftaran — EMIS Fields Copy (Field Lengkap)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("harus copy SEMUA field EMIS dari Pendaftaran ke Siswa saat approve", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis);
    setupAuthMocks();
    setupTransactionMock();

    mockUserFindUnique.mockResolvedValueOnce(null); // ortu tidak ada → buat baru
    // user.create untuk ortu
    mockUserCreate
      .mockResolvedValueOnce({ id: "user-ortu-1", role: "ORANG_TUA" })
      // user.create untuk siswa
      .mockResolvedValueOnce({ id: "user-siswa-1", role: "SISWA" });
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-1" });
    // Call #1: cek NISN duplikat (harus null / tidak dipakai)
    // Call #2: ambil siswaRecord di dalam transaction
    mockSiswaFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "siswa-1" });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);

    const userCreateCalls = mockUserCreate.mock.calls;
    // find the user.create call for SISWA (nested under data)
    const siswaCreateCall = userCreateCalls.find(
      (call) => call[0]?.data?.role === "SISWA",
    );

    expect(siswaCreateCall).toBeDefined();
    const siswaData = siswaCreateCall![0].data.siswa.create;

    // ✅ Verifikasi SEMUA field EMIS ter-copy dengan benar
    expect(siswaData.agama).toBe("Islam");
    expect(siswaData.noHpSiswa).toBe("081298765432");
    expect(siswaData.namaAyahKandung).toBe("Budi Santoso");
    expect(siswaData.statusAyahKandung).toBe("MASIH_HIDUP");
    expect(siswaData.nikAyah).toBe("3201011501900001");
    expect(siswaData.namaIbuKandung).toBe("Siti Rahmawati");
    expect(siswaData.statusIbuKandung).toBe("MASIH_HIDUP");
    expect(siswaData.nikIbu).toBe("3201011501900002");
    expect(siswaData.statusWali).toBe("SAMA_DENGAN_AYAH");
    expect(siswaData.namaWali).toBeNull();
    expect(siswaData.kewarganegaraan).toBe("WNI");
    expect(siswaData.kitas).toBeNull();
    expect(siswaData.asalNegara).toBeNull();

    // Field dasar juga harus ter-copy
    expect(siswaData.nisn).toBe("0081234567");
    expect(siswaData.tempatLahir).toBe("Jakarta");
    expect(siswaData.jenisKelamin).toBe("LAKI_LAKI");
    expect(siswaData.alamat).toBe(pendaftaranWithEmis.alamatSiswa);
    expect(siswaData.kelasId).toBe("kelas-1");
    expect(siswaData.pendaftaranId).toBe("pend-1");
  });

  it("harus copy field EMIS dengan null jika tidak diisi di pendaftaran", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranMinimal);
    setupAuthMocks("ortumin@example.com");
    setupTransactionMock();

    mockUserFindUnique.mockResolvedValueOnce(null);
    mockUserCreate
      .mockResolvedValueOnce({ id: "user-ortu-2", role: "ORANG_TUA" })
      .mockResolvedValueOnce({ id: "user-siswa-2", role: "SISWA" });
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-2" });
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-2" });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-2",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);

    const userCreateCalls = mockUserCreate.mock.calls;
    const siswaCreateCall = userCreateCalls.find(
      (call) => call[0]?.data?.role === "SISWA",
    );
    const siswaData = siswaCreateCall![0].data.siswa.create;

    // ✅ Semua field EMIS harus null
    expect(siswaData.agama).toBeNull();
    expect(siswaData.noHpSiswa).toBeNull();
    expect(siswaData.namaAyahKandung).toBeNull();
    expect(siswaData.statusAyahKandung).toBeNull();
    expect(siswaData.nikAyah).toBeNull();
    expect(siswaData.namaIbuKandung).toBeNull();
    expect(siswaData.statusIbuKandung).toBeNull();
    expect(siswaData.nikIbu).toBeNull();
    expect(siswaData.statusWali).toBeNull();
    expect(siswaData.namaWali).toBeNull();
    expect(siswaData.kewarganegaraan).toBe("WNI");
    expect(siswaData.kitas).toBeNull();
    expect(siswaData.asalNegara).toBeNull();
  });

  it("harus copy field WNA (KITAS + asalNegara) dan NIK null ke Siswa", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWna);
    setupAuthMocks("mohammed@email.com");
    setupTransactionMock();

    mockUserFindUnique.mockResolvedValueOnce(null);
    mockUserCreate
      .mockResolvedValueOnce({ id: "user-ortu-3", role: "ORANG_TUA" })
      .mockResolvedValueOnce({ id: "user-siswa-3", role: "SISWA" });
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-3" });
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-3" });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-3",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);

    const userCreateCalls = mockUserCreate.mock.calls;
    const siswaCreateCall = userCreateCalls.find(
      (call) => call[0]?.data?.role === "SISWA",
    );
    const siswaData = siswaCreateCall![0].data.siswa.create;

    // ✅ Field WNA ter-copy
    expect(siswaData.kewarganegaraan).toBe("WNA");
    expect(siswaData.kitas).toBe("KITAS-2024-001");
    expect(siswaData.asalNegara).toBe("Malaysia");
    // NIK ayah/ibu null untuk WNA
    expect(siswaData.nikAyah).toBeNull();
    expect(siswaData.nikIbu).toBeNull();
    // Agama tetap ter-copy
    expect(siswaData.agama).toBe("Islam");
    expect(siswaData.namaAyahKandung).toBe("Mohammed Al-Farisi");
    expect(siswaData.namaIbuKandung).toBe("Fatimah Al-Farisi");
  });
});

// ========================================================
// 1c. Salin Dokumen Pendaftaran → Berkas Siswa saat Approve
// ========================================================

describe("verifikasiPendaftaran — Salin Dokumen saat DITERIMA", () => {
  const pendaftaranAdaDokumen = {
    ...pendaftaranWithEmis,
    dokKartuKeluarga: "dokumen-pendaftaran/pendaftaran/pend-1/kk.jpg",
    dokAkteLahir: "dokumen-pendaftaran/pendaftaran/pend-1/akte.pdf",
    dokFoto: "dokumen-pendaftaran/pendaftaran/pend-1/foto.png",
    dokLainnya: ["dokumen-pendaftaran/pendaftaran/pend-1/lain-1.webp"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("menyalin dokumen pendaftaran ke bucket berkas-siswa setelah approve", async () => {
    setupDiterimaMinimal(pendaftaranAdaDokumen);

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
      catatanAdmin: "",
      kelasTujuanId: "kelas-1",
    });

    expect(result.success).toBe(true);
    expect(mockSalinDokumen).toHaveBeenCalledOnce();
    expect(mockSalinDokumen).toHaveBeenCalledWith("siswa-1", {
      kartuKeluarga: "dokumen-pendaftaran/pendaftaran/pend-1/kk.jpg",
      akteLahir: "dokumen-pendaftaran/pendaftaran/pend-1/akte.pdf",
      foto: "dokumen-pendaftaran/pendaftaran/pend-1/foto.png",
      lainnya: ["dokumen-pendaftaran/pendaftaran/pend-1/lain-1.webp"],
    });
  });

  it("menulis path tujuan ke kolom dokumen siswa", async () => {
    setupDiterimaMinimal(pendaftaranAdaDokumen);

    await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
      catatanAdmin: "",
      kelasTujuanId: "kelas-1",
    });

    expect(mockSiswaUpdate).toHaveBeenCalledWith({
      where: { id: "siswa-1" },
      data: {
        dokKartuKeluarga: "berkas-siswa/siswa-1/kartuKeluarga/kk.jpg",
        dokAkteLahir: "berkas-siswa/siswa-1/akteLahir/akte.pdf",
        dokFoto: "berkas-siswa/siswa-1/foto/foto.png",
        dokLainnya: ["berkas-siswa/siswa-1/lainnya/lain-1.webp"],
      },
    });
  });

  it("menangani pendaftaran tanpa dokumen sama sekali", async () => {
    setupDiterimaMinimal({
      ...pendaftaranWithEmis,
      dokKartuKeluarga: null,
      dokAkteLahir: null,
      dokFoto: null,
      dokLainnya: [],
    });
    // Helper asli mengembalikan kosong kalau tidak ada sumber dokumen.
    setupSalinMocks({
      kartuKeluarga: null,
      akteLahir: null,
      foto: null,
      lainnya: [],
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
      catatanAdmin: "",
      kelasTujuanId: "kelas-1",
    });

    expect(result.success).toBe(true);
    expect(mockSalinDokumen).toHaveBeenCalledWith("siswa-1", {
      kartuKeluarga: null,
      akteLahir: null,
      foto: null,
      lainnya: [],
    });
    // Semua kolom dikosongkan, wali bisa mengunggah dari dashboard
    expect(mockSiswaUpdate).toHaveBeenCalledWith({
      where: { id: "siswa-1" },
      data: {
        dokKartuKeluarga: null,
        dokAkteLahir: null,
        dokFoto: null,
        dokLainnya: [],
      },
    });
  });

  it("tidak menyimpan path sumber bucket lain saat salin gagal sebagian", async () => {
    setupDiterimaMinimal(pendaftaranAdaDokumen);
    setupSalinMocks({
      foto: null,
      lainnya: [],
      gagal: [
        "dokumen-pendaftaran/pendaftaran/pend-1/foto.png",
        "dokumen-pendaftaran/pendaftaran/pend-1/lain-1.webp",
      ],
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
      catatanAdmin: "",
      kelasTujuanId: "kelas-1",
    });

    // Approval tetap sukses (status sudah final)
    expect(result.success).toBe(true);
    expect(result.message).toContain("2 dokumen gagal disalin");

    const updateData = mockSiswaUpdate.mock.calls[0][0].data;
    expect(updateData.dokFoto).toBeNull();
    expect(updateData.dokLainnya).toEqual([]);
    expect(JSON.stringify(updateData)).not.toContain("dokumen-pendaftaran/");
  });

  it("menghapus berkas yatim bila salin sukses tapi penulisan ke DB gagal", async () => {
    setupDiterimaMinimal(pendaftaranAdaDokumen);
    setupSalinMocks({
      tersalin: [
        "berkas-siswa/siswa-1/kartuKeluarga/kk.jpg",
        "berkas-siswa/siswa-1/akteLahir/akte.pdf",
      ],
    });
    mockSiswaUpdate.mockRejectedValueOnce(new Error("DB down"));

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
      catatanAdmin: "",
      kelasTujuanId: "kelas-1",
    });

    // Approval tetap final walau penulisan path gagal
    expect(result.success).toBe(true);
    // Berkas yang sudah tercopy harus dihapus supaya tidak jadi PII yatim
    expect(mockStorageRemove).toHaveBeenCalledWith([
      "berkas-siswa/siswa-1/kartuKeluarga/kk.jpg",
      "berkas-siswa/siswa-1/akteLahir/akte.pdf",
    ]);
  });

  it("tidak menghapus apa pun dari storage bila penulisan ke DB sukses", async () => {
    setupDiterimaMinimal(pendaftaranAdaDokumen);
    setupSalinMocks({
      tersalin: ["berkas-siswa/siswa-1/kartuKeluarga/kk.jpg"],
    });

    await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
      catatanAdmin: "",
      kelasTujuanId: "kelas-1",
    });

    expect(mockSiswaUpdate).toHaveBeenCalledOnce();
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it("tetap sukses bila penghapusan berkas yatim ikut gagal", async () => {
    setupDiterimaMinimal(pendaftaranAdaDokumen);
    setupSalinMocks({ tersalin: ["berkas-siswa/siswa-1/foto/foto.png"] });
    mockSiswaUpdate.mockRejectedValueOnce(new Error("DB down"));
    mockStorageRemove.mockRejectedValue(new Error("storage down"));

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
      catatanAdmin: "",
      kelasTujuanId: "kelas-1",
    });

    expect(result.success).toBe(true);
  });

  it("tetap sukses & informatif bila helper salin melempar error", async () => {
    setupDiterimaMinimal(pendaftaranAdaDokumen);
    mockSalinDokumen.mockRejectedValue(new Error("storage down"));

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
      catatanAdmin: "",
      kelasTujuanId: "kelas-1",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("gagal disalin");
    // Tidak menulis apa pun ke Siswa bila salin total gagal
    expect(mockSiswaUpdate).not.toHaveBeenCalled();
  });

  it("tidak menyalin dokumen saat pendaftaran ditolak", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranAdaDokumen);
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) =>
        fn({
          buktiTransferPendaftaran: { update: mockBuktiTransferUpdate },
          pendaftaran: { update: mockPendaftaranUpdate, updateMany: mockPendaftaranUpdateMany },
        }),
    );

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITOLAK",
      alasanPenolakan: "Dokumen tidak sesuai",
      catatanAdmin: "",
    });

    expect(result.success).toBe(true);
    expect(mockSalinDokumen).not.toHaveBeenCalled();
    expect(mockSiswaUpdate).not.toHaveBeenCalled();
  });
});

// ========================================================
// 1b. Override Kelas Tujuan — pendaftar tanpa kelas
// ========================================================

describe("verifikasiPendaftaran — Override Kelas Tujuan (pendaftar tanpa kelas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("harus memakai override kelasTujuanId saat menerima pendaftaran yang mendaftar tanpa kelas", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranMinimal);
    setupAuthMocks("ortumin@example.com");
    setupTransactionMock();

    mockUserFindUnique.mockResolvedValueOnce(null);
    mockUserCreate
      .mockResolvedValueOnce({ id: "user-ortu-4", role: "ORANG_TUA" })
      .mockResolvedValueOnce({ id: "user-siswa-4", role: "SISWA" });
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-4" });
    // pendaftaranMinimal punya nisn: null → tidak ada cek NISN, jadi
    // siswaRecord langsung mendapat nilai ini (simulasi nested create).
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-4" });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-2",
      status: "DITERIMA",
      kelasTujuanId: "kelas-1",
    });

    expect(result.success).toBe(true);

    const userCreateCalls = mockUserCreate.mock.calls;
    const siswaCreateCall = userCreateCalls.find(
      (call) => call[0]?.data?.role === "SISWA",
    );
    const siswaData = siswaCreateCall![0].data.siswa.create;
    expect(siswaData.kelasId).toBe("kelas-1");

    // Kelas override juga dipersist ke record pendaftaran (rekap konsisten)
    expect(mockPendaftaranUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kelasTujuanId: "kelas-1" }),
      }),
    );
  });

  it("harus tetap menerima pendaftaran tanpa kelas jika override tidak dikirim", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranMinimal);
    setupAuthMocks("ortumin@example.com");
    setupTransactionMock();

    mockUserFindUnique.mockResolvedValueOnce(null);
    mockUserCreate
      .mockResolvedValueOnce({ id: "user-ortu-5", role: "ORANG_TUA" })
      .mockResolvedValueOnce({ id: "user-siswa-5", role: "SISWA" });
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-5" });
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-5" });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-2",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);

    const userCreateCalls = mockUserCreate.mock.calls;
    const siswaCreateCall = userCreateCalls.find(
      (call) => call[0]?.data?.role === "SISWA",
    );
    const siswaData = siswaCreateCall![0].data.siswa.create;
    expect(siswaData.kelasId).toBeNull();
  });

  it("harus MENOLAK override kelas yang tidak ditemukan sebelum membuat akun auth", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranMinimal);
    mockKelasFindUnique.mockResolvedValue(null);

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-2",
      status: "DITERIMA",
      kelasTujuanId: "kelas-tidak-ada",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Kelas tujuan tidak ditemukan");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("harus MENOLAK override kelas yang tidak cocok gender pendaftar", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranMinimal);
    mockKelasFindUnique.mockResolvedValue({
      id: "kelas-ikhwan",
      nama: "Kelas Ikhwan",
      kapasitas: 0,
      jenisKelamin: "LAKI_LAKI",
      _count: { siswa: 0 },
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-2",
      status: "DITERIMA",
      kelasTujuanId: "kelas-ikhwan",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("kelas khusus Ikhwan");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });
});

// ========================================================
// 2. Atomicity Check — Rollback
// ========================================================

describe("verifikasiPendaftaran - DITERIMA (Atomicity check)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("harus menghapus user auth yang baru dibuat jika database transaction gagal", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranMinimal);

    mockCreateUser
      .mockResolvedValueOnce({
        data: { user: { id: "auth-ortu-uuid", email: "ortumin@example.com" } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: "auth-siswa-uuid" } },
        error: null,
      });

    mockPrismaTransaction.mockRejectedValue(
      new Error("Database connection timeout"),
    );

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-2",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    expect(result.message).toBeTruthy();

    expect(mockDeleteUser).toHaveBeenCalledTimes(2);
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-ortu-uuid");
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-siswa-uuid");
  });

  it("harus menghapus hanya siswa jika ortu sudah ada sebelumnya", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranMinimal);

    mockCreateUser.mockResolvedValueOnce({
      data: null,
      error: { message: "User already been registered" },
    });

    mockListUsers.mockResolvedValueOnce({
      data: {
        users: [{ id: "existing-ortu-uuid", email: "ortumin@example.com" }],
      },
      error: null,
    });

    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-siswa-uuid" } },
      error: null,
    });

    mockPrismaTransaction.mockRejectedValue(new Error("DB Error"));

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-2",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);

    expect(mockDeleteUser).toHaveBeenCalledTimes(1);
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-siswa-uuid");
    expect(mockDeleteUser).not.toHaveBeenCalledWith("existing-ortu-uuid");
  });
});

// ========================================================
// DITERIMA — konsistensi row siswa (orphan heal + guard)
// ========================================================

describe("verifikasiPendaftaran — DITERIMA konsistensi siswa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // vi.clearAllMocks() TIDAK menghapus implementasi mock — default yang
    // di-set di sini akan bocor ke describe berikutnya. Reset eksplisit
    // untuk mocks yang dipakai bersama, lalu kembalikan default hoisted
    // yang diandalkan describe lain.
    mockUserFindUnique.mockReset();
    mockSiswaFindUnique.mockReset();
    mockSiswaCreate.mockReset();
    mockUserCreate.mockReset();
    mockOrangTuaFindUnique.mockReset();
    mockPendaftaranFindUnique.mockReset();
    mockParentStudentFindUnique.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    // Bersihkan default yang tersisa agar tidak bocor ke describe berikutnya.
    mockUserFindUnique.mockReset();
    mockSiswaFindUnique.mockReset();
    mockSiswaCreate.mockReset();
    mockUserCreate.mockReset();
    mockOrangTuaFindUnique.mockReset();
    mockPendaftaranFindUnique.mockReset();
    mockParentStudentFindUnique.mockReset().mockResolvedValue(null);
  });

  it("orphan heal: user SISWA tanpa row siswas → row siswa dibuat, approval sukses", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis);
    setupAuthMocks();
    setupTransactionMock();
    setupSalinMocks();

    // user ORANG_TUA belum ada → dibuat
    mockUserFindUnique
      .mockResolvedValueOnce(null) // tx: ortu by authId
      .mockResolvedValueOnce(null); // tx: ortu by email
    mockUserCreate.mockResolvedValueOnce({ id: "user-ortu-1", role: "ORANG_TUA" });
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-1" });
    // user SISWA SUDAH ADA (orphan) → tidak dibuat user baru
    mockUserFindUnique.mockResolvedValue({
      id: "user-siswa-1",
      role: "SISWA",
      authId: "auth-siswa-uuid",
    });

    // siswaRecord tidak ada → orphan. pendaftaranId bebas → create row siswa.
    mockSiswaFindUnique
      .mockResolvedValueOnce(null) // cek NISN duplikat
      .mockResolvedValueOnce(null) // siswaRecord → orphan
      .mockResolvedValueOnce(null) // cek pendaftaranId dipakai
      .mockResolvedValue({ id: "siswa-baru-1", userId: "user-siswa-1" }); // verifikasi pasca-commit
    mockSiswaCreate.mockResolvedValue({
      id: "siswa-baru-1",
      userId: "user-siswa-1",
    });
    mockParentStudentFindUnique.mockResolvedValue(null);

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);
    // Row siswa baru dibuat untuk user yang sudah ada — TANPA user/auth baru.
    expect(mockSiswaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-siswa-1",
          pendaftaranId: "pend-1",
        }),
      }),
    );
    // ParentStudent tetap dibuat
    expect(mockParentStudentCreate).toHaveBeenCalled();
  });

  it("guard: siswa gagal dibuat → approval dibatalkan, auth dibersihkan, status tidak berubah", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis);
    setupAuthMocks();
    setupTransactionMock();

    mockUserFindUnique
      .mockResolvedValueOnce(null) // tx: ortu by authId
      .mockResolvedValueOnce(null); // tx: ortu by email
    mockUserCreate.mockResolvedValueOnce({ id: "user-ortu-1", role: "ORANG_TUA" });
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-1" });
    // user SISWA sudah ada, siswaRecord null, pendaftaranId bebas,
    // tapi siswa.create gagal (return null) → guard harus melempar.
    mockUserFindUnique.mockResolvedValue({
      id: "user-siswa-1",
      role: "SISWA",
      authId: "auth-siswa-uuid",
    });
    mockSiswaFindUnique
      .mockResolvedValueOnce(null) // cek NISN
      .mockResolvedValueOnce(null) // siswaRecord
      .mockResolvedValueOnce(null); // pendaftaranId
    mockSiswaCreate.mockResolvedValue(null);

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Data siswa gagal dibuat");
    // Auth user dibersihkan dan klaim SEDANG_DIPROSES dibatalkan.
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-ortu-uuid");
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-siswa-uuid");
    expect(mockPendaftaranUpdateMany).toHaveBeenCalled();
  });

  it("verifikasi pasca-commit: siswa tidak ditemukan setelah commit → error jujur", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis);
    setupAuthMocks();
    setupTransactionMock();

    mockUserFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockUserCreate.mockResolvedValueOnce({ id: "user-ortu-1", role: "ORANG_TUA" });
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-1" });
    mockUserFindUnique.mockResolvedValue({
      id: "user-siswa-1",
      role: "SISWA",
      authId: "auth-siswa-uuid",
    });
    // siswaRecord ada (tx sukses) tapi verifikasi pasca-commit gagal.
    mockSiswaFindUnique
      .mockResolvedValueOnce(null) // cek NISN
      .mockResolvedValueOnce({ id: "siswa-1", userId: "user-siswa-1" }) // siswaRecord
      .mockResolvedValue(null); // verifikasi pasca-commit → tidak ditemukan

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("tidak dapat diverifikasi");
  });
});

// ========================================================
// 3. Penolakan Pendaftaran
// ========================================================

describe("verifikasiPendaftaran — DITOLAK", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("harus berhasil menolak pendaftaran dengan alasan", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis);
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        return fn({
          pendaftaran: { update: mockPendaftaranUpdate, updateMany: mockPendaftaranUpdateMany },
          buktiTransferPendaftaran: { update: mockBuktiTransferUpdate },
        });
      },
    );

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITOLAK",
      alasanPenolakan: "Dokumen tidak lengkap",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("DITOLAK");
    expect(mockPendaftaranUpdateMany).toHaveBeenCalledOnce();
    expect(mockBuktiTransferUpdate).toHaveBeenCalledOnce();
  });

  it("harus gagal menolak tanpa alasanPenolakan", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis);

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITOLAK",
    });

    expect(result.success).toBe(false);
    // Alasan penolakan divalidasi di schema, sehingga pesannya generik tetapi
    // field error spesifik tetap dikembalikan ke klien.
    expect(result.message).toContain("tidak valid");
    expect(result.errors?.alasanPenolakan).toBeDefined();
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it("harus mengirim email penolakan ke email orang tua", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis);
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        return fn({
          pendaftaran: { update: mockPendaftaranUpdate, updateMany: mockPendaftaranUpdateMany },
          buktiTransferPendaftaran: { update: mockBuktiTransferUpdate },
        });
      },
    );

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITOLAK",
      alasanPenolakan: "Dokumen tidak lengkap",
      catatanAdmin: "KK tidak terbaca",
    });

    expect(result.success).toBe(true);
    expect(sendPendaftaranDitolakEmail).toHaveBeenCalledOnce();
    expect(sendPendaftaranDitolakEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        emailOrangTua: pendaftaranWithEmis.emailOrangTua,
        nomorPendaftaran: pendaftaranWithEmis.nomorPendaftaran,
        alasanPenolakan: "Dokumen tidak lengkap",
        catatanAdmin: "KK tidak terbaca",
      }),
    );
  });

  it("tidak mengirim email penolakan bila transaksi DB gagal", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis);
    mockPrismaTransaction.mockRejectedValue(new Error("deadlock"));

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITOLAK",
      alasanPenolakan: "Dokumen tidak lengkap",
    });

    expect(result.success).toBe(false);
    expect(sendPendaftaranDitolakEmail).not.toHaveBeenCalled();
  });

  it("tetap sukses saat email penolakan gagal — status sudah final di DB", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis);
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        return fn({
          pendaftaran: { update: mockPendaftaranUpdate, updateMany: mockPendaftaranUpdateMany },
          buktiTransferPendaftaran: { update: mockBuktiTransferUpdate },
        });
      },
    );
    vi.mocked(sendPendaftaranDitolakEmail).mockResolvedValueOnce({
      success: false,
      error: "Resend timeout",
    } as never);

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITOLAK",
      alasanPenolakan: "Dokumen tidak lengkap",
    });

    // Penolakan tetap dianggap berhasil; admin diberi tahu emailnya gagal.
    expect(result.success).toBe(true);
    expect(result.message).toContain("GAGAL terkirim");
    expect(mockPendaftaranUpdateMany).toHaveBeenCalledOnce();
  });

  it("tetap sukses saat template email penolakan melempar error", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis);
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        return fn({
          pendaftaran: { update: mockPendaftaranUpdate, updateMany: mockPendaftaranUpdateMany },
          buktiTransferPendaftaran: { update: mockBuktiTransferUpdate },
        });
      },
    );
    vi.mocked(sendPendaftaranDitolakEmail).mockRejectedValueOnce(
      new Error("template crash") as never,
    );

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITOLAK",
      alasanPenolakan: "Dokumen tidak lengkap",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("GAGAL terkirim");
  });
});

// ========================================================
// 4. Edge Cases
// ========================================================

describe("verifikasiPendaftaran — Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("harus gagal jika pendaftaran tidak ditemukan", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(null);

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-inexist",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("tidak ditemukan");
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it("harus gagal dengan payload tidak valid", async () => {
    const result = await verifikasiPendaftaran({
      pendaftaranId: "",
      status: "INVALID",
    } as unknown as Parameters<typeof verifikasiPendaftaran>[0]);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it("harus default kewarganegaraan ke WNI jika null di pendaftaran", async () => {
    const pendaftaranTanpaKewarganegaraan = {
      ...pendaftaranMinimal,
      kewarganegaraan: null,
    };
    mockPendaftaranFindUnique.mockResolvedValue(
      pendaftaranTanpaKewarganegaraan,
    );
    setupAuthMocks("ortumin@example.com");
    setupTransactionMock();

    mockUserFindUnique.mockResolvedValueOnce(null);
    mockUserCreate
      .mockResolvedValueOnce({ id: "user-ortu-4", role: "ORANG_TUA" })
      .mockResolvedValueOnce({ id: "user-siswa-4", role: "SISWA" });
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-4" });
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-4" });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-2",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);

    const userCreateCalls = mockUserCreate.mock.calls;
    const siswaCreateCall = userCreateCalls.find(
      (call) => call[0]?.data?.role === "SISWA",
    );
    const siswaData = siswaCreateCall![0].data.siswa.create;

    expect(siswaData.kewarganegaraan).toBe("WNI");
  });
});

// ========================================================
// 5. Multi-Child — Satu Email Orang Tua, Banyak Anak
// ========================================================

describe("verifikasiPendaftaran — Multi-Child (Same Parent Email)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("harus reuse akun orang tua yang sudah ada saat approve pendaftaran anak kedua dengan email yang sama", async () => {
    // Pendaftaran anak kedua dengan email orang tua yang sama
    const pendaftaranAnakKedua = {
      ...pendaftaranMinimal,
      id: "pend-child-2",
      nomorPendaftaran: "REG-2026-00003",
      namaLengkap: "Saudara Ahmad",
      emailOrangTua: "ortu@example.com", // email sama dengan pendaftaranWithEmis
      namaOrangTua: "Bapak Ahmad",
    };
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranAnakKedua);

    // Supabase Auth: email sudah terdaftar → error "already been registered"
    mockCreateUser.mockResolvedValueOnce({
      data: null,
      error: { message: "User already been registered" },
    });
    mockListUsers.mockResolvedValueOnce({
      data: {
        users: [{ id: "existing-ortu-auth-uuid", email: "ortu@example.com" }],
      },
      error: null,
    });
    // Auth siswa baru
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-siswa-child2-uuid" } },
      error: null,
    });

    setupTransactionMock();

    // findFirst(ortu) → sudah ada (anak baru)
    mockUserFindUnique.mockResolvedValueOnce({
      id: "user-ortu-existing",
      role: "ORANG_TUA",
    });
    mockUserCreate.mockResolvedValueOnce({
      id: "user-siswa-child2",
      role: "SISWA",
    });
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-existing" });
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-child2" });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-child-2",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);

    // Verify: tidak membuat auth orang tua baru
    // mockCreateUser dipanggil 2x: 1x ortu (gagal already exists), 1x siswa
    expect(mockCreateUser).toHaveBeenCalledTimes(2);

    // Verify: listUsers dipanggil untuk resolve existing auth
    expect(mockListUsers).toHaveBeenCalledTimes(1);

    // Verify: User.findFirst dipanggil untuk ortu (found existing)
    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: "ORANG_TUA",
        }),
      }),
    );

    // Verify: ParentStudent link dibuat untuk anak kedua
    expect(mockParentStudentCreate).toHaveBeenCalledWith({
      data: {
        orangTuaId: "ortu-existing",
        siswaId: "siswa-child2",
        hubungan: "Orang Tua",
      },
    });

    // Verify: tidak membuat User baru untuk ortu (reuse existing)
    const ortuCreateCalls = mockUserCreate.mock.calls.filter(
      (call) => call[0]?.data?.role === "ORANG_TUA",
    );
    expect(ortuCreateCalls).toHaveLength(0);
  });

  it("harus membuat ParentStudent baru meskipun ortu sudah link ke anak lain", async () => {
    // Skenario: ortu sudah punya 1 anak, sekarang daftarkan anak ke-2
    const pendaftaranAnakKetiga = {
      ...pendaftaranMinimal,
      id: "pend-child-3",
      nomorPendaftaran: "REG-2026-00004",
      namaLengkap: "Anak Ketiga",
      emailOrangTua: "ortu@example.com",
      namaOrangTua: "Bapak Ahmad",
    };
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranAnakKetiga);

    // Auth ortu sudah ada
    mockCreateUser.mockResolvedValueOnce({
      data: null,
      error: { message: "User already been registered" },
    });
    mockListUsers.mockResolvedValueOnce({
      data: {
        users: [{ id: "existing-ortu-auth-uuid", email: "ortu@example.com" }],
      },
      error: null,
    });
    // Auth siswa baru
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-siswa-child3-uuid" } },
      error: null,
    });

    setupTransactionMock();

    mockUserFindUnique.mockResolvedValueOnce({
      id: "user-ortu-existing",
      role: "ORANG_TUA",
    });
    mockUserCreate.mockResolvedValueOnce({
      id: "user-siswa-child3",
      role: "SISWA",
    });
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-existing" });
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-child3" });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-child-3",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);

    // ParentStudent harus dibuat dengan ortu yang sama, siswa yang baru
    expect(mockParentStudentCreate).toHaveBeenCalledWith({
      data: {
        orangTuaId: "ortu-existing",
        siswaId: "siswa-child3",
        hubungan: "Orang Tua",
      },
    });
  });

  it("harus skip buktiTransfer update jika latestBuktiId null (anak kedua tanpa bukti baru)", async () => {
    const pendaftaranTanpaBukti = {
      ...pendaftaranMinimal,
      id: "pend-child-4",
      nomorPendaftaran: "REG-2026-00005",
      namaLengkap: "Anak Keempat",
      emailOrangTua: "ortu@example.com",
      namaOrangTua: "Bapak Ahmad",
      buktiTransfer: [], // tidak ada bukti transfer
    };
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranTanpaBukti);

    mockCreateUser.mockResolvedValueOnce({
      data: null,
      error: { message: "User already been registered" },
    });
    mockListUsers.mockResolvedValueOnce({
      data: {
        users: [{ id: "existing-ortu-auth-uuid", email: "ortu@example.com" }],
      },
      error: null,
    });
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-siswa-child4-uuid" } },
      error: null,
    });

    setupTransactionMock();

    mockUserFindUnique.mockResolvedValueOnce({
      id: "user-ortu-existing",
      role: "ORANG_TUA",
    });
    mockUserCreate.mockResolvedValueOnce({
      id: "user-siswa-child4",
      role: "SISWA",
    });
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-existing" });
    mockSiswaFindUnique.mockResolvedValue({ id: "siswa-child4" });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-child-4",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);

    // buktiTransfer update tidak dipanggil karena tidak ada bukti
    expect(mockBuktiTransferUpdate).not.toHaveBeenCalled();

    // ParentStudent tetap dibuat
    expect(mockParentStudentCreate).toHaveBeenCalled();
  });
});

// ========================================================
// 18. Gender: Kelas Khusus Harus Cocok dengan Jenis Kelamin Pendaftar
// ========================================================

describe("verifikasiPendaftaran — Gender Match Kelas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("harus menolak approve jika kelas tujuan khusus gender tidak cocok", async () => {
    // Pendaftar laki-laki (pendaftaranWithEmis.jenisKelamin = LAKI_LAKI)
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis);
    mockKelasFindUnique.mockResolvedValue({
      id: "kelas-1",
      nama: "Kelas 3",
      jenisKelamin: "PEREMPUAN",
      kapasitas: 30,
      _count: { siswa: 15 },
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("kelas khusus");
    // Tidak boleh ada akun Supabase yang dibuat
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });

  it("harus menerima approve jika gender pendaftar cocok dengan kelas khusus", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis);
    mockKelasFindUnique.mockResolvedValue({
      id: "kelas-1",
      nama: "Kelas 1",
      jenisKelamin: "LAKI_LAKI",
      kapasitas: 30,
      _count: { siswa: 15 },
    });

    setupAuthMocks();
    setupTransactionMock();

    mockUserFindUnique.mockResolvedValueOnce(null);
    mockUserCreate
      .mockResolvedValueOnce({ id: "user-ortu-1", role: "ORANG_TUA" })
      .mockResolvedValueOnce({ id: "user-siswa-1", role: "SISWA" });
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-1" });
    // Call #1: cek NISN duplikat (harus null / tidak dipakai)
    // Call #2+: ambil siswaRecord
    mockSiswaFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "siswa-1" });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);
    expect(mockPendaftaranUpdateMany).toHaveBeenCalled();
  });
});

// ========================================================
// 19. NISN: Duplikat dengan Siswa yang Sudah Ada / Pendaftaran Aktif Lain
// ========================================================

describe("verifikasiPendaftaran — Duplikat NISN", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("harus menolak jika NISN sudah dipakai siswa yang sudah diterima", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis);
    mockPendaftaranFindFirst.mockResolvedValue(null);
    setupAuthMocks();
    setupTransactionMock();

    // NISN check → siswa dengan NISN sama sudah ada
    mockSiswaFindUnique.mockResolvedValue({
      id: "siswa-existing",
      user: { nama: "Santri Lama", id: "user-lama" },
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("NISN");
    expect(result.message).toContain("Santri Lama");
    // Tidak ada akun/record yang dibuat
    expect(mockUserCreate).not.toHaveBeenCalled();
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });

  it("harus menolak jika NISN sudah dipakai pendaftaran aktif lain (MENUNGGU_VERIFIKASI)", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis);
    mockSiswaFindUnique.mockResolvedValue(null);
    setupAuthMocks();
    setupTransactionMock();

    // NISN siswa → null (tidak ada siswa), tapi ada pendaftaran aktif lain
    mockPendaftaranFindFirst.mockResolvedValue({
      id: "pend-lain",
      nomorPendaftaran: "REG-2026-00099",
      namaLengkap: "Calon Lain",
      status: "MENUNGGU_VERIFIKASI",
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("NISN");
    expect(result.message).toContain("REG-2026-00099");
    expect(result.message).toContain("diverifikasi admin");
    expect(mockUserCreate).not.toHaveBeenCalled();
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });

  it("harus menolak jika NISN sudah dipakai pendaftaran aktif lain (MENUNGGU_PEMBAYARAN)", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis);
    mockSiswaFindUnique.mockResolvedValue(null);
    setupAuthMocks();
    setupTransactionMock();

    mockPendaftaranFindFirst.mockResolvedValue({
      id: "pend-lain",
      nomorPendaftaran: "REG-2026-00100",
      namaLengkap: "Calon Lain",
      status: "MENUNGGU_PEMBAYARAN",
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("NISN");
    expect(result.message).toContain("REG-2026-00100");
    expect(result.message).toContain("menunggu pembayaran");
    expect(mockUserCreate).not.toHaveBeenCalled();
    expect(mockPendaftaranUpdate).not.toHaveBeenCalled();
  });

  it("harus menerima jika NISN belum dipakai siapa pun", async () => {
    mockPendaftaranFindUnique.mockResolvedValue(pendaftaranWithEmis);
    mockPendaftaranFindFirst.mockResolvedValue(null);
    setupAuthMocks();
    setupTransactionMock();

    mockUserFindUnique.mockResolvedValueOnce(null);
    mockUserCreate
      .mockResolvedValueOnce({ id: "user-ortu-1", role: "ORANG_TUA" })
      .mockResolvedValueOnce({ id: "user-siswa-1", role: "SISWA" });
    mockOrangTuaFindUnique.mockResolvedValue({ id: "ortu-1" });
    mockSiswaFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "siswa-1" });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);
    expect(mockPendaftaranUpdateMany).toHaveBeenCalled();
  });
});

// ========================================================
// Gerbang approval: KONFIRMASI KONTAK WALI (pengganti OTP)
// ========================================================

describe("verifikasiPendaftaran — Gerbang Konfirmasi Kontak Wali", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Test "menolak" di bawah return lebih awal (guard kontak wali) sehingga
    // Once queue setupDiterimaMinimal tidak terconsumsi — reset agar tidak
    // menggeser sequencing test berikutnya.
    mockSiswaFindUnique.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("menolak menyetujui pendaftaran yang kontak walinya belum dikonfirmasi", async () => {
    setupDiterimaMinimal({
      ...pendaftaranWithEmis,
      kontakWaliDikonfirmasiAt: null,
      metodeKonfirmasiKontak: null,
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
      catatanAdmin: "",
      kelasTujuanId: "kelas-1",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Kontak wali belum dikonfirmasi");
    // Tidak boleh ada akun auth yang dibuat, dan tidak boleh ada siswa.
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockSiswaUpdate).not.toHaveBeenCalled();
  });

  it("approval TIDAK lagi bergantung pada kolom verifikasi email warisan (OTP dihapus)", async () => {
    // OTP sudah dihapus dari alur: kolom warisan null pun approval tetap
    // lolos selama konfirmasi kontak wali ada. Ini kontrak bisnis baru —
    // kalau gerbang lama menyala lagi, test ini yang akan menangkapnya.
    setupDiterimaMinimal({
      ...pendaftaranWithEmis,
      kontakWaliDikonfirmasiAt: new Date("2026-01-01"),
      emailOrangTuaTerverifikasiAt: null,
      emailOrangTuaDiverifikasiOtpAt: null,
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
      catatanAdmin: "",
      kelasTujuanId: "kelas-1",
    });

    expect(result.success).toBe(true);
  });

  it("tetap bisa MENOLAK pendaftaran yang kontak walinya belum dikonfirmasi", async () => {
    setupDiterimaMinimal({
      ...pendaftaranWithEmis,
      kontakWaliDikonfirmasiAt: null,
      metodeKonfirmasiKontak: null,
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITOLAK",
      alasanPenolakan: "Data tidak sesuai",
      catatanAdmin: "",
    });

    // Menolak tidak membuat akun apa pun, jadi tidak perlu melewati gerbang.
    expect(result.success).toBe(true);
  });
});

// ========================================================
// 20. State machine MENUNGGU_VERIFIKASI → SEDANG_DIPROSES → DITERIMA
//     (claim atomic anti-race, rollback, recovery stale)
// ========================================================

describe("verifikasiPendaftaran — State Machine (SEDANG_DIPROSES)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  /**
   * Satu alur approve sukses penuh (claim → auth → tx → salin dokumen).
   *
   * Semua mock relevan di-RESET lalu di-set ulang: vi.clearAllMocks()
   * hanya membersihkan riwayat panggilan, BUKAN implementasi persisten
   * atau antrean mockResolvedValueOnce. Tanpa reset di sini, implementasi
   * dari describe sebelumnya (mis. fixture NISN duplikat) bocor ke test
   * ini dan menggagalkan alur.
   */
  function setupFullApprovalFlow(pendaftaran = pendaftaranWithEmis) {
    mockPendaftaranFindUnique.mockReset().mockResolvedValue(pendaftaran);
    // Validasi NISN duplikat: tidak ada pendaftaran aktif lain.
    mockPendaftaranFindFirst.mockReset().mockResolvedValue(null);
    mockPendaftaranUpdate.mockReset().mockResolvedValue({});
    // Klaim atomic default: berhasil (count 1).
    mockPendaftaranUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    mockCreateUser.mockReset();
    setupAuthMocks();
    setupTransactionMock();
    setupSalinMocks();
    // 7× findFirst di dalam transaksi (authId/email/username ortu+siswa)
    // semuanya "tidak ditemukan" kecuali test menimpa dengan Once.
    mockUserFindUnique.mockReset().mockResolvedValue(null);
    mockUserCreate.mockReset()
      .mockResolvedValueOnce({ id: "user-ortu-1", role: "ORANG_TUA", aktif: true })
      .mockResolvedValueOnce({ id: "user-siswa-1", role: "SISWA", aktif: true });
    mockOrangTuaFindUnique.mockReset().mockResolvedValue({ id: "ortu-1" });
    // Call #1: validasi NISN duplikat. Call #2: ambil siswaRecord.
    mockSiswaFindUnique.mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "siswa-1", userId: "user-siswa-1" });
    mockParentStudentFindUnique.mockReset().mockResolvedValue(null);
    mockParentStudentCreate.mockReset().mockResolvedValue({ id: "ps-1" });
    mockBuktiTransferUpdate.mockReset().mockResolvedValue({});
    mockSiswaUpdate.mockReset().mockResolvedValue({});
    mockListUsers.mockReset().mockResolvedValue({
      data: { users: [] },
      error: null,
    });
    mockDeleteUser.mockReset().mockResolvedValue({ error: null });
    mockStorageRemove.mockReset().mockResolvedValue({ error: null });
    mockKelasFindUnique.mockReset().mockResolvedValue({
      id: "kelas-1",
      nama: "Kelas 1",
      kapasitas: 30,
      _count: { siswa: 5 },
    });
  }

  it("dua admin approve paralel: hanya satu request yang dapat melakukan claim", async () => {
    setupFullApprovalFlow();

    // Hanya updateMany pertama dengan kondisi status=MENUNGGU_VERIFIKASI
    // (klaim) yang menang; klaim kedua gagal (count=0).
    let klaimKe = 0;
    mockPendaftaranUpdateMany.mockImplementation(
      async (args: { where?: { status?: string } }) => {
        if (args?.where?.status === "MENUNGGU_VERIFIKASI") {
          klaimKe += 1;
          return { count: klaimKe === 1 ? 1 : 0 };
        }
        return { count: 1 };
      },
    );

    const [r1, r2] = await Promise.all([
      verifikasiPendaftaran({ pendaftaranId: "pend-1", status: "DITERIMA" }),
      verifikasiPendaftaran({ pendaftaranId: "pend-1", status: "DITERIMA" }),
    ]);

    // Tepat satu pemenang, satu pecundang.
    const hasil = [r1, r2].sort((a, b) => Number(a.success) - Number(b.success));
    expect(hasil[0].success).toBe(false);
    expect(hasil[0].message).toContain("sedang atau sudah diproses");
    expect(hasil[1].success).toBe(true);
    // Hanya pemenang yang membuat 2 akun Auth (ortu + siswa).
    expect(mockCreateUser).toHaveBeenCalledTimes(2);
  });

  it("request kedua (claim gagal) tidak membuat akun Auth kedua", async () => {
    setupFullApprovalFlow();
    // Klaim (updateMany pertama, kondisi MENUNGGU_VERIFIKASI) gagal.
    mockPendaftaranUpdateMany.mockResolvedValueOnce({ count: 0 });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("sedang atau sudah diproses");
    // Tidak ada side effect: tidak ada Auth, tidak ada User, tidak ada email.
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockUserCreate).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("Auth orang tua sudah tersedia → reuse, tidak membuat akun ortu baru", async () => {
    setupFullApprovalFlow();
    // createUser ortu gagal: email sudah terdaftar (approval sebelumnya
    // gagal di tengah jalan). Lookup listUsers menemukan akun yang ada.
    // Reset dulu: setupAuthMocks() sudah mengantre 2 respons sukses,
    // sedangkan antrean Once FIFO — tanpa reset, panggilan pertama
    // justru mengembalikan sukses.
    mockCreateUser.mockReset()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "User already been registered" },
      })
      .mockResolvedValueOnce({ data: { user: { id: "auth-siswa-uuid" } }, error: null });
    mockListUsers.mockResolvedValue({
      data: { users: [{ id: "auth-ortu-existing", email: "ortu@example.com" }] },
      error: null,
    });
    // Record ORANG_TUA sudah ada untuk authId tersebut → tidak ada user.create.
    mockUserFindUnique
      .mockResolvedValueOnce({ id: "user-ortu-existing", role: "ORANG_TUA", aktif: true })
      .mockResolvedValue(null);

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);
    // Hanya akun SISWA yang dibuat; akun ortu di-reuse.
    const createdRoles = mockUserCreate.mock.calls.map((c) => c[0]?.data?.role);
    expect(createdRoles).toEqual(["SISWA"]);
    // Akun yang di-reuse tidak dihapus saat cleanup (hanya yang baru).
  });

  it("Auth siswa sudah tersedia → reuse, tidak membuat akun siswa baru", async () => {
    setupFullApprovalFlow();
    // createUser ortu sukses; createUser siswa sudah terdaftar.
    // Reset dulu antrean Once dari setupAuthMocks (FIFO).
    mockCreateUser.mockReset()
      .mockResolvedValueOnce({ data: { user: { id: "auth-ortu-uuid" } }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "User already been registered" },
      });
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: "auth-siswa-existing",
            // emailSiswa = "siswa." + nomorPendaftaran tanpa non-alnum
            // → siswa.reg202600001@sekolah.internal
            email: "siswa.reg202600001@sekolah.internal",
          },
        ],
      },
      error: null,
    });
    // Urutan findFirst di transaksi:
    //  1. ortu by authId → null
    //  2. ortu by email → null
    //  3. username ortu (deriveUniqueUsername) → null
    //  4. siswa by authId → record SISWA sudah ada → reuse,
    //     tidak ada user.create siswa.
    mockUserFindUnique.mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "user-siswa-existing", role: "SISWA", aktif: true });
    mockUserCreate.mockReset().mockResolvedValueOnce({ id: "user-ortu-1", role: "ORANG_TUA", aktif: true });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);
    const createdRoles = mockUserCreate.mock.calls.map((c) => c[0]?.data?.role);
    expect(createdRoles).toEqual(["ORANG_TUA"]);
  });

  it("pembuatan Auth gagal → akun dibersihkan, status kembali MENUNGGU_VERIFIKASI", async () => {
    setupFullApprovalFlow();
    // createUser ortu gagal dengan error generik (bukan already-registered).
    // Reset dulu antrean Once dari setupAuthMocks.
    mockCreateUser.mockReset().mockResolvedValueOnce({
      data: null,
      error: { message: "Internal Supabase error" },
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Gagal membuat akun login");
    expect(result.message).toContain("antrean verifikasi");
    // Klaim dibatalkan: updateMany SEDANG_DIPROSES → MENUNGGU_VERIFIKASI.
    const rollbackCall = mockPendaftaranUpdateMany.mock.calls.find(
      (c: any[]) =>
        c[0]?.where?.status === "SEDANG_DIPROSES" &&
        c[0]?.data?.status === "MENUNGGU_VERIFIKASI",
    );
    expect(rollbackCall).toBeDefined();
  });

  it("transaction database gagal → akun Auth baru dihapus, status dikembalikan", async () => {
    setupFullApprovalFlow();
    mockPrismaTransaction.mockRejectedValue(new Error("DB connection lost"));

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    // Kedua akun Auth yang baru dibuat (ortu + siswa) dihapus.
    expect(mockDeleteUser).toHaveBeenCalledTimes(2);
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-ortu-uuid");
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-siswa-uuid");
    // Klaim SEDANG_DIPROSES dibatalkan.
    const rollbackCall = mockPendaftaranUpdateMany.mock.calls.find(
      (c: any[]) =>
        c[0]?.where?.status === "SEDANG_DIPROSES",
    );
    expect(rollbackCall).toBeDefined();
  });

  it("proses copy dokumen gagal → approval tetap final (best-effort) + catatan jujur", async () => {
    setupFullApprovalFlow();
    mockSalinDokumen.mockRejectedValue(new Error("Storage unavailable"));

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    // Status sudah final di DB; kegagalan copy dilaporkan, bukan ditutupi.
    expect(result.success).toBe(true);
    expect(result.message).toContain("dokumen gagal disalin");
  });

  it("recovery: klaim SEDANG_DIPROSES yang stale (>15 menit) dipulihkan dan diproses ulang", async () => {
    const staleAt = new Date(Date.now() - 20 * 60 * 1000);
    setupFullApprovalFlow();
    // Panggilan findUnique #1: klaim stale. #2: hasil pemulihan (segar).
    // Antrean Once dipasang SETELAH setupFullApprovalFlow agar tidak
    // tertimpa reset-nya.
    mockPendaftaranFindUnique
      .mockResolvedValueOnce({
        ...pendaftaranWithEmis,
        status: "SEDANG_DIPROSES",
        diprosesOlehId: "guru-lain",
        waktuMulaiProses: staleAt,
      })
      .mockResolvedValueOnce({ ...pendaftaranWithEmis, status: "MENUNGGU_VERIFIKASI" });
    // updateMany pemulihan stale (kondisi SEDANG_DIPROSES + waktu lama)
    // dan klaim ulang keduanya berhasil (default count 1 dari setup).

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);
    // Pemulihan benar-benar memindahkan SEDANG_DIPROSES → MENUNGGU_VERIFIKASI.
    const recoveryCall = mockPendaftaranUpdateMany.mock.calls.find(
      (c: any[]) =>
        c[0]?.where?.status === "SEDANG_DIPROSES" &&
        c[0]?.data?.status === "MENUNGGU_VERIFIKASI",
    );
    expect(recoveryCall).toBeDefined();
  });

  it("klaim SEDANG_DIPROSES yang BELUM stale → ditolak dengan pesan jelas", async () => {
    setupFullApprovalFlow();
    // Klaim SEDANG_DIPROSES yang belum lewat batas 15 menit.
    mockPendaftaranFindUnique.mockReset().mockResolvedValue({
      ...pendaftaranWithEmis,
      status: "SEDANG_DIPROSES",
      diprosesOlehId: "guru-lain",
      waktuMulaiProses: new Date(), // baru saja, belum stale
    });
    // Pemulihan stale menolak (count 0): klaim belum stale.
    mockPendaftaranUpdateMany.mockReset().mockImplementation(
      async (args: { where?: { status?: string } }) => {
        if (args?.where?.status === "SEDANG_DIPROSES") {
          return { count: 0 };
        }
        return { count: 1 };
      },
    );

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("sedang diproses admin lain");
    // Tidak ada side effect apa pun.
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("retry setelah kegagalan tidak membuat data duplikat (idempotent reuse)", async () => {
    // Simulasi: percobaan pertama membuat Auth ortu lalu gagal di transaksi.
    // Percobaan kedua menemukan ortu auth SUDAH ADA → reuse.
    setupFullApprovalFlow();
    // Reset dulu antrean Once dari setupAuthMocks (FIFO).
    mockCreateUser.mockReset()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "User already been registered" },
      })
      .mockResolvedValueOnce({ data: { user: { id: "auth-siswa-uuid" } }, error: null });
    mockListUsers.mockResolvedValue({
      data: { users: [{ id: "auth-ortu-existing", email: "ortu@example.com" }] },
      error: null,
    });
    mockUserFindUnique
      .mockResolvedValueOnce({ id: "user-ortu-existing", role: "ORANG_TUA", aktif: true })
      .mockResolvedValue(null);

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);
    // Orang tua: record ditemukan via authId → tidak ada create.
    const ortuCreates = mockUserCreate.mock.calls.filter(
      (c) => c[0]?.data?.role === "ORANG_TUA",
    );
    expect(ortuCreates).toHaveLength(0);
  });

  it("approval ulang pendaftaran yang sudah DITERIMA → idempotent, tanpa side effect", async () => {
    mockPendaftaranFindUnique.mockResolvedValue({
      ...pendaftaranWithEmis,
      status: "DITERIMA",
      diverifikasiOlehId: "guru-1",
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("sudah DITERIMA");
    expect(result.message).toContain("Tidak ada akun");
    // Tidak ada akun Auth, User, relasi, atau transisi status baru.
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockUserCreate).not.toHaveBeenCalled();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
    expect(mockPendaftaranUpdateMany).not.toHaveBeenCalled();
  });

  it("password tidak bocor ke response error saat Auth gagal", async () => {
    setupFullApprovalFlow();
    // Reset dulu antrean Once dari setupAuthMocks.
    mockCreateUser.mockReset().mockResolvedValueOnce({
      data: null,
      error: { message: "Internal Supabase error" },
    });

    const result = await verifikasiPendaftaran({
      pendaftaranId: "pend-1",
      status: "DITERIMA",
    });

    expect(result.success).toBe(false);
    // Response tidak mengandung password hasil generateSecurePassword.
    expect(result.message).not.toContain("RandomSecurePass123!");
    expect(JSON.stringify(result)).not.toContain("RandomSecurePass123!");
  });
});
