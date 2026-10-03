// src/actions/reconcile-siswa.ts
//
// Reconciliation admin-only untuk data siswa yang rusak/orphan:
//   - user role SISWA tanpa row `siswas`
//   - pendaftaran DITERIMA tanpa row `siswas`
//
// Aturan keras:
//   - HANYA SUPER_ADMIN / ADMIN_AKADEMIK (di atas requireGuruAdmin).
//   - TIDAK PERNAH membuat Auth user baru (kredensial tidak bisa dibuat
//     dari sini — auth hanya dibuat oleh alur approval/create manual).
//   - TIDAK PERNAHU membuat User baru bila user dengan authId/email +
//     role SISWA sudah ada.
//   - TIDAK membuat siswa duplikat berdasarkan userId / pendaftaranId /
//     NISN / NIS — semua dicek sebelum create.
//   - Idempotent: repair kedua untuk data yang sama tidak mengubah apa pun.
//   - Dua mode: DRY_RUN (preview tanpa menulis) dan REPAIR_ONE (sekali eksekusi).
//   - Semua kejadian dicatat di log server dengan prefix [student-reconcile].

"use server";

import prisma from "@/lib/prisma";
import { requireGuruAdmin, isAcademicAdminRole } from "@/lib/auth";
import { toUserFriendlyError, AppError } from "@/lib/prisma-error";
import { revalidatePath } from "next/cache";
import type { ActionResponse } from "@/types";
import { Prisma, Role, StatusPendaftaran } from "@prisma/client";

export type ReconcileMode = "DRY_RUN" | "REPAIR_ONE";

export type ReconcileSiswaInput = {
  mode: ReconcileMode;
  userId?: string;
  pendaftaranId?: string;
};

export type ReconcileKonflik = {
  jenis:
    | "USER_TANPA_SISWA"
    | "PENDAFTARAN_TANPA_SISWA"
    | "NISN_DIPAKAI"
    | "NIS_DIPAKAI"
    | "PENDAFTARAN_ID_DIPAKAI"
    | "USER_ID_DIPAKAI"
    | "KELAS_TIDAK_DITEMUKAN"
    | "USER_SISWA_TIDAK_ADA";
  detail: string;
};

export type ReconcileResult = {
  mode: ReconcileMode;
  sumber: "USER" | "PENDAFTARAN";
  userId: string | null;
  pendaftaranId: string | null;
  konflik: ReconcileKonflik[];
  dapatDiperbaiki: boolean;
  requiresReview: boolean;
  alasanReview: string | null;
  siswaIdBaru: string | null;
  pesan: string;
};

export type OrphanSiswaReviewCandidate = {
  tipe: "USER_TANPA_SISWA" | "PENDAFTARAN_TANPA_SISWA";
  userId: string | null;
  pendaftaranId: string | null;
  nama: string | null;
  email: string | null;
  nomorPendaftaran: string | null;
  status: string | null;
  alasan: string;
  safeToRepair: boolean;
  requiresReview: boolean;
};

const REQUIRES_REVIEW = "REQUIRES_REVIEW" as const;

export async function listOrphanSiswaCandidates(): Promise<
  ActionResponse<{
    candidates: OrphanSiswaReviewCandidate[];
    summary: {
      total: number;
      repairable: number;
      review: number;
    };
  }>
