// src/actions/tugas.ts

"use server"

import prisma from "@/lib/prisma"
import { requireRole } from "@/lib/auth"
import { verifyGuruAksesKelas } from "@/lib/guru-auth"
import { rateLimitAsync, getClientIpFromHeaders } from "@/lib/rate-limit"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { getSignedUrl } from "@/lib/storage"
import {
  createTugasSchema,
  updateTugasSchema,
  submitTugasSchema,
  nilaiTugasSchema,
  type CreateTugasValues,
  type UpdateTugasValues,
  type SubmitTugasValues,
  type NilaiTugasValues,
} from "@/lib/validations/tugas"
import type { ActionResponse } from "@/types"
import { Role, StatusPengumpulan, Prisma } from "@prisma/client"
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
// 1. ACTIONS GURU: CRUD TUGAS
// ========================================================

/**
 * Buat tugas baru untuk kelas tertentu.
 */
export async function createTugas(
  payload: CreateTugasValues
): Promise<ActionResponse<{ tugasId: string }>> {
  try {
    const validated = createTugasSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data tugas tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const {
      judul,
      deskripsi,
      mataPelajaran,
      kelasId,
      periodeAjaranId,
      deadline,
      lampiranUrl,
    } = validated.data

    const { user } = await verifyGuruAksesKelas(kelasId, mataPelajaran)

    // Cari mata pelajaran berdasarkan nama
    const mapel = await prisma.mataPelajaran.findFirst({ where: { nama: mataPelajaran } })
    if (!mapel) {
      return { success: false, message: `Mata pelajaran "${mataPelajaran}" tidak ditemukan` }
    }

    const periode = await prisma.periodeAjaran.findUnique({
      where: { id: periodeAjaranId },
    })
    if (!periode) {
      return { success: false, message: "Periode ajaran tidak ditemukan" }
    }

    const deadlineDate = new Date(deadline)
    if (deadlineDate <= new Date()) {
      return {
        success: false,
        message: "Deadline harus di waktu yang akan datang",
      }
    }

    const tugas = await prisma.tugas.create({
      data: {
        judul,
        deskripsi,
        mataPelajaranId: mapel.id,
        kelasId,
        periodeAjaranId,
        deadline: deadlineDate,
        lampiranUrl,
        dibuatOlehId: user.id,
      },
    })

    revalidatePath("/dashboard/guru/tugas")
    return {
      success: true,
      message: "Tugas berhasil dibuat",
      data: { tugasId: tugas.id },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal membuat tugas",
    }
  }
}

/**
 * Update data tugas (judul, deskripsi, deadline, dll).
 */
export async function updateTugas(
  tugasId: string,
  payload: UpdateTugasValues
): Promise<ActionResponse> {
  try {
    const validated = updateTugasSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data update tugas tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const tugas = await prisma.tugas.findUnique({
      where: { id: tugasId },
    })
    if (!tugas) {
      return { success: false, message: "Tugas tidak ditemukan" }
    }

    await verifyGuruAksesKelas(tugas.kelasId, tugas.mataPelajaranId)

    // Cegah perubahan deadline jika sudah ada submission
    if (payload.deadline) {
      const submissionCount = await prisma.pengumpulanTugas.count({
        where: { tugasId },
      })
      if (submissionCount > 0) {
        return {
          success: false,
          message:
            "Tidak dapat mengubah deadline karena sudah ada siswa yang mengumpulkan",
        }
      }
    }

    // Jika mataPelajaran diubah, cari ID baru
    let mataPelajaranId: string | undefined
    if (payload.mataPelajaran) {
      const mapel = await prisma.mataPelajaran.findFirst({ where: { nama: payload.mataPelajaran } })
      if (!mapel) {
        return { success: false, message: `Mata pelajaran "${payload.mataPelajaran}" tidak ditemukan` }
      }
      mataPelajaranId = mapel.id
    }

    await prisma.tugas.update({
      where: { id: tugasId },
      data: {
        judul: payload.judul,
        deskripsi: payload.deskripsi,
        mataPelajaranId,
        kelasId: payload.kelasId,
        periodeAjaranId: payload.periodeAjaranId,
        deadline: payload.deadline ? new Date(payload.deadline) : undefined,
        lampiranUrl: payload.lampiranUrl,
      },
    })

    revalidatePath("/dashboard/guru/tugas")
    return { success: true, message: "Tugas berhasil diperbarui" }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memperbarui tugas",
    }
  }
}

