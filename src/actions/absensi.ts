// src/actions/absensi.ts

"use server"

import prisma from "@/lib/prisma"
import { requireRole } from "@/lib/auth"
import { verifyGuruAksesKelas } from "@/lib/guru-auth"
import {
  inputAbsensiSingleSchema,
  inputAbsensiBulkSchema,
  editAbsensiSchema,
  rekapKehadiranSchema,
  riwayatKehadiranSiswaSchema,
  type InputAbsensiSingleValues,
  type InputAbsensiBulkValues,
  type EditAbsensiValues,
  type RekapKehadiranValues,
  type RiwayatKehadiranSiswaValues,
} from "@/lib/validations/absensi"
import type { ActionResponse } from "@/types"
import { Role, StatusAbsensi } from "@prisma/client"
import { revalidatePath } from "next/cache"

// ========================================================
// HELPER: Validasi relasi Orang Tua → Siswa
// ========================================================

/**
 * Memverifikasi bahwa orang tua yang sedang login benar-benar
 * memiliki relasi ke siswa yang diminta via tabel ParentStudent.
 * Mencegah IDOR (Insecure Direct Object Reference).
 */
async function verifyOrangTuaAksesSiswa(
  orangTuaId: string,
  siswaId: string
): Promise<boolean> {
  const relasi = await prisma.parentStudent.findFirst({
    where: {
      orangTuaId,
      siswaId,
    },
  })
  return !!relasi
}

// ========================================================
// 1. ACTIONS GURU: INPUT ABSENSI
// ========================================================

/**
 * Input absensi untuk 1 siswa pada 1 tanggal.
 * Menggunakan upsert agar bisa mengedit jika sudah ada record.
 */
export async function inputAbsensiSingle(
  payload: InputAbsensiSingleValues
): Promise<ActionResponse> {
  try {
    const validated = inputAbsensiSingleSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data absensi tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { siswaId, kelasId, periodeAjaranId, tanggal, status, keterangan } =
      validated.data

    // Otorisasi: guru harus punya akses ke kelas ini
    const { user } = await verifyGuruAksesKelas(kelasId)

    // Validasi siswa benar-benar terdaftar di kelas ini
    const siswa = await prisma.siswa.findFirst({
      where: { id: siswaId, kelasId },
    })
    if (!siswa) {
      return {
        success: false,
        message: "Siswa tidak terdaftar di kelas yang dipilih",
      }
    }

    // Validasi periode ajaran
    const periode = await prisma.periodeAjaran.findUnique({
      where: { id: periodeAjaranId },
    })
    if (!periode) {
      return { success: false, message: "Periode ajaran tidak ditemukan" }
    }

    const tanggalDate = new Date(tanggal)

    // Upsert: jika sudah ada absensi untuk siswa+tanggal, update; jika belum, create
    await prisma.absensi.upsert({
      where: {
        siswaId_tanggal: {
          siswaId,
          tanggal: tanggalDate,
        },
      },
      update: {
        status: status as StatusAbsensi,
        keterangan,
        diinputOlehId: user.id,
        kelasId,
        periodeAjaranId,
      },
      create: {
        siswaId,
        kelasId,
        periodeAjaranId,
        tanggal: tanggalDate,
        status: status as StatusAbsensi,
        keterangan,
        diinputOlehId: user.id,
      },
    })

    revalidatePath(`/dashboard/guru/absensi`)
    return {
      success: true,
      message: `Absensi siswa berhasil disimpan (${status})`,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menyimpan absensi",
    }
  }
}

/**
 * Input absensi massal (bulk) untuk seluruh siswa dalam 1 kelas pada 1 tanggal.
 * Menggunakan transaction agar atomik — semua berhasil atau semua gagal.
 */
