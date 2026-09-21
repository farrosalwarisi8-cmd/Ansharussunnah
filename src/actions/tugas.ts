// src/actions/tugas.ts

"use server"

import prisma from "@/lib/prisma"
import { requireRole } from "@/lib/auth"
import { verifyGuruAksesKelas, getMapelIdYangDiajarDiKelas } from "@/lib/guru-auth"
import { rateLimitAsync, getClientIpFromHeaders } from "@/lib/rate-limit"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { getSignedUrl, getSignedUrls, isExternalUrl } from "@/lib/storage"
import {
  createTugasSchema,
  updateTugasSchema,
  submitTugasSchema,
  nilaiTugasSchema,
  inputNilaiTugasManualSchema,
  type CreateTugasValues,
  type UpdateTugasValues,
  type SubmitTugasValues,
  type NilaiTugasValues,
  type InputNilaiTugasManualValues,
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
// HELPER: Validasi lampiran tugas (URL eksternal ATAU path bucket lampiran)
// ========================================================

/**
 * KEAMANAN: `lampiranUrl` dulu disimpan mentah tanpa validasi — nilai arbitrer
 * seperti `javascript:...` bisa masuk ke DB dan dirender sebagai link. Sekarang
 * hanya menerima URL `http(s)://` (link referensi eksternal — flow yang sah,
 * mis. Google Drive) atau path internal bucket "lampiran" (tanpa traversal).
 */
function isLampiranUrlValid(value: string): boolean {
  if (/^https?:\/\//i.test(value)) return true
  const internal = value.startsWith("lampiran/")
  const aman = !value.includes("..") && !value.includes("\\") && !value.includes("://")
  return internal && aman
}

// ========================================================
// PENERIMA NOMOR OTOMATIS & TANDA INPUT MANUAL
// ========================================================

/**
 * Nomor urut berikutnya untuk tugas di kelas+mapel+periode yang sama
 * (Tugas 1, Tugas 2, dst). Dipanggil SEBELUM create di dalam transaksi agar
 * dua pembuatan bersamaan tidak mendapat nomor kembar.
 */
async function getNextNomorTugas(
  tx: Prisma.TransactionClient,
  kelasId: string,
  mataPelajaranId: string,
  periodeAjaranId: string
): Promise<number> {
  const aggregasi = await tx.tugas.aggregate({
    where: { kelasId, mataPelajaranId, periodeAjaranId },
    _max: { nomorTugas: true },
  })
  return (aggregasi._max.nomorTugas ?? 0) + 1
}

// Path/name sentinel untuk pengumpulan tugas manual (tanpa berkas di storage).
// urlFile sengaja BUKAN path bucket agar tidak dibuatkan signed URL.
const MANUAL_URL_FILE = "manual-input"
const MANUAL_NAMA_FILE = "Input manual (luar aplikasi)"

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
      targetGender,
      periodeAjaranId,
      deadline,
      lampiranUrl,
    } = validated.data

    if (lampiranUrl && !isLampiranUrlValid(lampiranUrl)) {
      return {
        success: false,
        message:
          "Format lampiran tidak valid (gunakan URL http(s) atau lokasi lampiran internal)",
      }
    }

    const { user } = await verifyGuruAksesKelas(kelasId, mataPelajaran)

    // Cari mata pelajaran berdasarkan nama
    const mapel = await prisma.mataPelajaran.findFirst({ where: { nama: mataPelajaran } })
    if (!mapel) {
      return { success: false, message: `Mata pelajaran "${mataPelajaran}" tidak ditemukan` }
    }

    // Validasi kecocokan gender mapel dengan target gender tugas (bila mapel khusus gender)
    if (mapel.jenisKelamin && targetGender && mapel.jenisKelamin !== targetGender) {
      const labelMapel = mapel.jenisKelamin === "LAKI_LAKI" ? "khusus Ikhwan" : "khusus Akhwat"
      return {
        success: false,
        message: `Mata pelajaran "${mataPelajaran}" adalah mapel ${labelMapel}. Target gender tugas tidak sesuai.`,
      }
    }

    // Bila mapel khusus gender & targetGender belum diisi, otomatis ikut gender mapel
    const effectiveTargetGender = mapel.jenisKelamin ?? targetGender ?? null

    const periode = await prisma.periodeAjaran.findUnique({
      where: { id: periodeAjaranId },
    })
    if (!periode) {
      return { success: false, message: "Periode ajaran tidak ditemukan" }
    }

    const inputManual = !!validated.data.inputManual

    // Tugas manual (offline) tidak memerlukan deadline mendatang — hanya metadata.
    if (!inputManual && !deadline) {
      return { success: false, message: "Deadline wajib diisi" }
    }
    const deadlineDate = deadline ? new Date(deadline) : null
    if (!inputManual && deadlineDate && deadlineDate <= new Date()) {
      return {
        success: false,
        message: "Deadline harus di waktu yang akan datang",
      }
    }
    // Kolom deadline NOT NULL di DB: tugas manual memakai fallback jauh ke depan
    // (nilai hanya agregat; deadline tidak dipakai untuk input manual).
    const storedDeadline = deadlineDate ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

    // Nomor otomatis (Tugas 1, dst.) dihitung dalam transaksi agar dua tugas
    // yang dibuat bersamaan di kelas+mapel+periode sama tidak bernomor kembar.
    const tugas = await prisma.$transaction(async (tx) => {
      const nomorTugas = await getNextNomorTugas(
        tx,
        kelasId,
        mapel.id,
        periodeAjaranId
      )
      return tx.tugas.create({
        data: {
          judul,
          deskripsi,
          mataPelajaranId: mapel.id,
          kelasId,
          targetGender: effectiveTargetGender,
          periodeAjaranId,
          deadline: storedDeadline,
          lampiranUrl,
          nomorTugas,
          inputManual,
          dibuatOlehId: user.id,
        },
      })
    })

    revalidatePath("/dashboard/tugas")
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

    // Jika mataPelajaran diubah, cari ID baru
    let mataPelajaranId: string | undefined
    let mapelJenisKelamin: "LAKI_LAKI" | "PEREMPUAN" | null | undefined
    if (payload.mataPelajaran) {
      const mapel = await prisma.mataPelajaran.findFirst({ where: { nama: payload.mataPelajaran } })
      if (!mapel) {
        return { success: false, message: `Mata pelajaran "${payload.mataPelajaran}" tidak ditemukan` }
      }
      mataPelajaranId = mapel.id
      mapelJenisKelamin = mapel.jenisKelamin
    } else {
      const mapelSaatIni = await prisma.mataPelajaran.findUnique({
        where: { id: tugas.mataPelajaranId },
        select: { jenisKelamin: true },
      })
      mapelJenisKelamin = mapelSaatIni?.jenisKelamin
    }

    // Validasi kecocokan gender mapel dengan target gender tugas
    if (
      mapelJenisKelamin &&
      payload.targetGender &&
      mapelJenisKelamin !== payload.targetGender
    ) {
      const labelMapel = mapelJenisKelamin === "LAKI_LAKI" ? "khusus Ikhwan" : "khusus Akhwat"
      return {
        success: false,
        message: `Mata pelajaran tersebut adalah mapel ${labelMapel}. Target gender tugas tidak sesuai.`,
      }
    }
    // Bila mapel khusus gender, target otomatis ikut gender mapel;
    // jika tidak, gunakan target dari payload (null = semua, boleh menghapus pilihan).
    const effectiveTargetGender =
      mapelJenisKelamin !== undefined && mapelJenisKelamin !== null
        ? mapelJenisKelamin
        : payload.targetGender !== undefined
          ? payload.targetGender
          : undefined

    // Verifikasi akses terhadap KELAS & MAPEL TUJUAN (setelah perubahan),
    // bukan hanya yang lama — mencegah guru memindahkan tugas ke kelas/mapel
    // yang bukan wewenangnya.
    const targetKelasId = payload.kelasId ?? tugas.kelasId
    const targetMapelId = mataPelajaranId ?? tugas.mataPelajaranId
    await verifyGuruAksesKelas(targetKelasId, targetMapelId)

    // Cegah perubahan deadline jika sudah ada submission. Form edit selalu
    // mengirim deadline (nilai lama), jadi bandingkan dulu: guru tetap boleh
    // mengubah judul/deskripsi/lampiran walau siswa sudah mengumpulkan,
    // hanya deadline yang dikunci.
    if (payload.deadline) {
      const deadlineBaru = new Date(payload.deadline)
      const deadlineBerubah = deadlineBaru.getTime() !== tugas.deadline.getTime()
      if (deadlineBerubah) {
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
    }

    if (payload.lampiranUrl && !isLampiranUrlValid(payload.lampiranUrl)) {
      return {
        success: false,
        message:
          "Format lampiran tidak valid (gunakan URL http(s) atau lokasi lampiran internal)",
      }
    }

    // Jika kelas/mapel/periode berubah, pindahkan ke penomoran scope baru
    // (nomor lama tetap dipakai yang lain; scope baru mendapatkan Tugas {n} terbaru).
    const scopeBerubah =
      targetKelasId !== tugas.kelasId ||
      targetMapelId !== tugas.mataPelajaranId ||
      (payload.periodeAjaranId !== undefined &&
        payload.periodeAjaranId !== tugas.periodeAjaranId)

    await prisma.$transaction(async (tx) => {
      let nomorTugas: number | undefined
      if (scopeBerubah) {
        nomorTugas = await getNextNomorTugas(
          tx,
          targetKelasId,
          targetMapelId,
          payload.periodeAjaranId ?? tugas.periodeAjaranId
        )
      }

      await tx.tugas.update({
        where: { id: tugasId },
        data: {
          judul: payload.judul,
          deskripsi: payload.deskripsi,
          mataPelajaranId,
          kelasId: payload.kelasId,
          targetGender: effectiveTargetGender,
          periodeAjaranId: payload.periodeAjaranId,
          deadline: payload.deadline ? new Date(payload.deadline) : undefined,
          lampiranUrl: payload.lampiranUrl,
          inputManual: payload.inputManual,
          nomorTugas,
        },
      })
    })

    revalidatePath("/dashboard/tugas")
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

    const { user, roleInKelas } = await verifyGuruAksesKelas(
      tugas.kelasId,
      tugas.mataPelajaranId
    )

    // KEAMANAN: hanya pembuat, wali kelas, atau admin yang boleh menghapus.
    const isOwner = !tugas.dibuatOlehId || tugas.dibuatOlehId === user.id
    const isPrivileged =
      roleInKelas === "WALI_KELAS" || roleInKelas === "ADMIN"
    if (!isOwner && !isPrivileged) {
      return {
        success: false,
        message:
          "Hanya guru pembuat, wali kelas, atau admin yang dapat menghapus tugas ini",
      }
    }

    if (tugas._count.pengumpulan > 0) {
      return {
        success: false,
        message:
          "Tidak dapat menghapus tugas yang sudah memiliki pengumpulan dari siswa",
      }
    }

    await prisma.tugas.delete({ where: { id: tugasId } })

    revalidatePath("/dashboard/tugas")
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

    const aksesMapel = await getMapelIdYangDiajarDiKelas(kelasId)
    // Pengajar tanpa penugasan mapel → tidak ada konten yang boleh dilihat
    if (aksesMapel !== "ALL" && aksesMapel.length === 0) {
      return {
        success: true,
        message: "Daftar tugas kosong",
        data: [],
      }
    }

    const tugasList = await prisma.tugas.findMany({
      where: {
        kelasId,
        ...(aksesMapel !== "ALL" ? { mataPelajaranId: { in: aksesMapel } } : {}),
      },
      include: {
        periodeAjaran: { select: { nama: true } },
        dibuatOleh: { select: { nama: true } },
        mataPelajaran: { select: { nama: true, jenisKelamin: true } },
        _count: { select: { pengumpulan: true } },
      },
      orderBy: { deadline: "desc" },
    })

    const formatted = tugasList.map((t) => ({
      id: t.id,
      judul: t.judul,
      deskripsi: t.deskripsi,
      mataPelajaran: t.mataPelajaran.nama,
      targetGender: t.targetGender,
      mapelGender: t.mataPelajaran.jenisKelamin,
      deadline: t.deadline,
      periode: t.periodeAjaran.nama,
      guru: t.dibuatOleh.nama,
      totalPengumpulan: t._count.pengumpulan,
      hasLampiran: !!t.lampiranUrl,
      nomorTugas: t.nomorTugas,
      inputManual: t.inputManual,
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

    const { user, roleInKelas } = await verifyGuruAksesKelas(
      pengumpulan.tugas.kelasId,
      pengumpulan.tugas.mataPelajaranId
    )

    // KEAMANAN (re-grade): nilai yang sudah diinput guru lain tidak bisa
    // ditimpa diam-diam — hanya guru yang sama, wali kelas, atau admin.
    if (pengumpulan.dinilaiOlehId && pengumpulan.dinilaiOlehId !== user.id) {
      const isPrivileged =
        roleInKelas === "WALI_KELAS" || roleInKelas === "ADMIN"
      if (!isPrivileged) {
        return {
          success: false,
          message:
            "Pengumpulan ini sudah dinilai guru lain. Hanya wali kelas atau admin yang dapat mengubah nilai.",
        }
      }
    }

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

    revalidatePath(`/dashboard/tugas/${pengumpulan.tugasId}`)
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
 * Input nilai manual massal untuk TUGAS OFFLINE (dikerjakan di luar aplikasi).
 * Membuat/update rekaman PengumpulanTugas berstatus DINILAI untuk tiap siswa
 * sehingga nilai masuk agregasi rapor seperti biasa. Rekaman berpola sama
 * dengan submission normal namun tanpa berkas (urlFile sentinel).
 * ✅ Otorisasi: guru harus mengampu kelas & mapel tugas terkait.
 */
export async function inputNilaiTugasManual(
  payload: InputNilaiTugasManualValues
): Promise<ActionResponse<{ jumlahDinilai: number }>> {
  try {
    const validated = inputNilaiTugasManualSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data penilaian manual tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { tugasId, penilaian } = validated.data

    const tugas = await prisma.tugas.findUnique({
      where: { id: tugasId },
      include: {
        mataPelajaran: { select: { jenisKelamin: true } },
      },
    })
    if (!tugas) {
      return { success: false, message: "Tugas tidak ditemukan" }
    }

    // KEAMANAN: input nilai manual hanya untuk tugas OFFLINE (inputManual).
    if (!tugas.inputManual) {
      return {
        success: false,
        message:
          "Input nilai manual hanya dapat dipakai untuk tugas offline (beri tanda 'Tugas offline')",
      }
    }

    const { user, roleInKelas } = await verifyGuruAksesKelas(tugas.kelasId, tugas.mataPelajaranId)

    // Validasi: semua siswa yang dinilai harus terdaftar di kelas tugas.
    const siswaIds = penilaian.map((item) => item.siswaId)
    const siswaDKelas = await prisma.siswa.findMany({
      where: { id: { in: siswaIds }, kelasId: tugas.kelasId, deleted_at: null },
      select: { id: true, jenisKelamin: true },
    })
    const siswaValid = new Set(siswaDKelas.map((s) => s.id))
    if (siswaIds.some((id) => !siswaValid.has(id))) {
      return {
        success: false,
        message: "Sebagian siswa yang dinilai tidak terdaftar di kelas tugas ini",
      }
    }
    // Validasi gender (paritas dengan daftar tugas siswa): tugas dengan target
    // gender / mapel khusus gender hanya boleh menilai siswa gender yang sama —
    // mencegah nilai bocor ke siswa gender lain di rekapan & rapor.
    const siswaGenderSalah = siswaDKelas.filter(
      (s) =>
        (tugas.targetGender && s.jenisKelamin !== tugas.targetGender) ||
        (tugas.mataPelajaran.jenisKelamin &&
          s.jenisKelamin !== tugas.mataPelajaran.jenisKelamin)
    )
    if (siswaGenderSalah.length > 0) {
      return {
        success: false,
        message:
          "Sebagian siswa yang dinilai tidak sesuai dengan target gender tugas ini",
      }
    }

    // KEAMANAN (re-grade, paritas dengan beriNilaiTugas): nilai manual yang
    // sudah diinput guru lain tidak bisa ditimpa diam-diam — hanya guru yang
    // sama, wali kelas, atau admin.
    const existing = await prisma.pengumpulanTugas.findMany({
      where: { tugasId, siswaId: { in: siswaIds } },
      select: { siswaId: true, dinilaiOlehId: true },
    })
    const dinilaiLain = existing.filter(
      (p) => p.dinilaiOlehId && p.dinilaiOlehId !== user.id
    )
    if (dinilaiLain.length > 0) {
      const isPrivileged =
        roleInKelas === "WALI_KELAS" || roleInKelas === "ADMIN"
      if (!isPrivileged) {
        return {
          success: false,
          message:
            "Sebagian nilai sudah diinput guru lain. Hanya wali kelas atau admin yang dapat mengubahnya.",
        }
      }
    }

    const sekarang = new Date()

    await prisma.$transaction(async (tx) => {
      for (const item of penilaian) {
        await tx.pengumpulanTugas.upsert({
          where: {
            tugasId_siswaId: { tugasId, siswaId: item.siswaId },
          },
          create: {
            tugasId,
            siswaId: item.siswaId,
            urlFile: MANUAL_URL_FILE,
            namaFile: MANUAL_NAMA_FILE,
            ukuranFile: null,
            waktuKumpul: sekarang,
            status: StatusPengumpulan.DINILAI,
            nilai: new Prisma.Decimal(item.nilai),
            feedback: item.feedback ?? null,
            jumlahRevisi: 0,
            dinilaiOlehId: user.id,
            waktuPenilaian: sekarang,
          },
          update: {
            status: StatusPengumpulan.DINILAI,
            nilai: new Prisma.Decimal(item.nilai),
            ...(item.feedback !== undefined ? { feedback: item.feedback ?? null } : {}),
            dinilaiOlehId: user.id,
            waktuPenilaian: sekarang,
          },
        })
      }
    })

    revalidatePath(`/dashboard/tugas/${tugasId}`)
    revalidatePath("/dashboard/tugas")
    return {
      success: true,
      message: `Nilai manual berhasil disimpan untuk ${penilaian.length} siswa`,
      data: { jumlahDinilai: penilaian.length },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menyimpan nilai manual",
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
        mataPelajaran: { select: { nama: true, jenisKelamin: true } },
      },
    })
    if (!tugas) {
      return { success: false, message: "Tugas tidak ditemukan" }
    }

    await verifyGuruAksesKelas(tugas.kelasId, tugas.mataPelajaranId)

    // Ambil semua siswa di kelas
    const siswaList = await prisma.siswa.findMany({
      where: { kelasId: tugas.kelasId, deleted_at: null },
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

    // Batch: generate signed URL untuk file jawaban siswa agar guru bisa membukanya.
    // URL eksternal (Google Drive / cloud) dilewati — bukan path bucket;
    // klien membukanya langsung via properti urlFile. Sentinel input manual juga
    // dilewati (tidak ada berkas di storage).
    const urlFileList = pengumpulanList
      .map((p) => p.urlFile)
      .filter(
        (u): u is string => !!u && !isExternalUrl(u) && u !== MANUAL_URL_FILE
      )
    const signedUrlMap = await getSignedUrls("tugas-siswa", urlFileList)

    const pengumpulanMap = new Map(
      pengumpulanList.map((p) => [p.siswaId, p])
    )

    const rekap = siswaList.map((siswa) => {
      const pengumpulan = pengumpulanMap.get(siswa.id)

      return {
        siswaId: siswa.id,
        pengumpulanId: pengumpulan?.id || null,
        nama: siswa.user.nama,
        nisn: siswa.nisn,
        jenisKelamin: siswa.jenisKelamin,
        status: pengumpulan
          ? pengumpulan.status
          : StatusPengumpulan.BELUM_DIKUMPULKAN,
        waktuKumpul: pengumpulan?.waktuKumpul || null,
        nilai: pengumpulan?.nilai || null,
        feedback: pengumpulan?.feedback || null,
        jumlahRevisi: pengumpulan?.jumlahRevisi || 0,
        penilai: pengumpulan?.dinilaiOleh?.nama || null,
        namaFile: pengumpulan?.namaFile || null,
        urlFile: pengumpulan?.urlFile || null,
        signedUrl: pengumpulan?.urlFile
          ? (signedUrlMap.get(pengumpulan.urlFile) ?? null)
          : null,
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
          mataPelajaran: tugas.mataPelajaran.nama,
          inputManual: tugas.inputManual,
          targetGender: tugas.targetGender,
          mataPelajaranJenisKelamin: tugas.mataPelajaran.jenisKelamin,
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
      where: {
        kelasId: user.siswa.kelasId,
        AND: [
          {
            OR: [
              { targetGender: null },
              { targetGender: user.siswa.jenisKelamin },
            ],
          },
          {
            OR: [
              { mataPelajaran: { jenisKelamin: null } },
              { mataPelajaran: { jenisKelamin: user.siswa.jenisKelamin } },
            ],
          },
        ],
      },
      include: {
        periodeAjaran: { select: { nama: true } },
        dibuatOleh: { select: { nama: true } },
        mataPelajaran: { select: { nama: true } },
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

    // Tugas manual (offline) hanya ditampilkan ke siswa bila SUDAH dinilai
    // (agar nilai/feedback terlihat di riwayat); bila belum dinilai, jangan
    // tampil sebagai tugas yang bisa "dikumpulkan" — pengerjaannya offline.
    const tugasTampil = tugasList.filter(
      (t) => !t.inputManual || t.pengumpulan.length > 0
    )

    const formatted = tugasTampil.map((t) => {
      const pengumpulan = t.pengumpulan[0] || null
      const isOverdue = now > t.deadline

      return {
        id: t.id,
        judul: t.judul,
        deskripsi: t.deskripsi,
        mataPelajaran: t.mataPelajaran.nama,
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
      include: {
        mataPelajaran: { select: { jenisKelamin: true } },
      },
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

    // Tugas offline (input manual) tidak bisa dikumpulkan lewat aplikasi —
    // pengerjaan dilakukan di luar aplikasi dan nilainya diinput langsung guru.
    if (tugas.inputManual) {
      return {
        success: false,
        message: "Tugas ini dikerjakan di luar aplikasi. Nilai diinput langsung oleh guru.",
      }
    }

    // Validasi gender: tugas khusus gender hanya untuk siswa dengan gender sama
    if (
      tugas.targetGender &&
      tugas.targetGender !== user.siswa.jenisKelamin
    ) {
      return {
        success: false,
        message: "Tugas ini khusus untuk gender lain",
      }
    }
    if (
      tugas.mataPelajaran.jenisKelamin &&
      tugas.mataPelajaran.jenisKelamin !== user.siswa.jenisKelamin
    ) {
      return {
        success: false,
        message: "Tugas ini dari mapel khusus untuk gender lain",
      }
    }

    // PENTEST FIX #4: Validasi path file harus per-siswa: submission/{tugasId}/{siswaId}/
    // Ini mencegah siswa mereferensikan file milik siswa lain di folder yang sama
    // Kontrak upload dari frontend: folder = `submission/${tugasId}/${siswaId}`
    //
    // Duo bentuk diterima:
    //  1) Path storage internal -> `submission/{tugasId}/{siswaId}/...` (harus diverifikasi di bucket)
    //  2) URL eksternal (Google Drive / cloud) -> `https://...` (diterima apa adanya)
    const expectedPrefix = `submission/${tugasId}/${siswaId}/`
    const isInternalPath = urlFile.startsWith("submission/")
    const isExternalUrl = /^https?:\/\//i.test(urlFile)

    if (!isExternalUrl) {
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
    }

    // PENTEST FIX #4: Verifikasi file di subfolder per-siswa, bukan folder umum per-tugas
    // ini hanya berlaku untuk file yang di-upload ke storage internal; URL eksternal
    // (misal Google Drive) tidak bisa diverifikasi keberadaannya di bucket.
    if (isInternalPath) {
      const supabaseAdmin = createSupabaseAdmin()
      const fileName = urlFile.split("/").pop()
      const { data: fileList, error: listError } = await supabaseAdmin.storage
        .from("tugas-siswa")
        .list(`submission/${tugasId}/${siswaId}`)

      if (listError) {
        console.error("Storage list error (tugas siswa):", listError)
        return {
          success: false,
          message: "Gagal memverifikasi file di storage.",
        }
      }

      const fileExists = fileList?.some((f) => f.name === fileName)
      if (!fileExists) {
        return {
          success: false,
          message:
            "File jawaban tidak ditemukan di storage. Silakan upload ulang.",
        }
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
      await prisma.$transaction(
        async (tx) => {
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
            // Hitung eksplisit — tidak ada trigger DB yang mengisi status
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
        },
        { timeout: 10000, maxWait: 3000 }
      )

      revalidatePath(`/dashboard/tugas/${tugasId}`)
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
        // Hitung eksplisit — tidak ada trigger DB yang mengisi status
        status: isTerlambat
          ? StatusPengumpulan.TERLAMBAT
          : StatusPengumpulan.TEPAT_WAKTU,
      },
    })

    revalidatePath(`/dashboard/tugas/${tugasId}`)
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
        mataPelajaran: { select: { nama: true, jenisKelamin: true } },
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

    // Validasi gender: tugas khusus gender hanya bisa diakses siswa dengan gender yang sama
    if (
      tugas.targetGender &&
      tugas.targetGender !== user.siswa.jenisKelamin
    ) {
      return {
        success: false,
        message: "Tugas ini khusus untuk gender lain",
      }
    }
    if (
      tugas.mataPelajaran.jenisKelamin &&
      tugas.mataPelajaran.jenisKelamin !== user.siswa.jenisKelamin
    ) {
      return {
        success: false,
        message: "Tugas ini dari mapel khusus untuk gender lain",
      }
    }

    const pengumpulan = tugas.pengumpulan[0] || null

    // Generate signed URLs — hanya untuk path internal bucket.
    // URL eksternal (Google Drive / cloud) diteruskan apa adanya supaya klien
    // tetap mendapat link yang bisa dibuka.
    const [signedLampiran, signedJawaban] = await Promise.all([
      tugas.lampiranUrl
        ? isExternalUrl(tugas.lampiranUrl)
          ? tugas.lampiranUrl
          : getSignedUrl("tugas-siswa", tugas.lampiranUrl)
        : null,
      pengumpulan?.urlFile && pengumpulan.urlFile !== MANUAL_URL_FILE
        ? isExternalUrl(pengumpulan.urlFile)
          ? pengumpulan.urlFile
          : getSignedUrl("tugas-siswa", pengumpulan.urlFile)
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
          mataPelajaran: tugas.mataPelajaran.nama,
          targetGender: tugas.targetGender,
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
      where: { id: siswaId, deleted_at: null },
      include: {
        user: { select: { nama: true } },
      },
    })

    if (!siswa || !siswa.kelasId) {
      return { success: false, message: "Data siswa tidak valid" }
    }

    const tugasList = await prisma.tugas.findMany({
      where: {
        kelasId: siswa.kelasId,
        AND: [
          {
            OR: [
              { targetGender: null },
              { targetGender: siswa.jenisKelamin },
            ],
          },
          {
            OR: [
              { mataPelajaran: { jenisKelamin: null } },
              { mataPelajaran: { jenisKelamin: siswa.jenisKelamin } },
            ],
          },
        ],
      },
      include: {
        dibuatOleh: { select: { nama: true } },
        mataPelajaran: { select: { nama: true } },
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
        mataPelajaran: t.mataPelajaran.nama,
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