/**
 * Hapus tugas (hanya jika belum ada submission).
 */
export async function deleteTugas(tugasId: string): Promise<ActionResponse> {
  try {
    const tugas = await prisma.tugas.findUnique({
      where: { id: tugasId },
      include: {
        _count: { select: { pengumpulan: true } },
      },
    })
    if (!tugas) {
      return { success: false, message: "Tugas tidak ditemukan" }
    }

    await verifyGuruAksesKelas(tugas.kelasId, tugas.mataPelajaranId)

    if (tugas._count.pengumpulan > 0) {
      return {
        success: false,
        message:
          "Tidak dapat menghapus tugas yang sudah memiliki pengumpulan dari siswa",
      }
    }

    await prisma.tugas.delete({ where: { id: tugasId } })

    revalidatePath("/dashboard/guru/tugas")
    return { success: true, message: "Tugas berhasil dihapus" }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menghapus tugas",
    }
  }
}

/**
 * Guru melihat daftar tugas yang dibuatnya untuk kelas tertentu.
 */
export async function getDaftarTugasGuru(kelasId: string): Promise<ActionResponse> {
  try {
    await verifyGuruAksesKelas(kelasId)

    const tugasList = await prisma.tugas.findMany({
      where: { kelasId },
      include: {
        periodeAjaran: { select: { nama: true } },
        dibuatOleh: { select: { nama: true } },
        _count: { select: { pengumpulan: true } },
      },
      orderBy: { deadline: "desc" },
    })

    const formatted = tugasList.map((t) => ({
      id: t.id,
      judul: t.judul,
      mataPelajaran: t.mataPelajaranId,
      deadline: t.deadline,
      periode: t.periodeAjaran.nama,
      guru: t.dibuatOleh.nama,
      totalPengumpulan: t._count.pengumpulan,
      hasLampiran: !!t.lampiranUrl,
    }))

    return {
      success: true,
      message: "Daftar tugas berhasil dimuat",
      data: formatted,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat daftar tugas",
    }
  }
}

// ========================================================
// 2. ACTIONS GURU: PENILAIAN & REKAP
// ========================================================

/**
 * Guru memberi nilai dan feedback untuk submission siswa.
 * Setelah dinilai, siswa tidak bisa resubmit lagi.
 */
export async function beriNilaiTugas(
  payload: NilaiTugasValues
): Promise<ActionResponse> {
  try {
    const validated = nilaiTugasSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data penilaian tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { pengumpulanId, nilai, feedback } = validated.data

    const pengumpulan = await prisma.pengumpulanTugas.findUnique({
      where: { id: pengumpulanId },
      include: {
        tugas: true,
      },
    })

    if (!pengumpulan) {
      return {
        success: false,
        message: "Data pengumpulan tugas tidak ditemukan",
      }
    }

    const { user } = await verifyGuruAksesKelas(
      pengumpulan.tugas.kelasId,
      pengumpulan.tugas.mataPelajaranId
    )

    await prisma.pengumpulanTugas.update({
      where: { id: pengumpulanId },
      data: {
        nilai: new Prisma.Decimal(nilai),
        feedback,
        status: StatusPengumpulan.DINILAI,
        dinilaiOlehId: user.id,
        waktuPenilaian: new Date(),
      },
    })

    revalidatePath(`/dashboard/guru/tugas/${pengumpulan.tugasId}`)
    return {
      success: true,
      message: `Nilai ${nilai} berhasil disimpan`,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menyimpan nilai tugas",
    }
  }
}

