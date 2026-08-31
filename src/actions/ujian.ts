// src/actions/ujian.ts

"use server"

import prisma from "@/lib/prisma"
import { requireRole } from "@/lib/auth"
import { verifyGuruAksesKelas } from "@/lib/guru-auth"
import {
  createUjianSchema,
  updateUjianSchema,
  createSoalSchema,
  submitPengerjaanUjianSchema,
  nilaiEsaiSchema,
  type CreateUjianValues,
  type UpdateUjianValues,
  type CreateSoalValues,
  type SubmitPengerjaanUjianValues,
  type NilaiEsaiValues,
} from "@/lib/validations/ujian"
import { rateLimitAsync, getClientIpFromHeaders } from "@/lib/rate-limit"
import type { ActionResponse } from "@/types"
import { Role, StatusUjian, StatusPengerjaan, Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"

// ========================================================
// 1. ACTIONS GURU: MANAJEMEN UJIAN
// ========================================================

export async function createUjian(
  payload: CreateUjianValues
): Promise<ActionResponse<{ ujianId: string }>> {
  try {
    const validated = createUjianSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data ujian tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const {
      judul,
      deskripsi,
      mataPelajaran,
      kelasId,
      periodeAjaranId,
      waktuMulai,
      waktuSelesai,
      durasiMenit,
    } = validated.data

    // Validasi otorisasi guru terhadap kelas
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

    const ujian = await prisma.ujian.create({
      data: {
        judul,
        deskripsi,
        mataPelajaranId: mapel.id,
        kelasId,
        periodeAjaranId,
        waktuMulai: new Date(waktuMulai),
        waktuSelesai: new Date(waktuSelesai),
        durasiMenit,
        status: StatusUjian.DRAFT,
        dibuatOlehId: user.id,
      },
    })

    revalidatePath("/dashboard/guru/ujian")
    return {
      success: true,
      message: "Ujian berhasil dibuat dalam status DRAFT",
      data: { ujianId: ujian.id },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal membuat ujian",
    }
  }
}

export async function updateUjian(
  ujianId: string,
  payload: UpdateUjianValues
): Promise<ActionResponse> {
  try {
    const validated = updateUjianSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data update ujian tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const ujian = await prisma.ujian.findUnique({
      where: { id: ujianId },
    })
    if (!ujian) {
      return { success: false, message: "Ujian tidak ditemukan" }
    }

    await verifyGuruAksesKelas(ujian.kelasId, ujian.mataPelajaranId)

    // Jika ujian sudah berjalan dan ada siswa yang mulai mengerjakan, cegah perubahan waktu/durasi fatal
    if (ujian.status === StatusUjian.PUBLISHED) {
      const pengerjaanCount = await prisma.pengerjaanUjian.count({
        where: { ujianId },
      })
      if (pengerjaanCount > 0 && (payload.durasiMenit || payload.kelasId)) {
        return {
          success: false,
          message: "Tidak dapat mengubah durasi/kelas karena ujian sudah mulai dikerjakan siswa",
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

    await prisma.ujian.update({
      where: { id: ujianId },
      data: {
        judul: payload.judul,
        deskripsi: payload.deskripsi,
        mataPelajaranId,
        kelasId: payload.kelasId,
        periodeAjaranId: payload.periodeAjaranId,
        waktuMulai: payload.waktuMulai ? new Date(payload.waktuMulai) : undefined,
        waktuSelesai: payload.waktuSelesai ? new Date(payload.waktuSelesai) : undefined,
        durasiMenit: payload.durasiMenit,
        status: payload.status,
      },
    })

    revalidatePath("/dashboard/guru/ujian")
    return { success: true, message: "Data ujian berhasil diperbarui" }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal memperbarui ujian" }
  }
}

export async function deleteUjian(ujianId: string): Promise<ActionResponse> {
  try {
    const ujian = await prisma.ujian.findUnique({
      where: { id: ujianId },
      include: {
        _count: { select: { pengerjaan: true } },
      },
    })
    if (!ujian) {
      return { success: false, message: "Ujian tidak ditemukan" }
    }

    await verifyGuruAksesKelas(ujian.kelasId, ujian.mataPelajaranId)

    if (ujian._count.pengerjaan > 0) {
      return {
        success: false,
        message: "Tidak dapat menghapus ujian yang sudah memiliki riwayat pengerjaan siswa",
      }
    }

    await prisma.ujian.delete({ where: { id: ujianId } })

    revalidatePath("/dashboard/guru/ujian")
    return { success: true, message: "Ujian berhasil dihapus" }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menghapus ujian" }
  }
}

export async function addOrUpdateSoalUjian(
  payload: CreateSoalValues
): Promise<ActionResponse> {
  try {
    const validated = createSoalSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data soal tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { ujianId, nomorSoal, pertanyaan, tipe, bobot, kunciEsai, opsi } =
      validated.data

    const ujian = await prisma.ujian.findUnique({ where: { id: ujianId } })
    if (!ujian) return { success: false, message: "Ujian tidak ditemukan" }

    await verifyGuruAksesKelas(ujian.kelasId, ujian.mataPelajaranId)

    if (ujian.status === StatusUjian.SELESAI) {
      return { success: false, message: "Ujian sudah selesai, soal tidak dapat diubah" }
    }

    await prisma.$transaction(async (tx) => {
      // Upsert Soal
      const soal = await tx.soalUjian.upsert({
        where: {
          ujianId_nomorSoal: { ujianId, nomorSoal },
        },
        update: {
          pertanyaan,
          tipe,
          bobot,
          kunciEsai: tipe === "ESAI" ? kunciEsai : null,
        },
        create: {
          ujianId,
          nomorSoal,
          pertanyaan,
          tipe,
          bobot,
          kunciEsai: tipe === "ESAI" ? kunciEsai : null,
        },
      })

      // Jika Pilihan Ganda, recreate opsi
      if (tipe === "PILIHAN_GANDA" && opsi) {
        await tx.opsiJawaban.deleteMany({ where: { soalId: soal.id } })
        await tx.opsiJawaban.createMany({
          data: opsi.map((o) => ({
            soalId: soal.id,
            label: o.label.toUpperCase(),
            teks: o.teks,
            benar: o.benar,
          })),
        })
      } else if (tipe === "ESAI") {
        await tx.opsiJawaban.deleteMany({ where: { soalId: soal.id } })
      }
    })

    revalidatePath(`/dashboard/guru/ujian/${ujianId}`)
    return { success: true, message: `Soal nomor ${nomorSoal} berhasil disimpan` }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menyimpan soal ujian" }
  }
}

export async function deleteSoalUjian(
  ujianId: string,
  nomorSoal: number
): Promise<ActionResponse> {
  try {
    const ujian = await prisma.ujian.findUnique({ where: { id: ujianId } })
    if (!ujian) return { success: false, message: "Ujian tidak ditemukan" }

    await verifyGuruAksesKelas(ujian.kelasId, ujian.mataPelajaranId)

    await prisma.soalUjian.delete({
      where: {
        ujianId_nomorSoal: { ujianId, nomorSoal },
      },
    })

    revalidatePath(`/dashboard/guru/ujian/${ujianId}`)
    return { success: true, message: "Soal berhasil dihapus" }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menghapus soal" }
  }
}

// PENTEST FIX #2: Expose submitTerlambat di rekap hasil ujian
export async function getRekapHasilUjian(ujianId: string): Promise<ActionResponse> {
  try {
    const ujian = await prisma.ujian.findUnique({
      where: { id: ujianId },
      include: {
        kelas: true,
        soal: {
          select: { id: true, nomorSoal: true, bobot: true, tipe: true },
        },
      },
    })
    if (!ujian) return { success: false, message: "Ujian tidak ditemukan" }

    await verifyGuruAksesKelas(ujian.kelasId, ujian.mataPelajaranId)

    const rekap = await prisma.pengerjaanUjian.findMany({
      where: { ujianId },
      include: {
        siswa: {
          select: {
            id: true,
            nisn: true,
            user: { select: { nama: true, email: true } },
          },
        },
        jawaban: {
          include: {
            soal: { select: { nomorSoal: true, tipe: true, bobot: true } },
          },
        },
      },
      orderBy: { siswa: { user: { nama: "asc" } } },
    })

    // PENTEST FIX #2: Field submitTerlambat sekarang tersedia dari schema, diteruskan ke rekap
    return {
      success: true,
      message: "Rekap hasil ujian berhasil dimuat",
      data: {
        ujian,
        peserta: rekap.map((p) => ({
          id: p.id,
          siswa: p.siswa,
          status: p.status,
          waktuMulai: p.waktuMulai,
          waktuSubmit: p.waktuSubmit,
          submitTerlambat: p.submitTerlambat, // Flag dari pentest fix #2
          nilaiTotal: p.nilaiTotal,
          nilaiPg: p.nilaiPg,
          nilaiEsai: p.nilaiEsai,
          jawaban: p.jawaban,
        })),
      },
    }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal memuat rekap ujian" }
  }
}

export async function beriNilaiEsai(
  payload: NilaiEsaiValues
): Promise<ActionResponse> {
  try {
    const validated = nilaiEsaiSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Format penilaian tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { pengerjaanId, penilaian } = validated.data

    const pengerjaan = await prisma.pengerjaanUjian.findUnique({
      where: { id: pengerjaanId },
      include: {
        ujian: {
          include: {
            soal: true,
          },
        },
      },
    })

    if (!pengerjaan) {
      return { success: false, message: "Data pengerjaan siswa tidak ditemukan" }
    }

    const { user } = await verifyGuruAksesKelas(
      pengerjaan.ujian.kelasId,
      pengerjaan.ujian.mataPelajaranId
    )

    await prisma.$transaction(async (tx) => {
      // Update tiap jawaban esai yang dinilai
      for (const item of penilaian) {
        const soal = pengerjaan.ujian.soal.find((s) => s.id === item.soalId)
        if (!soal || soal.tipe !== "ESAI") continue

        // Validasi nilai tidak melebihi bobot soal
        const nilaiFixed = Math.min(Math.max(0, item.nilaiSoal), soal.bobot)

        await tx.jawabanSiswa.update({
          where: {
            pengerjaanId_soalId: { pengerjaanId, soalId: item.soalId },
          },
          data: {
            nilaiSoal: new Prisma.Decimal(nilaiFixed),
            catatanGuru: item.catatanGuru,
            dinilaiOlehId: user.id,
            waktuPenilaian: new Date(),
          },
        })
      }

      // Hitung ulang total nilai ujian
      const semuaJawaban = await tx.jawabanSiswa.findMany({
        where: { pengerjaanId },
        include: { soal: true },
      })

      const totalBobotSemuaSoal = pengerjaan.ujian.soal.reduce(
        (acc: number, s) => acc + s.bobot,
        0
      )
      const totalPoinDidapat = semuaJawaban.reduce((acc: number, j) => {
        return acc + (j.nilaiSoal ? Number(j.nilaiSoal) : 0)
      }, 0)

      // Cek apakah masih ada soal esai yang belum dinilai
      const adaEsaiBelumDinilai = semuaJawaban.some(
        (j) => j.soal.tipe === "ESAI" && j.nilaiSoal === null
      )

      const nilaiAkhirSkala100 =
        totalBobotSemuaSoal > 0
          ? (totalPoinDidapat / totalBobotSemuaSoal) * 100
          : 0

      await tx.pengerjaanUjian.update({
        where: { id: pengerjaanId },
        data: {
          nilaiTotal: new Prisma.Decimal(nilaiAkhirSkala100.toFixed(2)),
          status: adaEsaiBelumDinilai
            ? StatusPengerjaan.SELESAI
            : StatusPengerjaan.DINILAI,
        },
      })
    })

    revalidatePath(`/dashboard/guru/ujian/${pengerjaan.ujianId}`)
    return {
      success: true,
      message: "Penilaian esai berhasil disimpan dan nilai total telah diperbarui",
    }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menyimpan nilai esai" }
  }
}

// ========================================================
// 2. ACTIONS SISWA: PENGERJAAN UJIAN
// ========================================================

export async function getDaftarUjianSiswa(): Promise<ActionResponse> {
  try {
    const user = await requireRole([Role.SISWA])
    if (!user.siswa || !user.siswa.kelasId) {
      return { success: false, message: "Siswa belum terdaftar di kelas aktif" }
    }

    const now = new Date()

    const ujianList = await prisma.ujian.findMany({
      where: {
        kelasId: user.siswa.kelasId,
        status: StatusUjian.PUBLISHED,
      },
      include: {
        periodeAjaran: { select: { nama: true } },
        dibuatOleh: { select: { nama: true } },
        pengerjaan: {
          where: { siswaId: user.siswa.id },
          select: {
            id: true,
            status: true,
            waktuMulai: true,
            waktuSubmit: true,
            nilaiTotal: true,
          },
        },
        _count: { select: { soal: true } },
      },
      orderBy: { waktuMulai: "desc" },
    })

    const formatted = ujianList.map((u) => {
      const pengerjaan = u.pengerjaan[0] || null
      const isExpired = now > u.waktuSelesai
      const isStarted = now >= u.waktuMulai

      return {
        id: u.id,
        judul: u.judul,
        deskripsi: u.deskripsi,
        mataPelajaran: u.mataPelajaranId,
        durasiMenit: u.durasiMenit,
        waktuMulai: u.waktuMulai,
        waktuSelesai: u.waktuSelesai,
        totalSoal: u._count.soal,
        guru: u.dibuatOleh.nama,
        statusPengerjaan: pengerjaan ? pengerjaan.status : "BELUM_MULAI",
        nilai: pengerjaan?.status === StatusPengerjaan.DINILAI ? pengerjaan.nilaiTotal : null,
        dapatDikerjakan: isStarted && !isExpired && (!pengerjaan || pengerjaan.status === StatusPengerjaan.SEDANG_MENGERJAKAN),
      }
    })

    return {
      success: true,
      message: "Daftar ujian berhasil diambil",
      data: formatted,
    }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal memuat ujian siswa" }
  }
}

export async function mulaiPengerjaanUjian(
  ujianId: string
): Promise<ActionResponse> {
  try {
    const user = await requireRole([Role.SISWA])
    if (!user.siswa || !user.siswa.kelasId) {
      return { success: false, message: "Data kelas siswa tidak valid" }
    }

    const siswaId = user.siswa.id
    const now = new Date()

    const ujian = await prisma.ujian.findUnique({
      where: { id: ujianId },
      include: {
        soal: {
          orderBy: { nomorSoal: "asc" },
          select: {
            id: true,
            nomorSoal: true,
            pertanyaan: true,
            tipe: true,
            bobot: true,
            // SECURITY: Opsi TIDAK BOLEH memuat field 'benar' ke client siswa!
            opsi: {
              select: {
                id: true,
                label: true,
                teks: true,
              },
              orderBy: { label: "asc" },
            },
          },
        },
      },
    })

    if (!ujian) return { success: false, message: "Ujian tidak ditemukan" }
    if (ujian.kelasId !== user.siswa.kelasId) {
      return { success: false, message: "Ujian ini bukan untuk kelas Anda" }
    }
    if (ujian.status !== StatusUjian.PUBLISHED) {
      return { success: false, message: "Ujian belum dibuka oleh guru" }
    }
    if (now < ujian.waktuMulai) {
      return { success: false, message: "Ujian belum dimulai" }
    }
    if (now > ujian.waktuSelesai) {
      return { success: false, message: "Waktu pendaftaran ujian telah berakhir" }
    }

    // Cek pengerjaan existing
    let pengerjaan = await prisma.pengerjaanUjian.findUnique({
      where: {
        ujianId_siswaId: { ujianId, siswaId },
      },
      include: {
        jawaban: true,
      },
    })

    if (pengerjaan) {
      if (pengerjaan.status !== StatusPengerjaan.SEDANG_MENGERJAKAN) {
        return {
          success: false,
          message: "Anda sudah menyelesaikan dan mengumpulkan ujian ini",
        }
      }
    } else {
      // Inisialisasi Pengerjaan Baru
      pengerjaan = await prisma.pengerjaanUjian.create({
        data: {
          ujianId,
          siswaId,
          waktuMulai: now,
          status: StatusPengerjaan.SEDANG_MENGERJAKAN,
        },
        include: { jawaban: true },
      })
    }

    // Hitung sisa batas waktu deadline siswa
    const deadlineSiswa = new Date(
      pengerjaan.waktuMulai.getTime() + ujian.durasiMenit * 60 * 1000
    )
    const deadlineFinal =
      deadlineSiswa < ujian.waktuSelesai ? deadlineSiswa : ujian.waktuSelesai

    return {
      success: true,
      message: "Ujian siap dikerjakan",
      data: {
        pengerjaanId: pengerjaan.id,
        ujian: {
          id: ujian.id,
          judul: ujian.judul,
          mataPelajaran: ujian.mataPelajaranId,
          durasiMenit: ujian.durasiMenit,
          waktuMulaiSiswa: pengerjaan.waktuMulai,
          deadlineSelesai: deadlineFinal,
          soal: ujian.soal,
        },
        jawabanTersimpan: pengerjaan.jawaban,
      },
    }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal memulai ujian" }
  }
}

export async function submitPengerjaanUjian(
  payload: SubmitPengerjaanUjianValues
): Promise<ActionResponse> {
  try {
    const ip = await getClientIpFromHeaders()
    const limiter = await rateLimitAsync(`submit-ujian:${ip}`, {
      maxRequests: 5,
      windowMs: 60 * 1000,
    })
    if (!limiter.success) {
      return { success: false, message: "Terlalu banyak request submit. Tunggu sebentar." }
    }

    const user = await requireRole([Role.SISWA])
    if (!user.siswa) return { success: false, message: "Akses ditolak" }

    const validated = submitPengerjaanUjianSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data jawaban tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { ujianId, jawaban } = validated.data
    const siswaId = user.siswa.id
    const now = new Date()

    const pengerjaan = await prisma.pengerjaanUjian.findUnique({
      where: { ujianId_siswaId: { ujianId, siswaId } },
      include: {
        ujian: {
          include: {
            soal: {
              include: { opsi: true },
            },
          },
        },
      },
    })

    if (!pengerjaan) {
      return { success: false, message: "Sesi ujian tidak ditemukan" }
    }
    if (pengerjaan.status !== StatusPengerjaan.SEDANG_MENGERJAKAN) {
      return { success: false, message: "Ujian ini sudah pernah dikumpulkan sebelumnya" }
    }

    // =========================================================
    // PENTEST FIX #2: Server-side deadline enforcement
    // Hitung deadlineFinal di server — tidak bergantung pada timer client
    // =========================================================
    const deadlineSiswaMs = pengerjaan.waktuMulai.getTime() + pengerjaan.ujian.durasiMenit * 60 * 1000
    const deadlineSiswa = new Date(deadlineSiswaMs)
    const deadlineFinal =
      deadlineSiswa < pengerjaan.ujian.waktuSelesai
        ? deadlineSiswa
        : pengerjaan.ujian.waktuSelesai

    // Tandai apakah submit ini melewati batas waktu resmi
    // Jawaban TETAP diterima agar tidak ada data yang hilang,
    // tapi guru dapat melihat flag submitTerlambat di rekap
    const submitTerlambat = now > deadlineFinal

    // Eksekusi Grading Pilihan Ganda & Submit secara Atomik
    const hasil = await prisma.$transaction(async (tx) => {
      let poinPgDiperoleh = 0
      let totalBobotSemuaSoal = 0
      let adaSoalEsai = false

      for (const soal of pengerjaan.ujian.soal) {
        totalBobotSemuaSoal += soal.bobot
        if (soal.tipe === "ESAI") adaSoalEsai = true

        const jwbSiswa = jawaban.find((j) => j.soalId === soal.id)

        if (soal.tipe === "PILIHAN_GANDA") {
          let isBenar = false
          if (jwbSiswa?.opsiDipilihId) {
            const opsiBenar = soal.opsi.find((o) => o.benar)
            if (opsiBenar && opsiBenar.id === jwbSiswa.opsiDipilihId) {
              isBenar = true
              poinPgDiperoleh += soal.bobot
            }
          }

          await tx.jawabanSiswa.upsert({
            where: {
              pengerjaanId_soalId: { pengerjaanId: pengerjaan.id, soalId: soal.id },
            },
            update: {
              opsiDipilihId: jwbSiswa?.opsiDipilihId || null,
              benar: isBenar,
              nilaiSoal: new Prisma.Decimal(isBenar ? soal.bobot : 0),
            },
            create: {
              pengerjaanId: pengerjaan.id,
              soalId: soal.id,
              opsiDipilihId: jwbSiswa?.opsiDipilihId || null,
              benar: isBenar,
              nilaiSoal: new Prisma.Decimal(isBenar ? soal.bobot : 0),
            },
          })
        } else if (soal.tipe === "ESAI") {
          await tx.jawabanSiswa.upsert({
            where: {
              pengerjaanId_soalId: { pengerjaanId: pengerjaan.id, soalId: soal.id },
            },
            update: {
              jawabanEsai: jwbSiswa?.jawabanEsai || "",
              nilaiSoal: null, // Menunggu koreksi guru
              benar: null,
            },
            create: {
              pengerjaanId: pengerjaan.id,
              soalId: soal.id,
              jawabanEsai: jwbSiswa?.jawabanEsai || "",
              nilaiSoal: null,
              benar: null,
            },
          })
        }
      }

      // Hitung nilai akhir PG jika tidak ada esai
      let statusAkhir: StatusPengerjaan = StatusPengerjaan.SELESAI
      let nilaiTotal: Prisma.Decimal | null = null
      const nilaiPgDecimal = new Prisma.Decimal(
        totalBobotSemuaSoal > 0
          ? ((poinPgDiperoleh / totalBobotSemuaSoal) * 100).toFixed(2)
          : "0.00"
      )

      if (!adaSoalEsai) {
        statusAkhir = StatusPengerjaan.DINILAI
        nilaiTotal = nilaiPgDecimal
      }

      // PENTEST FIX #2: Simpan submitTerlambat bersama data pengerjaan
      const updatedPengerjaan = await tx.pengerjaanUjian.update({
        where: { id: pengerjaan.id },
        data: {
          waktuSubmit: now,
          status: statusAkhir,
          nilaiPg: nilaiPgDecimal,
          nilaiTotal,
          submitTerlambat, // Field baru dari pentest fix
        },
      })

      return updatedPengerjaan
    })

    // Susun pesan response dengan info keterlambatan jika relevan
    let pesanSubmit: string
    if (submitTerlambat) {
      pesanSubmit =
        hasil.status === StatusPengerjaan.DINILAI
          ? `Ujian dikumpulkan (terlambat dari batas waktu). Nilai Anda: ${hasil.nilaiTotal}. Guru akan melihat catatan keterlambatan ini.`
          : "Ujian dikumpulkan (terlambat dari batas waktu) dan menunggu penilaian guru. Keterlambatan dicatat dalam rekap."
    } else {
      pesanSubmit =
        hasil.status === StatusPengerjaan.DINILAI
          ? `Ujian berhasil dikumpulkan. Nilai Anda: ${hasil.nilaiTotal}`
          : "Ujian berhasil dikumpulkan dan menunggu penilaian soal esai oleh guru."
    }

    return {
      success: true,
      message: pesanSubmit,
      data: {
        status: hasil.status,
        nilaiTotal: hasil.nilaiTotal,
        submitTerlambat,
      },
    }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal mengumpulkan jawaban ujian" }
  }
}

// ========================================================
// PENTEST FIX #2: AUTO-CLOSE PENGERJAAN YANG KEDALUWARSA
//
// Fungsi ini menutup semua sesi pengerjaan yang masih SEDANG_MENGERJAKAN
// tapi sudah melewati deadlineFinal mereka masing-masing.
//
// CARA SCHEDULING (pilih salah satu):
// 1. Vercel Cron (direkomendasikan): tambahkan ke vercel.json:
//    { "crons": [{ "path": "/api/cron/tutup-ujian", "schedule": "*/5 * * * *" }] }
//    Buat Route Handler di src/app/api/cron/tutup-ujian/route.ts yang memanggil action ini
//    setelah memvalidasi header "Authorization: Bearer <CRON_SECRET>".
// 2. Trigger manual guru: tombol "Tutup Ujian" di dashboard guru memanggil fungsi ini
//    dengan ujianId spesifik (opsional).
// 3. Dipanggil otomatis oleh getRekapHasilUjian saat guru membuka rekap (lazy close).
// ========================================================

export async function tutupPengerjaanUjianKedaluwarsa(
  ujianId?: string // Jika diisi, hanya proses ujian tersebut; jika kosong, proses semua
): Promise<ActionResponse<{ totalDitutup: number; detail: string[] }>> {
  try {
    // Bisa dipanggil guru (spesifik per ujian) atau sistem cron (semua ujian)
    // Jika ada ujianId, validasi guru punya akses ke ujian tersebut
    if (ujianId) {
      const ujian = await prisma.ujian.findUnique({ where: { id: ujianId } })
      if (!ujian) return { success: false, message: "Ujian tidak ditemukan" }
      await verifyGuruAksesKelas(ujian.kelasId, ujian.mataPelajaranId)
    }
    // Untuk mode cron (tanpa ujianId), tidak perlu validasi pemanggil —
    // middleware route handler yang bertanggung jawab memvalidasi CRON_SECRET.

    const now = new Date()

    // Cari semua sesi yang masih SEDANG_MENGERJAKAN
    const whereClause: Record<string, unknown> = {
      status: StatusPengerjaan.SEDANG_MENGERJAKAN,
    }
    if (ujianId) {
      whereClause.ujianId = ujianId
    }

    const sesiAktif = await prisma.pengerjaanUjian.findMany({
      where: whereClause,
      include: {
        ujian: {
          include: {
            soal: { select: { id: true, tipe: true, bobot: true } },
          },
        },
      },
    })

    let totalDitutup = 0
    const detail: string[] = []

    for (const sesi of sesiAktif) {
      const deadlineSiswaMs = sesi.waktuMulai.getTime() + sesi.ujian.durasiMenit * 60 * 1000
      const deadlineSiswa = new Date(deadlineSiswaMs)
      const deadlineFinal =
        deadlineSiswa < sesi.ujian.waktuSelesai ? deadlineSiswa : sesi.ujian.waktuSelesai

      // Hanya tutup jika sudah melewati deadline
      if (now <= deadlineFinal) continue

      const adaSoalEsai = sesi.ujian.soal.some((s) => s.tipe === "ESAI")

      await prisma.$transaction(async (tx) => {
        // Buat record jawaban kosong untuk soal yang belum dijawab sama sekali
        // (agar rekap guru lengkap dan tidak ada data kosong)
        for (const soal of sesi.ujian.soal) {
          const jawabanExisting = await tx.jawabanSiswa.findUnique({
            where: {
              pengerjaanId_soalId: { pengerjaanId: sesi.id, soalId: soal.id },
            },
          })

          if (!jawabanExisting) {
            await tx.jawabanSiswa.create({
              data: {
                pengerjaanId: sesi.id,
                soalId: soal.id,
                opsiDipilihId: null,
                jawabanEsai: soal.tipe === "ESAI" ? "" : null,
                benar: soal.tipe === "PILIHAN_GANDA" ? false : null,
                nilaiSoal: soal.tipe === "PILIHAN_GANDA" ? new Prisma.Decimal(0) : null,
              },
            })
          }
        }

        // Tutup sesi: status SELESAI (ada esai) atau DINILAI (hanya PG)
        // Hitung nilai PG dari jawaban yang sudah masuk
        const jawabanPg = await tx.jawabanSiswa.findMany({
          where: { pengerjaanId: sesi.id },
          include: { soal: { select: { tipe: true, bobot: true } } },
        })

        const totalBobot = sesi.ujian.soal.reduce((acc, s) => acc + s.bobot, 0)
        const poinPg = jawabanPg
          .filter((j) => j.soal.tipe === "PILIHAN_GANDA" && j.benar === true)
          .reduce((acc, j) => acc + j.soal.bobot, 0)

        const nilaiPgDecimal = new Prisma.Decimal(
          totalBobot > 0 ? ((poinPg / totalBobot) * 100).toFixed(2) : "0.00"
        )

        await tx.pengerjaanUjian.update({
          where: { id: sesi.id },
          data: {
            status: adaSoalEsai ? StatusPengerjaan.SELESAI : StatusPengerjaan.DINILAI,
            waktuSubmit: deadlineFinal, // Waktu submit = tepat di deadline (bukan "now")
            submitTerlambat: true,
            nilaiPg: nilaiPgDecimal,
            nilaiTotal: adaSoalEsai ? null : nilaiPgDecimal,
          },
        })
      })

      totalDitutup++
      detail.push(
        `Sesi ${sesi.id} (siswa: ${sesi.siswaId}, ujian: ${sesi.ujianId}) — ditutup otomatis`
      )
    }

    return {
      success: true,
      message:
        totalDitutup === 0
          ? "Tidak ada sesi pengerjaan yang perlu ditutup saat ini"
          : `${totalDitutup} sesi pengerjaan kedaluwarsa berhasil ditutup`,
      data: { totalDitutup, detail },
    }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menutup sesi ujian kedaluwarsa" }
  }
}

// ========================================================
// 4. ACTIONS GURU: LIHAT DAFTAR UJIAN YANG DIBUAT
// ========================================================

export async function getDaftarUjianGuru(
  kelasId: string
): Promise<ActionResponse> {
  try {
    await verifyGuruAksesKelas(kelasId)

    const now = new Date()

    const ujianList = await prisma.ujian.findMany({
      where: { kelasId },
      include: {
        periodeAjaran: { select: { nama: true } },
        dibuatOleh: { select: { nama: true } },
        _count: { select: { soal: true, pengerjaan: true } },
      },
      orderBy: { waktuMulai: "desc" },
    })

    const formatted = ujianList.map((u) => ({
      id: u.id,
      judul: u.judul,
      mataPelajaran: u.mataPelajaranId,
      kelasId: u.kelasId,
      durasiMenit: u.durasiMenit,
      waktuMulai: u.waktuMulai,
      waktuSelesai: u.waktuSelesai,
      status: u.status,
      totalSoal: u._count.soal,
      totalPeserta: u._count.pengerjaan,
      guru: u.dibuatOleh.nama,
      periode: u.periodeAjaran.nama,
    }))

    return {
      success: true,
      message: "Daftar ujian guru berhasil dimuat",
      data: formatted,
    }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal memuat daftar ujian guru" }
  }
}

// ========================================================
// 5. ACTIONS ORANG TUA: LIHAT DAFTAR UJIAN ANAK (Read-Only)
// ========================================================

/**
 * Orang tua melihat daftar ujian dan hasil anaknya.
 * ✅ KEAMANAN: Validasi relasi ParentStudent.
 */
export async function getDaftarUjianAnak(
  siswaId: string
): Promise<ActionResponse> {
  try {
    const user = await requireRole([Role.ORANG_TUA])
    if (!user.orangTua) {
      return { success: false, message: "Data orang tua tidak ditemukan" }
    }

    // ✅ Validasi relasi orang tua → siswa
    const relasi = await prisma.parentStudent.findFirst({
      where: { orangTuaId: user.orangTua.id, siswaId },
    })
    if (!relasi) {
      return { success: false, message: "Akses ditolak: Siswa ini bukan anak Anda" }
    }

    const siswa = await prisma.siswa.findUnique({
      where: { id: siswaId },
      include: { kelas: { select: { id: true } } },
    })
    if (!siswa || !siswa.kelasId) {
      return { success: false, message: "Data kelas siswa tidak valid" }
    }

    const now = new Date()

    const ujianList = await prisma.ujian.findMany({
      where: {
        kelasId: siswa.kelasId,
        status: StatusUjian.PUBLISHED,
      },
      include: {
        periodeAjaran: { select: { nama: true } },
        dibuatOleh: { select: { nama: true } },
        pengerjaan: {
          where: { siswaId },
          select: {
            id: true,
            status: true,
            waktuMulai: true,
            waktuSubmit: true,
            nilaiTotal: true,
          },
        },
        _count: { select: { soal: true } },
      },
      orderBy: { waktuMulai: "desc" },
    })

    const formatted = ujianList.map((u) => {
      const pengerjaan = u.pengerjaan[0] || null
      const isExpired = now > u.waktuSelesai
      const isStarted = now >= u.waktuMulai

      return {
        id: u.id,
        judul: u.judul,
        deskripsi: u.deskripsi,
        mataPelajaran: u.mataPelajaranId,
        durasiMenit: u.durasiMenit,
        waktuMulai: u.waktuMulai,
        waktuSelesai: u.waktuSelesai,
        totalSoal: u._count.soal,
        guru: u.dibuatOleh.nama,
        statusPengerjaan: pengerjaan ? pengerjaan.status : "BELUM_MULAI",
        nilai: pengerjaan?.status === StatusPengerjaan.DINILAI ? pengerjaan.nilaiTotal : null,
      }
    })

    return {
      success: true,
      message: "Daftar ujian anak berhasil dimuat",
      data: formatted,
    }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal memuat daftar ujian anak" }
  }
}