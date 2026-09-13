// src/actions/upload-dokumen.ts

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

// Nama field FormData untuk tiap jenis dokumen.
const DOKUMEN_MAP = [
  {
    field: "kartuKeluarga",
    kolom: "dokKartuKeluarga",
    label: "Kartu Keluarga (KK)",
  },
  {
    field: "akteLahir",
    kolom: "dokAkteLahir",
    label: "Akta Kelahiran",
  },
  {
    field: "foto",
    kolom: "dokFoto",
    label: "Pas Foto 3x4",
  },
] as const

function normalizeNomor(nomor: string): string {
  return nomor.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "")
}

/**
 * Unggah dokumen pendukung (KK, Akta Lahir, Pas Foto) PENDAFTARAN setelah
 * formulir awal disubmit — berguna untuk melengkapi berkas yang opsional
 * saat mendaftar, maupun yang ditagih setelah pendaftaran diterima.
 *
 * Keamanan: file DIKIRIM ke server dan diunggah oleh server (service role) ke
 * Supabase Storage. Klien tidak pernah menentukan path file — path dibuat
 * server-side dengan nanoid sehingga path/URL dari klien tidak bisa dipalsukan
 * atau digunakan untuk path traversal / bucket injection (pola sama dengan
 * uploadBuktiTransferPendaftaran). File lama yang diganti dibersihkan
 * best-effort setelah record berhasil diperbarui.
 */
export async function uploadDokumenPendaftaran(
  formData: FormData
): Promise<ActionResponse> {
  try {
    const ip = await getClientIpFromHeaders()
    const limiter = await rateLimitAsync(`upload-dokumen-pendaftaran:${ip}`, {
      maxRequests: 10,
      windowMs: 10 * 60 * 1000, // 10 menit
    })
    if (!limiter.success) {
      return {
        success: false,
        message:
          "Terlalu banyak percobaan upload. Silakan coba lagi dalam 10 menit.",
      }
    }

    const nomorPendaftaran = normalizeNomor(
      (formData.get("nomorPendaftaran") as string) || ""
    )

    if (!nomorPendaftaran) {
      return {
        success: false,
        message: "Nomor pendaftaran wajib diisi",
      }
    }

    // Kumpulkan file yang dikirim (setidaknya satu wajib ada).
    const fileEntries = DOKUMEN_MAP.map((d) => ({
      ...d,
      file: formData.get(d.field) as File | null,
    })).filter((e) => e.file && e.file.size > 0)

    if (fileEntries.length === 0) {
      return {
        success: false,
        message: "Pilih minimal satu berkas untuk diunggah",
      }
    }

    // Validasi magic bytes + ukuran file (server-side, bukan hanya klien)
    for (const entry of fileEntries) {
      const validation = await validateFile(entry.file!)
      if (!validation.valid) {
        return {
          success: false,
          message: `${entry.label}: ${validation.error || "Berkas yang diunggah tidak valid"}`,
        }
      }

      const fileExt = (entry.file!.name.split(".").pop() || "").toLowerCase()
      if (!ALLOWED_EXTENSIONS.has(fileExt)) {
        return {
          success: false,
          message: `${entry.label}: format berkas tidak valid (gunakan JPG, PNG, WEBP, atau PDF)`,
        }
      }
    }

    // Cek apakah pendaftaran ada (tidak dihapus). Dokumen dibutuhkan terlepas
    // dari status (menunggu pembayaran/verifikasi, diterima, maupun ditolak).
    const pendaftaran = await prisma.pendaftaran.findUnique({
      where: { nomorPendaftaran, deleted_at: null },
    })

    if (!pendaftaran) {
      return {
        success: false,
        message: "Nomor pendaftaran tidak ditemukan",
      }
    }

    // Server-side upload dengan service role. Path ditentukan server,
    // disimpan per-pendaftaran di folder `pendaftaran/{idPendaftaran}`.
    const supabaseAdmin = createSupabaseAdmin()

    const uploads: Array<{
      kolom: (typeof DOKUMEN_MAP)[number]["kolom"]
      label: string
      path: string
      file: File
    }> = []

    for (const entry of fileEntries) {
      const file = entry.file!
      const fileExt = (file.name.split(".").pop() || "").toLowerCase()
      const generatedName = `${nanoid(12)}.${fileExt}`
      const filePath = `dokumen-pendaftaran/pendaftaran/${pendaftaran.id}/${generatedName}`

      const arrayBuffer = await file.arrayBuffer()
      const { error: uploadError } = await supabaseAdmin.storage
        .from("dokumen-pendaftaran")
        .upload(filePath, arrayBuffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        })

      if (uploadError) {
        console.error("Storage upload error:", uploadError)

        // Bersihkan file yang sudah terupload sebelumnya pada batch ini
        for (const done of uploads) {
          await supabaseAdmin.storage
            .from("dokumen-pendaftaran")
            .remove([done.path])
            .catch(() => {})
        }

        return {
          success: false,
          message: `${entry.label}: gagal mengunggah berkas. Pastikan format dan ukuran file sesuai (maks. 5 MB).`,
        }
      }

      uploads.push({ kolom: entry.kolom, label: entry.label, path: filePath, file })
    }

    // Simpan path dokumen lama untuk dibersihkan setelah sukses (anti file yatim)
    const oldPaths = uploads
      .map((u) => pendaftaran[u.kolom])
      .filter(
        (p): p is string =>
          typeof p === "string" && p.length > 0 && !p.startsWith("http")
      )

    // Update record pendaftaran secara ATOMIC. Jika gagal, semua file yang
    // barusan diunggah dibersihkan agar tidak jadi file yatim.
    try {
      await prisma.$transaction(async (tx) => {
        const updateData: Record<string, string> = {}
        for (const u of uploads) {
          updateData[u.kolom] = u.path
        }
        await tx.pendaftaran.update({
          where: { id: pendaftaran.id },
          data: updateData,
        })
      }, { timeout: 10000, maxWait: 3000 })
    } catch (dbError) {
      for (const u of uploads) {
        await supabaseAdmin.storage
          .from("dokumen-pendaftaran")
          .remove([u.path])
          .catch(() => {})
      }
      throw dbError
    }

    // Best-effort: hapus dokumen lama yang diganti
    if (oldPaths.length > 0) {
      await supabaseAdmin.storage
        .from("dokumen-pendaftaran")
        .remove(oldPaths)
        .catch(() => {})
    }

    revalidatePath("/dashboard/pendaftaran")

    return {
      success: true,
      message:
        fileEntries.length === 1
          ? `${fileEntries[0].label} berhasil diunggah.`
          : "Dokumen pendaftaran berhasil diunggah.",
    }
  } catch (error) {
    console.error("Error uploadDokumenPendaftaran:", error)
    return {
      success: false,
      message: "Gagal mengunggah dokumen. Silakan coba lagi.",
    }
  }
}