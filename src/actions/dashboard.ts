// src/actions/dashboard.ts

"use server"

import prisma from "@/lib/prisma"
import { requireRole, isAcademicAdminRole } from "@/lib/auth"
import {
  Role,
  StatusUjian,
  StatusPengerjaan,
  StatusPengumpulan,
  StatusTagihan,
  JenisTagihan,
} from "@prisma/client"
import type { ActionResponse } from "@/types"

// ========================================================
// TIPE DATA RANGKUMAN (dipakai komponen role-home)
// ========================================================

export interface InfoUjianHome {
  id: string
  judul: string
  mapel: string
  kelas: string
  status: string
  durasiMenit: number
  totalSoal: number
  waktuMulai: string
}

export interface InfoTugasHome {
  id: string
  judul: string
  mapel: string
  kelas: string
  deadline: string
  pending: number
}

export interface InfoNilaiUjianHome {
  id: string
  judul: string
  mapel: string
  nilai: number
  tanggal: string
}

export interface RangkumanGuru {
  jumlahKelas: number
  jumlahSantri: number
  ujianAktif: number
  ujianPerluDinilai: number
  tugasPerluDinilai: number
  daftarUjian: InfoUjianHome[]
  daftarTugas: InfoTugasHome[]
}

export interface RangkumanSiswa {
  ujianTersedia: number
  daftarUjianTersedia: InfoUjianHome[]
  rataRataNilai: number | null
  daftarNilai: InfoNilaiUjianHome[]
  tugasBelumDikirim: number
  daftarTugas: InfoTugasHome[]
  kehadiranPersen: number
  hadir: number
  totalAbsensi: number
  spp: {
    namaTagihan: string
    nominal: number
    status: string
  } | null
}

export interface RangkumanAdmin {
  jumlahSantri: number
  jumlahGuru: number
  jumlahKelas: number
  jumlahMapel: number
  pendaftarMenunggu: number
  ujianPerluDinilai: number
  tugasPerluDinilai: number
  tagihanBelumBayar: number
  daftarUjian: InfoUjianHome[]
}

// ========================================================
// HELPER INTERNAL
// ========================================================

function toIso(d: Date): string {
  return d.toISOString()
}

function infoUjianFrom(row: {
  id: string
  judul: string
  kelas: { nama: string }
  mataPelajaran: { nama: string }
  status: StatusUjian
  durasiMenit: number
  waktuMulai: Date
  _count: { soal: number }
}): InfoUjianHome {
  return {
    id: row.id,
    judul: row.judul,
    mapel: row.mataPelajaran.nama,
    kelas: row.kelas.nama,
    status: row.status,
    durasiMenit: row.durasiMenit,
    totalSoal: row._count.soal,
    waktuMulai: toIso(row.waktuMulai),
  }
}

