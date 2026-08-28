// src/actions/akuntansi.ts

"use server"

import prisma from "@/lib/prisma"
import { requireAuth, requireRole } from "@/lib/auth"
import { getClientIpFromHeaders, rateLimit } from "@/lib/rate-limit"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { getSignedUrl } from "@/lib/storage"
import {
  generateBulkSppSchema,
  submitBuktiSppSchema,
  konfirmasiPembayaranSppSchema,
  createTransaksiKeuanganSchema,
  cancelTransaksiSchema,
  cancelTagihanSchema,
  queryLaporanKeuanganSchema,
  type GenerateBulkSppValues,
  type SubmitBuktiSppValues,
  type KonfirmasiPembayaranSppValues,
  type CreateTransaksiKeuanganValues,
  type CancelTransaksiValues,
  type CancelTagihanValues,
  type QueryLaporanKeuanganValues,
} from "@/lib/validations/akuntansi"
import type { ActionResponse } from "@/types"
import { Role, StatusTagihan, StatusTransaksi, TipeTransaksi } from "@prisma/client"
import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"

// ========================================================
// HELPER OTORISASI
// ========================================================

async function requireAdminKeuangan() {
  return requireRole([Role.ADMIN_KEUANGAN])
}

async function verifyOrangTuaAksesSiswa(orangTuaId: string, siswaId: string): Promise<boolean> {
  const relasi = await prisma.parentStudent.findFirst({
    where: { orangTuaId, siswaId },
  })
  return !!relasi
}

// ========================================================
// 1. GENERATE TAGIHAN SPP BULANAN (IDEMPOTENT BULK)
// ========================================================

export async function generateBulkSpp(
  payload: GenerateBulkSppValues
): Promise<ActionResponse<{ totalSiswaTerproses: number; totalDilewati: number }>> {
  try {
    await requireAdminKeuangan()

    const validated = generateBulkSppSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data input pembuatan tagihan tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { bulan, tahun, kelasId } = validated.data

    // 1. Ambil semua siswa aktif yang masuk filter kelasId (jika ada)
    const filterSiswa: Record<string, any> = {
      user: { aktif: true },
    }
    if (kelasId) {
      filterSiswa.kelasId = kelasId
    }

    const siswaList = await prisma.siswa.findMany({
      where: filterSiswa,
      include: {
        kelas: {
          include: {
            jenjang: true,
          },
        },
      },
    })

    if (siswaList.length === 0) {
      return {
        success: false,
        message: "Tidak ada siswa aktif yang ditemukan untuk kriteria yang dipilih",
      }
    }

    // Jatuh tempo diset otomatis tanggal 10 bulan tersebut
    const jatuhTempo = new Date(tahun, bulan - 1, 10, 23, 59, 59)

    let totalSiswaTerproses = 0
    let totalDilewati = 0

    await prisma.$transaction(async (tx) => {
      for (const siswa of siswaList) {
        // Cek apakah tagihan bulan+tahun ini sudah ada untuk siswa terkait (Idempotency)
        const existing = await tx.tagihanSpp.findUnique({
          where: {
            siswaId_bulan_tahun: {
              siswaId: siswa.id,
              bulan,
              tahun,
            },
          },
        })

        if (existing) {
          totalDilewati++
          continue
        }

        // Tentukan nominal tagihan SPP:
        // Prioritas 1: sppKhusus di level Siswa (beasiswa/keringanan)
        // Prioritas 2: tarifSppBulanan di level Jenjang Kelas
        let nominalSpp: Prisma.Decimal | null = null

        if (siswa.sppKhusus) {
          nominalSpp = siswa.sppKhusus
        } else if (siswa.kelas?.jenjang?.tarifSppBulanan) {
          nominalSpp = siswa.kelas.jenjang.tarifSppBulanan
        }

        // Jika tidak ada tarif SPP terkonfigurasi, skip siswa ini
        if (!nominalSpp || Number(nominalSpp) <= 0) {
          totalDilewati++
          continue
        }

        await tx.tagihanSpp.create({
          data: {
            siswaId: siswa.id,
            bulan,
            tahun,
            nominal: nominalSpp,
            jatuhTempo,
            status: StatusTagihan.BELUM_BAYAR,
          },
        })

        totalSiswaTerproses++
      }
    })

    revalidatePath("/dashboard/finance/spp")
    return {
      success: true,
      message: `Pembuatan tagihan selesai. Terproses: ${totalSiswaTerproses} siswa, Dilewati (sudah ada/tanpa tarif): ${totalDilewati}`,
      data: { totalSiswaTerproses, totalDilewati },
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal meng-generate tagihan SPP bulanan",
    }
  }
}

