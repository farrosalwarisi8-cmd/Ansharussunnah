// src/actions/bukti-transfer.ts

"use server"

import prisma from "@/lib/prisma"
import type { ActionResponse } from "@/types"

/**
 * Server Action untuk upload bukti transfer (PUBLIC - tanpa auth)
 * File sudah diupload ke Supabase Storage dari client,
 * server action ini hanya menyimpan path-nya ke database.
 */
export async function uploadBuktiTransferPendaftaran(
  formData: FormData
): Promise<ActionResponse> {
  try {
    const nomorPendaftaran = formData.get("nomorPendaftaran") as string
    const urlFile = formData.get("urlFile") as string
    const namaFile = formData.get("namaFile") as string
    const ukuranFile = parseInt(formData.get("ukuranFile") as string) || 0

    if (!nomorPendaftaran || !urlFile || !namaFile) {
      return {
        success: false,
        message: "Data bukti transfer tidak lengkap",
      }
    }

    // Cek apakah pendaftaran ada
    const pendaftaran = await prisma.pendaftaran.findUnique({
      where: { nomorPendaftaran },
    })

    if (!pendaftaran) {
      return {
        success: false,
        message: "Nomor pendaftaran tidak ditemukan",
      }
    }

    // Cek status - hanya bisa upload jika MENUNGGU_PEMBAYARAN atau DITOLAK
    if (
      pendaftaran.status !== "MENUNGGU_PEMBAYARAN" &&
      pendaftaran.status !== "DITOLAK"
    ) {
      return {
        success: false,
        message: `Pendaftaran dengan status "${pendaftaran.status}" tidak dapat mengupload bukti transfer`,
      }
    }

    // Buat record bukti transfer
    await prisma.buktiTransferPendaftaran.create({
      data: {
        pendaftaranId: pendaftaran.id,
        urlFile,
        namaFile,
        ukuranFile,
        status: "PENDING",
      },
    })

    // Update status pendaftaran menjadi MENUNGGU_VERIFIKASI
    await prisma.pendaftaran.update({
      where: { id: pendaftaran.id },
      data: {
        status: "MENUNGGU_VERIFIKASI",
        alasanPenolakan: null, // Hapus alasan penolakan sebelumnya jika ada
      },
    })

    return {
      success: true,
      message: "Bukti transfer berhasil diupload. Menunggu verifikasi admin.",
    }
  } catch (error) {
    console.error("Error uploadBuktiTransfer:", error)
    return {
      success: false,
      message: "Gagal mengupload bukti transfer. Silakan coba lagi.",
    }
  }
}