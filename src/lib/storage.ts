// src/lib/storage.ts

import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { nanoid } from "nanoid"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

// Magic bytes signatures untuk format valid


/**
 * Validasi magic bytes (file signature) langsung dari Buffer
 */
async function validateMagicBytes(
  file: File
): Promise<{ valid: boolean; detectedType?: string; error?: string }> {
  try {
    const buffer = await file.slice(0, 12).arrayBuffer()
    const bytes = new Uint8Array(buffer)

    if (bytes.length < 3) {
      return { valid: false, error: "Berkas terlalu kecil" }
    }

    // JPEG check: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { valid: true, detectedType: "image/jpeg" }
    }

    // PNG check: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return { valid: true, detectedType: "image/png" }
    }

    // WEBP check: RIFF....WEBP
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes.length >= 12 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return { valid: true, detectedType: "image/webp" }
    }

    // PDF check: %PDF
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return { valid: true, detectedType: "application/pdf" }
    }

    return {
      valid: false,
      error: "Format berkas tidak valid atau tidak didukung (Gunakan format JPG, PNG, WEBP, atau PDF)",
    }
  } catch {
    return { valid: false, error: "Gagal memproses validasi struktur berkas" }
  }
}

export async function validateFile(
  file: File
): Promise<{ valid: boolean; error?: string }> {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Ukuran file "${file.name}" melebihi batas maksimal 5 MB`,
    }
  }

  if (file.size === 0) {
    return { valid: false, error: `File "${file.name}" tidak memiliki data (kosong)` }
  }

  const magicCheck = await validateMagicBytes(file)
  if (!magicCheck.valid) {
    return { valid: false, error: magicCheck.error }
  }

  return { valid: true }
}

export async function uploadFileToStorage(
  bucket: string,
  folder: string,
  file: File
): Promise<{ path: string; error?: string }> {
  const validation = await validateFile(file)
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
    console.error("Storage upload error:", error)
    return { path: "", error: "Gagal mengunggah file ke server" }
  }

  return { path: data.path }
}

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

/**
 * Batch: generate signed URL untuk banyak file dalam SATU panggilan API.
 * Mengembalikan Map<path, signedUrl | null>.
 * Path yang tidak ditemukan atau gagal akan bernilai null.
 */
export async function getSignedUrls(
  bucket: string,
  paths: string[],
  expiresIn: number = 3600
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>()

  if (paths.length === 0) return result

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, expiresIn)

  if (error || !data) {
    for (const p of paths) result.set(p, null)
    return result
  }

  for (let i = 0; i < paths.length; i++) {
    result.set(paths[i], data[i]?.signedUrl ?? null)
  }

  return result
}