export async function inputAbsensiBulk(
  payload: InputAbsensiBulkValues
): Promise<ActionResponse<{ berhasil: number; gagal: number }>> {
  try {
    const validated = inputAbsensiBulkSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data absensi bulk tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { kelasId, periodeAjaranId, tanggal, absensi } = validated.data

    const { user } = await verifyGuruAksesKelas(kelasId)

    const periode = await prisma.periodeAjaran.findUnique({
      where: { id: periodeAjaranId },
    })
    if (!periode) {
      return { success: false, message: "Periode ajaran tidak ditemukan" }
    }

    const tanggalDate = new Date(tanggal)

    // Validasi semua siswa terdaftar di kelas ini
    const siswaIds = absensi.map((a) => a.siswaId)
    const siswaTerdaftar = await prisma.siswa.findMany({
      where: {
        id: { in: siswaIds },
        kelasId,
      },
      select: { id: true },
    })

    const siswaValidIds = new Set(siswaTerdaftar.map((s) => s.id))
    const siswaInvalid = siswaIds.filter((id) => !siswaValidIds.has(id))

    if (siswaInvalid.length > 0) {
      return {
        success: false,
        message: `${siswaInvalid.length} siswa tidak terdaftar di kelas yang dipilih`,
      }
    }

    // Eksekusi bulk upsert dalam transaction
    let berhasil = 0

    await prisma.$transaction(
      async (tx) => {
      for (const item of absensi) {
        await tx.absensi.upsert({
          where: {
            siswaId_tanggal: {
              siswaId: item.siswaId,
              tanggal: tanggalDate,
            },
          },
          update: {
            status: item.status as StatusAbsensi,
            keterangan: item.keterangan,
            diinputOlehId: user.id,
            kelasId,
            periodeAjaranId,
          },
          create: {
            siswaId: item.siswaId,
            kelasId,
            periodeAjaranId,
            tanggal: tanggalDate,
            status: item.status as StatusAbsensi,
            keterangan: item.keterangan,
            diinputOlehId: user.id,
          },
        })
        berhasil++
      }
      },
      { timeout: 10000, maxWait: 3000 }
    )

    revalidatePath(`/dashboard/guru/absensi`)
    return {
      success: true,
      message: `Absensi bulk berhasil: ${berhasil} siswa tercatat`,
      data: { berhasil, gagal: 0 },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menyimpan absensi bulk",
    }
  }
}

/**
 * Edit absensi yang sudah diinput sebelumnya.
 */
export async function editAbsensi(
  payload: EditAbsensiValues
): Promise<ActionResponse> {
  try {
    const validated = editAbsensiSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data edit absensi tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { absensiId, status, keterangan } = validated.data

    const absensi = await prisma.absensi.findUnique({
      where: { id: absensiId },
    })
    if (!absensi) {
      return { success: false, message: "Record absensi tidak ditemukan" }
    }

    // Otorisasi: guru harus punya akses ke kelas absensi ini
    await verifyGuruAksesKelas(absensi.kelasId)

    await prisma.absensi.update({
      where: { id: absensiId },
      data: {
        status: status as StatusAbsensi,
        keterangan,
      },
    })

    revalidatePath(`/dashboard/guru/absensi`)
    return {
      success: true,
      message: "Absensi berhasil diperbarui",
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memperbarui absensi",
    }
  }
}

// ========================================================
// 2. ACTIONS GURU: REKAP KEHADIRAN
// ========================================================

/**
 * Rekap persentase kehadiran per siswa dalam satu kelas untuk periode tertentu.
 * Mengembalikan data agregat: total hari, hadir, sakit, izin, alpha, persentase.
 */