// ========================================================
// 2. ORANG TUA / SISWA: SUBMIT BUKTI PEMBAYARAN SPP
// ========================================================

export async function submitBuktiPembayaranSpp(
  payload: SubmitBuktiSppValues
): Promise<ActionResponse> {
  try {
    const ip = await getClientIpFromHeaders()
    const limiter = rateLimit(`submit-bukti-spp:${ip}`, {
      maxRequests: 5,
      windowMs: 5 * 60 * 1000,
    })
    if (!limiter.success) {
      return { success: false, message: "Terlalu banyak request upload. Silakan coba 5 menit lagi." }
    }

    const validated = submitBuktiSppSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data pembayaran tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { tagihanId, nominalDibayar, metodeBayar, urlBukti, namaBukti, catatan } = validated.data

    const sessionUser = await requireAuth()

    const tagihan = await prisma.tagihanSpp.findUnique({
      where: { id: tagihanId },
    })
    if (!tagihan) {
      return { success: false, message: "Data tagihan SPP tidak ditemukan" }
    }

    if (tagihan.status === StatusTagihan.SUDAH_BAYAR || tagihan.status === StatusTagihan.DIBATALKAN) {
      return { success: false, message: "Tagihan ini sudah lunas atau dibatalkan" }
    }

    // ✅ Otorisasi: Siswa hanya bisa bayar tagihannya sendiri, Orang tua hanya bisa bayar tagihan anaknya
    if (sessionUser.role === Role.SISWA) {
      const siswa = await prisma.siswa.findUnique({ where: { userId: sessionUser.id } })
      if (!siswa || tagihan.siswaId !== siswa.id) {
        return { success: false, message: "Akses ditolak: Ini bukan tagihan Anda" }
      }
    } else if (sessionUser.role === Role.ORANG_TUA) {
      const ortu = await prisma.orangTua.findUnique({ where: { userId: sessionUser.id } })
      if (!ortu) return { success: false, message: "Profil orang tua tidak ditemukan" }
      const hasAkses = await verifyOrangTuaAksesSiswa(ortu.id, tagihan.siswaId)
      if (!hasAkses) {
        return { success: false, message: "Akses ditolak: Siswa ini bukan anak Anda" }
      }
    } else if (sessionUser.role !== Role.ADMIN_KEUANGAN) {
      return { success: false, message: "Wewenang tidak mencukupi" }
    }

    // ✅ Validasi path file & pencegahan path traversal
    const expectedPrefix = `spp/${tagihanId}/`
    if (!urlFileCheck(urlBukti, expectedPrefix)) {
      return { success: false, message: "Struktur lokasi berkas tidak valid" }
    }

    // Verifikasi file ada di Supabase Storage
    const supabaseAdmin = createSupabaseAdmin()
    const fileName = urlBukti.split("/").pop()
    const { data: fileList } = await supabaseAdmin.storage
      .from("bukti-spp")
      .list(`spp/${tagihanId}`)

    const fileExists = fileList?.some((f) => f.name === fileName)
    if (!fileExists) {
      return { success: false, message: "Berkas bukti transfer tidak ditemukan di server" }
    }

    // Buat record pembayaran SPP & Ubah status tagihan menjadi SUDAH_BAYAR secara atomik
    await prisma.$transaction(async (tx) => {
      await tx.pembayaranSpp.create({
        data: {
          tagihanId,
          nominalDibayar: new Prisma.Decimal(nominalDibayar),
          tanggalBayar: new Date(),
          metodeBayar,
          urlBukti,
          namaBukti,
          catatan,
          dikonfirmasiOlehId: sessionUser.id,
        },
      })

      await tx.tagihanSpp.update({
        where: { id: tagihanId },
        data: {
          status: StatusTagihan.SUDAH_BAYAR,
        },
      })
    })

    revalidatePath("/dashboard/finance/spp")
    return {
      success: true,
      message: "Pembayaran berhasil dicatat dan diverifikasi",
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal mencatatkan pembayaran SPP",
    }
  }
}

