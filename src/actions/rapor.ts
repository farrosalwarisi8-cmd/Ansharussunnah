// src/actions/rapor.ts

"use server"

import prisma from "@/lib/prisma"
import { requireRole } from "@/lib/auth"
import { verifyGuruAksesKelas } from "@/lib/guru-auth"
import {
  generateRaporSchema,
  rekapKelasSchema,
  createCatatanRaporSchema,
  updateCatatanRaporSchema,
  type GenerateRaporValues,
  type RekapKelasValues,
  type CreateCatatanRaporValues,
  type UpdateCatatanRaporValues,
} from "@/lib/validations/rapor"
import type { ActionResponse } from "@/types"
import { Role, StatusPengerjaan, StatusPengumpulan, Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"

// ========================================================
// HELPER: Validasi relasi Orang Tua → Siswa
// ========================================================

async function verifyOrangTuaAksesSiswa(
  orangTuaId: string,
  siswaId: string
): Promise<boolean> {
  const relasi = await prisma.parentStudent.findFirst({
    where: { orangTuaId, siswaId },
  })
  return !!relasi
}

// ========================================================
// HELPER: Agregasi Nilai Per Mata Pelajaran
// ========================================================

interface NilaiMapel {
  mataPelajaran: string
  rataRataUjian: number
  rataRataTugas: number
  nilaiGabungan: number
  jumlahUjian: number
  jumlahTugas: number
}

/**
 * Menghitung rata-rata nilai per mata pelajaran dari data ujian & tugas.
 * Nilai gabungan = (rata-rata ujian * 0.6) + (rata-rata tugas * 0.4)
 * Bobot bisa disesuaikan sesuai kebijakan sekolah.
 */
async function hitungNilaiPerMapel(
  siswaId: string,
  periodeAjaranId: string
): Promise<NilaiMapel[]> {
  // 1. Ambil semua nilai ujian siswa di periode ini
  const pengerjaanUjian = await prisma.pengerjaanUjian.findMany({
    where: {
      siswaId,
      ujian: { periodeAjaranId },
      status: StatusPengerjaan.DINILAI,
    },
    include: {
      ujian: { select: { mataPelajaran: { select: { nama: true } } } },
    },
  })

  // 2. Ambil semua nilai tugas siswa di periode ini
  const pengumpulanTugas = await prisma.pengumpulanTugas.findMany({
    where: {
      siswaId,
      tugas: { periodeAjaranId },
      status: StatusPengumpulan.DINILAI,
    },
    include: {
      tugas: { select: { mataPelajaran: { select: { nama: true } } } },
    },
  })

  // 3. Kelompokkan per mata pelajaran
  const mapelMap = new Map<
    string,
    { nilaiUjian: number[]; nilaiTugas: number[] }
  >()

  for (const p of pengerjaanUjian) {
    const mapel = p.ujian.mataPelajaran.nama
    if (!mapelMap.has(mapel)) {
      mapelMap.set(mapel, { nilaiUjian: [], nilaiTugas: [] })
    }
    if (p.nilaiTotal) {
      mapelMap.get(mapel)!.nilaiUjian.push(Number(p.nilaiTotal))
    }
  }

  for (const p of pengumpulanTugas) {
    const mapel = p.tugas.mataPelajaran.nama
    if (!mapelMap.has(mapel)) {
      mapelMap.set(mapel, { nilaiUjian: [], nilaiTugas: [] })
    }
    if (p.nilai) {
      mapelMap.get(mapel)!.nilaiTugas.push(Number(p.nilai))
    }
  }

  // 4. Hitung rata-rata per mapel
  const hasil: NilaiMapel[] = []

  for (const [mapel, data] of mapelMap.entries()) {
    const rataUjian =
      data.nilaiUjian.length > 0
        ? data.nilaiUjian.reduce((a, b) => a + b, 0) / data.nilaiUjian.length
        : 0

    const rataTugas =
      data.nilaiTugas.length > 0
        ? data.nilaiTugas.reduce((a, b) => a + b, 0) / data.nilaiTugas.length
        : 0

    // Bobot: Ujian 60%, Tugas 40%
    const BOBOT_UJIAN = 0.6
    const BOBOT_TUGAS = 0.4

    let nilaiGabungan = 0
    if (data.nilaiUjian.length > 0 && data.nilaiTugas.length > 0) {
      nilaiGabungan = rataUjian * BOBOT_UJIAN + rataTugas * BOBOT_TUGAS
    } else if (data.nilaiUjian.length > 0) {
      nilaiGabungan = rataUjian
    } else if (data.nilaiTugas.length > 0) {
      nilaiGabungan = rataTugas
    }

    hasil.push({
      mataPelajaran: mapel,
      rataRataUjian: Math.round(rataUjian * 100) / 100,
      rataRataTugas: Math.round(rataTugas * 100) / 100,
      nilaiGabungan: Math.round(nilaiGabungan * 100) / 100,
      jumlahUjian: data.nilaiUjian.length,
      jumlahTugas: data.nilaiTugas.length,
    })
  }

  // Urutkan berdasarkan nama mata pelajaran
  hasil.sort((a, b) => a.mataPelajaran.localeCompare(b.mataPelajaran))

  return hasil
}

/**
 * Menghitung persentase kehadiran siswa di periode tertentu.
 */
async function hitungKehadiran(
  siswaId: string,
  periodeAjaranId: string
): Promise<{
  total: number
  hadir: number
  sakit: number
  izin: number
  alpha: number
  persentase: string
}> {
  const absensiList = await prisma.absensi.findMany({
    where: { siswaId, periodeAjaranId },
  })

  const hitung = { HADIR: 0, SAKIT: 0, IZIN: 0, ALPHA: 0 }
  for (const a of absensiList) {
    hitung[a.status]++
  }

  const total = absensiList.length
  const persentase =
    total > 0 ? ((hitung.HADIR / total) * 100).toFixed(1) : "0.0"

  return {
    total,
    hadir: hitung.HADIR,
    sakit: hitung.SAKIT,
    izin: hitung.IZIN,
    alpha: hitung.ALPHA,
    persentase: `${persentase}%`,
  }
}

// ========================================================
// 1. ACTIONS GURU: GENERATE RAPOR PER SISWA
// ========================================================

/**
 * Generate data rapor lengkap untuk 1 siswa di 1 periode.
 * Mengagregasi: nilai per mapel (ujian+tugas), kehadiran, catatan wali kelas.
 */
export async function generateRaporSiswa(
  payload: GenerateRaporValues
): Promise<ActionResponse> {
  try {
    const validated = generateRaporSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Parameter rapor tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { siswaId, periodeAjaranId } = validated.data

    // Ambil data siswa + kelas
    const siswa = await prisma.siswa.findUnique({
      where: { id: siswaId },
      include: {
        user: { select: { nama: true, email: true } },
        kelas: {
          include: {
            jenjang: { select: { nama: true } },
            waliKelas: {
              include: { user: { select: { nama: true } } },
            },
          },
        },
      },
    })

    if (!siswa || !siswa.kelas) {
      return { success: false, message: "Data siswa atau kelas tidak ditemukan" }
    }

    // Otorisasi guru terhadap kelas siswa
    await verifyGuruAksesKelas(siswa.kelas.id)

    // Validasi periode
    const periode = await prisma.periodeAjaran.findUnique({
      where: { id: periodeAjaranId },
    })
    if (!periode) {
      return { success: false, message: "Periode ajaran tidak ditemukan" }
    }

    // Hitung agregasi nilai per mapel
    const nilaiPerMapel = await hitungNilaiPerMapel(siswaId, periodeAjaranId)

    // Hitung kehadiran
    const kehadiran = await hitungKehadiran(siswaId, periodeAjaranId)

    // Ambil catatan rapor jika ada
    const catatanRapor = await prisma.catatanRapor.findUnique({
      where: {
        siswaId_periodeAjaranId: { siswaId, periodeAjaranId },
      },
      include: {
        waliKelas: {
          include: { user: { select: { nama: true } } },
        },
      },
    })

    // Hitung rata-rata keseluruhan
    const rataKeseluruhan =
      nilaiPerMapel.length > 0
        ? nilaiPerMapel.reduce((acc, m) => acc + m.nilaiGabungan, 0) /
          nilaiPerMapel.length
        : 0

    return {
      success: true,
      message: "Rapor berhasil di-generate",
      data: {
        identitas: {
          siswaId: siswa.id,
          nama: siswa.user.nama,
          nisn: siswa.nisn,
          kelas: siswa.kelas.nama,
          jenjang: siswa.kelas.jenjang.nama,
          waliKelas: siswa.kelas.waliKelas?.user.nama || "Belum ditentukan",
        },
        periode: {
          id: periode.id,
          nama: periode.nama,
          tahunAjaran: periode.tahunAjaran,
          semester: periode.semester,
        },
        nilaiPerMapel,
        rataRataKeseluruhan: Math.round(rataKeseluruhan * 100) / 100,
        kehadiran,
        catatanRapor: catatanRapor
          ? {
              catatan: catatanRapor.catatan,
              ranking: catatanRapor.ranking,
              waliKelas: catatanRapor.waliKelas.user.nama,
              tanggalDibuat: catatanRapor.createdAt,
            }
          : null,
      },
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal men-generate rapor",
    }
  }
}

// ========================================================
// 2. ACTIONS GURU: REKAP RAPOR SELURUH KELAS
// ========================================================

/**
 * Rekap rapor untuk seluruh siswa dalam 1 kelas di 1 periode.
 * Mengembalikan ringkasan per siswa: rata-rata, kehadiran, ranking.
 */
export async function getRekapRaporKelas(
  payload: RekapKelasValues
): Promise<ActionResponse> {
  try {
    const validated = rekapKelasSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Parameter rekap tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { kelasId, periodeAjaranId } = validated.data

    await verifyGuruAksesKelas(kelasId)

    const periode = await prisma.periodeAjaran.findUnique({
      where: { id: periodeAjaranId },
    })
    if (!periode) {
      return { success: false, message: "Periode ajaran tidak ditemukan" }
    }

    // Ambil semua siswa di kelas
    const siswaList = await prisma.siswa.findMany({
      where: { kelasId },
      include: {
        user: { select: { nama: true } },
      },
      orderBy: { user: { nama: "asc" } },
    })

    // Hitung rapor per siswa
    const rekap = await Promise.all(
      siswaList.map(async (siswa) => {
        const nilaiMapel = await hitungNilaiPerMapel(
          siswa.id,
          periodeAjaranId
        )
        const kehadiran = await hitungKehadiran(siswa.id, periodeAjaranId)

        const rataKeseluruhan =
          nilaiMapel.length > 0
            ? nilaiMapel.reduce((acc, m) => acc + m.nilaiGabungan, 0) /
              nilaiMapel.length
            : 0

        const catatan = await prisma.catatanRapor.findUnique({
          where: {
            siswaId_periodeAjaranId: {
              siswaId: siswa.id,
              periodeAjaranId,
            },
          },
          select: { ranking: true, catatan: true },
        })

        return {
          siswaId: siswa.id,
          nama: siswa.user.nama,
          nisn: siswa.nisn,
          rataRataKeseluruhan: Math.round(rataKeseluruhan * 100) / 100,
          jumlahMapel: nilaiMapel.length,
          kehadiran: kehadiran.persentase,
          totalAlpha: kehadiran.alpha,
          ranking: catatan?.ranking || null,
          hasCatatan: !!catatan,
        }
      })
    )

    // Urutkan berdasarkan ranking (jika ada), lalu rata-rata descending
    rekap.sort((a, b) => {
      if (a.ranking && b.ranking) return a.ranking - b.ranking
      if (a.ranking) return -1
      if (b.ranking) return 1
      return b.rataRataKeseluruhan - a.rataRataKeseluruhan
    })

    return {
      success: true,
      message: "Rekap rapor kelas berhasil dimuat",
      data: {
        kelasId,
        periode: {
          id: periode.id,
          nama: periode.nama,
        },
        totalSiswa: siswaList.length,
        rekap,
      },
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal memuat rekap rapor kelas",
    }
  }
}

// ========================================================
// 3. ACTIONS GURU: CRUD CATATAN RAPOR
// ========================================================

/**
 * Buat/update catatan rapor untuk 1 siswa di 1 periode.
 * Hanya wali kelas atau guru yang mengajar di kelas siswa yang bisa mengisi.
 */
export async function createOrUpdateCatatanRapor(
  payload: CreateCatatanRaporValues
): Promise<ActionResponse> {
  try {
    const validated = createCatatanRaporSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data catatan rapor tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { siswaId, periodeAjaranId, catatan, ranking } = validated.data

    // Ambil data siswa untuk validasi kelas
    const siswa = await prisma.siswa.findUnique({
      where: { id: siswaId },
      include: { kelas: true },
    })

    if (!siswa || !siswa.kelas) {
      return { success: false, message: "Data siswa tidak ditemukan" }
    }

    const { user, guru, roleInKelas } = await verifyGuruAksesKelas(siswa.kelas.id)

    // Hanya wali kelas yang boleh menulis catatan rapor
    if (roleInKelas !== "WALI_KELAS") {
      return { success: false, message: "Akses ditolak: Hanya wali kelas yang dapat menulis catatan rapor" }
    }

    // Upsert catatan rapor
    await prisma.catatanRapor.upsert({
      where: {
        siswaId_periodeAjaranId: { siswaId, periodeAjaranId },
      },
      update: {
        catatan,
        ranking,
        dibuatOlehId: user.id,
      },
      create: {
        siswaId,
        periodeAjaranId,
        waliKelasId: guru.id,
        catatan,
        ranking,
        dibuatOlehId: user.id,
      },
    })

    revalidatePath(`/dashboard/guru/rapor`)
    return {
      success: true,
      message: "Catatan rapor berhasil disimpan",
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal menyimpan catatan rapor",
    }
  }
}

/**
 * Update catatan rapor yang sudah ada.
 */
export async function updateCatatanRapor(
  payload: UpdateCatatanRaporValues
): Promise<ActionResponse> {
  try {
    const validated = updateCatatanRaporSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data update tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { catatanId, catatan, ranking } = validated.data

    const catatanRapor = await prisma.catatanRapor.findUnique({
      where: { id: catatanId },
      include: {
        siswa: { include: { kelas: true } },
      },
    })

    if (!catatanRapor) {
      return { success: false, message: "Catatan rapor tidak ditemukan" }
    }

    if (catatanRapor.siswa.kelas) {
      const { roleInKelas } = await verifyGuruAksesKelas(catatanRapor.siswa.kelas.id)
      if (roleInKelas !== "WALI_KELAS") {
        return { success: false, message: "Akses ditolak: Hanya wali kelas yang dapat mengubah catatan rapor" }
      }
    }

    await prisma.catatanRapor.update({
      where: { id: catatanId },
      data: { catatan, ranking },
    })

    revalidatePath(`/dashboard/guru/rapor`)
    return { success: true, message: "Catatan rapor berhasil diperbarui" }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal memperbarui catatan rapor",
    }
  }
}

