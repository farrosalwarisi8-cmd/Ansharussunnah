// src/actions/verifikasi.ts

"use server";

import prisma from "@/lib/prisma";
import { deriveUniqueUsername } from "@/lib/username";
import { siswaCocokKelas } from "@/lib/guru-kelas-gender";
import { requireGuruAdmin } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getSignedUrl, getSignedUrls } from "@/lib/storage";
import { generateSecurePassword } from "@/lib/password";
import { REKENING_PPDB_DEFAULT } from "@/lib/biaya-ppdb";
import {
  sendEmail,
  buildKredensialEmail,
  buildKredensialEmailAnakKedua,
  buildPemberitahuanRoleBaruEmail,
  sendPendaftaranDitolakEmail,
} from "@/lib/email";
import {
  verifikasiPendaftaranSchema,
  type VerifikasiPendaftaranValues,
} from "@/lib/validations/pendaftaran";
import { salinDokumenPendaftaranKeSiswa } from "@/lib/salin-dokumen-pendaftaran";
import { BERKAS_BUCKET } from "@/lib/berkas-siswa-service";
import { toUserFriendlyError, AppError } from "@/lib/prisma-error";
import { normalizePagination } from "@/lib/pagination";
import type { ActionResponse, PendaftaranWithRelations } from "@/types";
import { StatusPendaftaran, StatusVerifikasiBukti, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getPendaftaranList(options?: {
  status?: StatusPendaftaran;
  search?: string;
  limit?: number;
  page?: number;
  sortBy?: "newest" | "oldest";
}): Promise<
  ActionResponse<{
    items: PendaftaranWithRelations[];
    total: number;
    page: number;
    totalPages: number;
  }>
> {
  try {
    await requireGuruAdmin();

    // Pagination dibatasi server: limit dari klien dibatasi 1..100 sehingga
    // daftar tidak bisa ditarik seluruhnya dalam satu panggilan.
    const pagination = normalizePagination(
      { page: options?.page, pageSize: options?.limit },
      { defaultPageSize: 10 },
    );
    const page = pagination.page;
    const limit = pagination.pageSize;
    const skip = pagination.skip;

    const whereCondition: Record<string, unknown> = { deleted_at: null };

    if (options?.status) {
      whereCondition.status = options.status;
    }

    if (options?.search) {
      whereCondition.OR = [
        { nomorPendaftaran: { contains: options.search, mode: "insensitive" } },
        { namaLengkap: { contains: options.search, mode: "insensitive" } },
        { namaOrangTua: { contains: options.search, mode: "insensitive" } },
        { emailOrangTua: { contains: options.search, mode: "insensitive" } },
      ];
    }

    const sortDirection = options?.sortBy === "oldest" ? "asc" : "desc";

    const [items, total] = await Promise.all([
      prisma.pendaftaran.findMany({
        where: whereCondition,
        orderBy: [{ createdAt: sortDirection }, { id: sortDirection }],
        skip,
        take: limit,
        include: {
          jenjangTujuan: { include: { kelas: true } },
          kelasTujuan: true,
          buktiTransfer: { orderBy: { waktuUpload: "desc" } },
          diverifikasiOleh: true,
          kontakWaliDikonfirmasiOleh: true,
        },
      }),
      prisma.pendaftaran.count({ where: whereCondition }),
    ]);

    return {
      success: true,
      message: "Data pendaftaran berhasil diambil",
      data: {
        items: items as PendaftaranWithRelations[],
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: unknown) {
    console.error("Error getPendaftaranList:", error);
    return {
      success: false,
      message: toUserFriendlyError(
        error,
        "Gagal memuat daftar pendaftaran. Silakan coba lagi atau hubungi admin.",
      ),
    };
  }
}

/**
 * Rincian jumlah pendaftar per status + hitung berkas belum lengkap — SEMUA di
 * database via count/groupBy, tanpa menarik baris ke server.
 *
 * Dipakai kartu "Rincian Status Pendaftar" di dashboard admin. Sebelumnya kartu
 * ini memanggil getPendaftaranList 4x paralel (masing-masing include besar dan
 * hingga 100 baris) hanya untuk membaca angka total — boros query, memori, dan
 * payload. Sekarang: 2 query ringkas (groupBy + count).
 *
 * Return selalu success dengan angka (0 saat gagal agregasi lanjutan) supaya
 * dashboard tidak perlu menangani bentuk error berbeda dari angka.
 */
export async function getPendaftaranRincianStatus(): Promise<
  ActionResponse<{
    menungguPembayaran: number;
    menungguVerifikasi: number;
    diterima: number;
    ditolak: number;
    berkasBelumLengkap: number;
  }>
> {
  try {
    await requireGuruAdmin();

    // Satu groupBy menghasilkan jumlah per status sekaligus.
    const perStatus = await prisma.pendaftaran.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { deleted_at: null },
    });

    const jumlah = (status: StatusPendaftaran): number =>
      perStatus.find((r) => r.status === status)?._count._all ?? 0;

    // Berkas belum lengkap dihitung DB-side: pendaftar yang sedang menunggu
    // (belum diproses) dengan salah satu berkas utama kosong. Dulu dihitung
    // client dari 100 baris pertama — sekarang akurat tanpa batas baris.
    const berkasBelumLengkap = await prisma.pendaftaran.count({
      where: {
        deleted_at: null,
        status: {
          in: [
            StatusPendaftaran.MENUNGGU_PEMBAYARAN,
            StatusPendaftaran.MENUNGGU_VERIFIKASI,
          ],
        },
        OR: [
          { dokKartuKeluarga: null },
          { dokKartuKeluarga: "" },
          { dokAkteLahir: null },
          { dokAkteLahir: "" },
          { dokFoto: null },
          { dokFoto: "" },
        ],
      },
    });

    return {
      success: true,
      message: "Rincian pendaftar berhasil diambil",
      data: {
        menungguPembayaran: jumlah(StatusPendaftaran.MENUNGGU_PEMBAYARAN),
        menungguVerifikasi: jumlah(StatusPendaftaran.MENUNGGU_VERIFIKASI),
        diterima: jumlah(StatusPendaftaran.DITERIMA),
        ditolak: jumlah(StatusPendaftaran.DITOLAK),
        berkasBelumLengkap,
      },
    };
  } catch (error: unknown) {
    console.error("Error getPendaftaranRincianStatus:", error);
    return {
      success: false,
      message: toUserFriendlyError(
        error,
        "Gagal memuat rincian pendaftar. Silakan coba lagi atau hubungi admin.",
      ),
    };
  }
}

export async function getPendaftaranDetail(pendaftaranId: string): Promise<
  ActionResponse<{
    pendaftaran: PendaftaranWithRelations;
    signedUrls: {
      kartuKeluarga?: string | null;
      akteLahir?: string | null;
      foto?: string | null;
      buktiTransfer: Array<{ id: string; url: string | null }>;
    };
  }>
> {
  try {
    await requireGuruAdmin();

    const pendaftaran = await prisma.pendaftaran.findUnique({
      where: { id: pendaftaranId, deleted_at: null },
      include: {
        jenjangTujuan: { include: { kelas: true } },
        kelasTujuan: true,
        buktiTransfer: { orderBy: { waktuUpload: "desc" } },
        diverifikasiOleh: true,
        // Jejak konfirmasi kontak wali (pengganti OTP) — panel admin
        // menampilkan siapa/kapan, dan itu juga yang membuka gerbang DITERIMA.
        kontakWaliDikonfirmasiOleh: true,
      },
    });

    if (!pendaftaran) {
      return { success: false, message: "Data pendaftaran tidak ditemukan" };
    }

    const buktiPaths = pendaftaran.buktiTransfer
      .map((bt) => bt.urlFile)
      .filter((u): u is string => !!u && !u.startsWith("http"))

    const signedBuktiMap = buktiPaths.length > 0
      ? await getSignedUrls("bukti-transfer", buktiPaths)
      : new Map<string, string | null>()

    const [signedKK, signedAkte, signedFoto] = await Promise.all([
      pendaftaran.dokKartuKeluarga
        ? getSignedUrl("dokumen-pendaftaran", pendaftaran.dokKartuKeluarga)
        : null,
      pendaftaran.dokAkteLahir
        ? getSignedUrl("dokumen-pendaftaran", pendaftaran.dokAkteLahir)
        : null,
      pendaftaran.dokFoto
        ? getSignedUrl("dokumen-pendaftaran", pendaftaran.dokFoto)
        : null,
    ])

    const signedBukti = pendaftaran.buktiTransfer.map((bt) => ({
      id: bt.id,
      url: bt.urlFile && bt.urlFile.startsWith("http")
        ? bt.urlFile
        : (bt.urlFile ? (signedBuktiMap.get(bt.urlFile) ?? null) : null),
    }))

    return {
      success: true,
      message: "Detail pendaftaran berhasil diambil",
      data: {
        pendaftaran: pendaftaran as PendaftaranWithRelations,
        signedUrls: {
          kartuKeluarga: signedKK,
          akteLahir: signedAkte,
          foto: signedFoto,
          buktiTransfer: signedBukti,
        },
      },
    };
  } catch (error: unknown) {
    console.error("Error getPendaftaranDetail:", error);
    return {
      success: false,
      message: toUserFriendlyError(
        error,
        "Gagal memuat detail pendaftaran. Silakan coba lagi atau hubungi admin.",
      ),
    };
  }
}

/**
 * Batas waktu klaim SEDANG_DIPROSES dianggap stale (menggantung
 * karena crash/proses mati). Setelah lewat, admin lain boleh
 * memulihkan pendaftaran ke MENUNGGU_VERIFIKASI dan memproses
 * ulang dari awal.
 */
// `export`-free: berkas ini bertanda "use server" yang hanya
// boleh mengekspor fungsi async. Konstanta ini cukup dipakai
// internal (lihat pemulihan klaim stale di bawah).
const STALE_PROSES_MS = 15 * 60 * 1000;

/**
 * Batalkan klaim SEDANG_DIPROSES → kembali ke MENUNGGU_VERIFIKASI.
 * Bersyarat: hanya admin yang mengklaim (diprosesOlehId sama) yang
 * boleh membatalkan, dan hanya bila status masih SEDANG_DIPROSES.
 * Dipakai setiap jalur kegagalan setelah claim agar status tidak
 * menggantung selamanya.
 */
async function batalkanKlaimProses(
  pendaftaranId: string,
  adminId: string,
): Promise<void> {
  await prisma.pendaftaran.updateMany({
    where: {
      id: pendaftaranId,
      status: StatusPendaftaran.SEDANG_DIPROSES,
      diprosesOlehId: adminId,
    },
    data: {
      status: StatusPendaftaran.MENUNGGU_VERIFIKASI,
      diprosesOlehId: null,
      waktuMulaiProses: null,
    },
  });
}

/**
 * Pulihkan klaim SEDANG_DIPROSES yang STALE (lebih dari
 * STALE_PROSES_MS lalu, atau waktunya kosong) → kembali ke
 * MENUNGGU_VERIFIKASI. Mengembalikan true bila baris benar
 * dipulihkan (hanya satu request yang menang — updateMany
 * bersyarat).
 */
async function pulihkanKlaimStale(
  pendaftaranId: string,
): Promise<boolean> {
  const batas = new Date(Date.now() - STALE_PROSES_MS);
  const hasil = await prisma.pendaftaran.updateMany({
    where: {
      id: pendaftaranId,
      status: StatusPendaftaran.SEDANG_DIPROSES,
      OR: [
        { waktuMulaiProses: null },
        { waktuMulaiProses: { lte: batas } },
      ],
    },
    data: {
      status: StatusPendaftaran.MENUNGGU_VERIFIKASI,
      diprosesOlehId: null,
      waktuMulaiProses: null,
    },
  });
  return hasil.count > 0;
}

// Helper untuk menghapus user Supabase Auth jika transaction gagal
async function cleanupAuthUsers(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  authIds: string[],
): Promise<void> {
  for (const authId of authIds) {
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(authId);
      if (error) {
        console.error(
          `⚠️ Cleanup Error (Auth ID: ${authId}): ${error.message}`,
        );
      } else {
        console.log(`✅ Cleanup Sukses (Auth ID: ${authId})`);
      }
    } catch (cleanupErr) {
      console.error(
        `⚠️ Exception saat membersihkan Auth ID: ${authId}`,
        cleanupErr,
      );
    }
  }
}

