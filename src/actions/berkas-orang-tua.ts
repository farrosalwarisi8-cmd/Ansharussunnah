// src/actions/berkas-orang-tua.ts

"use server"

import prisma from "@/lib/prisma"
import { requireRole } from "@/lib/auth"
import { toUserFriendlyError } from "@/lib/prisma-error"
import {
  readBerkasSiswa,
  writeBerkasSiswa,
  removeBerkasSiswa,
  type BerkasSiswaData,
} from "@/lib/berkas-siswa-service"
import type { ActionResponse } from "@/types"
import { Role } from "@prisma/client"
import { revalidatePath } from "next/cache"

export type { BerkasSiswaData }

/**
 * ✅ KEAMANAN: validasi bahwa pengguna yang sedang login benar-benar wali dari
 * siswa tersebut. Tanpa ini, `siswaId` yang dikirim klien menjadi IDOR
 * baca/tulis berkas antar sekolah.
 *
 * `orangTuaId` diambil dari sesi pengguna yang sedang login — bukan dari
 * input klien — lalu dicocokkan dengan relasi ke `siswaId` yang diminta.
 */
async function verifikasiAksesAnak(
  siswaId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireRole([Role.ORANG_TUA])

  if (!user || !user.orangTua) {
    return { ok: false, message: "Data orang tua tidak ditemukan" }
  }

  const relasi = await prisma.parentStudent.findFirst({
    where: { orangTuaId: user.orangTua.id, siswaId },
    select: { id: true },
  })

  if (!relasi) {
    return { ok: false, message: "Anda tidak memiliki akses ke berkas siswa ini" }
  }

  return { ok: true }
}

/**
 * Melihat berkas anak (KK, akta, pas foto, dokumen lain) dari dashboard wali.
 * Ini adalah jalur melengkapi berkas SETELAH pendaftaran diterima — alur publik
 * bertoken sudah tertutup pada saat itu.
 */
export async function getBerkasAnak(
  siswaId: string
): Promise<ActionResponse<BerkasSiswaData>> {
  try {
    if (!siswaId || typeof siswaId !== "string") {
      return { success: false, message: "ID siswa tidak valid" }
    }

    const akses = await verifikasiAksesAnak(siswaId)
    if (!akses.ok) {
      return { success: false, message: akses.message }
    }

    return await readBerkasSiswa(siswaId)
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memuat berkas anak"),
    }
  }
}

/**
 * Unggah / ganti berkas anak. Nama berkas & path ditentukan server; wali tidak
 * bisa menulis ke bucket/path siswa lain karena relasi parentStudent dicek
 * sebelum operasi.
 */
export async function uploadBerkasAnak(
  siswaId: string,
  kategori: string,
  formData: FormData
): Promise<ActionResponse> {
  try {
    if (!siswaId || typeof siswaId !== "string") {
      return { success: false, message: "ID siswa tidak valid" }
    }

    const akses = await verifikasiAksesAnak(siswaId)
    if (!akses.ok) {
      return { success: false, message: akses.message }
    }

    const result = await writeBerkasSiswa(siswaId, kategori, formData)
    if (result.success) {
      revalidatePath("/dashboard/berkas")
    }
    return result
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal mengunggah berkas anak"),
    }
  }
}

/**
 * Menghapus berkas anak. `path` hanya relevan untuk kategori "lainnya" dan
 * tetap diverifikasi terhadap daftar dokumen anak (di dalam service), jadi
 * wali tidak bisa menghapus path milik siswa lain.
 */
export async function hapusBerkasAnak(
  siswaId: string,
  kategori: string,
  path?: string
): Promise<ActionResponse> {
  try {
    if (!siswaId || typeof siswaId !== "string") {
      return { success: false, message: "ID siswa tidak valid" }
    }

    const akses = await verifikasiAksesAnak(siswaId)
    if (!akses.ok) {
      return { success: false, message: akses.message }
    }

    const result = await removeBerkasSiswa(siswaId, kategori, path)
    if (result.success) {
      revalidatePath("/dashboard/berkas")
    }
    return result
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal menghapus berkas anak"),
    }
  }
}