// ========================================================
// 4. ACTIONS SISWA: LIHAT RAPOR SENDIRI (Read-Only)
// ========================================================

/**
 * Siswa melihat rapor dirinya sendiri untuk periode tertentu.
 * SiswaId diambil dari session, bukan dari input client.
 */
export async function getRaporSiswa(
  periodeAjaranId: string
): Promise<ActionResponse> {
  try {
    const user = await requireRole([Role.SISWA])
    if (!user.siswa) {
      return { success: false, message: "Data siswa tidak ditemukan" }
    }

    const siswaId = user.siswa.id // ✅ Dari session

    const siswa = await prisma.siswa.findUnique({
      where: { id: siswaId },
      include: {
        user: { select: { nama: true } },
        kelas: {
          include: {
            jenjang: { select: { nama: true } },
            waliKelas: {
              include: { user: { select: { nama: true } } },
            },
          },
        },
      },
    })

    if (!siswa || !siswa.kelas) {
      return { success: false, message: "Data kelas siswa tidak valid" }
    }

    const periode = await prisma.periodeAjaran.findUnique({
      where: { id: periodeAjaranId },
    })
    if (!periode) {
      return { success: false, message: "Periode ajaran tidak ditemukan" }
    }

    const nilaiPerMapel = await hitungNilaiPerMapel(siswaId, periodeAjaranId)
    const kehadiran = await hitungKehadiran(siswaId, periodeAjaranId)

    const catatanRapor = await prisma.catatanRapor.findUnique({
      where: {
        siswaId_periodeAjaranId: { siswaId, periodeAjaranId },
      },
    })

    const rataKeseluruhan =
      nilaiPerMapel.length > 0
        ? nilaiPerMapel.reduce((acc, m) => acc + m.nilaiGabungan, 0) /
          nilaiPerMapel.length
        : 0

    return {
      success: true,
      message: "Rapor berhasil dimuat",
      data: {
        identitas: {
          nama: siswa.user.nama,
          nisn: siswa.nisn,
          kelas: siswa.kelas.nama,
          jenjang: siswa.kelas.jenjang.nama,
        },
        periode: {
          nama: periode.nama,
          tahunAjaran: periode.tahunAjaran,
          semester: periode.semester,
        },
        nilaiPerMapel,
        rataRataKeseluruhan: Math.round(rataKeseluruhan * 100) / 100,
        kehadiran,
        catatan: catatanRapor?.catatan || null,
        ranking: catatanRapor?.ranking || null,
      },
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal memuat rapor",
    }
  }
}

