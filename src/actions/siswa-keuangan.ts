// src/actions/siswa-keuangan.ts

"use server"

import prisma from "@/lib/prisma"
import { requireRole } from "@/lib/auth"
import type { ActionResponse } from "@/types"
import { Role } from "@prisma/client"

const KEUANGAN_ROLES = [Role.ADMIN_KEUANGAN, Role.SUPER_ADMIN] as const

type SiswaReadOnlyListItem = {
  id: string
  userId: string
  nama: string
  email: string
  nisn: string | null
  nis: string | null
  jenisKelamin: string | null
  kelasNama: string | null
  jenjangNama: string | null
  aktif: boolean
}

/**
 * (READ-ONLY) Daftar seluruh siswa beserta filter jenjang/kelas untuk
 * ADMIN_KEUANGAN. Tidak ada aksi edit/reset — hanya menampilkan data.
 * Query disusun independen dari requireGuruAdmin agar role administrasi
 * keuangan dapat melihat siswa di semua kelas & jenjang.
 */
export async function getDaftarSiswaKeuangan(params?: {
  jenjangId?: string
  kelasId?: string
}): Promise<ActionResponse<SiswaReadOnlyListItem[]>> {
  try {
    await requireRole([...KEUANGAN_ROLES])

    const jenjangId = params?.jenjangId
    const kelasId = params?.kelasId

    const siswaList = await prisma.siswa.findMany({
      where: {
        ...(kelasId ? { kelasId } : {}),
        ...(jenjangId && !kelasId
          ? { kelas: { jenjangId } }
          : {}),
        user: { aktif: true },
      },
      include: {
        user: { select: { id: true, nama: true, email: true, aktif: true } },
        kelas: {
          select: {
            nama: true,
            jenjang: { select: { nama: true } },
          },
        },
      },
      orderBy: [{ kelas: { jenjang: { urutan: "asc" } } }, { kelas: { nama: "asc" } }, { user: { nama: "asc" } }],
    })

    const formatted: SiswaReadOnlyListItem[] = siswaList.map((s) => ({
      id: s.id,
      userId: s.user.id,
      nama: s.user.nama,
      email: s.user.email,
      nisn: s.nisn,
      nis: s.nis,
      jenisKelamin: s.jenisKelamin,
      kelasNama: s.kelas?.nama || "—",
      jenjangNama: s.kelas?.jenjang?.nama || "—",
      aktif: s.user.aktif,
    }))

    return {
      success: true,
      message: `Daftar siswa berhasil dimuat (${formatted.length} siswa)`,
      data: formatted,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat daftar siswa",
    }
  }
}

/**
 * Struktur jenjang → kelas untuk filter pada halaman daftar siswa keuangan.
 */
export async function getStrukturKelasUntukKeuangan(): Promise<
  ActionResponse<{
    jenjangList: Array<{
      id: string
      nama: string
      urutan: number
      kelas: Array<{ id: string; nama: string }>
    }>
  }>
> {
  try {
    await requireRole([...KEUANGAN_ROLES])

    const jenjangs = await prisma.jenjang.findMany({
      where: { aktif: true },
      orderBy: { urutan: "asc" },
      include: {
        kelas: {
          where: { aktif: true },
          orderBy: { nama: "asc" },
          select: { id: true, nama: true },
        },
      },
    })

    return {
      success: true,
      message: "Struktur jenjang/kelas berhasil dimuat",
      data: { jenjangList: jenjangs },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat struktur jenjang/kelas",
    }
  }
}