export async function verifikasiPendaftaran(
  payload: VerifikasiPendaftaranValues,
): Promise<ActionResponse> {
  try {
    const guruUser = await requireGuruAdmin();

    const validated = verifikasiPendaftaranSchema.safeParse(payload);
    if (!validated.success) {
      return {
        success: false,
        message: "Data verifikasi tidak valid",
        errors: validated.error.flatten().fieldErrors,
      };
    }

    const {
      pendaftaranId,
      status,
      catatanAdmin,
      alasanPenolakan,
      kelasTujuanId,
    } = validated.data;

    let pendaftaran = await prisma.pendaftaran.findUnique({
      where: { id: pendaftaranId, deleted_at: null },
      include: {
        buktiTransfer: { orderBy: { waktuUpload: "desc" }, take: 1 },
        jenjangTujuan: true,
      },
    });

    if (!pendaftaran) {
      return { success: false, message: "Data pendaftaran tidak ditemukan" };
    }
    // pendaftaran diambil include penuh; field konfirmasi kontak wali ikut
    // tersedia pada objek ini untuk gerbang di bawah.

    // ============ GUARD STATE MACHINE (anti-race) ============
    //
    // MENUNGGU_VERIFIKASI → SEDANG_DIPROSES → DITERIMA
    // MENUNGGU_VERIFIKASI → DITOLAK
    //
    // 1. Approval ulang pendaftaran yang SUDAH DITERIMA bersifat
    //    idempotent: sukses, tetapi TIDAK membuat akun Auth,
    //    User, OrangTua, Siswa, atau relasi baru apa pun.
    // 2. SEDANG_DIPROSES: pendaftaran sedang dipegang admin
    //    lain (atau klaim menggantung karena crash). Bila klaim
    //    sudah stale (> 15 menit), pulihkan ke MENUNGGU_VERIFIKASI
    //    dan proses seperti biasa; bila belum, hentikan.
    // 3. Status lain (DITOLAK, MENUNGGU_PEMBAYARAN) tidak bisa
    //    diverifikasi.
    if (
      status === "DITERIMA" &&
      pendaftaran.status === StatusPendaftaran.DITERIMA
    ) {
      return {
        success: true,
        message: `Pendaftaran ${pendaftaran.nomorPendaftaran} sudah DITERIMA sebelumnya. Tidak ada akun atau relasi baru yang dibuat.`,
      };
    }

    if (pendaftaran.status === StatusPendaftaran.SEDANG_DIPROSES) {
      const dipulihkan = await pulihkanKlaimStale(pendaftaran.id);
      if (!dipulihkan) {
        return {
          success: false,
          message: `Pendaftaran ${pendaftaran.nomorPendaftaran} sedang diproses admin lain. Tunggu hingga selesai atau refresh halaman.`,
        };
      }
      // Klaim stale berhasil dipulihkan → muat ulang record agar
      // seluruh pemeriksaan berikutnya (kontak wali, kapasitas,
      // dst) memakai data terbaru.
      const segar = await prisma.pendaftaran.findUnique({
        where: { id: pendaftaranId, deleted_at: null },
        include: {
          buktiTransfer: { orderBy: { waktuUpload: "desc" }, take: 1 },
          jenjangTujuan: true,
        },
      });
      if (!segar) {
        return { success: false, message: "Data pendaftaran tidak ditemukan" };
      }
      pendaftaran = segar;
    }

    if (pendaftaran.status !== StatusPendaftaran.MENUNGGU_VERIFIKASI) {
      return {
        success: false,
        message: `Pendaftaran ${pendaftaran.nomorPendaftaran} sudah berstatus ${pendaftaran.status} dan tidak dapat diverifikasi lagi.`,
      };
    }

    // GERBANG APPROVAL: konfirmasi kontak wali oleh panitia (pengganti OTP).
    //
    // OTP email dihapus dari alur pendaftaran, jadi tidak ada lagi bukti
    // otomatis kepemilikan kontak. Sebagai gantinya, panitia WAJIB mengonfirmasi
    // kontak wali (WhatsApp/telepon/langsung) SEBELUM menyetujui — tombol
    // "Konfirmasi Kontak Wali" di panel verifikasi mencatatnya ke kolom
    // khusus (kontakWaliDikonfirmasiAt + metode + catatan). Bila belum,
    // approval ditolak dengan pesan yang jelas — BUKAN diam-diam dianggap
    // "email sudah terverifikasi".
    //
    // Kolom emailOrangTuaTerverifikasiAt yang lama TIDAK dipakai lagi sebagai
    // gerbang: isinya adalah jejak OTP/grandfathering pendaftaran lama, dan
    // memakainya untuk approval baru akan mencampur makna audit.
    //
    // Penolakan (DITOLAK) tidak melewati gerbang ini: menolak tidak membuat
    // akun apa pun dan harus selalu bisa dilakukan.
    if (
      status === "DITERIMA" &&
      !pendaftaran.kontakWaliDikonfirmasiAt
    ) {
      return {
        success: false,
        message:
          "Kontak wali belum dikonfirmasi panitia, sehingga pendaftaran tidak bisa disetujui. Hubungi orang tua/wali (WhatsApp/telepon/langsung), lalu tekan \"Konfirmasi Kontak Wali\" pada panel pendaftaran ini sebelum menerima.",
      };
    }

    const latestBuktiId = pendaftaran.buktiTransfer[0]?.id;

    // Kelas tujuan final: pakai override dari admin bila dikirim, selain itu
    // gunakan kelas tujuan yang dipilih pendaftar saat mendaftar.
    const finalKelasId = kelasTujuanId || pendaftaran.kelasTujuanId || null;

    // --- CASE A: PENDAFTARAN DITOLAK ---
    if (status === "DITOLAK") {
      if (!alasanPenolakan) {
        return {
          success: false,
          message: "Alasan penolakan wajib diisi jika menolak pendaftaran",
        };
      }

      await prisma.$transaction(
        async (tx) => {
          const claimed = await tx.pendaftaran.updateMany({
            where: {
              id: pendaftaranId,
              status: StatusPendaftaran.MENUNGGU_VERIFIKASI,
            },
            data: {
              status: StatusPendaftaran.DITOLAK,
              catatanAdmin: catatanAdmin || null,
              alasanPenolakan,
              diverifikasiOlehId: guruUser.id,
              waktuVerifikasi: new Date(),
            },
          });

          if (claimed.count === 0) {
            throw new AppError(
              "Pendaftaran sudah diproses admin lain. Silakan refresh halaman.",
            );
          }

          if (latestBuktiId) {
            await tx.buktiTransferPendaftaran.update({
              where: { id: latestBuktiId },
              data: {
                status: StatusVerifikasiBukti.DITOLAK,
                catatanVerifikasi: alasanPenolakan,
                diverifikasiOlehId: guruUser.id,
                waktuVerifikasi: new Date(),
              },
            });
          }

          return claimed;
        },
        { timeout: 10000, maxWait: 5000 },
      );

      // Beri tahu orang tua/wali: pendaftaran ditolak + alasannya, agar tidak
      // menunggu status yang tidak akan pernah berubah. Snapshot kontakWa pada
      // record dipakai; fallback ke default bila kosong (pendaftaran lama).
      //
      // PENTING: dibungkus try/catch sendiri karena status SUDAH final di DB
      // pada titik ini. Jika EMAIL yang melempar, admin tidak boleh melihat
      // aksi "gagal" padahal penolakan sudah tersimpan — dan mengulangi aksi
      // akan ditolak guard transisi status dengan pesan membingungkan.
      let emailPenolakanTerkirim = false;
      try {
        const hasil = await sendPendaftaranDitolakEmail({
          namaOrangTua: pendaftaran.namaOrangTua,
          emailOrangTua: pendaftaran.emailOrangTua,
          namaSiswa: pendaftaran.namaLengkap,
          nomorPendaftaran: pendaftaran.nomorPendaftaran,
          alasanPenolakan,
          catatanAdmin: catatanAdmin || null,
          kontakWa: pendaftaran.kontakWa || REKENING_PPDB_DEFAULT.kontakWa,
        });
        emailPenolakanTerkirim = hasil.success;
        if (!hasil.success) {
          console.error(
            `[email] Email penolakan ${pendaftaran.nomorPendaftaran} gagal:`,
            hasil.error,
          );
        }
      } catch (error) {
        console.error(
          `[email] Error tak terduga saat mengirim email penolakan ${pendaftaran.nomorPendaftaran}:`,
          error,
        );
      }

      revalidatePath("/dashboard/pendaftaran");
      return {
        success: true,
        message: emailPenolakanTerkirim
          ? `Pendaftaran ${pendaftaran.nomorPendaftaran} telah DITOLAK. Email pemberitahuan dikirim ke ${pendaftaran.emailOrangTua}.`
          : `Pendaftaran ${pendaftaran.nomorPendaftaran} telah DITOLAK, tetapi email pemberitahuan GAGAL terkirim. Mohon informasikan penolakan secara manual ke ${pendaftaran.emailOrangTua}.`,
      };
    }

    // --- CASE B: PENDAFTARAN DITERIMA ---
    if (status === "DITERIMA") {
      const supabaseAdmin = createSupabaseAdmin();

      // ✅ Validasi kapasitas kelas sebelum menerima pendaftaran
      if (finalKelasId) {
        const kelas = await prisma.kelas.findUnique({
          where: { id: finalKelasId },
          include: { _count: { select: { siswa: true } }, jenjang: true },
        });
        if (!kelas) {
          return {
            success: false,
            message:
              "Kelas tujuan tidak ditemukan. Pilih kelas yang tersedia sebelum menerima pendaftaran.",
          };
        }

        // Validasi jenjang kelas harus sama dengan jenjang tujuan pendaftar
        if (pendaftaran.jenjangTujuanId && kelas.jenjangId !== pendaftaran.jenjangTujuanId) {
          return {
            success: false,
            message: `Kelas "${kelas.nama}" adalah kelas ${kelas.jenjang?.nama || "lain"} dan tidak sesuai dengan jenjang tujuan pendaftar (${pendaftaran.jenjangTujuan?.nama || "tidak diketahui"}). Pilih kelas yang sesuai.`,
          };
        }

        if (kelas.kapasitas > 0 && kelas._count.siswa >= kelas.kapasitas) {
          return {
            success: false,
            message: `Kelas "${kelas.nama}" sudah penuh (${kelas._count.siswa}/${kelas.kapasitas}). Pilih kelas lain sebelum menerima pendaftaran.`,
          };
        }

        // ✅ Validasi kecocokan gender pendaftar dengan kelas tujuan
        if (
          kelas &&
          kelas.jenisKelamin &&
          pendaftaran.jenisKelamin &&
          kelas.jenisKelamin !== pendaftaran.jenisKelamin
        ) {
          const labelKelas =
            kelas.jenisKelamin === "LAKI_LAKI" ? "Ikhwan" : "Akhwat";
          return {
            success: false,
            message: `Kelas "${kelas.nama}" adalah kelas khusus ${labelKelas} dan tidak sesuai dengan jenis kelamin pendaftar. Pilih kelas tujuan yang sesuai sebelum menerima.`,
          };
        }
      }

      // ============ CLAIM ATOMIK (anti-race) ============
      // Pindahkan status MENUNGGU_VERIFIKASI → SEDANG_DIPROSES
      // SEBELUM side effect apa pun (Supabase Auth). updateMany
      // bersyarat menjamin hanya SATU request — dari dua admin
      // yang menekan "Terima" bersamaan — yang bisa melanjutkan;
      // request kedua berhenti di sini tanpa membuat akun ganda.
      const klaimProses = await prisma.pendaftaran.updateMany({
        where: {
          id: pendaftaranId,
          status: StatusPendaftaran.MENUNGGU_VERIFIKASI,
        },
        data: {
          status: StatusPendaftaran.SEDANG_DIPROSES,
          diprosesOlehId: guruUser.id,
          waktuMulaiProses: new Date(),
        },
      });

      if (klaimProses.count === 0) {
        return {
          success: false,
          message: `Pendaftaran ${pendaftaran.nomorPendaftaran} sedang atau sudah diproses admin lain. Silakan refresh halaman dan coba lagi.`,
        };
      }

      // Amankan credentials secara random. Password ortu hanya digenerate bila
      // akun ortu benar-benar BARU akan dibuat. Jika email ortu sudah punya akun
      // (reuse authId), password lama tetap dipakai — TIDAK ada password ortu baru.
      let passwordOrangTua: string | undefined;
      const passwordSiswa = generateSecurePassword(14);

      const emailOrtu = pendaftaran.emailOrangTua.toLowerCase().trim();
      const cleanNomor = pendaftaran.nomorPendaftaran
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const emailSiswa = `siswa.${cleanNomor}@sekolah.internal`;

      const newlyCreatedAuthIds: string[] = [];
      let authOrtuId: string;
      let ortuAlreadyExisted = false;
      // Id siswa hasil approval; dipakai SETELAH transaksi commit untuk menyalin
      // dokumen pendaftaran ke bucket berkas-siswa.
      let siswaIdTerverifikasi: string | null = null;
      let ortuRecordBaruDibuat = false;
      // Akun Auth dibuat/di-reuse secara idempotent. Seluruh bagian
      // ini dibungkus try/catch: bila Auth gagal, akun yang sudah
      // sempat dibuat dihapus dan klaim SEDANG_DIPROSES dibatalkan
      // (kembali ke MENUNGGU_VERIFIKASI) — tidak ada akun yatim dan
      // tidak ada status menggantung.
      let authSiswaId: string;
      try {
        // Create Supabase Auth Orang Tua
        passwordOrangTua = generateSecurePassword(14);
        const { data: authOrtuData, error: authOrtuError } =
          await supabaseAdmin.auth.admin.createUser({
            email: emailOrtu,
            password: passwordOrangTua,
            email_confirm: true,
            user_metadata: {
              nama: pendaftaran.namaOrangTua,
              role: Role.ORANG_TUA,
            },
          });

        if (authOrtuError) {
          if (authOrtuError.message.includes("already been registered")) {
            // Akun ortu sudah tersedia (mis. approval sebelumnya
            // gagal di tengah jalan): REUSE — jangan buat akun
            // kedua. Paginate dengan perPage besar agar lookup
            // tidak terbatas pada 50 user pertama (listUsers
            // default 50).
            const { data: existingUsers } =
              await supabaseAdmin.auth.admin.listUsers({
                perPage: 1000,
              });
            const matched = existingUsers.users.find(
              (u) => u.email === emailOrtu,
            );
            if (!matched) throw new Error("Gagal memetakan akun auth orang tua");
            authOrtuId = matched.id;
            ortuAlreadyExisted = true;
            // Akun reuse: password ortu "baru" yang digenerate tidak dipakai
            // kemana-mana (createUser gagal, akun lama tidak diubah).
            passwordOrangTua = undefined;
          } else {
            throw new Error(
              `Gagal membuat akun auth orang tua: ${authOrtuError.message}`,
            );
          }
        } else {
          authOrtuId = authOrtuData.user.id;
          if (!ortuAlreadyExisted) newlyCreatedAuthIds.push(authOrtuId);
        }

        // Create Supabase Auth Siswa (idempotent: reuse bila email
        // siswa internal sudah punya akun — mis. approval sebelumnya
        // gagal setelah akun siswa dibuat).
        const { data: authSiswaData, error: authSiswaError } =
          await supabaseAdmin.auth.admin.createUser({
            email: emailSiswa,
            password: passwordSiswa,
            email_confirm: true,
            user_metadata: {
              nama: pendaftaran.namaLengkap,
              role: Role.SISWA,
            },
          });

        if (authSiswaError) {
          if (authSiswaError.message.includes("already been registered")) {
            const { data: existingUsers } =
              await supabaseAdmin.auth.admin.listUsers({
                perPage: 1000,
              });
            const matched = existingUsers.users.find(
              (u) => u.email === emailSiswa,
            );
            if (!matched) throw new Error("Gagal memetakan akun auth siswa");
            authSiswaId = matched.id;
          } else {
            throw new Error(
              `Gagal membuat akun auth siswa: ${authSiswaError.message}`,
            );
          }
        } else {
          authSiswaId = authSiswaData.user.id;
          newlyCreatedAuthIds.push(authSiswaId);
        }
      } catch (authError) {
        // Audit di log server (pesan error provider tidak bocor ke
        // response — tidak mengandung password/token).
        console.error(
          `[verifikasi] Pembuatan akun Auth gagal untuk ${pendaftaran.nomorPendaftaran}:`,
          authError,
        );
        await cleanupAuthUsers(supabaseAdmin, newlyCreatedAuthIds);
        await batalkanKlaimProses(pendaftaranId, guruUser.id);
        return {
          success: false,
          message:
            "Gagal membuat akun login. Pendaftaran dikembalikan ke antrean verifikasi agar bisa dicoba ulang.",
        };
      }

      // ✅ Prisma Transaction with strict rollback cleanup
      try {
        await prisma.$transaction(
          async (tx) => {
            // ✅ Validasi NISN agar tidak duplikat dengan siswa yang SUDAH ADA
            // ATAU pendaftaran aktif lain. Kolom nisn di model Siswa bersifat
            // @unique — tanpa pengecekan proaktif ini, approve akan crash dengan
            // error mentah P2002 langsung ke layar admin. Kita cek lebih awal dan
            // beri pesan yang jelas. Satu NISN hanya boleh milik SATU calon siswa:
            // dicek juga terhadap pendaftaran aktif (MENUNGGU_PEMBAYARAN /
            // MENUNGGU_VERIFIKASI) lain, paritas dengan jalur pendaftaran online
            // & siswa manual.
            if (pendaftaran.nisn) {
              const [nisnSiswa, nisnPendaftaran] = await Promise.all([
                tx.siswa.findUnique({
                  where: { nisn: pendaftaran.nisn },
                  select: {
                    id: true,
                    user: { select: { nama: true, id: true } },
                  },
                }),
                tx.pendaftaran.findFirst({
                  where: {
                    nisn: pendaftaran.nisn,
                    id: { not: pendaftaran.id },
                    status: {
                      in: [
                        StatusPendaftaran.MENUNGGU_PEMBAYARAN,
                        StatusPendaftaran.MENUNGGU_VERIFIKASI,
                      ],
                    },
                  },
                  select: {
                    nomorPendaftaran: true,
                    namaLengkap: true,
                    status: true,
                  },
                }),
              ]);
              if (nisnSiswa) {
                throw new AppError(
                  `NISN "${pendaftaran.nisn}" sudah terdaftar atas nama ${nisnSiswa.user.nama}. Mohon periksa kembali data pendaftaran ini sebelum melanjutkan.`,
                );
              }
              if (nisnPendaftaran) {
                throw new AppError(
                  `NISN "${pendaftaran.nisn}" sudah digunakan pada pendaftaran lain (Nomor: ${nisnPendaftaran.nomorPendaftaran}, atas nama ${nisnPendaftaran.namaLengkap}) yang sedang ${nisnPendaftaran.status === StatusPendaftaran.MENUNGGU_VERIFIKASI ? "diverifikasi admin" : "menunggu pembayaran"}. Satu NISN hanya boleh untuk satu calon siswa. Mohon periksa kembali.`,
                );
              }
            }

            // Find existing user by authId + role first, then by email as fallback
            // (handles cases where authId differs but email matches — e.g. parent
            // re-registers with a new Supabase auth but the DB still has the old record)
            let userOrtu = await tx.user.findFirst({
              where: { authId: authOrtuId, role: Role.ORANG_TUA },
            });

            if (!userOrtu) {
              userOrtu = await tx.user.findFirst({
                where: { email: emailOrtu, role: Role.ORANG_TUA },
              });
              if (userOrtu) {
                await tx.user.update({
                  where: { id: userOrtu.id },
                  data: { authId: authOrtuId },
                });
              }
            }

            // Jangan pernah mengambil/menimpa record user dengan role lain (misal
            // ADMIN_KEUANGAN/GURU) yang ber-email sama. Satu orang bisa punya
            // beberapa role, dan role ORANG_TUA harus punya record tersendiri agar
            // muncul di fitur "Ganti Akun" dan bisa login sebagai wali santri.
            if (!userOrtu) {
              userOrtu = await tx.user.create({
                data: {
                  email: emailOrtu,
                  username: await deriveUniqueUsername(tx, emailOrtu),
                  nama: pendaftaran.namaOrangTua,
                  role: Role.ORANG_TUA,
                  authId: authOrtuId,
                  // Akun reuse (email sudah punya akun di role lain): tidak ada
                  // password baru → jangan paksa ganti password.
                  ...(ortuAlreadyExisted
                    ? { mustChangePassword: false }
                    : { mustChangePassword: true }),
                  aktif: true,
                  orangTua: {
                    create: {
                      noHp: pendaftaran.noHpOrangTua,
                      alamat:
                        pendaftaran.alamatOrangTua || pendaftaran.alamatSiswa,
                    },
                  },
                },
              });
              if (ortuAlreadyExisted) {
                // Record ORANG_TUA ini BARU dibuat dari akun yang email-nya sudah
                // punya akun lain (reuse authId) → peran ORANG_TUA baru ditambahkan.
                ortuRecordBaruDibuat = true;
              }
            } else if (userOrtu.aktif === false) {
              // Reaktivasi akun orang tua yang pernah dinonaktifkan (orang tua dengan
              // anak kedua+ yang sebelumnya dia nonaktifkan / record lama).
              await tx.user.update({
                where: { id: userOrtu.id },
                data: { aktif: true },
              });
            }

            const orangTuaRecord = await tx.orangTua.findUnique({
              where: { userId: userOrtu.id, deleted_at: null },
            });

            let userSiswa = await tx.user.findFirst({
              where: { authId: authSiswaId, role: Role.SISWA },
            });

            if (!userSiswa) {
              userSiswa = await tx.user.findFirst({
                where: { email: emailSiswa, role: Role.SISWA },
              });
              if (userSiswa) {
                await tx.user.update({
                  where: { id: userSiswa.id },
                  data: { authId: authSiswaId },
                });
              }
            }

            // Re-check kapasitas + gender kelas DI DALAM transaction untuk
            if (finalKelasId) {
              const kelasTx = await tx.kelas.findUnique({
                where: { id: finalKelasId },
                include: { _count: { select: { siswa: true } } },
              });
              if (!kelasTx) {
                throw new AppError(
                  "Kelas tujuan tidak ditemukan pada saat verifikasi.",
                );
              }
              if (
                kelasTx &&
                kelasTx.kapasitas > 0 &&
                kelasTx._count.siswa >= kelasTx.kapasitas
              ) {
                throw new AppError(
                  `Kelas "${kelasTx.nama}" sudah penuh (${kelasTx._count.siswa}/${kelasTx.kapasitas}).`,
                );
              }
              if (
                kelasTx &&
                !siswaCocokKelas(pendaftaran.jenisKelamin, kelasTx.jenisKelamin)
              ) {
                throw new AppError(
                  `Kelas "${kelasTx.nama}" adalah kelas khusus gender yang tidak sesuai dengan jenis kelamin pendaftar.`,
                );
              }
            }

            if (!userSiswa) {
              const existingByEmail = await tx.user.findFirst({
                where: { email: emailSiswa, role: Role.SISWA },
              });
              if (existingByEmail) {
                userSiswa = existingByEmail;
                await tx.user.update({
                  where: { id: userSiswa.id },
                  data: { authId: authSiswaId },
                });
              } else {
                userSiswa = await tx.user.create({
                  data: {
                    email: emailSiswa,
                    username: await deriveUniqueUsername(tx, emailSiswa),
                    nama: pendaftaran.namaLengkap,
                    role: Role.SISWA,
                    authId: authSiswaId,
                    mustChangePassword: true,
                    siswa: {
                      create: {
                        nisn: pendaftaran.nisn || null,
                        agama: pendaftaran.agama || null,
                        tempatLahir: pendaftaran.tempatLahir,
                        tanggalLahir: pendaftaran.tanggalLahir,
                        jenisKelamin: pendaftaran.jenisKelamin,
                        alamat: pendaftaran.alamatSiswa,
                        noHpSiswa: pendaftaran.noHpSiswa || null,
                        namaAyahKandung: pendaftaran.namaAyahKandung || null,
                        statusAyahKandung:
                          pendaftaran.statusAyahKandung || null,
                        nikAyah: pendaftaran.nikAyah || null,
                        namaIbuKandung: pendaftaran.namaIbuKandung || null,
                        statusIbuKandung: pendaftaran.statusIbuKandung || null,
                        nikIbu: pendaftaran.nikIbu || null,
                        statusWali: pendaftaran.statusWali || null,
                        namaWali: pendaftaran.namaWali || null,
                        kewarganegaraan: pendaftaran.kewarganegaraan || "WNI",
                        kitas: pendaftaran.kitas || null,
                        asalNegara: pendaftaran.asalNegara || null,
                        kelasId: finalKelasId,
                        pendaftaranId: pendaftaran.id,
                      },
                    },
                  },
                });
              }
            }

            const siswaRecord = await tx.siswa.findUnique({
              where: { userId: userSiswa.id, deleted_at: null },
            });

            siswaIdTerverifikasi = siswaRecord?.id ?? null;

            if (orangTuaRecord && siswaRecord) {
              const existingRelation = await tx.parentStudent.findUnique({
                where: {
                  orangTuaId_siswaId: {
                    orangTuaId: orangTuaRecord.id,
                    siswaId: siswaRecord.id,
                  },
                },
              });

              if (!existingRelation) {
                await tx.parentStudent.create({
                  data: {
                    orangTuaId: orangTuaRecord.id,
                    siswaId: siswaRecord.id,
                    hubungan: "Orang Tua",
                  },
                });
              }
            }

            if (latestBuktiId) {
              await tx.buktiTransferPendaftaran.update({
                where: { id: latestBuktiId },
                data: {
                  status: StatusVerifikasiBukti.DITERIMA,
                  diverifikasiOlehId: guruUser.id,
                  waktuVerifikasi: new Date(),
                },
              });
            }

            // Transisi final state machine: SEDANG_DIPROSES → DITERIMA,
            // bersyarat record masih dipegah admin ini (status belum
            // berubah di tengah transaksi).
            const claimed = await tx.pendaftaran.updateMany({
              where: {
                id: pendaftaranId,
                status: StatusPendaftaran.SEDANG_DIPROSES,
              },
              data: {
                status: StatusPendaftaran.DITERIMA,
                catatanAdmin: catatanAdmin || null,
                kelasTujuanId: finalKelasId,
                diverifikasiOlehId: guruUser.id,
                waktuVerifikasi: new Date(),
              },
            });

            if (claimed.count === 0) {
              throw new AppError(
                "Pendaftaran sudah diproses admin lain. Silakan refresh halaman.",
              );
            }
          },
          { timeout: 15000, maxWait: 5000 },
        );
      } catch (txError) {
        console.error(
          "Prisma transaction error, rolling back Supabase Users...",
          txError,
        );
        await cleanupAuthUsers(supabaseAdmin, newlyCreatedAuthIds);
        // Batalkan klaim SEDANG_DIPROSES → MENUNGGU_VERIFIKASI agar
        // status tidak menggantung (stale recovery adalah fallback
        // bila pembatalan ini pun gagal).
        await batalkanKlaimProses(pendaftaranId, guruUser.id);
        throw txError;
      }

      // Salin dokumen pendaftaran ke bucket `berkas-siswa` supaya langsung
      // menyatu dengan berkas siswa. Dilakukan SETELAH transaksi commit:
      //   - ID siswa baru hanya ada setelah commit, sedangkan path tujuan butuh
      //     siswaId.
      //   - I/O storage di dalam transaksi menahan lock DB terlalu lama, dan
      //     rollback transaksi tidak akan membatalkan file yang sudah tercopy.
      //
      // Best-effort: kegagalan satu berkas tidak membatalkan approval (status
      // sudah final), berkas gagal ditandai kosong agar wali bisa mengunggah
      // ulang dari dashboard. Doc source tetap dipertahankan di pendaftaran.
      let dokumenGagalDisalin = 0;
      if (siswaIdTerverifikasi) {
        // Path tujuan yang sudah tercopy, dipakai untuk membersihkannya bila
        // penulisan path ke DB gagal (lihat catch di bawah).
        let pathTersalin: string[] = [];
        try {
          const hasilSalin = await salinDokumenPendaftaranKeSiswa(
            siswaIdTerverifikasi,
            {
              kartuKeluarga: pendaftaran.dokKartuKeluarga,
              akteLahir: pendaftaran.dokAkteLahir,
              foto: pendaftaran.dokFoto,
              lainnya: Array.isArray(pendaftaran.dokLainnya)
                ? pendaftaran.dokLainnya
                : [],
            },
          );

          dokumenGagalDisalin = hasilSalin.gagal.length;
          pathTersalin = hasilSalin.tersalin;

          await prisma.siswa.update({
            where: { id: siswaIdTerverifikasi },
            data: {
              dokKartuKeluarga: hasilSalin.kartuKeluarga,
              dokAkteLahir: hasilSalin.akteLahir,
              dokFoto: hasilSalin.foto,
              dokLainnya: hasilSalin.lainnya,
            },
          });

          pathTersalin = [];
        } catch (copyError) {
          dokumenGagalDisalin = 1;
          console.error(
            `Gagal menyalin dokumen pendaftaran ${pendaftaran.nomorPendaftaran}:`,
            copyError,
          );

          // Approval sudah commit dan tidak bisa di-rollback, jadi file yang
          // sudah tercopy tapi tidak tercatat di DB akan menggantung sebagai
          // arsip PII yang tidak tertaut. Hapus agar tidak tertinggal.
          if (pathTersalin.length > 0) {
            await supabaseAdmin.storage
              .from(BERKAS_BUCKET)
              .remove(pathTersalin)
              .catch((removeError) => {
                console.error(
                  `Gagal membersihkan ${pathTersalin.length} berkas yatim:`,
                  removeError,
                );
              });
          }
        }
      }

      // Kirim email kredensial / pemberitahuan.
      // - Akun ortu BARU (authId benar-benar baru): kirim kredensial lengkap
      //   (ortu + siswa) via buildKredensialEmail.
      // - Akun ortu SUDAH ADA (reuse authId): kirim kredensial SISWA via
      //   buildKredensialEmailAnakKedua — tanpa password ortu baru (tidak ada
      //   password ortu baru yang digenerate). Alur ini TIDAK diubah.
      // Jika peran ORANG_TUA benar-benar BARU ditambahkan ke akun yang sudah ada
      // (sebelumnya email ini hanya punya role lain, dan record ORANG_TUA baru
      // diciptakan), kirim juga pemberitahuan role baru — TANPA password.
      //
      // F1 — status parsial yang jujur: email dikirim SETELAH transaksi commit,
      // jadi kegagalan email BUKAN kegagalan approval. Status DB sudah final
      // (DITERIMA, akun dibuat); mengulang aksi tidak mungkin (guard transisi
      // status) dan tidak boleh — cukup laporkan bahwa email gagal supaya
      // panitia menyampaikan kredensial secara manual.
      let emailKredensialTerkirim = true;
      let emailKredensialError: string | null = null;
      try {
        const hasilEmail = await sendEmail({
          to: emailOrtu,
          jenisEmail: "kredensial_akun",
          // Sekali approval → sekali email kredensial (retry tidak menggandakan).
          idempotencyKey: `kredensial:${pendaftaran.nomorPendaftaran}`,
          subject: ortuAlreadyExisted
            ? `Santri Baru Diterima — ${pendaftaran.nomorPendaftaran}`
            : `Pendaftaran Disetujui — ${pendaftaran.nomorPendaftaran}`,
          html: ortuAlreadyExisted
            ? buildKredensialEmailAnakKedua({
                namaOrangTua: pendaftaran.namaOrangTua,
                emailOrangTua: emailOrtu,
                namaSiswa: pendaftaran.namaLengkap,
                emailSiswa,
                passwordSiswa,
                nomorPendaftaran: pendaftaran.nomorPendaftaran,
              })
            : buildKredensialEmail({
                namaOrangTua: pendaftaran.namaOrangTua,
                emailOrangTua: emailOrtu,
                passwordOrangTua,
                namaSiswa: pendaftaran.namaLengkap,
                emailSiswa,
                passwordSiswa,
                nomorPendaftaran: pendaftaran.nomorPendaftaran,
              }),
        });
        emailKredensialTerkirim = hasilEmail.success;
        if (!hasilEmail.success) {
          emailKredensialError =
            typeof hasilEmail.error === "string" && hasilEmail.error.length > 0
              ? hasilEmail.error
              : "tidak diketahui";
          console.error(
            `[email] Email kredensial ${pendaftaran.nomorPendaftaran} gagal:`,
            hasilEmail.error,
          );
        }
      } catch (error) {
        emailKredensialTerkirim = false;
        emailKredensialError =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[email] Error tak terduga saat mengirim email kredensial ${pendaftaran.nomorPendaftaran}:`,
          error,
        );
      }

      if (ortuAlreadyExisted && ortuRecordBaruDibuat) {
        await sendEmail({
          to: emailOrtu,
          jenisEmail: "role_baru",
          idempotencyKey: `role-baru:${pendaftaran.nomorPendaftaran}`,
          subject: "Akun Orang Tua Baru Ditambahkan — Ansharussunnah",
          html: buildPemberitahuanRoleBaruEmail({
            nama: pendaftaran.namaOrangTua,
            email: emailOrtu,
            roleBaru: "Orang Tua",
          }),
        });
      }

      revalidatePath("/dashboard/pendaftaran");
      revalidatePath("/dashboard/siswa");
      revalidatePath("/dashboard/berkas");

      // F1 — status parsial yang jujur dalam SATU pesan: approval sudah commit
      // (tidak bisa dibatalkan), tapi admin harus tahu apa yang belum beres:
      // email kredensial gagal, dan/atau sebagian dokumen gagal disalin.
      const catatanParsial: string[] = [];
      if (!emailKredensialTerkirim) {
        catatanParsial.push(
          `EMAIL KREDENSIAL GAGAL terkirim ke ${emailOrtu}${emailKredensialError ? ` (${emailKredensialError})` : ""}. Sampaikan kredensial login secara manual — jangan mengulang aksi "Terima" karena status sudah final.`,
        );
      }
      if (dokumenGagalDisalin > 0) {
        catatanParsial.push(
          `${dokumenGagalDisalin} dokumen gagal disalin ke berkas siswa — wali dapat mengunggah ulang dari dashboard.`,
        );
      }

      return {
        success: true,
        message:
          `Pendaftaran ${pendaftaran.nomorPendaftaran} DITERIMA. Akun login telah dikirimkan ke ${emailOrtu}.` +
          (catatanParsial.length > 0
            ? ` CATATAN: ${catatanParsial.join(" ")} Sekaligus periksa panel berkas di dashboard wali.`
            : ""),
      };
    }

    return { success: false, message: "Status verifikasi tidak dikenali" };
  } catch (error: unknown) {
    console.error("Error verifikasiPendaftaran:", error);
    return {
      success: false,
      message: toUserFriendlyError(
        error,
        "Terjadi kesalahan saat memproses verifikasi. Silakan coba lagi atau hubungi admin.",
      ),
    };
  }
}
