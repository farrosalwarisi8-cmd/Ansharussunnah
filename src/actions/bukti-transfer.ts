// src/actions/bukti-transfer.ts

"use server"

import prisma from "@/lib/prisma"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { validateFile } from "@/lib/storage"
import { rateLimitAsync, getClientIpFromHeaders } from "@/lib/rate-limit"
import type { ActionResponse } from "@/types"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"

// Ekstensi yang diizinkan (SPI/whitelist), kombinasi dengan magic bytes di validateFile
const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "pdf",
])

function normalizeNomor(nomor: string): string {
  return nomor.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "")
}

/**
 * Upload bukti transfer PENDAFTARAN.
 *
 * Keamanan: file DIKIRIM ke server dan diunggah oleh server (service role) ke
 * Supabase Storage. Klien tidak pernah menentukan path file — path dibuat
 * server-side dengan nanoid sehingga path/URL dari klien tidak bisa dipalsukan
 * atau digunakan untuk path traversal / bucket injection.
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

    const nomorPendaftaran = normalizeNomor(
      (formData.get("nomorPendaftaran") as string) || ""
    )
    const file = formData.get("file") as File | null

    if (!nomorPendaftaran || !file) {
      return {
        success: false,
        message: "Data bukti transfer tidak lengkap",
      }
    }

    // Validasi magic bytes + ukuran file (server-side, bukan hanya klien)
    const validation = await validateFile(file)
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error || "Berkas yang diunggah tidak valid",
      }
    }

    const fileExt = (file.name.split(".").pop() || "").toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(fileExt)) {
      return {
        success: false,
        message:
          "Format berkas tidak valid (gunakan JPG, PNG, WEBP, atau PDF)",
      }
    }

    // Cek apakah pendaftaran ada + valid untuk upload
    const pendaftaran = await prisma.pendaftaran.findUnique({
      where: { nomorPendaftaran, deleted_at: null },
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

    // Server-side upload dengan service role. Path ditentukan server,
    // tidak menerima input path apapun dari klien.
    const supabaseAdmin = createSupabaseAdmin()
    const generatedName = `${nanoid(12)}.${fileExt}`
    const filePath = `transfer/${nomorPendaftaran}/${generatedName}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabaseAdmin.storage
      .from("bukti-transfer")
      .upload(filePath, arrayBuffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      })

    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      return {
        success: false,
        message:
          "Gagal mengunggah bukti transfer. Pastikan format dan ukuran file sesuai (maks. 5 MB).",
      }
    }

    // Buat record bukti transfer + update status pendaftaran secara ATOMIC.
    // Jika record gagal dibuat, file yang barusan diunggah dibersihkan.
    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.buktiTransferPendaftaran.create({
            data: {
              pendaftaranId: pendaftaran.id,
              urlFile: filePath,
              namaFile: file.name,
              ukuranFile: file.size,
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
    } catch (dbError) {
      // Cleanup: hapus file yang baru diunggah agar tidak jadi file yatim
      await supabaseAdmin.storage
        .from("bukti-transfer")
        .remove([filePath])
        .catch(() => {})
      throw dbError
    }

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