async function hitungRangkumanSiswa(
  siswaId: string,
  kelasId: string
): Promise<RangkumanSiswa> {
  const now = new Date()
  const tanggal = new Date(now)
  const startBulan = new Date(tanggal.getFullYear(), tanggal.getMonth(), 1)
  const startBulanDepan = new Date(tanggal.getFullYear(), tanggal.getMonth() + 1, 1)

  // --- Ujian tersedia & riwayat nilai ---
  const ujianList = await prisma.ujian.findMany({
    where: {
      kelasId,
      status: StatusUjian.PUBLISHED,
    },
    include: {
      kelas: { select: { nama: true } },
      mataPelajaran: { select: { nama: true } },
      pengerjaan: {
        where: { siswaId },
        select: {
          id: true,
          status: true,
          waktuSubmit: true,
          nilaiTotal: true,
        },
      },
      _count: { select: { soal: true } },
    },
    orderBy: { waktuMulai: "desc" },
    take: 50,
  })

  const daftarUjianTersedia: InfoUjianHome[] = []
  const daftarNilai: InfoNilaiUjianHome[] = []
  const nilaiList: number[] = []

  for (const u of ujianList) {
    const pengerjaan = u.pengerjaan[0] || null
    const sudahDikerjakan =
      pengerjaan?.status === StatusPengerjaan.SELESAI ||
      pengerjaan?.status === StatusPengerjaan.DINILAI

    if (now >= u.waktuMulai && now <= u.waktuSelesai && !sudahDikerjakan) {
      daftarUjianTersedia.push(infoUjianFrom(u))
    }

    if (
      pengerjaan?.status === StatusPengerjaan.DINILAI &&
      pengerjaan.nilaiTotal !== null
    ) {
      const nilai = Number(pengerjaan.nilaiTotal)
      nilaiList.push(nilai)
      daftarNilai.push({
        id: u.id,
        judul: u.judul,
        mapel: u.mataPelajaran.nama,
        nilai,
        tanggal: pengerjaan.waktuSubmit
          ? toIso(pengerjaan.waktuSubmit)
          : toIso(u.waktuMulai),
      })
    }
  }

  daftarNilai.sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1))
  const rataRataNilai =
    nilaiList.length > 0
      ? Math.round((nilaiList.reduce((a, b) => a + b, 0) / nilaiList.length) * 10) / 10
      : null

  // --- Tugas belum dikumpulkan ---
  const tugasList = await prisma.tugas.findMany({
    where: {
      kelasId,
      deadline: { gte: now },
      // Belum ada record pengumpulan siswa sama sekali
      pengumpulan: { none: { siswaId } },
    },
    include: {
      kelas: { select: { nama: true } },
      mataPelajaran: { select: { nama: true } },
    },
    orderBy: { deadline: "asc" },
    take: 5,
  })

  const daftarTugas: InfoTugasHome[] = tugasList.map((t) => ({
    id: t.id,
    judul: t.judul,
    mapel: t.mataPelajaran.nama,
    kelas: t.kelas.nama,
    deadline: toIso(t.deadline),
    pending: 0,
  }))

  // --- Kehadiran bulan berjalan ---
  const absensi = await prisma.absensi.findMany({
    where: {
      siswaId,
      tanggal: { gte: startBulan, lt: startBulanDepan },
    },
    select: { status: true },
  })
  const totalAbsensi = absensi.length
  const hadir = absensi.filter((a) => a.status === "HADIR").length
  const kehadiranPersen =
    totalAbsensi > 0 ? Math.round((hadir / totalAbsensi) * 100) : 100

  // --- Status SPP bulan berjalan ---
  const tagihan = await prisma.tagihanSiswa.findFirst({
    where: {
      siswaId,
      jenisTagihan: JenisTagihan.SPP,
      bulan: now.getMonth() + 1,
      tahun: now.getFullYear(),
      status: { not: StatusTagihan.DIBATALKAN },
    },
    select: {
      namaTagihan: true,
      nominal: true,
      status: true,
    },
  })

  const labelSpp =
    tagihan?.status === StatusTagihan.SUDAH_BAYAR
      ? "Lunas"
      : tagihan?.status === StatusTagihan.MENUNGGU_VERIFIKASI
        ? "Menunggu Verifikasi"
        : tagihan?.status === StatusTagihan.DIBAYAR_SEBAGIAN
          ? "Sebagian"
          : "Belum Bayar"

  return {
    ujianTersedia: daftarUjianTersedia.length,
    daftarUjianTersedia,
    rataRataNilai,
    daftarNilai: daftarNilai.slice(0, 4),
    tugasBelumDikirim: tugasList.length,
    daftarTugas,
    kehadiranPersen,
    hadir,
    totalAbsensi,
    spp: tagihan
      ? {
          namaTagihan: tagihan.namaTagihan,
          nominal: Number(tagihan.nominal),
          status: labelSpp,
        }
      : null,
  }
}

// ========================================================
// 1. RANGKUMAN HOME GURU
// ========================================================