// ========================================================
// 5. ACTIONS ORANG TUA: LIHAT RAPOR ANAK (Read-Only)
// ========================================================

/**
 * Orang tua melihat rapor anaknya.
 * ✅ KEAMANAN: Validasi relasi ParentStudent.
 */
export async function getRaporAnak(
  siswaId: string,
  periodeAjaranId: string
): Promise<ActionResponse> {
  try {
    const user = await requireRole([Role.ORANG_TUA])
    if (!user.orangTua) {
      return { success: false, message: "Data orang tua tidak ditemukan" }
    }

    // ✅ Validasi relasi orang tua → siswa
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

    const siswa = await prisma.siswa.findUnique({
      where: { id: siswaId },
      include: {
        user: { select: { nama: true } },
        kelas: {
          include: {
            jenjang: { select: { nama: true } },
          },
        },
      },
    })

    if (!siswa || !siswa.kelas) {
      return { success: false, message: "Data siswa tidak valid" }
    }

    const periode = await prisma.periodeAjaran.findUnique({
      where: { id: periodeAjaranId },
    })
    if (!periode) {
      return { success: false, message: "Periode ajaran tidak ditemukan" }
    }

    const nilaiPerMapel = await hitungNilaiPerMapel(siswaId, periodeAjaranId)
    const kehadiran = await hitungKehadiran(siswaId, periodeAjaranId)

    const catatanRapor = await prisma.catatanRapor.findUnique({
      where: {
        siswaId_periodeAjaranId: { siswaId, periodeAjaranId },
      },
    })

    const rataKeseluruhan =
      nilaiPerMapel.length > 0
        ? nilaiPerMapel.reduce((acc, m) => acc + m.nilaiGabungan, 0) /
          nilaiPerMapel.length
        : 0

    return {
      success: true,
      message: "Rapor anak berhasil dimuat",
      data: {
        identitas: {
          namaSiswa: siswa.user.nama,
          nisn: siswa.nisn,
          kelas: siswa.kelas.nama,
          jenjang: siswa.kelas.jenjang.nama,
        },
        periode: {
          nama: periode.nama,
          tahunAjaran: periode.tahunAjaran,
          semester: periode.semester,
        },
        nilaiPerMapel,
        rataRataKeseluruhan: Math.round(rataKeseluruhan * 100) / 100,
        kehadiran,
        catatan: catatanRapor?.catatan || null,
        ranking: catatanRapor?.ranking || null,
      },
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal memuat rapor anak",
    }
  }
}