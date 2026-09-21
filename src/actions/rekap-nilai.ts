// src/actions/rekap-nilai.ts

"use server"

import prisma from "@/lib/prisma"
import { verifyGuruAksesKelas, getMapelIdYangDiajarDiKelas } from "@/lib/guru-auth"
import { labelNomorTugas, labelNomorUjian } from "@/lib/ujian-label"
import type { ActionResponse } from "@/types"
import { StatusPengumpulan, StatusPengerjaan } from "@prisma/client"
import { toUserFriendlyError } from "@/lib/prisma-error"

/**
 * Rekap nilai satu kelas: matriks siswa × kegiatan (tugas & ujian) yang sudah
 * PUNYA NILAI (termasuk nilai input manual offline). Dipakai halaman
 * "Rekap Nilai" guru.
 * ✅ Otorisasi: guru harus mengampu kelas (dan mapel bersangkutan bila bukan
 * wali kelas/admin).
 */
export async function getRekapNilaiMapelKelas(
  kelasId: string,
  periodeAjaranId: string
): Promise<ActionResponse> {
  try {
    await verifyGuruAksesKelas(kelasId)

    const aksesMapel = await getMapelIdYangDiajarDiKelas(kelasId)
    const filterMapel =
      aksesMapel !== "ALL"
        ? { mataPelajaranId: { in: aksesMapel } }
        : {}

    const [kelas, periode, siswaList, semuaTugas, semuaUjian, semuaPengumpulan, semuaPengerjaan] =
      await Promise.all([
        prisma.kelas.findUnique({
          where: { id: kelasId },
          include: {
            jenjang: { select: { nama: true } },
          },
        }),
        prisma.periodeAjaran.findUnique({
          where: { id: periodeAjaranId },
          select: { id: true, nama: true, tahunAjaran: true, semester: true },
        }),
        prisma.siswa.findMany({
          where: { kelasId, deleted_at: null },
          include: { user: { select: { nama: true } } },
          orderBy: { user: { nama: "asc" } },
        }),
        prisma.tugas.findMany({
          where: { kelasId, periodeAjaranId, ...filterMapel },
          include: { mataPelajaran: { select: { nama: true } } },
          orderBy: [{ mataPelajaranId: "asc" }, { nomorTugas: "asc" }],
        }),
        prisma.ujian.findMany({
          where: { kelasId, periodeAjaranId, ...filterMapel },
          include: { mataPelajaran: { select: { nama: true } } },
          orderBy: [{ mataPelajaranId: "asc" }, { waktuMulai: "asc" }],
        }),
        prisma.pengumpulanTugas.findMany({
          where: {
            tugas: { kelasId, periodeAjaranId, ...filterMapel },
            status: StatusPengumpulan.DINILAI,
          },
          select: { siswaId: true, tugasId: true, nilai: true },
        }),
        prisma.pengerjaanUjian.findMany({
          where: {
            ujian: { kelasId, periodeAjaranId, ...filterMapel },
            status: StatusPengerjaan.DINILAI,
          },
          select: { siswaId: true, ujianId: true, nilaiTotal: true },
        }),
      ])

    if (!kelas) {
      return { success: false, message: "Kelas tidak ditemukan" }
    }
    if (!periode) {
      return { success: false, message: "Periode ajaran tidak ditemukan" }
    }

    // Kolom kegiatan: urutkan label untuk kolom rapi.
    const kegiatan = [
      ...semuaTugas.map((t) => ({
        id: t.id,
        judul: t.judul,
        tipe: "TUGAS" as const,
        mataPelajaran: t.mataPelajaran.nama,
        label: labelNomorTugas(t.nomorTugas),
        inputManual: t.inputManual,
      })),
      ...semuaUjian.map((u) => ({
        id: u.id,
        judul: u.judul,
        tipe: "UJIAN" as const,
        mataPelajaran: u.mataPelajaran.nama,
        label: labelNomorUjian(u.jenisUjian, u.nomorUjian),
        inputManual: u.inputManual,
      })),
    ].sort((a, b) => {
      if (a.mataPelajaran !== b.mataPelajaran) {
        return a.mataPelajaran.localeCompare(b.mataPelajaran)
      }
      if (a.tipe !== b.tipe) return a.tipe === "TUGAS" ? -1 : 1
      return a.label.localeCompare(b.label, undefined, { numeric: true })
    })

    // Peta nilai per kegiatan.
    const nilaiTugas = new Map<string, number>()
    for (const p of semuaPengumpulan) {
      if (p.nilai !== null) {
        nilaiTugas.set(`${p.tugasId}:${p.siswaId}`, Number(p.nilai))
      }
    }
    const nilaiUjian = new Map<string, number>()
    for (const p of semuaPengerjaan) {
      if (p.nilaiTotal !== null) {
        nilaiUjian.set(`${p.ujianId}:${p.siswaId}`, Number(p.nilaiTotal))
      }
    }

    const siswa = siswaList.map((s) => {
      const nilai: Record<string, number | null> = {}
      for (const k of kegiatan) {
        nilai[k.id] =
          k.tipe === "TUGAS"
            ? (nilaiTugas.get(`${k.id}:${s.id}`) ?? null)
            : (nilaiUjian.get(`${k.id}:${s.id}`) ?? null)
      }
      return {
        siswaId: s.id,
        nama: s.user.nama,
        nisn: s.nisn,
        nilai,
      }
    })

    return {
      success: true,
      message: "Rekap nilai berhasil dimuat",
      data: {
        kelasId,
        kelas: kelas.nama,
        jenjang: kelas.jenjang.nama,
        jumlahSiswa: siswaList.length,
        periode: {
          id: periode.id,
          nama: periode.nama,
          tahunAjaran: periode.tahunAjaran,
          semester: periode.semester,
        },
        kegiatan,
        siswa,
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memuat rekap nilai kelas"),
    }
  }
}