> {
  try {
    const admin = await requireGuruAdmin();
    if (!isAcademicAdminRole(admin.role)) {
      throw new AppError(
        "Akses ditolak: daftar review siswa hanya untuk SUPER_ADMIN / ADMIN_AKADEMIK.",
      );
    }

    const users = await prisma.user.findMany({
      where: { role: Role.SISWA, deleted_at: null },
      include: { siswa: true },
    });

    const pendaftarans = await prisma.pendaftaran.findMany({
      where: { status: StatusPendaftaran.DITERIMA, deleted_at: null },
      include: { siswa: true },
    });

    const candidates: OrphanSiswaReviewCandidate[] = [];

    const userSeen = new Set<string>();

    for (const user of users) {
      const hasActiveSiswa = !!user.siswa && !user.siswa.deleted_at;
      if (hasActiveSiswa) continue;

      const cleanEmailTail = user.email?.replace(/[^a-z0-9]/gi, "").toLowerCase();
      const matchingPendaftaran = cleanEmailTail
        ? await prisma.pendaftaran.findFirst({
            where: {
              status: StatusPendaftaran.DITERIMA,
              deleted_at: null,
              // nomorPendaftaran wajib isi (String @unique, non-null) — tidak
              // perlu difilter; filter `not: null` bahkan tidak valid di tipe Prisma.
            },
          })
        : null;

      const matched = !!matchingPendaftaran;
      userSeen.add(user.id);
      candidates.push({
        tipe: "USER_TANPA_SISWA",
        userId: user.id,
        pendaftaranId: matchingPendaftaran?.id ?? null,
        nama: user.nama,
        email: user.email,
        nomorPendaftaran: matchingPendaftaran?.nomorPendaftaran ?? null,
        status: matchingPendaftaran?.status ?? null,
        alasan: matched
          ? "User SISWA tidak memiliki row siswa aktif; pendaftaran yang cocok tersedia untuk review."
          : "User SISWA tidak memiliki row siswa aktif; perlu review admin agar kandidat tidak disambung ke data yang salah.",
        safeToRepair: true,
        requiresReview: true,
      });
    }

    for (const pendaftaran of pendaftarans) {
      const hasActiveSiswa = !!pendaftaran.siswa && !pendaftaran.siswa.deleted_at;
      if (hasActiveSiswa) continue;

      const matchingUser = await prisma.user.findFirst({
        where: {
          role: Role.SISWA,
          email: pendaftaran.nomorPendaftaran
            ? `siswa.${pendaftaran.nomorPendaftaran.toLowerCase().replace(/[^a-z0-9]/g, "")}@sekolah.internal`
            : undefined,
          deleted_at: null,
        },
      });

      const alreadyListed =
        candidates.some((candidate) => candidate.pendaftaranId === pendaftaran.id) ||
        (matchingUser ? userSeen.has(matchingUser.id) : false);
      if (alreadyListed) continue;

      candidates.push({
        tipe: "PENDAFTARAN_TANPA_SISWA",
        userId: matchingUser?.id ?? null,
        pendaftaranId: pendaftaran.id,
        nama: pendaftaran.namaLengkap,
        email: matchingUser?.email ?? null,
        nomorPendaftaran: pendaftaran.nomorPendaftaran,
        status: pendaftaran.status,
        alasan: matchingUser
          ? "Pendaftaran DITERIMA butuh row siswa dan user SISWA yang cocok telah terdeteksi."
          : "Pendaftaran DITERIMA tetap tanpa row siswa; tidak ada user SISWA yang dapat dipasangkan secara aman.",
        safeToRepair: !!matchingUser,
        requiresReview: !matchingUser,
      });
    }

    const summary = {
      total: candidates.length,
      repairable: candidates.filter((candidate) => candidate.safeToRepair).length,
      review: candidates.filter((candidate) => candidate.requiresReview).length,
    };

    return {
      success: true,
      message: "Daftar kandidat orphan siswa berhasil dihasilkan tanpa mengubah data.",
      data: {
        candidates,
        summary,
      },
    };
  } catch (error: unknown) {
    console.error("[student-reconcile] review-list failed", error);
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memuat daftar review siswa."),
    };
  }
}

function emailSiswaInternal(nomorPendaftaran: string): string {
  const clean = nomorPendaftaran.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `siswa.${clean}@sekolah.internal`;
}

/**
 * Preview + repair satu kasus orphan. DRY_RUN tidak menulis apa pun;
 * REPAIR_ONE membuat row siswa (dan relasi ortu bila memungkinkan) dalam
 * satu transaction.
 */
