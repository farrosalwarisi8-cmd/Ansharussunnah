// src/actions/akuntansi.ts

"use server"

import prisma from "@/lib/prisma"
import { requireAuth, requireRole } from "@/lib/auth"
import { verifyGuruAksesKelas } from "@/lib/guru-auth"
import { getClientIpFromHeaders, rateLimitAsync } from "@/lib/rate-limit"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { getSignedUrl } from "@/lib/storage"
import {
  generateBulkSppSchema,
  submitBuktiSppSchema,
  konfirmasiPembayaranSppSchema,
  konfirmasiPembayaranAdminSchema,
  createTransaksiKeuanganSchema,
  cancelTransaksiSchema,
  cancelTagihanSchema,
  queryLaporanKeuanganSchema,
  type GenerateBulkSppValues,
  type SubmitBuktiSppValues,
  type KonfirmasiPembayaranSppValues,
  type KonfirmasiPembayaranAdminValues,
  type CreateTransaksiKeuanganValues,
  type CancelTransaksiValues,
  type CancelTagihanValues,
  type QueryLaporanKeuanganValues,
} from "@/lib/validations/akuntansi"
import type { ActionResponse } from "@/types"
import { Role, StatusTagihan, StatusPembayaran, StatusTransaksi, TipeTransaksi } from "@prisma/client"
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
    const filterSiswa: Record<string, unknown> = {
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
        const bulanNames = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
        const existing = await tx.tagihanSiswa.findFirst({
          where: {
            siswaId: siswa.id,
            bulan,
            tahun,
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

        await tx.tagihanSiswa.create({
          data: {
            siswaId: siswa.id,
            namaTagihan: `SPP ${bulanNames[bulan]} ${tahun}`,
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
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal meng-generate tagihan SPP bulanan",
    }
  }
}

// ========================================================
// 2. ORANG TUA / SISWA: SUBMIT BUKTI PEMBAYARAN SPP
//    PENTEST FIX #1: Alur dua-tahap — status → MENUNGGU_VERIFIKASI
//    Status tidak langsung SUDAH_BAYAR; admin harus konfirmasi terlebih dahulu.
// ========================================================

export async function submitBuktiPembayaranSpp(
  payload: SubmitBuktiSppValues
): Promise<ActionResponse> {
  try {
    const ip = await getClientIpFromHeaders()
    const limiter = await rateLimitAsync(`submit-bukti-spp:${ip}`, {
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

    const tagihan = await prisma.tagihanSiswa.findUnique({
      where: { id: tagihanId },
    })
    if (!tagihan) {
      return { success: false, message: "Data tagihan SPP tidak ditemukan" }
    }

    // Tagihan yang sudah lunas, dibatalkan, atau sedang menunggu verifikasi tidak bisa disubmit lagi
    if (tagihan.status === StatusTagihan.SUDAH_BAYAR || tagihan.status === StatusTagihan.DIBATALKAN) {
      return { success: false, message: "Tagihan ini sudah lunas atau dibatalkan" }
    }

    // PENTEST FIX #1: Cegah double-submit saat ada pembayaran PENDING yang belum diproses admin
    if (tagihan.status === StatusTagihan.MENUNGGU_VERIFIKASI) {
      return {
        success: false,
        message:
          "Bukti pembayaran Anda sudah diterima dan sedang menunggu verifikasi admin keuangan. " +
          "Harap tunggu hingga diproses sebelum mengirim bukti baru.",
      }
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

    // PENTEST FIX #1: Buat record PembayaranSpp berstatus PENDING
    //   - Status tagihan → MENUNGGU_VERIFIKASI (BUKAN SUDAH_BAYAR)
    //   - Admin keuangan harus memanggil konfirmasiPembayaranSppOlehAdmin untuk finalisasi
    //   - nominalDibayar dicatat apa adanya; admin yang memvalidasi kesesuaiannya
    await prisma.$transaction(async (tx) => {
      await tx.pembayaranSiswa.create({
        data: {
          tagihanId,
          nominalDibayar: new Prisma.Decimal(nominalDibayar),
          tanggalBayar: new Date(),
          metodeBayar,
          urlBukti,
          namaBukti,
          catatan,
          statusPembayaran: StatusPembayaran.PENDING,
          // dikonfirmasiOlehId & waktuKonfirmasi dibiarkan null hingga admin konfirmasi
        },
      })

      await tx.tagihanSiswa.update({
        where: { id: tagihanId },
        data: {
          status: StatusTagihan.MENUNGGU_VERIFIKASI,
        },
      })
    })

    revalidatePath("/dashboard/finance/spp")
    return {
      success: true,
      message:
        "Bukti pembayaran berhasil dikirim dan sedang menunggu verifikasi oleh admin keuangan. " +
        "Status tagihan Anda akan diperbarui setelah pembayaran dikonfirmasi.",
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal mencatatkan pembayaran SPP",
    }
  }
}

// ========================================================
// 3. ADMIN KEUANGAN: KONFIRMASI PEMBAYARAN SPP DARI SISWA/ORTU
//    PENTEST FIX #1 (baru): Action dua-tahap — approve atau reject bukti upload
//    Hanya ADMIN_KEUANGAN yang bisa memanggil fungsi ini.
// ========================================================

export async function konfirmasiPembayaranSppOlehAdmin(
  payload: KonfirmasiPembayaranAdminValues
): Promise<
  ActionResponse<{
    statusTagihanBaru: string
    totalTerbayar: number
    sisaTunggakan: number
    nominalTidakSesuai: boolean
    selisihNominal: number
  }>
> {
  try {
    const adminUser = await requireAdminKeuangan()

    const validated = konfirmasiPembayaranAdminSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data konfirmasi tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { pembayaranId, disetujui, catatan, alasanPenolakan } = validated.data

    // Ambil pembayaran beserta tagihan dan semua pembayaran lain yang sudah DIKONFIRMASI
    const pembayaran = await prisma.pembayaranSiswa.findUnique({
      where: { id: pembayaranId },
      include: {
        tagihan: {
          include: {
            pembayaran: {
              where: { statusPembayaran: StatusPembayaran.DIKONFIRMASI },
            },
          },
        },
      },
    })

    if (!pembayaran) {
      return { success: false, message: "Data pembayaran tidak ditemukan" }
    }

    if (pembayaran.statusPembayaran !== StatusPembayaran.PENDING) {
      return {
        success: false,
        message: `Pembayaran ini sudah diproses sebelumnya (status: ${pembayaran.statusPembayaran})`,
      }
    }

    const tagihan = pembayaran.tagihan
    const nominalTagihan = Number(tagihan.nominal)
    const nominalPembayaranIni = Number(pembayaran.nominalDibayar)

    // Hitung total yang sudah dikonfirmasi admin SEBELUM pembayaran ini
    const totalSudahDikonfirmasi = tagihan.pembayaran.reduce(
      (acc, p) => acc + Number(p.nominalDibayar),
      0
    )

    // PENTEST FIX #1: Flag untuk memperingatkan admin jika nominal tidak sesuai
    // Tidak memblokir, hanya memberi sinyal agar admin bisa verifikasi manual
    const nominalTidakSesuai = nominalPembayaranIni !== nominalTagihan
    const selisihNominal = Math.abs(nominalTagihan - nominalPembayaranIni)

    const hasil = await prisma.$transaction(async (tx) => {
      if (disetujui) {
        // PENTEST FIX #3 (Partial Payment): Hitung total setelah pembayaran ini dikonfirmasi
        const totalDibayarSetelahIni = totalSudahDikonfirmasi + nominalPembayaranIni

        // Tentukan status tagihan berdasarkan total kumulatif
        let statusTagihanBaru: StatusTagihan
        if (totalDibayarSetelahIni >= nominalTagihan) {
          statusTagihanBaru = StatusTagihan.SUDAH_BAYAR
        } else {
          statusTagihanBaru = StatusTagihan.DIBAYAR_SEBAGIAN
        }

        // Update record pembayaran: DIKONFIRMASI
        await tx.pembayaranSiswa.update({
          where: { id: pembayaranId },
          data: {
            statusPembayaran: StatusPembayaran.DIKONFIRMASI,
            dikonfirmasiOlehId: adminUser.id,
            waktuKonfirmasi: new Date(),
            catatan: catatan || pembayaran.catatan,
          },
        })

        // Update tagihan dengan status baru dan cache totalTerbayar
        await tx.tagihanSiswa.update({
          where: { id: tagihan.id },
          data: {
            status: statusTagihanBaru,
            totalTerbayar: new Prisma.Decimal(totalDibayarSetelahIni),
          },
        })

        return {
          statusTagihanBaru,
          totalTerbayar: totalDibayarSetelahIni,
          sisaTunggakan: Math.max(0, nominalTagihan - totalDibayarSetelahIni),
        }
      } else {
        // Pembayaran DITOLAK: kembalikan status tagihan sesuai jatuh tempo
        const now = new Date()
        const statusTagihanDikembalikan =
          tagihan.jatuhTempo < now ? StatusTagihan.TERLAMBAT : StatusTagihan.BELUM_BAYAR

        await tx.pembayaranSiswa.update({
          where: { id: pembayaranId },
          data: {
            statusPembayaran: StatusPembayaran.DITOLAK,
            dikonfirmasiOlehId: adminUser.id,
            waktuKonfirmasi: new Date(),
            alasanPenolakan: alasanPenolakan || null,
            catatan: catatan || pembayaran.catatan,
          },
        })

        // Kembalikan status tagihan ke kondisi sebelum ada pending
        await tx.tagihanSiswa.update({
          where: { id: tagihan.id },
          data: {
            status: statusTagihanDikembalikan,
          },
        })

        return {
          statusTagihanBaru: statusTagihanDikembalikan,
          totalTerbayar: totalSudahDikonfirmasi,
          sisaTunggakan: Math.max(0, nominalTagihan - totalSudahDikonfirmasi),
        }
      }
    })

    revalidatePath("/dashboard/finance/spp")
    return {
      success: true,
      message: disetujui
        ? hasil.sisaTunggakan > 0
          ? `Pembayaran dikonfirmasi. Tagihan dibayar sebagian — sisa tunggakan: Rp ${hasil.sisaTunggakan.toLocaleString("id-ID")}`
          : "Pembayaran dikonfirmasi. Tagihan dinyatakan lunas."
        : `Pembayaran ditolak. Tagihan dikembalikan ke status sebelumnya. Siswa/ortu dapat mengupload ulang bukti.`,
      data: {
        statusTagihanBaru: hasil.statusTagihanBaru,
        totalTerbayar: hasil.totalTerbayar,
        sisaTunggakan: hasil.sisaTunggakan,
        // Sinyal ke admin UI agar dapat menampilkan peringatan kesesuaian nominal
        nominalTidakSesuai,
        selisihNominal,
      },
    }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal memproses konfirmasi pembayaran" }
  }
}

// ========================================================
// 4. ADMIN KEUANGAN: MANAJEMEN PEMBAYARAN SPP (INPUT MANUAL)
//    PENTEST FIX #3: Tambah logika partial payment — tidak langsung SUDAH_BAYAR
//    jika total pembayaran < nominal tagihan.
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

    const tagihan = await prisma.tagihanSiswa.findUnique({
      where: { id: tagihanId },
      include: {
        pembayaran: {
          where: { statusPembayaran: StatusPembayaran.DIKONFIRMASI },
        },
      },
    })
    if (!tagihan) return { success: false, message: "Tagihan tidak ditemukan" }

    if (tagihan.status === StatusTagihan.SUDAH_BAYAR) {
      return { success: false, message: "Tagihan sudah lunas" }
    }
    if (tagihan.status === StatusTagihan.DIBATALKAN) {
      return { success: false, message: "Tagihan sudah dibatalkan" }
    }

    // PENTEST FIX #3: Hitung total kumulatif termasuk pembayaran baru ini
    const totalSudahDikonfirmasi = tagihan.pembayaran.reduce(
      (acc, p) => acc + Number(p.nominalDibayar),
      0
    )
    const totalDibayarSetelahIni = totalSudahDikonfirmasi + nominalDibayar
    const nominalTagihan = Number(tagihan.nominal)

    // Tentukan status berdasarkan total kumulatif, bukan nominal input saja
    const statusTagihanBaru =
      totalDibayarSetelahIni >= nominalTagihan
        ? StatusTagihan.SUDAH_BAYAR
        : StatusTagihan.DIBAYAR_SEBAGIAN

    await prisma.$transaction(async (tx) => {
      await tx.pembayaranSiswa.create({
        data: {
          tagihanId,
          nominalDibayar: new Prisma.Decimal(nominalDibayar),
          tanggalBayar: new Date(),
          metodeBayar,
          urlBukti: urlBukti || null,
          namaBukti: namaBukti || null,
          catatan: catatan || "Konfirmasi manual oleh admin keuangan",
          // Input manual oleh admin langsung berstatus DIKONFIRMASI
          statusPembayaran: StatusPembayaran.DIKONFIRMASI,
          dikonfirmasiOlehId: adminUser.id,
          waktuKonfirmasi: new Date(),
        },
      })

      await tx.tagihanSiswa.update({
        where: { id: tagihanId },
        data: {
          status: statusTagihanBaru,
          totalTerbayar: new Prisma.Decimal(totalDibayarSetelahIni),
        },
      })
    })

    const sisaTunggakan = Math.max(0, nominalTagihan - totalDibayarSetelahIni)
    revalidatePath("/dashboard/finance/spp")
    return {
      success: true,
      message:
        statusTagihanBaru === StatusTagihan.SUDAH_BAYAR
          ? "Konfirmasi pembayaran berhasil. Tagihan dinyatakan lunas."
          : `Konfirmasi pembayaran sebagian berhasil. Sisa tunggakan: Rp ${sisaTunggakan.toLocaleString("id-ID")}`,
    }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal memproses konfirmasi" }
  }
}

// ========================================================
// 5. ADMIN KEUANGAN: TRANSAKSI KEUANGAN NON-SPP
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
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menyimpan transaksi keuangan" }
  }
}

// ========================================================
// 6. AUDIT TRAIL: SOFT-DELETE TRANSAKSI & TAGIHAN
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
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal membatalkan transaksi" }
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

    const tagihan = await prisma.tagihanSiswa.findUnique({
      where: { id: tagihanId },
    })
    if (!tagihan) return { success: false, message: "Tagihan tidak ditemukan" }
    if (tagihan.status === StatusTagihan.DIBATALKAN) {
      return { success: false, message: "Tagihan ini sudah dibatalkan" }
    }

    await prisma.tagihanSiswa.update({
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
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal membatalkan tagihan SPP" }
  }
}

// ========================================================
// 7. REPORTS: LAPORAN ARUS KAS & TUNGGAKAN
//    PENTEST FIX #1: Filter pemasukan SPP hanya dari PembayaranSpp DIKONFIRMASI
//    PENTEST FIX #1: getRekapTunggakanSpp sertakan MENUNGGU_VERIFIKASI sebagai kategori terpisah
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

    // PENTEST FIX #1: Hanya hitung pembayaran yang sudah DIKONFIRMASI admin sebagai pemasukan sah
    // Pembayaran PENDING (menunggu verifikasi) TIDAK masuk ke laporan keuangan
    const totalSpp = await prisma.pembayaranSiswa.aggregate({
      where: {
        tanggalBayar: { gte: start, lte: end },
        statusPembayaran: StatusPembayaran.DIKONFIRMASI,
        tagihan: { status: { not: StatusTagihan.DIBATALKAN } },
      },
      _sum: { nominalDibayar: true },
    })

    // Hitung pembayaran pending di periode yang sama (untuk info, BUKAN pemasukan)
    const totalSppPending = await prisma.pembayaranSiswa.aggregate({
      where: {
        tanggalBayar: { gte: start, lte: end },
        statusPembayaran: StatusPembayaran.PENDING,
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

    const nominalSppDikonfirmasi = Number(totalSpp._sum.nominalDibayar || 0)
    const nominalSppPending = Number(totalSppPending._sum.nominalDibayar || 0)
    const totalPemasukan = nominalSppDikonfirmasi + totalPemasukanLain
    const saldoBersih = totalPemasukan - totalPengeluaran

    return {
      success: true,
      message: "Laporan arus kas berhasil dihitung",
      data: {
        periode: { mulai: start, selesai: end },
        ringkasan: {
          pemasukanSpp: nominalSppDikonfirmasi,
          // Info: nominal SPP yang belum diverifikasi (tidak masuk ke saldo)
          sppMenungguVerifikasi: nominalSppPending,
          pemasukanLain: totalPemasukanLain,
          totalPemasukan,
          totalPengeluaran,
          saldoBersih,
        },
        transaksi: rincianTransaksi,
      },
    }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menyusun laporan keuangan" }
  }
}

export async function getRekapTunggakanSpp(
  kelasId?: string,
  bulan?: number,
  tahun?: number
): Promise<ActionResponse> {
  try {
    await requireAdminKeuangan()

    // PENTEST FIX #1: Pisahkan tunggakan murni dan yang menunggu verifikasi
    const baseFilter: Record<string, unknown> = {}
    if (bulan) baseFilter.bulan = bulan
    if (tahun) baseFilter.tahun = tahun
    if (kelasId) {
      baseFilter.siswa = { kelasId }
    }

    const includeConfig = {
      siswa: {
        select: {
          id: true,
          nisn: true,
          user: { select: { nama: true } },
          kelas: { select: { nama: true } },
        },
      },
    }

    const orderByConfig = [
      { tahun: "asc" as const },
      { bulan: "asc" as const },
      { siswa: { user: { nama: "asc" as const } } },
    ]

    // Ambil tunggakan murni (belum bayar sama sekali)
    const tunggakanMurni = await prisma.tagihanSiswa.findMany({
      where: {
        ...baseFilter,
        status: { in: [StatusTagihan.BELUM_BAYAR, StatusTagihan.TERLAMBAT] },
      },
      include: includeConfig,
      orderBy: orderByConfig,
    })

    // Ambil tagihan yang dibayar sebagian (cicilan)
    const dibayarSebagian = await prisma.tagihanSiswa.findMany({
      where: {
        ...baseFilter,
        status: StatusTagihan.DIBAYAR_SEBAGIAN,
      },
      include: includeConfig,
      orderBy: orderByConfig,
    })

    // Ambil tagihan yang menunggu verifikasi admin (bukan tunggakan, belum lunas)
    const menungguVerifikasi = await prisma.tagihanSiswa.findMany({
      where: {
        ...baseFilter,
        status: StatusTagihan.MENUNGGU_VERIFIKASI,
      },
      include: includeConfig,
      orderBy: orderByConfig,
    })

    const formatTagihan = (list: typeof tunggakanMurni) =>
      list.map((t) => ({
        tagihanId: t.id,
        siswaId: t.siswa.id,
        namaSiswa: t.siswa.user.nama,
        kelas: t.siswa.kelas?.nama || "Tanpa Kelas",
        periode: `${t.bulan}/${t.tahun}`,
        nominal: Number(t.nominal),
        totalTerbayar: Number(t.totalTerbayar || 0),
        sisaTunggakan: Number(t.nominal) - Number(t.totalTerbayar || 0),
        jatuhTempo: t.jatuhTempo,
        status: t.status,
      }))

    const totalNominalTunggakanMurni = tunggakanMurni.reduce((acc, t) => acc + Number(t.nominal), 0)
    const totalNominalDibayarSebagian = dibayarSebagian.reduce(
      (acc, t) => acc + (Number(t.nominal) - Number(t.totalTerbayar || 0)),
      0
    )

    return {
      success: true,
      message: "Data tunggakan SPP berhasil dikompilasi",
      data: {
        ringkasan: {
          totalTunggakanMurni: tunggakanMurni.length,
          totalNominalTunggakanMurni,
          totalDibayarSebagian: dibayarSebagian.length,
          totalSisaDibayarSebagian: totalNominalDibayarSebagian,
          totalMenungguVerifikasi: menungguVerifikasi.length,
        },
        tunggakanMurni: formatTagihan(tunggakanMurni),
        dibayarSebagian: formatTagihan(dibayarSebagian),
        menungguVerifikasi: formatTagihan(menungguVerifikasi),
      },
    }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menyusun rekap tunggakan" }
  }
}

// ========================================================
// 8. ORANG TUA / SISWA: READ-ONLY STATUS SPP & BUKTI SIGNED URL
//    PENTEST FIX #1: Expose status MENUNGGU_VERIFIKASI & DIBAYAR_SEBAGIAN dengan jelas
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
    } else if (sessionUser.role === Role.GURU) {
      // GURU hanya boleh melihat data SPP jika dia adalah wali kelas siswa tersebut
      const siswaCheck = await prisma.siswa.findUnique({ where: { id: siswaId } })
      if (!siswaCheck || !siswaCheck.kelasId) {
        return { success: false, message: "Data siswa tidak valid" }
      }
      try {
        const { roleInKelas } = await verifyGuruAksesKelas(siswaCheck.kelasId)
        if (roleInKelas !== "WALI_KELAS") {
          return { success: false, message: "Akses ditolak: Anda bukan wali kelas siswa ini" }
        }
      } catch {
        return { success: false, message: "Akses ditolak: Anda bukan wali kelas siswa ini" }
      }
    } else if (sessionUser.role !== Role.ADMIN_KEUANGAN) {
      return { success: false, message: "Hak akses tidak valid" }
    }

    const tagihanList = await prisma.tagihanSiswa.findMany({
      where: { siswaId },
      include: {
        pembayaran: {
          orderBy: { createdAt: "desc" },
          include: { dikonfirmasiOleh: { select: { nama: true } } },
        },
      },
      orderBy: [{ tahun: "desc" }, { bulan: "desc" }],
    })

    const formatted = await Promise.all(
      tagihanList.map(async (t) => {
        // Ambil pembayaran terakhir (paling baru) untuk ditampilkan
        const pembayaranTerakhir = t.pembayaran[0] || null
        // Pembayaran yang sudah dikonfirmasi untuk riwayat lengkap
        const pembayaranDikonfirmasi = t.pembayaran.filter(
          (p) => p.statusPembayaran === StatusPembayaran.DIKONFIRMASI
        )

        let signedBuktiUrl: string | null = null
        if (pembayaranTerakhir?.urlBukti) {
          signedBuktiUrl = await getSignedUrl("bukti-spp", pembayaranTerakhir.urlBukti)
        }

        const nominalTagihan = Number(t.nominal)
        const totalTerbayar = Number(t.totalTerbayar || 0)
        const sisaTunggakan = Math.max(0, nominalTagihan - totalTerbayar)

        // PENTEST FIX #1: Label yang jelas untuk setiap status
        const labelStatus: Record<string, string> = {
          BELUM_BAYAR: "Belum Dibayar",
          TERLAMBAT: "Terlambat — Harap segera bayar",
          MENUNGGU_VERIFIKASI: "Bukti dikirim — Menunggu konfirmasi admin keuangan",
          DIBAYAR_SEBAGIAN: `Dibayar Sebagian — Sisa Rp ${sisaTunggakan.toLocaleString("id-ID")}`,
          SUDAH_BAYAR: "Lunas",
          DIBATALKAN: "Dibatalkan",
        }

        return {
          id: t.id,
          bulan: t.bulan,
          tahun: t.tahun,
          nominal: nominalTagihan,
          status: t.status,
          labelStatus: labelStatus[t.status] || t.status,
          jatuhTempo: t.jatuhTempo,
          totalTerbayar,
          sisaTunggakan,
          // Info pembayaran terkini (PENDING atau DIKONFIRMASI)
          pembayaranTerkini: pembayaranTerakhir
            ? {
                id: pembayaranTerakhir.id,
                nominalDibayar: Number(pembayaranTerakhir.nominalDibayar),
                tanggalBayar: pembayaranTerakhir.tanggalBayar,
                metodeBayar: pembayaranTerakhir.metodeBayar,
                statusPembayaran: pembayaranTerakhir.statusPembayaran,
                alasanPenolakan: pembayaranTerakhir.alasanPenolakan,
                catatan: pembayaranTerakhir.catatan,
                konfirmator: pembayaranTerakhir.dikonfirmasiOleh?.nama || null,
                buktiUrl: signedBuktiUrl,
              }
            : null,
          // Riwayat pembayaran yang sudah dikonfirmasi
          riwayatPembayaran: pembayaranDikonfirmasi.map((p) => ({
            nominalDibayar: Number(p.nominalDibayar),
            tanggalBayar: p.tanggalBayar,
            metodeBayar: p.metodeBayar,
            konfirmator: p.dikonfirmasiOleh?.nama || null,
          })),
        }
      })
    )

    return {
      success: true,
      message: "Data tagihan & riwayat SPP sukses dimuat",
      data: formatted,
    }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal memuat rincian tagihan" }
  }
}

// ========================================================
// PRIVATE UTIL
// ========================================================

function urlFileCheck(url: string, prefix: string): boolean {
  return url.startsWith(prefix) && !url.includes("..") && !url.includes("//")
}