// src/actions/bukti-transfer.ts

"use server"

import prisma from "@/lib/prisma"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import type { ActionResponse } from "@/types"

/**
 * ✅ FIX: Verifikasi file benar-benar ada di Supabase Storage
 * sebelum menyimpan record ke database.
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

    // ✅ FIX: Validasi path file — cegah path traversal
    // Path harus berada di folder transfer/{nomorPendaftaran}/
    const expectedPrefix = `transfer/${nomorPendaftaran}/`
    if (!urlFile.startsWith(expectedPrefix)) {
      return {
        success: false,
        message: "Path file tidak valid. File harus berada di folder pendaftaran yang sesuai.",
      }
    }

    // Cegah path traversal (../)
    if (urlFile.includes("..") || urlFile.includes("//")) {
      return {
        success: false,
        message: "Path file mengandung karakter tidak valid.",
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

    // Cek status
    if (
      pendaftaran.status !== "MENUNGGU_PEMBAYARAN" &&
      pendaftaran.status !== "DITOLAK"
    ) {
      return {
        success: false,
        message: `Pendaftaran dengan status "${pendaftaran.status}" tidak dapat mengupload bukti transfer`,
      }
    }

    // ✅ FIX: Verifikasi file benar-benar ada di Supabase Storage
    const supabaseAdmin = createSupabaseAdmin()
    const { data: fileList, error: listError } = await supabaseAdmin.storage
      .from("bukti-transfer")
      .list(`transfer/${nomorPendaftaran}`)

    if (listError) {
      console.error("Storage list error:", listError)
      return {
        success: false,
        message: "Gagal memverifikasi file di storage.",
      }
    }

    // Cek apakah file dengan nama yang sesuai benar-benar ada
    const fileName = urlFile.split("/").pop()
    const fileExists = fileList?.some((f) => f.name === fileName)

    if (!fileExists) {
      return {
        success: false,
        message: "File bukti transfer tidak ditemukan di storage. Silakan upload ulang.",
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

    // Update status pendaftaran
    await prisma.pendaftaran.update({
      where: { id: pendaftaran.id },
      data: {
        status: "MENUNGGU_VERIFIKASI",
        alasanPenolakan: null,
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