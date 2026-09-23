// src/actions/biaya-ppdb.ts
//
// Server actions pengaturan biaya PPDB (panel admin /dashboard/biaya-ppdb).
//
// KEAMANAN:
// - Semua akses tulis dijaga guard role admin: SUPER_ADMIN / ADMIN_AKADEMIK /
//   GURU(isAdmin) / ADMIN_KEUANGAN — sama dengan cakupan panel verifikasi
//   pendaftar plus admin keuangan (domain keuangan).
// - Semua input divalidasi zod sebelum menyentuh DB.
// - Pembacaan publik (halaman pendaftaran) lewat lib/biaya-ppdb-server di
//   server component, bukan action klien tanpa guard.
//
// KECEPATAN: pembacaan di-cache (lihat lib/biaya-ppdb-server), penulisan
// selalu meng-invalidate cache agar perubahan langsung terlihat.

"use server"

import prisma from "@/lib/prisma"
import { requireRole } from "@/lib/auth"
import { AppError, toUserFriendlyError } from "@/lib/prisma-error"
import { Role, Prisma } from "@prisma/client"
import {
  updateBiayaJenjangSchema,
  updatePengaturanPPDBSchema,
  type UpdateBiayaJenjangValues,
  type UpdatePengaturanPPDBValues,
} from "@/lib/validations/biaya-ppdb"
import type { ActionResponse } from "@/types"
import { revalidatePath } from "next/cache"
import {
  getPengaturanPPDB,
  invalidateBiayaPPDBCache,
} from "@/lib/biaya-ppdb-server"
import { resolveBiayaJenjang } from "@/lib/biaya-ppdb"

async function requireAdminPPDB() {
  // SUPER_ADMIN/ADMIN_AKADEMIK selalu boleh; GURU hanya bila isAdmin;
  // ADMIN_KEUANGAN boleh karena ini domain keuangan.
  const user = await requireRole([
    Role.SUPER_ADMIN,
    Role.ADMIN_AKADEMIK,
    Role.GURU,
    Role.ADMIN_KEUANGAN,
  ])
  if (user.role === Role.GURU && !user.isAdmin) {
    throw new AppError("Akses ditolak: Fitur ini hanya untuk admin")
  }
  return user
}

/**
 * Data lengkap untuk panel admin: daftar jenjang (termasuk non-aktif) beserta
 * biaya efektifnya + pengaturan rekening/WA saat ini.
 */
export async function getBiayaPPDBAdmin(): Promise<
  ActionResponse<{
    jenjang: Array<{
      id: string
      nama: string
      aktif: boolean
      urutan: number
      biayaPendaftaran: number
      biayaUangGedung: number
      biayaSarpras: number
    }>
    pengaturan: {
      bankNama: string
      bankNoRekening: string
      bankAtasNama: string
      kontakWa: string
      namaKontakWa: string
    }
  }>
> {
  try {
    await requireAdminPPDB()

    const [jenjangRows, pengaturan] = await Promise.all([
      prisma.jenjang.findMany({
        orderBy: { urutan: "asc" },
        select: {
          id: true,
          nama: true,
          aktif: true,
          urutan: true,
          biayaPendaftaranPPDB: true,
          biayaUangGedung: true,
          biayaSarpras: true,
        },
      }),
      getPengaturanPPDB(),
    ])

    return {
      success: true,
      message: "Data biaya PPDB berhasil dimuat",
      data: {
        jenjang: jenjangRows.map((j) => {
          const biaya = resolveAdminBiaya(j)
          return {
            id: j.id,
            nama: j.nama,
            aktif: j.aktif,
            urutan: j.urutan,
            biayaPendaftaran: biaya.biayaPendaftaran,
            biayaUangGedung: biaya.biayaUangGedung,
            biayaSarpras: biaya.biayaSarpras,
          }
        }),
        pengaturan,
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memuat pengaturan biaya PPDB"),
    }
  }
}

function resolveAdminBiaya(j: {
  nama: string
  biayaPendaftaranPPDB: Prisma.Decimal | null
  biayaUangGedung: Prisma.Decimal | null
  biayaSarpras: Prisma.Decimal | null
}): { biayaPendaftaran: number; biayaUangGedung: number; biayaSarpras: number } {
  const b = resolveBiayaJenjang(j.nama, {
    biayaPendaftaranPPDB: j.biayaPendaftaranPPDB ? j.biayaPendaftaranPPDB.toString() : null,
    biayaUangGedung: j.biayaUangGedung ? j.biayaUangGedung.toString() : null,
    biayaSarpras: j.biayaSarpras ? j.biayaSarpras.toString() : null,
  })
  return b
}

/**
 * Simpan biaya satu jenjang. Nilai dikirim sebagai angka final (bukan null)
 * sehingga panel selalu menampilkan harga eksplisit — admin tetap bisa
 * mengembalikan ke default dengan mengisi angka default lagi.
 */
export async function updateBiayaJenjang(
  payload: UpdateBiayaJenjangValues
): Promise<ActionResponse> {
  try {
    await requireAdminPPDB()

    const validated = updateBiayaJenjangSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data biaya tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { jenjangId, ...biaya } = validated.data

    const jenjang = await prisma.jenjang.findUnique({
      where: { id: jenjangId },
      select: { id: true, nama: true },
    })
    if (!jenjang) {
      return { success: false, message: "Jenjang tidak ditemukan" }
    }

    await prisma.jenjang.update({
      where: { id: jenjangId },
      data: {
        biayaPendaftaranPPDB: new Prisma.Decimal(biaya.biayaPendaftaran),
        biayaUangGedung: new Prisma.Decimal(biaya.biayaUangGedung),
        biayaSarpras: new Prisma.Decimal(biaya.biayaSarpras),
      },
    })

    await invalidateBiayaPPDBCache()
    revalidatePath("/dashboard/biaya-ppdb")
    revalidatePath("/pendaftaran")
    revalidatePath("/pendaftaran/sukses")

    return {
      success: true,
      message: `Biaya PPDB jenjang "${jenjang.nama}" berhasil diperbarui`,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memperbarui biaya jenjang"),
    }
  }
}

/**
 * Simpan pengaturan rekening tujuan transfer & kontak WA konfirmasi.
 * Upsert baris tunggal (id = 1) — aman dipanggil sebelum seed.
 */
export async function updatePengaturanPPDB(
  payload: UpdatePengaturanPPDBValues
): Promise<ActionResponse> {
  try {
    await requireAdminPPDB()

    const validated = updatePengaturanPPDBSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data pengaturan tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const data = validated.data

    await prisma.pengaturanPPDB.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    })

    await invalidateBiayaPPDBCache()
    revalidatePath("/dashboard/biaya-ppdb")
    revalidatePath("/pendaftaran")
    revalidatePath("/pendaftaran/sukses")

    return {
      success: true,
      message: "Pengaturan rekening & kontak WA berhasil disimpan",
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal menyimpan pengaturan PPDB"),
    }
  }
}