// ========================================================
// 3. ADMIN KEUANGAN: MANAJEMEN PEMBAYARAN SPP (MANUAL)
// ========================================================

export async function konfirmasiPembayaranSppManual(
  payload: KonfirmasiPembayaranSppValues
): Promise<ActionResponse> {
  try {
    const adminUser = await requireAdminKeuangan()

    const validated = konfirmasiPembayaranSppSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data pembayaran tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { tagihanId, nominalDibayar, metodeBayar, urlBukti, namaBukti, catatan } = validated.data

    const tagihan = await prisma.tagihanSpp.findUnique({
      where: { id: tagihanId },
    })
    if (!tagihan) return { success: false, message: "Tagihan tidak ditemukan" }

    if (tagihan.status === StatusTagihan.SUDAH_BAYAR) {
      return { success: false, message: "Tagihan sudah lunas" }
    }

    await prisma.$transaction(async (tx) => {
      await tx.pembayaranSpp.create({
        data: {
          tagihanId,
          nominalDibayar: new Prisma.Decimal(nominalDibayar),
          tanggalBayar: new Date(),
          metodeBayar,
          urlBukti: urlBukti || null,
          namaBukti: namaBukti || null,
          catatan: catatan || "Konfirmasi manual oleh admin keuangan",
          dikonfirmasiOlehId: adminUser.id,
        },
      })

      await tx.tagihanSpp.update({
        where: { id: tagihanId },
        data: { status: StatusTagihan.SUDAH_BAYAR },
      })
    })

    revalidatePath("/dashboard/finance/spp")
    return {
      success: true,
      message: `Konfirmasi pembayaran tagihan SPP sukses diselesaikan`,
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Gagal memproses konfirmasi" }
  }
}

// ========================================================
// 4. ADMIN KEUANGAN: TRANSAKSI KEUANGAN NON-SPP
// ========================================================

export async function createTransaksiKeuangan(
  payload: CreateTransaksiKeuanganValues
): Promise<ActionResponse> {
  try {
    const adminUser = await requireAdminKeuangan()

    const validated = createTransaksiKeuanganSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data transaksi tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { kategoriId, nominal, deskripsi, tanggal, urlBukti, namaBukti } = validated.data

    const kategori = await prisma.kategoriTransaksi.findUnique({
      where: { id: kategoriId, aktif: true },
    })
    if (!kategori) return { success: false, message: "Kategori transaksi tidak aktif atau tidak ditemukan" }

    if (urlBukti) {
      const expectedPrefix = `nota/`
      if (!urlFileCheck(urlBukti, expectedPrefix)) {
        return { success: false, message: "Struktur lokasi berkas nota tidak valid" }
      }
    }

    const transaksi = await prisma.transaksiKeuangan.create({
      data: {
        kategoriId,
        tipe: kategori.tipe,
        nominal: new Prisma.Decimal(nominal),
        deskripsi,
        tanggal: new Date(tanggal),
        urlBukti: urlBukti || null,
        namaBukti: namaBukti || null,
        status: StatusTransaksi.AKTIF,
        dibuatOlehId: adminUser.id,
      },
    })

    revalidatePath("/dashboard/finance/transaksi")
    return {
      success: true,
      message: `Transaksi keuangan ${kategori.tipe.toLowerCase()} berhasil disimpan`,
      data: transaksi,
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Gagal menyimpan transaksi keuangan" }
  }
}

// ========================================================
// 5. AUDIT TRAIL: SOFT-DELETE TRANSAKSI & TAGIHAN
// ========================================================

export async function batalkanTransaksiKeuangan(
  payload: CancelTransaksiValues
): Promise<ActionResponse> {
  try {
    const adminUser = await requireAdminKeuangan()

    const validated = cancelTransaksiSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Input pembatalan tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { transaksiId, alasanPembatalan } = validated.data

    const transaksi = await prisma.transaksiKeuangan.findUnique({
      where: { id: transaksiId },
    })
    if (!transaksi) return { success: false, message: "Transaksi tidak ditemukan" }
    if (transaksi.status === StatusTransaksi.DIBATALKAN) {
      return { success: false, message: "Transaksi ini sudah dibatalkan sebelumnya" }
    }

    await prisma.transaksiKeuangan.update({
      where: { id: transaksiId },
      data: {
        status: StatusTransaksi.DIBATALKAN,
        alasanPembatalan,
        dibatalkanOlehId: adminUser.id,
        waktuPembatalan: new Date(),
      },
    })

    revalidatePath("/dashboard/finance/transaksi")
    return { success: true, message: "Transaksi berhasil dibatalkan (soft-delete)" }
  } catch (error: any) {
    return { success: false, message: error.message || "Gagal membatalkan transaksi" }
  }
}

export async function batalkanTagihanSpp(
  payload: CancelTagihanValues
): Promise<ActionResponse> {
  try {
    const adminUser = await requireAdminKeuangan()

    const validated = cancelTagihanSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Input pembatalan tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { tagihanId, alasanPembatalan } = validated.data

    const tagihan = await prisma.tagihanSpp.findUnique({
      where: { id: tagihanId },
    })
    if (!tagihan) return { success: false, message: "Tagihan tidak ditemukan" }
    if (tagihan.status === StatusTagihan.DIBATALKAN) {
      return { success: false, message: "Tagihan ini sudah dibatalkan" }
    }

    await prisma.tagihanSpp.update({
      where: { id: tagihanId },
      data: {
        status: StatusTagihan.DIBATALKAN,
        alasanPembatalan,
        dibatalkanOlehId: adminUser.id,
        waktuPembatalan: new Date(),
      },
    })

    revalidatePath("/dashboard/finance/spp")
    return { success: true, message: "Tagihan SPP berhasil dibatalkan" }
  } catch (error: any) {
    return { success: false, message: error.message || "Gagal membatalkan tagihan SPP" }
  }
}

// ========================================================
// 6. REPORTS: LAPORAN ARUS KAS & TUNGGAKAN
// ========================================================

export async function getLaporanKeuangan(
  payload: QueryLaporanKeuanganValues
): Promise<ActionResponse> {
  try {
    await requireAdminKeuangan()

    const validated = queryLaporanKeuanganSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Parameter filter tanggal tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { tanggalMulai, tanggalSelesai } = validated.data
    const start = new Date(tanggalMulai)
    const end = new Date(tanggalSelesai)

    // 1. Ambil pembayaran SPP (Pemasukan SPP)
    const totalSpp = await prisma.pembayaranSpp.aggregate({
      where: {
        tanggalBayar: { gte: start, lte: end },
        tagihan: { status: { not: StatusTagihan.DIBATALKAN } },
      },
      _sum: { nominalDibayar: true },
    })

    // 2. Ambil transaksi non-SPP yang AKTIF (Pemasukan & Pengeluaran)
    const transaksiNonSpp = await prisma.transaksiKeuangan.findMany({
      where: {
        tanggal: { gte: start, lte: end },
        status: StatusTransaksi.AKTIF,
      },
      include: { kategori: { select: { nama: true } } },
    })

    let totalPemasukanLain = 0
    let totalPengeluaran = 0

    const rincianTransaksi = transaksiNonSpp.map((t) => {
      const nominal = Number(t.nominal)
      if (t.tipe === TipeTransaksi.PEMASUKAN) {
        totalPemasukanLain += nominal
      } else {
        totalPengeluaran += nominal
      }

      return {
        id: t.id,
        kategori: t.kategori.nama,
        tipe: t.tipe,
        nominal,
        deskripsi: t.deskripsi,
        tanggal: t.tanggal,
      }
    })

    const nominalSpp = Number(totalSpp._sum.nominalDibayar || 0)
    const totalPemasukan = nominalSpp + totalPemasukanLain
    const saldoBersih = totalPemasukan - totalPengeluaran

    return {
      success: true,
      message: "Laporan arus kas berhasil dihitung",
      data: {
        periode: { mulai: start, selesai: end },
        ringkasan: {
          pemasukanSpp: nominalSpp,
          pemasukanLain: totalPemasukanLain,
          totalPemasukan,
          totalPengeluaran,
          saldoBersih,
        },
        transaksi: rincianTransaksi,
      },
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Gagal menyusun laporan keuangan" }
  }
}

export async function getRekapTunggakanSpp(
  kelasId?: string,
  bulan?: number,
  tahun?: number
): Promise<ActionResponse> {
  try {
    await requireAdminKeuangan()

    const whereClause: Record<string, any> = {
      status: { in: [StatusTagihan.BELUM_BAYAR, StatusTagihan.TERLAMBAT] },
    }

    if (bulan) whereClause.bulan = bulan
    if (tahun) whereClause.tahun = tahun
    if (kelasId) {
      whereClause.siswa = { kelasId }
    }

    const tunggakan = await prisma.tagihanSpp.findMany({
      where: whereClause,
      include: {
        siswa: {
          select: {
            id: true,
            nisn: true,
            user: { select: { nama: true } },
            kelas: { select: { nama: true } },
          },
        },
      },
      orderBy: [{ tahun: "asc" }, { bulan: "asc" }, { siswa: { user: { nama: "asc" } } }],
    })

    const totalTunggakanNominal = tunggakan.reduce(
      (acc, curr) => acc + Number(curr.nominal),
      0
    )

    return {
      success: true,
      message: "Data tunggakan SPP berhasil dikompilasi",
      data: {
        totalSiswaMenunggak: tunggakan.length,
        totalNominalTunggakan: totalTunggakanNominal,
        rincian: tunggakan.map((t) => ({
          tagihanId: t.id,
          siswaId: t.siswa.id,
          namaSiswa: t.siswa.user.nama,
          kelas: t.siswa.kelas?.nama || "Tanpa Kelas",
          periode: `${t.bulan}/${t.tahun}`,
          nominal: Number(t.nominal),
          jatuhTempo: t.jatuhTempo,
        })),
      },
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Gagal menyusun rekap tunggakan" }
  }
}

// ========================================================
// 7. ORANG TUA / SISWA: READ-ONLY STATUS SPP & BUKTI SIGNED URL
// ========================================================

export async function getTagihanSppSiswa(siswaId: string): Promise<ActionResponse> {
  try {
    const sessionUser = await requireAuth()

    // Otorisasi read-only
    if (sessionUser.role === Role.SISWA) {
      const siswa = await prisma.siswa.findUnique({ where: { userId: sessionUser.id } })
      if (!siswa || siswa.id !== siswaId) {
        return { success: false, message: "Akses ditolak: Anda hanya bisa melihat tagihan sendiri" }
      }
    } else if (sessionUser.role === Role.ORANG_TUA) {
      const ortu = await prisma.orangTua.findUnique({ where: { userId: sessionUser.id } })
      if (!ortu) return { success: false, message: "Profil orang tua tidak ditemukan" }
      const hasAkses = await verifyOrangTuaAksesSiswa(ortu.id, siswaId)
      if (!hasAkses) {
        return { success: false, message: "Akses ditolak: Siswa ini bukan anak kandung Anda" }
      }
    } else if (sessionUser.role !== Role.ADMIN_KEUANGAN && sessionUser.role !== Role.GURU) {
      return { success: false, message: "Hak akses tidak valid" }
    }

    const tagihanList = await prisma.tagihanSpp.findMany({
      where: { siswaId },
      include: {
        pembayaran: {
          include: { dikonfirmasiOleh: { select: { nama: true } } },
        },
      },
      orderBy: [{ tahun: "desc" }, { bulan: "desc" }],
    })

    const formatted = await Promise.all(
      tagihanList.map(async (t) => {
        const pembayaran = t.pembayaran[0] || null
        let signedBuktiUrl: string | null = null

        if (pembayaran?.urlBukti) {
          signedBuktiUrl = await getSignedUrl("bukti-spp", pembayaran.urlBukti)
        }

        return {
          id: t.id,
          bulan: t.bulan,
          tahun: t.tahun,
          nominal: Number(t.nominal),
          status: t.status,
          jatuhTempo: t.jatuhTempo,
          pembayaran: pembayaran
            ? {
                nominalDibayar: Number(pembayaran.nominalDibayar),
                tanggalBayar: pembayaran.tanggalBayar,
                metodeBayar: pembayaran.metodeBayar,
                catatan: pembayaran.catatan,
                konfirmator: pembayaran.dikonfirmasiOleh.nama,
                buktiUrl: signedBuktiUrl,
              }
            : null,
        }
      })
    )

    return {
      success: true,
      message: "Data tagihan & riwayat SPP sukses dimuat",
      data: formatted,
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Gagal memuat rincian tagihan" }
  }
}

// ========================================================
// PRIVATE UTIL
// ========================================================

function urlFileCheck(url: string, prefix: string): boolean {
  return url.startsWith(prefix) && !url.includes("..") && !url.includes("//")
}