/**
 * Rekap pengumpulan tugas: siapa sudah/belum mengumpulkan, status, nilai.
 */
export async function getRekapPengumpulanTugas(
  tugasId: string
): Promise<ActionResponse> {
  try {
    const tugas = await prisma.tugas.findUnique({
      where: { id: tugasId },
      include: {
        kelas: true,
      },
    })
    if (!tugas) {
      return { success: false, message: "Tugas tidak ditemukan" }
    }

    await verifyGuruAksesKelas(tugas.kelasId, tugas.mataPelajaranId)

    // Ambil semua siswa di kelas
    const siswaList = await prisma.siswa.findMany({
      where: { kelasId: tugas.kelasId },
      include: {
        user: { select: { nama: true } },
      },
      orderBy: { user: { nama: "asc" } },
    })

    // Ambil semua pengumpulan untuk tugas ini
    const pengumpulanList = await prisma.pengumpulanTugas.findMany({
      where: { tugasId },
      include: {
        dinilaiOleh: { select: { nama: true } },
      },
    })

    const pengumpulanMap = new Map(
      pengumpulanList.map((p) => [p.siswaId, p])
    )

    const rekap = siswaList.map((siswa) => {
      const pengumpulan = pengumpulanMap.get(siswa.id)

      return {
        siswaId: siswa.id,
        nama: siswa.user.nama,
        nisn: siswa.nisn,
        status: pengumpulan
          ? pengumpulan.status
          : StatusPengumpulan.BELUM_DIKUMPULKAN,
        waktuKumpul: pengumpulan?.waktuKumpul || null,
        nilai: pengumpulan?.nilai || null,
        feedback: pengumpulan?.feedback || null,
        jumlahRevisi: pengumpulan?.jumlahRevisi || 0,
        penilai: pengumpulan?.dinilaiOleh?.nama || null,
      }
    })

    // Statistik ringkas
    const sudahKumpul = pengumpulanList.length
    const belumKumpul = siswaList.length - sudahKumpul
    const sudahDinilai = pengumpulanList.filter(
      (p) => p.status === StatusPengumpulan.DINILAI
    ).length
    const terlambat = pengumpulanList.filter(
      (p) => p.status === StatusPengumpulan.TERLAMBAT
    ).length

    return {
      success: true,
      message: "Rekap pengumpulan berhasil dimuat",
      data: {
        tugas: {
          id: tugas.id,
          judul: tugas.judul,
          deadline: tugas.deadline,
          mataPelajaran: tugas.mataPelajaranId,
        },
        statistik: {
          totalSiswa: siswaList.length,
          sudahKumpul,
          belumKumpul,
          sudahDinilai,
          terlambat,
        },
        rekap,
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat rekap pengumpulan",
    }
  }
}

// ========================================================
// 3. ACTIONS SISWA: LIHAT TUGAS & SUBMIT
// ========================================================

/**
 * Siswa melihat daftar tugas untuk kelasnya.
 * Termasuk status pengumpulan sendiri.
 */
export async function getDaftarTugasSiswa(): Promise<ActionResponse> {
  try {
    const user = await requireRole([Role.SISWA])
    if (!user.siswa || !user.siswa.kelasId) {
      return {
        success: false,
        message: "Siswa belum terdaftar di kelas aktif",
      }
    }

    const tugasList = await prisma.tugas.findMany({
      where: { kelasId: user.siswa.kelasId },
      include: {
        periodeAjaran: { select: { nama: true } },
        dibuatOleh: { select: { nama: true } },
        pengumpulan: {
          where: { siswaId: user.siswa.id },
          select: {
            id: true,
            status: true,
            waktuKumpul: true,
            nilai: true,
            feedback: true,
            jumlahRevisi: true,
          },
        },
      },
      orderBy: { deadline: "asc" },
    })

    const now = new Date()

    const formatted = tugasList.map((t) => {
      const pengumpulan = t.pengumpulan[0] || null
      const isOverdue = now > t.deadline

      return {
        id: t.id,
        judul: t.judul,
        deskripsi: t.deskripsi,
        mataPelajaran: t.mataPelajaranId,
        deadline: t.deadline,
        guru: t.dibuatOleh.nama,
        periode: t.periodeAjaran.nama,
        hasLampiran: !!t.lampiranUrl,
        isOverdue,
        statusPengumpulan: pengumpulan
          ? pengumpulan.status
          : StatusPengumpulan.BELUM_DIKUMPULKAN,
        nilai:
          pengumpulan?.status === StatusPengumpulan.DINILAI
            ? pengumpulan.nilai
            : null,
        feedback: pengumpulan?.feedback || null,
        jumlahRevisi: pengumpulan?.jumlahRevisi || 0,
        // Siswa boleh submit/resubmit jika: belum dinilai DAN (belum deadline ATAU sudah lewat tapi belum dinilai)
        dapatSubmit:
          !pengumpulan ||
          (pengumpulan.status !== StatusPengumpulan.DINILAI),
      }
    })

    return {
      success: true,
      message: "Daftar tugas berhasil dimuat",
      data: formatted,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat daftar tugas",
    }
  }
}

/**
 * Siswa upload/submit jawaban tugas.
 *
 * ✅ DESIGN DECISION: Resubmit diizinkan (menimpa submission lama).
 * Alasan: Siswa sering salah upload file atau ingin memperbaiki jawaban.
 * Namun setelah guru menilai (status DINILAI), resubmit di-lock.
 * Setiap resubmit, versi lama disimpan di RiwayatPengumpulanTugas untuk audit.
 */
export async function submitTugas(
  payload: SubmitTugasValues
): Promise<ActionResponse> {
  try {
    // Rate limit: 10 submit per 5 menit per IP
    const ip = await getClientIpFromHeaders()
    const limiter = await rateLimitAsync(`submit-tugas:${ip}`, {
      maxRequests: 10,
      windowMs: 5 * 60 * 1000,
    })
    if (!limiter.success) {
      return {
        success: false,
        message: "Terlalu banyak upload. Tunggu beberapa menit.",
      }
    }

    const validated = submitTugasSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data submission tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { tugasId, urlFile, namaFile, ukuranFile } = validated.data

    const user = await requireRole([Role.SISWA])
    if (!user.siswa || !user.siswa.kelasId) {
      return { success: false, message: "Data kelas siswa tidak valid" }
    }

    const siswaId = user.siswa.id

    const tugas = await prisma.tugas.findUnique({
      where: { id: tugasId },
    })
    if (!tugas) {
      return { success: false, message: "Tugas tidak ditemukan" }
    }

    // Validasi tugas milik kelas siswa
    if (tugas.kelasId !== user.siswa.kelasId) {
      return {
        success: false,
        message: "Tugas ini bukan untuk kelas Anda",
      }
    }

    // PENTEST FIX #4: Validasi path file harus per-siswa: submission/{tugasId}/{siswaId}/
    // Ini mencegah siswa mereferensikan file milik siswa lain di folder yang sama
    // Kontrak upload dari frontend: folder = `submission/${tugasId}/${siswaId}`
    const expectedPrefix = `submission/${tugasId}/${siswaId}/`
    if (!urlFile.startsWith(expectedPrefix)) {
      return {
        success: false,
        message: "Path file tidak valid",
      }
    }
    if (urlFile.includes("..") || urlFile.includes("//")) {
      return {
        success: false,
        message: "Path file mengandung karakter tidak valid",
      }
    }

    // PENTEST FIX #4: Verifikasi file di subfolder per-siswa, bukan folder umum per-tugas
    // Ini memastikan siswa tidak bisa mereferensikan file di folder siswa lain
    const supabaseAdmin = createSupabaseAdmin()
    const fileName = urlFile.split("/").pop()
    const { data: fileList } = await supabaseAdmin.storage
      .from("tugas-siswa")
      .list(`submission/${tugasId}/${siswaId}`)

    const fileExists = fileList?.some((f) => f.name === fileName)
    if (!fileExists) {
      return {
        success: false,
        message:
          "File jawaban tidak ditemukan di storage. Silakan upload ulang.",
      }
    }

    const now = new Date()
    const isTerlambat = now > tugas.deadline

    // Cek submission existing
    const existing = await prisma.pengumpulanTugas.findUnique({
      where: {
        tugasId_siswaId: { tugasId, siswaId },
      },
    })

    if (existing) {
      // ✅ Lock resubmit jika sudah dinilai guru
      if (existing.status === StatusPengumpulan.DINILAI) {
        return {
          success: false,
          message:
            "Tugas sudah dinilai oleh guru. Tidak dapat mengirim ulang.",
        }
      }

      // Simpan versi lama ke riwayat sebelum menimpa
      await prisma.$transaction(async (tx) => {
        await tx.riwayatPengumpulanTugas.create({
          data: {
            pengumpulanId: existing.id,
            urlFile: existing.urlFile,
            namaFile: existing.namaFile,
            waktuKumpul: existing.waktuKumpul,
            status: existing.status,
          },
        })

        await tx.pengumpulanTugas.update({
          where: { id: existing.id },
          data: {
            urlFile,
            namaFile,
            ukuranFile,
            waktuKumpul: now,
            status: isTerlambat
              ? StatusPengumpulan.TERLAMBAT
              : StatusPengumpulan.TEPAT_WAKTU,
            jumlahRevisi: { increment: 1 },
            // Reset nilai & feedback karena siswa mengirim ulang
            nilai: null,
            feedback: null,
            dinilaiOlehId: null,
            waktuPenilaian: null,
          },
        })
      })

      revalidatePath("/dashboard/siswa/tugas")
      return {
        success: true,
        message: isTerlambat
          ? "Jawaban berhasil dikirim ulang (TERLAMBAT)"
          : "Jawaban berhasil dikirim ulang",
      }
    }

    // Submission baru
    await prisma.pengumpulanTugas.create({
      data: {
        tugasId,
        siswaId,
        urlFile,
        namaFile,
        ukuranFile,
        waktuKumpul: now,
        status: isTerlambat
          ? StatusPengumpulan.TERLAMBAT
          : StatusPengumpulan.TEPAT_WAKTU,
      },
    })

    revalidatePath("/dashboard/siswa/tugas")
    return {
      success: true,
      message: isTerlambat
        ? "Jawaban berhasil dikumpulkan (TERLAMBAT dari deadline)"
        : "Jawaban berhasil dikumpulkan tepat waktu",
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal mengirim jawaban tugas",
    }
  }
}

/**
 * Siswa melihat detail tugas & status pengumpulannya sendiri.
 * Termasuk signed URL untuk download lampiran guru dan file jawaban sendiri.
 */
export async function getDetailTugasSiswa(
  tugasId: string
): Promise<ActionResponse> {
  try {
    const user = await requireRole([Role.SISWA])
    if (!user.siswa || !user.siswa.kelasId) {
      return { success: false, message: "Data kelas siswa tidak valid" }
    }

    const tugas = await prisma.tugas.findUnique({
      where: { id: tugasId },
      include: {
        dibuatOleh: { select: { nama: true } },
        periodeAjaran: { select: { nama: true } },
        pengumpulan: {
          where: { siswaId: user.siswa.id },
          include: {
            dinilaiOleh: { select: { nama: true } },
            riwayat: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    })

    if (!tugas) {
      return { success: false, message: "Tugas tidak ditemukan" }
    }

    if (tugas.kelasId !== user.siswa.kelasId) {
      return {
        success: false,
        message: "Tugas ini bukan untuk kelas Anda",
      }
    }

    const pengumpulan = tugas.pengumpulan[0] || null

    // Generate signed URLs
    const [signedLampiran, signedJawaban] = await Promise.all([
      tugas.lampiranUrl
        ? getSignedUrl("tugas-siswa", tugas.lampiranUrl)
        : null,
      pengumpulan?.urlFile
        ? getSignedUrl("tugas-siswa", pengumpulan.urlFile)
        : null,
    ])

    return {
      success: true,
      message: "Detail tugas berhasil dimuat",
      data: {
        tugas: {
          id: tugas.id,
          judul: tugas.judul,
          deskripsi: tugas.deskripsi,
          mataPelajaran: tugas.mataPelajaranId,
          deadline: tugas.deadline,
          guru: tugas.dibuatOleh.nama,
          periode: tugas.periodeAjaran.nama,
          lampiranUrl: signedLampiran,
        },
        pengumpulan: pengumpulan
          ? {
              id: pengumpulan.id,
              status: pengumpulan.status,
              waktuKumpul: pengumpulan.waktuKumpul,
              nilai: pengumpulan.nilai,
              feedback: pengumpulan.feedback,
              jumlahRevisi: pengumpulan.jumlahRevisi,
              jawabanUrl: signedJawaban,
              namaFile: pengumpulan.namaFile,
              penilai: pengumpulan.dinilaiOleh?.nama || null,
              waktuPenilaian: pengumpulan.waktuPenilaian,
              riwayat: pengumpulan.riwayat.map((r) => ({
                waktuKumpul: r.waktuKumpul,
                status: r.status,
                namaFile: r.namaFile,
              })),
            }
          : null,
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat detail tugas",
    }
  }
}

// ========================================================
// 4. ACTIONS ORANG TUA: LIHAT TUGAS ANAK (Read-Only)
// ========================================================

/**
 * Orang tua melihat status tugas anaknya.
 * ✅ KEAMANAN: Validasi relasi ParentStudent.
 */
export async function getTugasAnak(
  siswaId: string
): Promise<ActionResponse> {
  try {
    const user = await requireRole([Role.ORANG_TUA])
    if (!user.orangTua) {
      return { success: false, message: "Data orang tua tidak ditemukan" }
    }

    // ✅ Validasi relasi
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
      },
    })

    if (!siswa || !siswa.kelasId) {
      return { success: false, message: "Data siswa tidak valid" }
    }

    const tugasList = await prisma.tugas.findMany({
      where: { kelasId: siswa.kelasId },
      include: {
        dibuatOleh: { select: { nama: true } },
        pengumpulan: {
          where: { siswaId },
          select: {
            status: true,
            waktuKumpul: true,
            nilai: true,
            feedback: true,
          },
        },
      },
      orderBy: { deadline: "desc" },
    })

    const formatted = tugasList.map((t) => {
      const pengumpulan = t.pengumpulan[0] || null

      return {
        id: t.id,
        judul: t.judul,
        mataPelajaran: t.mataPelajaranId,
        deadline: t.deadline,
        guru: t.dibuatOleh.nama,
        statusPengumpulan: pengumpulan
          ? pengumpulan.status
          : StatusPengumpulan.BELUM_DIKUMPULKAN,
        nilai:
          pengumpulan?.status === StatusPengumpulan.DINILAI
            ? pengumpulan.nilai
            : null,
        feedback: pengumpulan?.feedback || null,
      }
    })

    return {
      success: true,
      message: "Daftar tugas anak berhasil dimuat",
      data: {
        namaSiswa: siswa.user.nama,
        tugas: formatted,
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat data tugas anak",
    }
  }
}