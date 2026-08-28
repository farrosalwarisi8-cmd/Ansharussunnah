// src/lib/storage.ts

import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { nanoid } from "nanoid"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]

/**
 * Validasi file sebelum upload
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Ukuran file "${file.name}" melebihi 5 MB`,
    }
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Tipe file "${file.name}" tidak didukung. Gunakan JPG, PNG, atau PDF.`,
    }
  }
  return { valid: true }
}

/**
 * Upload file ke Supabase Storage (dari browser/client-side)
 * @param bucket - Nama bucket ('dokumen-pendaftaran' atau 'bukti-transfer')
 * @param folder - Sub-folder (misal: 'pendaftaran/REG-2024-00001')
 * @param file - File yang akan diupload
 * @returns URL path file di storage
 */
export async function uploadFileToStorage(
  bucket: string,
  folder: string,
  file: File
): Promise<{ path: string; error?: string }> {
  const validation = validateFile(file)
  if (!validation.valid) {
    return { path: "", error: validation.error }
  }

  const supabase = createSupabaseBrowserClient()
  const fileExt = file.name.split(".").pop()
  const fileName = `${nanoid(12)}.${fileExt}`
  const filePath = `${folder}/${fileName}`

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    })

  if (error) {
    console.error("Upload error:", error)
    return { path: "", error: "Gagal mengupload file. Silakan coba lagi." }
  }

  return { path: data.path }
}

/**
 * Upload banyak file sekaligus
 */
export async function uploadMultipleFiles(
  bucket: string,
  folder: string,
  files: File[]
): Promise<{ paths: string[]; errors: string[] }> {
  const paths: string[] = []
  const errors: string[] = []

  for (const file of files) {
    const result = await uploadFileToStorage(bucket, folder, file)
    if (result.error) {
      errors.push(result.error)
    } else {
      paths.push(result.path)
    }
  }

  return { paths, errors }
}

/**
 * Dapatkan URL publik/signed untuk file di storage (server-side)
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string | null> {
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  if (error) return null
  return data.signedUrl
}