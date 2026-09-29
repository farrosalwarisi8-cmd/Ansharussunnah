// src/actions/konfirmasi-kontak-wali.ts
"use server";

// Konfirmasi kontak wali — gerbang approval pengganti OTP.
//
// Sejak OTP email dihapus dari alur pendaftaran, tidak ada lagi bukti otomatis
// "pemilik email menguasai pendaftaran ini". Penggantinya BUKAN klaim diam-diam
// (misal mengisi ulang kolom emailOrangTuaTerverifikasiAt — itu melanggar
// makna audit kolom warisan), melainkan pemeriksaan manual panitia yang
// dicatat di kolom khusus:
//
//   kontakWaliDikonfirmasiAt        → kapan
//   kontakWaliDikonfirmasiOlehId    → siapa
//   metodeKonfirmasiKontak          → lewat apa (WHATSAPP/TELEPON/LANGSUNG)
//   catatanKonfirmasiKontak         → konteks (mis. nomor yang dihubungi)
//
// verifikasiPendaftaran menolak DITERIMA bila kolom-kolom ini kosong.

import prisma from "@/lib/prisma";
import { requireGuruAdmin } from "@/lib/auth";
import { toUserFriendlyError } from "@/lib/prisma-error";
import { revalidatePath } from "next/cache";
import type { ActionResponse } from "@/types";
import { z } from "zod";

export const METODE_KONFIRMASI = ["WHATSAPP", "TELEPON", "LANGSUNG"] as const;
export type MetodeKonfirmasi = (typeof METODE_KONFIRMASI)[number];

const konfirmasiSchema = z.object({
  pendaftaranId: z.string().min(1),
  metode: z.enum(METODE_KONFIRMASI),
  catatan: z.string().max(500).optional(),
});

export async function konfirmasiKontakWali(
  pendaftaranId: string,
  metode: MetodeKonfirmasi,
  catatan?: string
): Promise<ActionResponse> {
  try {
    const admin = await requireGuruAdmin();

    const parsed = konfirmasiSchema.safeParse({ pendaftaranId, metode, catatan });
    if (!parsed.success) {
      return {
        success: false,
        message: "Data konfirmasi tidak valid",
        errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const pendaftaran = await prisma.pendaftaran.findUnique({
      where: { id: pendaftaranId },
      select: {
        id: true,
        nomorPendaftaran: true,
        deleted_at: true,
        kontakWaliDikonfirmasiAt: true,
      },
    });

    if (!pendaftaran || pendaftaran.deleted_at) {
      return { success: false, message: "Pendaftaran tidak ditemukan" };
    }

    if (pendaftaran.kontakWaliDikonfirmasiAt) {
      return {
        success: false,
        message: `Kontak wali pada pendaftaran ${pendaftaran.nomorPendaftaran} sudah dikonfirmasi.`,
      };
    }

    const sekarang = new Date();

    await prisma.pendaftaran.update({
      where: { id: pendaftaranId },
      data: {
        kontakWaliDikonfirmasiAt: sekarang,
        kontakWaliDikonfirmasiOlehId: admin.id,
        metodeKonfirmasiKontak: parsed.data.metode,
        catatanKonfirmasiKontak: parsed.data.catatan?.trim() || null,
      },
    });

    revalidatePath("/dashboard/verifikasi-pendaftaran");

    return {
      success: true,
      message: `Kontak wali ${pendaftaran.nomorPendaftaran} dikonfirmasi via ${parsed.data.metode.toLowerCase()}. Pendaftaran sekarang bisa disetujui.`,
    };
  } catch (error: unknown) {
    console.error("Error konfirmasiKontakWali:", error);
    return {
      success: false,
      message: toUserFriendlyError(
        error,
        "Gagal menyimpan konfirmasi kontak. Silakan coba lagi."
      ),
    };
  }
}

/** Batalkan konfirmasi (mis. salah input) — hanya selama belum DITERIMA/DITOLAK. */
export async function batalkanKonfirmasiKontakWali(
  pendaftaranId: string
): Promise<ActionResponse> {
  try {
    await requireGuruAdmin();

    const pendaftaran = await prisma.pendaftaran.findUnique({
      where: { id: pendaftaranId },
      select: {
        id: true,
        nomorPendaftaran: true,
        deleted_at: true,
        status: true,
        kontakWaliDikonfirmasiAt: true,
      },
    });

    if (!pendaftaran || pendaftaran.deleted_at) {
      return { success: false, message: "Pendaftaran tidak ditemukan" };
    }

    if (!pendaftaran.kontakWaliDikonfirmasiAt) {
      return { success: false, message: "Konfirmasi kontak belum ada" };
    }

    if (pendaftaran.status === "DITERIMA" || pendaftaran.status === "DITOLAK") {
      return {
        success: false,
        message: `Pendaftaran ${pendaftaran.nomorPendaftaran} sudah berstatus final; konfirmasi tidak bisa dibatalkan.`,
      };
    }

    await prisma.pendaftaran.update({
      where: { id: pendaftaranId },
      data: {
        kontakWaliDikonfirmasiAt: null,
        kontakWaliDikonfirmasiOlehId: null,
        metodeKonfirmasiKontak: null,
        catatanKonfirmasiKontak: null,
      },
    });

    revalidatePath("/dashboard/verifikasi-pendaftaran");
    return { success: true, message: "Konfirmasi kontak dibatalkan" };
  } catch (error: unknown) {
    console.error("Error batalkanKonfirmasiKontakWali:", error);
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal membatalkan konfirmasi. Silakan coba lagi."),
    };
  }
}