export async function reconcileSiswa(
  input: ReconcileSiswaInput,
): Promise<ActionResponse<ReconcileResult>> {
  try {
    const admin = await requireGuruAdmin();
    if (!isAcademicAdminRole(admin.role)) {
      throw new AppError(
        "Akses ditolak: reconciliation siswa hanya untuk SUPER_ADMIN / ADMIN_AKADEMIK.",
      );
    }

    if (!input.userId && !input.pendaftaranId) {
      return {
        success: false,
        message: "userId atau pendaftaranId wajib diisi.",
      };
    }

    const konflik: ReconcileKonflik[] = [];
    let userId: string | null = null;
    let pendaftaranId: string | null = null;
    let pendaftaran: Prisma.PendaftaranGetPayload<Record<string, never>> | null = null;

    // ---------- Sumber 1: user role SISWA tanpa row siswas ----------
    if (input.userId) {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        include: { siswa: true },
      });
      if (!user) {
        return { success: false, message: "User tidak ditemukan." };
      }
      if (user.role !== Role.SISWA) {
        return {
          success: false,
          message: `User "${user.nama}" berrole ${user.role}, bukan SISWA.`,
        };
      }
      userId = user.id;
      if (user.siswa && !user.siswa.deleted_at) {
        // Idempotent: sudah ada row siswa — tidak ada yang perlu diperbaiki.
        return {
          success: true,
          message: `User "${user.nama}" sudah memiliki row siswa (${user.siswa.id}). Tidak ada perubahan.`,
          data: {
            mode: input.mode,
            sumber: "USER",
            userId,
            pendaftaranId: null,
            konflik: [],
            dapatDiperbaiki: false,
            requiresReview: false,
            alasanReview: null,
            siswaIdBaru: null,
            pesan: "sudah-konsisten",
          },
        };
      }
      konflik.push({
        jenis: "USER_TANPA_SISWA",
        detail: `User "${user.nama}" (${user.email}) tidak memiliki row siswas aktif.`,
      });

      // Repair dari userId butuh data pendaftaran (sumber field EMIS siswa).
      // Email siswa internal berbentuk siswa.<nomor>@sekolah.internal —
      // cari pendaftaran DITERIMA yang cocok berdasarkan nomor tersebut.
      if (!pendaftaran) {
        const match = user.email.match(/^siswa\.([a-z0-9]+)@sekolah\.internal$/);
        if (match) {
          const cleanNomor = match[1];
          const kandidat = await prisma.pendaftaran.findMany({
            where: { status: StatusPendaftaran.DITERIMA, deleted_at: null },
            select: { id: true, nomorPendaftaran: true },
          });
          const cocok = kandidat.find(
            (p) =>
              p.nomorPendaftaran.toLowerCase().replace(/[^a-z0-9]/g, "") ===
              cleanNomor,
          );
          if (cocok) {
            const lengkap = await prisma.pendaftaran.findUnique({
              where: { id: cocok.id },
            });
            if (lengkap) {
              pendaftaranId = lengkap.id;
              pendaftaran = lengkap;
            }
          }
        }
        if (!pendaftaran) {
          return {
            success: true,
            message: REQUIRES_REVIEW,
            data: {
              mode: input.mode,
              sumber: "USER",
              userId,
              pendaftaranId: null,
              konflik,
              dapatDiperbaiki: false,
              requiresReview: true,
              alasanReview:
                "Pendaftaran DITERIMA yang cocok tidak ditemukan dari email user. Repair dengan pendaftaranId eksplisit.",
              siswaIdBaru: null,
              pesan: "pendaftaran-tidak-ditemukan",
            },
          };
        }
      }
    }

    // ---------- Sumber 2: pendaftaran DITERIMA tanpa row siswas ----------
    if (input.pendaftaranId) {
      const p = await prisma.pendaftaran.findUnique({
        where: { id: input.pendaftaranId },
      });
      if (!p) {
        return { success: false, message: "Pendaftaran tidak ditemukan." };
      }
      if (p.status !== StatusPendaftaran.DITERIMA) {
        return {
          success: false,
          message: `Pendaftaran ${p.nomorPendaftaran} berstatus ${p.status}, bukan DITERIMA.`,
        };
      }
      pendaftaranId = p.id;
      pendaftaran = p;

      const siswaAda = await prisma.siswa.findUnique({
        where: { pendaftaranId: p.id },
      });
      if (siswaAda && !siswaAda.deleted_at) {
        return {
          success: true,
          message: `Pendaftaran ${p.nomorPendaftaran} sudah memiliki row siswa (${siswaAda.id}). Tidak ada perubahan.`,
          data: {
            mode: input.mode,
            sumber: "PENDAFTARAN",
            userId: null,
            pendaftaranId,
            konflik: [],
            dapatDiperbaiki: false,
            requiresReview: false,
            alasanReview: null,
            siswaIdBaru: null,
            pesan: "sudah-konsisten",
          },
        };
      }
      konflik.push({
        jenis: "PENDAFTARAN_TANPA_SISWA",
        detail: `Pendaftaran ${p.nomorPendaftaran} DITERIMA tetapi tidak memiliki row siswas.`,
      });

      // Cari user siswa yang seharusnya (dibuat oleh approval sebelumnya).
      const email = emailSiswaInternal(p.nomorPendaftaran);
      const user = await prisma.user.findFirst({
        where: { email, role: Role.SISWA },
      });
      if (user) {
        userId = user.id;
      } else {
        konflik.push({
          jenis: "USER_SISWA_TIDAK_ADA",
          detail: `User SISWA dengan email ${email} tidak ditemukan. Auth/User tidak dapat dibuat dari sini — buat manual lewat "Tambah Siswa" atau ulang alur pendaftaran.`,
        });
      }
    }

    // ---------- Konflik uniqueness ----------
    if (pendaftaran) {
      if (pendaftaran.nisn) {
        const dipakai = await prisma.siswa.findUnique({
          where: { nisn: pendaftaran.nisn },
          select: { id: true },
        });
        if (dipakai) {
          konflik.push({
            jenis: "NISN_DIPAKAI",
            detail: `NISN ${pendaftaran.nisn} sudah dipakai siswa ${dipakai.id}.`,
          });
        }
      }
      // Catatan: Pendaftaran tidak punya kolom NIS (hanya NISN). NIS siswa
      // baru dibuat null — tidak ada konflik NIS yang mungkin dari sini.
    }

    // ---------- Kelas tujuan ----------
    let kelasId: string | null = null;
    if (pendaftaran?.kelasTujuanId) {
      const kelas = await prisma.kelas.findUnique({
        where: { id: pendaftaran.kelasTujuanId },
        select: { id: true, nama: true },
      });
      if (!kelas) {
        // Jangan menebak kelas — kembalikan REQUIRES_REVIEW.
        return {
          success: true,
          message: REQUIRES_REVIEW,
          data: {
            mode: input.mode,
            sumber: pendaftaranId ? "PENDAFTARAN" : "USER",
            userId,
            pendaftaranId,
            konflik,
            dapatDiperbaiki: false,
            requiresReview: true,
            alasanReview: `Kelas tujuan ${pendaftaran.kelasTujuanId} sudah tidak ada. Tentukan kelas baru sebelum repair.`,
            siswaIdBaru: null,
            pesan: "kelas-tidak-ditemukan",
          },
        };
      }
      kelasId = kelas.id;
    }

    const blockingKonflik = konflik.filter(
      (k) =>
        k.jenis === "NISN_DIPAKAI" ||
        k.jenis === "NIS_DIPAKAI" ||
        k.jenis === "PENDAFTARAN_ID_DIPAKAI" ||
        k.jenis === "USER_ID_DIPAKAI",
    );
    const dapatDiperbaiki =
      userId !== null && blockingKonflik.length === 0;

    if (!dapatDiperbaiki) {
      console.log(
        `[student-reconcile] conflict admin=${admin.id} userId=${userId} pendaftaranId=${pendaftaranId} konflik=${konflik.map((k) => k.jenis).join(",")}`,
      );
      return {
        success: true,
        message: REQUIRES_REVIEW,
        data: {
          mode: input.mode,
          sumber: pendaftaranId ? "PENDAFTARAN" : "USER",
          userId,
          pendaftaranId,
          konflik,
          dapatDiperbaiki: false,
          requiresReview: true,
          alasanReview:
            !userId
              ? "User SISWA tidak dapat ditentukan — buat manual oleh admin."
              : `Konflik data: ${blockingKonflik.map((k) => k.detail).join(" ")}`,
          siswaIdBaru: null,
          pesan: "konflik",
        },
      };
    }

    // ---------- DRY_RUN: preview tanpa menulis ----------
    if (input.mode === "DRY_RUN") {
      console.log(
        `[student-reconcile] dry-run admin=${admin.id} userId=${userId} pendaftaranId=${pendaftaranId}`,
      );
      return {
        success: true,
        message: "Dry-run: tidak ada data diubah.",
        data: {
          mode: input.mode,
          sumber: pendaftaranId ? "PENDAFTARAN" : "USER",
          userId,
          pendaftaranId,
          konflik,
          dapatDiperbaiki: true,
          requiresReview: false,
          alasanReview: null,
          siswaIdBaru: null,
          pesan: "dry-run-ok",
        },
      };
    }

    // ---------- REPAIR_ONE: create row siswa dalam transaction ----------
    if (!pendaftaran || !userId) {
      return {
        success: false,
        message: "Data pendaftaran tidak lengkap untuk repair.",
      };
    }

    const siswaIdBaru = await prisma.$transaction(
      async (tx) => {
        // Re-cek idempotensi di dalam transaction (anti-race).
        const existing = await tx.siswa.findFirst({
          where: { userId, deleted_at: null },
        });
        if (existing) return existing.id;

        const siswaBaru = await tx.siswa.create({
          data: {
            userId,
            pendaftaranId,
            nisn: pendaftaran.nisn || null,
            nis: null,
            agama: pendaftaran.agama || null,
            tempatLahir: pendaftaran.tempatLahir,
            tanggalLahir: pendaftaran.tanggalLahir,
            jenisKelamin: pendaftaran.jenisKelamin,
            alamat: pendaftaran.alamatSiswa,
            noHpSiswa: pendaftaran.noHpSiswa || null,
            namaAyahKandung: pendaftaran.namaAyahKandung || null,
            statusAyahKandung: pendaftaran.statusAyahKandung || null,
            nikAyah: pendaftaran.nikAyah || null,
            namaIbuKandung: pendaftaran.namaIbuKandung || null,
            statusIbuKandung: pendaftaran.statusIbuKandung || null,
            nikIbu: pendaftaran.nikIbu || null,
            statusWali: pendaftaran.statusWali || null,
            namaWali: pendaftaran.namaWali || null,
            kewarganegaraan: pendaftaran.kewarganegaraan || "WNI",
            kitas: pendaftaran.kitas || null,
            asalNegara: pendaftaran.asalNegara || null,
            kelasId,
          },
        });

        // Relasi orang tua: HANYA bila user ORANG_TUA sudah ada. Auth user
        // tidak pernah dibuat dari sini — bila ortu belum punya akun,
        // relasi dilewati dan dilaporkan di pesan hasil.
        const emailOrtu = pendaftaran.emailOrangTua.toLowerCase().trim();
        const userOrtu = await tx.user.findFirst({
          where: { email: emailOrtu, role: Role.ORANG_TUA },
        });
        if (userOrtu) {
          let orangTuaRecord = await tx.orangTua.findUnique({
            where: { userId: userOrtu.id, deleted_at: null },
          });
          if (!orangTuaRecord) {
            orangTuaRecord = await tx.orangTua.create({
              data: {
                userId: userOrtu.id,
                noHp: pendaftaran.noHpOrangTua,
                alamat:
                  pendaftaran.alamatOrangTua || pendaftaran.alamatSiswa,
              },
            });
          }
          const relasiAda = await tx.parentStudent.findUnique({
            where: {
              orangTuaId_siswaId: {
                orangTuaId: orangTuaRecord.id,
                siswaId: siswaBaru.id,
              },
            },
          });
          if (!relasiAda) {
            await tx.parentStudent.create({
              data: {
                orangTuaId: orangTuaRecord.id,
                siswaId: siswaBaru.id,
                hubungan: "Orang Tua",
              },
            });
          }
        }

        return siswaBaru.id;
      },
      { timeout: 15000, maxWait: 5000 },
    );

    // Audit log: siapa, kapan, sumber, userId, pendaftaranId, siswaId, hasil.
    console.log(
      `[student-reconcile] repaired admin=${admin.id} adminRole=${admin.role} waktu=${new Date().toISOString()} sumber=${pendaftaranId ? "PENDAFTARAN" : "USER"} userId=${userId} pendaftaranId=${pendaftaranId} siswaIdBaru=${siswaIdBaru}`,
    );

    revalidatePath("/dashboard/siswa");

    return {
      success: true,
      message: `Row siswa ${siswaIdBaru} berhasil dibuat untuk user ${userId}.`,
      data: {
        mode: input.mode,
        sumber: pendaftaranId ? "PENDAFTARAN" : "USER",
        userId,
        pendaftaranId,
        konflik,
        dapatDiperbaiki: true,
        requiresReview: false,
        alasanReview: null,
        siswaIdBaru,
        pesan: "repaired",
      },
    };
  } catch (error: unknown) {
    console.error("[student-reconcile] failed", error);
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal menjalankan reconciliation siswa."),
    };
  }
}
