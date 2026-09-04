// src/actions/bukti-transfer.ts

"use server"

import prisma from "@/lib/prisma"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { rateLimitAsync, getClientIpFromHeaders } from "@/lib/rate-limit"
import type { ActionResponse } from "@/types"
import { revalidatePath } from "next/cache"

/**
 * ✅ FIX: Verifikasi file benar-benar ada di Supabase Storage
 * sebelum menyimpan record ke database.
 */
export async function uploadBuktiTransferPendaftaran(
  formData: FormData
): Promise<ActionResponse> {
  try {
    // Rate Limit: maksimal 10 upload per 10 menit per IP
    const ip = await getClientIpFromHeaders()
    const limiter = await rateLimitAsync(`upload-bukti-transfer:${ip}`, {
      maxRequests: 10,
      windowMs: 10 * 60 * 1000, // 10 menit
    })
    if (!limiter.success) {
      return {
        success: false,
        message: "Terlalu banyak percobaan upload. Silakan coba lagi dalam 10 menit.",
      }
    }

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

    // Buat record bukti transfer + update status pendaftaran secara ATOMIC
    await prisma.$transaction(
      async (tx) => {
        await tx.buktiTransferPendaftaran.create({
          data: {
            pendaftaranId: pendaftaran.id,
            urlFile,
            namaFile,
            ukuranFile,
            status: "PENDING",
          },
        })

        // Update status pendaftaran
        await tx.pendaftaran.update({
          where: { id: pendaftaran.id },
          data: {
            status: "MENUNGGU_VERIFIKASI",
            alasanPenolakan: null,
          },
        })
      },
      { timeout: 10000, maxWait: 3000 }
    )

    revalidatePath("/dashboard/pendaftaran")

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