export async function getRangkumanGuruHome(): Promise<
  ActionResponse<RangkumanGuru>
> {
  try {
    const user = await requireRole([Role.GURU, Role.SUPER_ADMIN, Role.ADMIN_AKADEMIK])
    const isAdmin = isAcademicAdminRole(user.role) || user.isAdmin

    const whereKelas: {
      aktif: boolean
      OR?: Array<{ waliKelasId: string } | { guruMengajar: { some: { guruId: string } } }>
    } = { aktif: true }

    if (!isAdmin) {
      const guruId = user.guru?.id
      if (!guruId) {
        return { success: false, message: "Forbidden: Profil guru tidak ditemukan" }
      }
      whereKelas.OR = [
        { waliKelasId: guruId },
        { guruMengajar: { some: { guruId } } },
      ]
    }

    const kelasList = await prisma.kelas.findMany({
      where: whereKelas as never,
      select: { id: true },
    })
    const kelasIds = kelasList.map((k) => k.id)

    const kosong: RangkumanGuru = {
      jumlahKelas: 0,
      jumlahSantri: 0,
      ujianAktif: 0,
      ujianPerluDinilai: 0,
      tugasPerluDinilai: 0,
      daftarUjian: [],
      daftarTugas: [],
    }
    if (kelasIds.length === 0) return { success: true, message: "OK", data: kosong }

    const now = new Date()

    const [jumlahSantri, ujianAktif, ujianPerluDinilai, daftarUjian, daftarTugas] =
      await Promise.all([
        prisma.siswa.count({ where: { kelasId: { in: kelasIds } } }),
        prisma.ujian.count({
          where: {
            kelasId: { in: kelasIds },
            status: StatusUjian.PUBLISHED,
            waktuSelesai: { gte: now },
          },
        }),
        prisma.pengerjaanUjian.count({
          where: {
            status: StatusPengerjaan.SELESAI,
            ujian: { kelasId: { in: kelasIds } },
          },
        }),
        prisma.ujian.findMany({
          where: { kelasId: { in: kelasIds } },
          include: {
            kelas: { select: { nama: true } },
            mataPelajaran: { select: { nama: true } },
            _count: { select: { soal: true } },
          },
          orderBy: { waktuMulai: "desc" },
          take: 5,
        }),
        prisma.tugas.findMany({
          where: { kelasId: { in: kelasIds } },
          include: {
            kelas: { select: { nama: true } },
            mataPelajaran: { select: { nama: true } },
            _count: {
              select: {
                pengumpulan: {
                  where: {
                    status: {
                      in: [StatusPengumpulan.TEPAT_WAKTU, StatusPengumpulan.TERLAMBAT],
                    },
                  },
                },
              },
            },
          },
          orderBy: { deadline: "desc" },
          take: 5,
        }),
      ])

    const tugasPerluDinilai = daftarTugas.reduce(
      (acc, t) => acc + t._count.pengumpulan,
      0
    )

    return {
      success: true,
      message: "Rangkuman dashboard guru berhasil dimuat",
      data: {
        jumlahKelas: kelasIds.length,
        jumlahSantri,
        ujianAktif,
        ujianPerluDinilai,
        tugasPerluDinilai,
        daftarUjian: daftarUjian.map(infoUjianFrom),
        daftarTugas: daftarTugas.map((t) => ({
          id: t.id,
          judul: t.judul,
          mapel: t.mataPelajaran.nama,
          kelas: t.kelas.nama,
          deadline: toIso(t.deadline),
          pending: t._count.pengumpulan,
        })),
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat rangkuman guru",
    }
  }
}

// ========================================================
// 2. RANGKUMAN HOME SISWA
// ========================================================

export async function getRangkumanSiswaHome(): Promise<
  ActionResponse<RangkumanSiswa>
> {
  try {
    const user = await requireRole([Role.SISWA])
    if (!user.siswa?.kelasId) {
      return {
        success: false,
        message: "Anda belum terdaftar di kelas aktif. Hubungi admin sekolah.",
      }
    }
    const data = await hitungRangkumanSiswa(user.siswa.id, user.siswa.kelasId)
    return {
      success: true,
      message: "Rangkuman dashboard siswa berhasil dimuat",
      data,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat rangkuman siswa",
    }
  }
}

// ========================================================
// 3. RANGKUMAN HOME ORANG TUA (berdasarkan anak terpilih)
// ========================================================

export async function getRangkumanOrangTuaHome(
  siswaId: string
): Promise<ActionResponse<RangkumanSiswa>> {
  try {
    const user = await requireRole([Role.ORANG_TUA])
    if (!user.orangTua) {
      return { success: false, message: "Data orang tua tidak ditemukan" }
    }

    // Validasi relasi ortu → siswa (hanya anak kandung/terdaftar)
    const relasi = await prisma.parentStudent.findFirst({
      where: { orangTuaId: user.orangTua.id, siswaId },
    })
    if (!relasi) {
      return { success: false, message: "Akses ditolak: Siswa ini bukan anak Anda" }
    }

    const kelasSiswa = await prisma.siswa.findUnique({
      where: { id: siswaId },
      select: { kelasId: true },
    })
    if (!kelasSiswa?.kelasId) {
      return {
        success: false,
        message: "Data kelas anak tidak valid",
      }
    }

    const data = await hitungRangkumanSiswa(siswaId, kelasSiswa.kelasId)
    return {
      success: true,
      message: "Rangkuman dashboard orang tua berhasil dimuat",
      data,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat rangkuman orang tua",
    }
  }
}

// ========================================================
// 4. RANGKUMAN HOME ADMIN (SUPER_ADMIN / ADMIN_AKADEMIK)
// ========================================================

export async function getRangkumanAdminHome(): Promise<
  ActionResponse<RangkumanAdmin>
> {
  try {
    await requireRole([Role.SUPER_ADMIN, Role.ADMIN_AKADEMIK])

    const now = new Date()

    const [
      jumlahSantri,
      jumlahGuru,
      jumlahKelas,
      jumlahMapel,
      pendaftarMenunggu,
      ujianPerluDinilai,
      tugasPerluDinilai,
      tagihanBelumBayar,
      daftarUjian,
    ] = await Promise.all([
      prisma.siswa.count(),
      prisma.guru.count(),
      prisma.kelas.count({ where: { aktif: true } }),
      prisma.mataPelajaran.count({ where: { aktif: true } }),
      prisma.pendaftaran.count({
        where: {
          status: { in: ["MENUNGGU_PEMBAYARAN", "MENUNGGU_VERIFIKASI"] },
        },
      }),
      prisma.pengerjaanUjian.count({
        where: { status: StatusPengerjaan.SELESAI },
      }),
      prisma.pengumpulanTugas.count({
        where: {
          status: {
            in: [StatusPengumpulan.TEPAT_WAKTU, StatusPengumpulan.TERLAMBAT],
          },
        },
      }),
      prisma.tagihanSiswa.count({
        where: {
          status: {
            in: [StatusTagihan.BELUM_BAYAR, StatusTagihan.TERLAMBAT],
          },
        },
      }),
      prisma.ujian.findMany({
        include: {
          kelas: { select: { nama: true } },
          mataPelajaran: { select: { nama: true } },
          _count: { select: { soal: true } },
        },
        orderBy: { waktuMulai: "desc" },
        take: 5,
      }),
    ])

    return {
      success: true,
      message: "Rangkuman dashboard admin berhasil dimuat",
      data: {
        jumlahSantri,
        jumlahGuru,
        jumlahKelas,
        jumlahMapel,
        pendaftarMenunggu,
        ujianPerluDinilai,
        tugasPerluDinilai,
        tagihanBelumBayar,
        daftarUjian: daftarUjian.map(infoUjianFrom),
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat rangkuman admin",
    }
  }
}