export async function getRekapKehadiranKelas(
  payload: RekapKehadiranValues
): Promise<ActionResponse> {
  try {
    const validated = rekapKehadiranSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Parameter rekap tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { kelasId, periodeAjaranId, tanggalMulai, tanggalSelesai } =
      validated.data

    await verifyGuruAksesKelas(kelasId)

    // Build filter tanggal
    const tanggalFilter: Record<string, unknown> = {}
    if (tanggalMulai) {
      tanggalFilter.gte = new Date(tanggalMulai)
    }
    if (tanggalSelesai) {
      tanggalFilter.lte = new Date(tanggalSelesai)
    }

    // Ambil semua siswa di kelas
    const siswaList = await prisma.siswa.findMany({
      where: { kelasId },
      include: {
        user: { select: { nama: true } },
      },
      orderBy: { user: { nama: "asc" } },
    })

    // Ambil semua absensi untuk kelas + periode + filter tanggal
    const whereAbsensi: Record<string, unknown> = {
      kelasId,
      periodeAjaranId,
    }
    if (Object.keys(tanggalFilter).length > 0) {
      whereAbsensi.tanggal = tanggalFilter
    }

    const semuaAbsensi = await prisma.absensi.findMany({
      where: whereAbsensi,
    })

    // Agregasi per siswa
    const rekap = siswaList.map((siswa) => {
      const absensiSiswa = semuaAbsensi.filter(
        (a) => a.siswaId === siswa.id
      )

      const hitung = {
        HADIR: 0,
        SAKIT: 0,
        IZIN: 0,
        ALPHA: 0,
      }

      for (const a of absensiSiswa) {
        hitung[a.status]++
      }

      const total = absensiSiswa.length
      const persentaseKehadiran =
        total > 0 ? ((hitung.HADIR / total) * 100).toFixed(1) : "0.0"

      return {
        siswaId: siswa.id,
        nama: siswa.user.nama,
        nisn: siswa.nisn,
        totalHari: total,
        hadir: hitung.HADIR,
        sakit: hitung.SAKIT,
        izin: hitung.IZIN,
        alpha: hitung.ALPHA,
        persentaseKehadiran: `${persentaseKehadiran}%`,
      }
    })

    return {
      success: true,
      message: "Rekap kehadiran berhasil dimuat",
      data: {
        kelasId,
        periodeAjaranId,
        totalSiswa: siswaList.length,
        rekap,
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat rekap kehadiran",
    }
  }
}

// ========================================================
// 3. ACTIONS SISWA: RIWAYAT KEHADIRAN (Read-Only)
// ========================================================

/**
 * Siswa melihat riwayat kehadiran dirinya sendiri.
 * Hanya bisa akses data miliknya sendiri (validasi via session).
 */
export async function getRiwayatKehadiranSiswa(
  payload?: RiwayatKehadiranSiswaValues
): Promise<ActionResponse> {
  try {
    const user = await requireRole([Role.SISWA])
    if (!user.siswa) {
      return { success: false, message: "Data siswa tidak ditemukan" }
    }

    const siswaId = user.siswa.id // ✅ Paksa pakai ID dari session, bukan dari input client

    const tanggalFilter: Record<string, unknown> = {}
    if (payload?.tanggalMulai) {
      tanggalFilter.gte = new Date(payload.tanggalMulai)
    }
    if (payload?.tanggalSelesai) {
      tanggalFilter.lte = new Date(payload.tanggalSelesai)
    }

    const whereClause: Record<string, unknown> = { siswaId }
    if (Object.keys(tanggalFilter).length > 0) {
      whereClause.tanggal = tanggalFilter
    }

    const riwayat = await prisma.absensi.findMany({
      where: whereClause,
      include: {
        kelas: { select: { nama: true } },
        periodeAjaran: { select: { nama: true } },
      },
      orderBy: { tanggal: "desc" },
    })

    // Agregasi ringkas
    const hitung = { HADIR: 0, SAKIT: 0, IZIN: 0, ALPHA: 0 }
    for (const r of riwayat) {
      hitung[r.status]++
    }

    return {
      success: true,
      message: "Riwayat kehadiran berhasil dimuat",
      data: {
        siswaId,
        nama: user.nama,
        total: riwayat.length,
        ringkasan: hitung,
        riwayat: riwayat.map((r) => ({
          id: r.id,
          tanggal: r.tanggal,
          status: r.status,
          keterangan: r.keterangan,
          kelas: r.kelas.nama,
          periode: r.periodeAjaran.nama,
        })),
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat riwayat kehadiran",
    }
  }
}

// ========================================================
// 4. ACTIONS ORANG TUA: RIWAYAT KEHADIRAN ANAK (Read-Only)
// ========================================================

/**
 * Orang tua melihat riwayat kehadiran anaknya.
 * ✅ KEAMANAN: Validasi relasi ParentStudent sebelum mengizinkan akses.
 * Orang tua TIDAK bisa melihat data siswa lain hanya dengan mengganti siswaId.
 */
export async function getRiwayatKehadiranAnak(
  payload: RiwayatKehadiranSiswaValues
): Promise<ActionResponse> {
  try {
    const validated = riwayatKehadiranSiswaSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Parameter tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const user = await requireRole([Role.ORANG_TUA])
    if (!user.orangTua) {
      return { success: false, message: "Data orang tua tidak ditemukan" }
    }

    const { siswaId, tanggalMulai, tanggalSelesai } = validated.data

    // ✅ KRITIS: Validasi bahwa orang tua ini benar-benar punya relasi ke siswa ini
    const hasAkses = await verifyOrangTuaAksesSiswa(
      user.orangTua.id,
      siswaId
    )
    if (!hasAkses) {
      return {
        success: false,
        message: "Anda tidak memiliki akses ke data siswa ini",
      }
    }

    const tanggalFilter: Record<string, unknown> = {}
    if (tanggalMulai) {
      tanggalFilter.gte = new Date(tanggalMulai)
    }
    if (tanggalSelesai) {
      tanggalFilter.lte = new Date(tanggalSelesai)
    }

    const whereClause: Record<string, unknown> = { siswaId }
    if (Object.keys(tanggalFilter).length > 0) {
      whereClause.tanggal = tanggalFilter
    }

    const riwayat = await prisma.absensi.findMany({
      where: whereClause,
      include: {
        kelas: { select: { nama: true } },
        periodeAjaran: { select: { nama: true } },
      },
      orderBy: { tanggal: "desc" },
    })

    // Ambil nama siswa
    const siswa = await prisma.siswa.findUnique({
      where: { id: siswaId },
      include: { user: { select: { nama: true } } },
    })

    const hitung = { HADIR: 0, SAKIT: 0, IZIN: 0, ALPHA: 0 }
    for (const r of riwayat) {
      hitung[r.status]++
    }

    return {
      success: true,
      message: "Riwayat kehadiran anak berhasil dimuat",
      data: {
        siswaId,
        namaSiswa: siswa?.user.nama || "Siswa",
        total: riwayat.length,
        ringkasan: hitung,
        riwayat: riwayat.map((r) => ({
          id: r.id,
          tanggal: r.tanggal,
          status: r.status,
          keterangan: r.keterangan,
          kelas: r.kelas.nama,
          periode: r.periodeAjaran.nama,
        })),
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat riwayat kehadiran anak",
    }
  }
}

// ========================================================
// 5. ACTIONS GURU: AMBIL DAFTAR SISWA BERDASARKAN KELAS
// ========================================================

/**
 * Guru mengambil daftar siswa di kelas tertentu untuk input absensi.
 * ✅ Validasi akses guru terhadap kelas via verifyGuruAksesKelas.
 */
export async function getSiswaByKelas(
  kelasId: string
): Promise<ActionResponse> {
  try {
    await verifyGuruAksesKelas(kelasId)

    const siswaList = await prisma.siswa.findMany({
      where: { kelasId, user: { aktif: true } },
      include: {
        user: { select: { nama: true, email: true } },
      },
      orderBy: { user: { nama: "asc" } },
    })

    const formatted = siswaList.map((s) => ({
      siswaId: s.id,
      nama: s.user.nama,
      nisn: s.nisn,
      email: s.user.email,
    }))

    return {
      success: true,
      message: `Daftar siswa kelas berhasil dimuat (${formatted.length} siswa)`,
      data: formatted,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat daftar siswa",
    }
  }
}