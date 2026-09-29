// src/actions/berkas-siswa.ts

"use server"

import { requireGuruAdmin } from "@/lib/auth"
import { toUserFriendlyError } from "@/lib/prisma-error"
import {
  readBerkasSiswa,
  writeBerkasSiswa,
  removeBerkasSiswa,
  type BerkasSiswaData,
} from "@/lib/berkas-siswa-service"
import type { ActionResponse } from "@/types"
import { revalidatePath } from "next/cache"

export type { BerkasSiswaData }

/**
 * Wrapper admin untuk operasi berkas siswa.
 *
 * Seluruh logika upload/hapus ada di `@/lib/berkas-siswa-service`; file ini
 * hanya menambah otorisasi guru admin + revalidasi path. Dipisah karena logic
 * yang sama dipakai dashboard wali lewat `@/actions/berkas-orang-tua` dengan
 * otorisasi berbeda — inti yang diduplikasi akan rawan melenceng di dua tempat.
 */
export async function getBerkasSiswa(
  siswaId: string
): Promise<ActionResponse<BerkasSiswaData>> {
  try {
    await requireGuruAdmin()
    return await readBerkasSiswa(siswaId)
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memuat berkas siswa"),
    }
  }
}

export async function uploadBerkasSiswa(
  siswaId: string,
  kategori: string,
  formData: FormData
): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()
    const result = await writeBerkasSiswa(siswaId, kategori, formData)
    if (result.success) {
      revalidatePath("/dashboard/siswa")
    }
    return result
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal mengunggah berkas siswa"),
    }
  }
}

export async function hapusBerkasSiswa(
  siswaId: string,
  kategori: string,
  path?: string
): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()
    const result = await removeBerkasSiswa(siswaId, kategori, path)
    if (result.success) {
      revalidatePath("/dashboard/siswa")
    }
    return result
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal menghapus berkas siswa"),
    }
  }
}
