// src/actions/kenaikan-kelas.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuruAdmin } from "@/lib/auth"
import { verifyGuruAksesKelas } from "@/lib/guru-auth"
import {
  promosiSiswaMassalSchema,
  type PromosiSiswaMassalValues,
} from "@/lib/validations/kenaikan-kelas"
import { toUserFriendlyError, AppError } from "@/lib/prisma-error"
import type { ActionResponse } from "@/types"
import { revalidatePath } from "next/cache"

// ========================================================
// 1. PROMOSI SISWA MASSAL
// ========================================================

/**
 * Memindahkan siswa dari kelas lama ke kelas baru (kenaikan kelas).
 * Menerima array mapping { siswaId, kelasBaruId }[].
 * Menggunakan Prisma transaction untuk atomicity.
 * Menyimpan histori di RiwayatKelasSiswa.
 */
export async function promosiSiswaMassal(
  payload: PromosiSiswaMassalValues
): Promise<ActionResponse<{ totalBerhasil: number; totalGagal: number }>> {
  try {
    await requireGuruAdmin()

    const validated = promosiSiswaMassalSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data promosi tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { periodeAjaranId, mapping } = validated.data

    // Validasi periode ajaran exists
    const periode = await prisma.periodeAjaran.findUnique({
      where: { id: periodeAjaranId },
    })
    if (!periode) {
      return { success: false, message: "Periode ajaran tidak ditemukan" }
    }

    // Validasi semua kelasBaruId exist (ikutkan okupansi untuk cek kapasitas)
    const kelasBaruIds = [...new Set(mapping.map((m) => m.kelasBaruId))]
    const kelasBaruList = await prisma.kelas.findMany({
      where: { id: { in: kelasBaruIds } },
      include: { _count: { select: { siswa: true } } },
    })

    if (kelasBaruList.length !== kelasBaruIds.length) {
      const foundIds = new Set(kelasBaruList.map((k) => k.id))
      const missingIds = kelasBaruIds.filter((id) => !foundIds.has(id))
      return {
        success: false,
        message: `Kelas tujuan tidak valid: ${missingIds.join(", ")}`,
      }
    }

    // Validasi semua siswaId exist
    const siswaIds = [...new Set(mapping.map((m) => m.siswaId))]
    const siswaList = await prisma.siswa.findMany({
      where: { id: { in: siswaIds }, deleted_at: null },
    })

    if (siswaList.length !== siswaIds.length) {
      const foundSiswaIds = new Set(siswaList.map((s) => s.id))
      const missingSiswaIds = siswaIds.filter((id) => !foundSiswaIds.has(id))
      return {
        success: false,
        message: `Siswa tidak valid: ${missingSiswaIds.join(", ")}`,
      }
    }

    let totalBerhasil = 0
    let totalGagal = 0

    // ========================================================
    // Strategi optimasi batch:
    //
    // 1. Pre-validasi semua data SEBELUM masuk transaction.
    //    Jika ada siswa yang tidak valid atau kelas asal tidak ditemukan,
    //    hitung sebagai gagal di fase validasi. Begitu masuk transaction,
    //    seharusnya tidak ada kegagalan individual (kecuali error DB).
    //
    // 2. Gunakan createMany + skipDuplicates untuk riwayatKelasSiswa.
    //    Constraint unique [siswaId, periodeAjaranId] memastikan tidak ada
    //    duplikat. Ini mengubah O(n) findUnique+create menjadi 1 query.
    //
    // 3. Kelompokkan siswa berdasarkan kelasBaruId, lalu updateMany per grup.
    //    Ini mengubah O(n) update per-siswa menjadi O(kelas unik) query.
    //
    // 4. Naikkan timeout transaction untuk menampung skala besar.
    // ========================================================

    // --- Fase 1: Pre-validasi & siapkan data ---
    const siswaMap = new Map(siswaList.map((s) => [s.id, s]))
    const kelasBaruMap = new Map(kelasBaruList.map((k) => [k.id, k]))
    const validItems: { siswaId: string; kelasBaruId: string }[] = []
    const kelasAsalMap = new Map<string, string | null>() // siswaId → kelasAsalId
    // Rencana penempatan per kelas tujuan (digunakan untuk cek kapasitas)
    const rencanaPenempatan = new Map<string, number>() // kelasBaruId → jumlah siswa

    for (const item of mapping) {
      const siswa = siswaMap.get(item.siswaId)
      if (!siswa) {
        totalGagal++
        console.error(`Siswa ${item.siswaId} tidak ditemukan, dilewati`)
        continue
      }
      const kelasBaru = kelasBaruMap.get(item.kelasBaruId)
      // Cegah penempatan ke kelas dengan gender berbeda (akhwat/ikhwan terpisah).
      // Kelas campuran (jenisKelamin null) menerima semua gender.
      if (
        kelasBaru?.jenisKelamin &&
        siswa.jenisKelamin &&
        kelasBaru.jenisKelamin !== siswa.jenisKelamin
      ) {
        totalGagal++
        console.error(
          `Siswa ${item.siswaId} (${siswa.jenisKelamin}) tidak cocok dengan kelas tujuan ${item.kelasBaruId} (${kelasBaru.jenisKelamin}), dilewati`
        )
        continue
      }
      // Cegah overkapasitas: temuan sebelumnya tidak boleh melampaui kuota
      // kelas tujuan (termasuk siswa yang memang sudah berada di sana).
      const jumlahRencana = (rencanaPenempatan.get(item.kelasBaruId) || 0) + 1
      if (
        kelasBaru?.kapasitas &&
        kelasBaru.kapasitas > 0 &&
        kelasBaru._count.siswa + jumlahRencana > kelasBaru.kapasitas
      ) {
        totalGagal++
        console.error(
          `Kelas tujuan ${item.kelasBaruId} sudah penuh (${kelasBaru._count.siswa}/${kelasBaru.kapasitas}), siswa ${item.siswaId} dilewati`
        )
        continue
      }
      rencanaPenempatan.set(item.kelasBaruId, jumlahRencana)
      validItems.push(item)
      kelasAsalMap.set(item.siswaId, siswa.kelasId)
    }

    // --- Fase 2: Eksekusi batch dalam transaction ---
    if (validItems.length > 0) {
      await prisma.$transaction(
        async (tx) => {
          // Batch 1: Simpan histori kelas siswa pada periode tujuan.
          // - kelasId = kelas baru yang dihuni selama periode tujuan.
          // - kelasAsalId = kelas sebelum promosi (nullable — kosong jika siswa
          //   tidak punya kelas asal tercatat, mis. siswa baru).
          const riwayatData = validItems
            .map((item) => ({
              siswaId: item.siswaId,
              kelasId: item.kelasBaruId,
              periodeAjaranId,
              kelasAsalId: kelasAsalMap.get(item.siswaId) ?? null,
            }))
            .filter((item) => item.kelasAsalId) // Filter siswa tanpa kelas asal

          if (riwayatData.length > 0) {
            // skipDuplicates: true — jika riwayat sudah ada untuk periode ini,
            // lewati tanpa error (berkat constraint unique siswaId + periodeAjaranId)
            await tx.riwayatKelasSiswa.createMany({
              data: riwayatData,
              skipDuplicates: true,
            })
          }

          // Batch 2: Update kelas siswa, dikelompokkan per kelasBaruId
          // Strategi: gunakan Map<kelasBaruId, siswaId[]> lalu updateMany per grup
          const grupPerKelas = new Map<string, string[]>()
          for (const item of validItems) {
            const existing = grupPerKelas.get(item.kelasBaruId) || []
            existing.push(item.siswaId)
            grupPerKelas.set(item.kelasBaruId, existing)
          }

          // Otoritatif di dalam transaction: pantau kuota ulang agar dua
          // promosi yang berjalan bersamaan tidak mengisi kelas melebihi
          // kapasitas (race window). Gagal = seluruh batch dibatalkan.
          for (const [kelasBaruId, siswaIds] of grupPerKelas) {
            const kelasTx = await tx.kelas.findUnique({
              where: { id: kelasBaruId },
              include: { _count: { select: { siswa: true } } },
            })
            if (
              kelasTx &&
              kelasTx.kapasitas > 0 &&
              kelasTx._count.siswa + siswaIds.length > kelasTx.kapasitas
            ) {
              throw new AppError(
                `Kelas "${kelasTx.nama}" sudah penuh (${kelasTx._count.siswa}/${kelasTx.kapasitas}). Tidak dapat menempatkan ${siswaIds.length} siswa.`
              )
            }

            await tx.siswa.updateMany({
              where: { id: { in: siswaIds } },
              data: { kelasId: kelasBaruId },
            })
          }

          // Jika transaction berhasil, semua validItems dianggap berhasil
          totalBerhasil = validItems.length
        },
        {
          // Naikkan timeout untuk menampung promosi skala besar (ratusan siswa)
          // maxWait: waktu menunggu slot transaction (ms)
          // timeout: waktu maksimal eksekusi transaction (ms)
          timeout: 30000,
          maxWait: 10000,
        }
      )
    }

    revalidatePath("/dashboard/guru/kenaikan-kelas")
    revalidatePath("/dashboard/siswa")
    return {
      success: true,
      message: `Promosi selesai. Berhasil: ${totalBerhasil} siswa, Gagal: ${totalGagal} siswa`,
      data: { totalBerhasil, totalGagal },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal melakukan promosi kelas"),
    }
  }
}

// ========================================================
// 2. GET SISWA UNTUK PROMOSI (dengan Rekomendasi Kelas Tujuan)
// ========================================================

/**
 * Ekstrak urutan numerik dari nama kelas, misal "Kelas 2" → 2, "Tingkat 1" → 1.
 * Dipakai untuk menghitung "kelas berikutnya" di dalam satu jenjang.
 * Kelas tanpa angka dianggap paling akhir (tak bisa naik di jenjang itu).
 */
function urutanNumerikKelas(nama: string): number {
  const match = nama.match(/(\d+)/)
  return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER
}

/**
 * Mengambil daftar siswa di suatu kelas beserta rekomendasi kelas tujuan.
 *
 * ALUR:
 * 1. Naik kelas DI DALAM jenjang yang sama terlebih dahulu.
 *    Contoh: "Madrasah Aliyah - Kelas 2" → rekomendasi "Kelas 3".
 *    Target = semua kelas aktif di jenjang yang sama dengan urutan lebih tinggi.
 * 2. Hanya jika siswa berada di kelas TERAKHIR jenjangnya (lulus), barulah
 *    diarahkan ke kelas-kelas di jenjang berikutnya (urutan + 1).
 * 3. Jika jenjang tertinggi, tidak ada kelas tujuan sama sekali.
 * Guru tetap bisa override manual pemilihan kelas tujuan per siswa.
 */
export async function getSiswaUntukPromosi(
  kelasId: string
): Promise<ActionResponse> {
  try {
    await verifyGuruAksesKelas(kelasId)

    const kelas = await prisma.kelas.findUnique({
      where: { id: kelasId },
      include: { jenjang: true },
    })
    if (!kelas) {
      return { success: false, message: "Kelas tidak ditemukan" }
    }

    const urutanKelasSekarang = urutanNumerikKelas(kelas.nama)

    // Ambil semua kelas aktif di jenjang yang SAMA, urutkan berdasarkan urutan numerik
    const kelasSamaJenjang = await prisma.kelas.findMany({
      where: { jenjangId: kelas.jenjangId, aktif: true },
      select: {
        id: true,
        nama: true,
        kapasitas: true,
        jenisKelamin: true,
        _count: { select: { siswa: true } },
      },
    })
    kelasSamaJenjang.sort(
      (a, b) => urutanNumerikKelas(a.nama) - urutanNumerikKelas(b.nama)
    )

    // Kelas berikutnya dalam jenjang yang sama (urutan lebih tinggi dari kelas asal)
    const kelasBerikutnyaSamaJenjang = kelasSamaJenjang.filter(
      (k) => urutanNumerikKelas(k.nama) > urutanKelasSekarang
    )

    // Ambil semua siswa di kelas ini
    const siswaList = await prisma.siswa.findMany({
      where: { kelasId, deleted_at: null },
      include: {
        user: { select: { nama: true, email: true } },
      },
      orderBy: { user: { nama: "asc" } },
    })

    // Menentukan kelas tujuan:
    // - Masih ada kelas lebih tinggi di jenjang yang sama → NAIK_KELAS
    // - Tidak ada → siswa di kelas terakhir → LULUS ke jenjang berikutnya
    let targetKelas: Array<{
      id: string
      nama: string
      jenjang: string
      jenisKelamin: (typeof kelas)["jenisKelamin"]
      terisi: number
      kapasitas: number
      sisaKuota: number
    }> = []
    let jenisPromosi: "NAIK_KELAS" | "LULUS" | null = null
    let jenjangTujuan: { id: string; nama: string } | null = null

    if (kelasBerikutnyaSamaJenjang.length > 0) {
      jenisPromosi = "NAIK_KELAS"
      jenjangTujuan = { id: kelas.jenjang.id, nama: kelas.jenjang.nama }
      targetKelas = kelasBerikutnyaSamaJenjang.map((k) => ({
        id: k.id,
        nama: k.nama,
        jenjang: kelas.jenjang.nama,
        jenisKelamin: k.jenisKelamin,
        terisi: k._count.siswa,
        kapasitas: k.kapasitas,
        sisaKuota: k.kapasitas - k._count.siswa,
      }))
    } else {
      const jenjangBerikutnya = await prisma.jenjang.findFirst({
        where: { urutan: kelas.jenjang.urutan + 1, aktif: true },
        include: {
          kelas: {
            where: { aktif: true },
            orderBy: { nama: "asc" },
            select: {
              id: true,
              nama: true,
              kapasitas: true,
              jenisKelamin: true,
              _count: { select: { siswa: true } },
            },
          },
        },
      })
      if (jenjangBerikutnya) {
        jenisPromosi = "LULUS"
        jenjangTujuan = { id: jenjangBerikutnya.id, nama: jenjangBerikutnya.nama }
        const kelasLulus = [...jenjangBerikutnya.kelas].sort(
          (a, b) => urutanNumerikKelas(a.nama) - urutanNumerikKelas(b.nama)
        )
        targetKelas = kelasLulus.map((k) => ({
          id: k.id,
          nama: k.nama,
          jenjang: jenjangBerikutnya.nama,
          jenisKelamin: k.jenisKelamin,
          terisi: k._count.siswa,
          kapasitas: k.kapasitas,
          sisaKuota: k.kapasitas - k._count.siswa,
        }))
      }
    }

    // Format daftar siswa dengan rekomendasi kelas tujuan
    const formatted = siswaList.map((siswa) => {
      // Rekomendasi: kelas tujuan terdekat yang masih punya kuota &
      // kompatibel dengan jenis kelamin siswa (akhwat/ikhwan terpisah).
      // targetKelas sudah diurutkan dari kelas terdekat ke terjauh.
      let rekomendasiKelasId: string | null = null
      if (targetKelas.length > 0) {
        const kandidat = targetKelas.filter((k) => k.sisaKuota > 0)
        const kandidatGenderSama = kandidat.filter(
          (k) => !k.jenisKelamin || siswa.jenisKelamin === k.jenisKelamin
        )
        const rekomendasi = kandidatGenderSama[0] || kandidat[0] || null
        rekomendasiKelasId = rekomendasi?.id ?? null
      }

      return {
        siswaId: siswa.id,
        nama: siswa.user.nama,
        nisn: siswa.nisn,
        jenisKelamin: siswa.jenisKelamin,
        kelasAsal: kelas.nama,
        rekomendasiKelasId,
      }
    })

    return {
      success: true,
      message: "Daftar siswa untuk promosi berhasil dimuat",
      data: {
        kelasAsal: {
          id: kelas.id,
          nama: kelas.nama,
          jenjang: kelas.jenjang.nama,
          totalSiswa: siswaList.length,
        },
        jenisPromosi,
        jenjangTujuan,
        kelasTujuan: targetKelas,
        daftarSiswa: formatted,
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memuat data siswa untuk promosi"),
    }
  }
}

// ========================================================
// 3. GET RIWAYAT KELAS SISWA
// ========================================================

/**
 * Mengambil riwayat kelas siswa dari tabel RiwayatKelasSiswa.
 * Berguna untuk melihat rapor tahun-tahun sebelumnya meski siswa sudah pindah kelas.
 */
export async function getRiwayatKelasSiswa(
  siswaId: string
): Promise<ActionResponse> {
  try {
    // Batasi akses: hanya guru yang mengajar/menjadi wali di kelas siswa
    // (atau admin akademik) yang boleh melihat riwayat kelas siswa tersebut.
    const siswa = await prisma.siswa.findUnique({
      where: { id: siswaId, deleted_at: null },
      include: { kelas: { select: { id: true } } },
    })
    if (!siswa) {
      return { success: false, message: "Siswa tidak ditemukan" }
    }
    if (!siswa.kelasId) {
      await requireGuruAdmin()
    } else {
      await verifyGuruAksesKelas(siswa.kelasId)
    }

    const riwayatList = await prisma.riwayatKelasSiswa.findMany({
      where: { siswaId },
      include: {
        kelas: {
          include: {
            jenjang: { select: { nama: true } },
          },
        },
        kelasAsal: {
          include: {
            jenjang: { select: { nama: true } },
          },
        },
        periodeAjaran: {
          select: { nama: true, tahunAjaran: true, semester: true },
        },
      },
      orderBy: { periodeAjaran: { tahunAjaran: "desc" } },
    })

    const formatted = riwayatList.map((r) => ({
      id: r.id,
      periode: r.periodeAjaran.nama,
      tahunAjaran: r.periodeAjaran.tahunAjaran,
      semester: r.periodeAjaran.semester,
      kelasSekarang: `${r.kelas.jenjang.nama} - ${r.kelas.nama}`,
      kelasAsal: r.kelasAsal
        ? `${r.kelasAsal.jenjang.nama} - ${r.kelasAsal.nama}`
        : null,
      createdAt: r.createdAt,
    }))

    return {
      success: true,
      message: "Riwayat kelas siswa berhasil dimuat",
      data: formatted,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memuat riwayat kelas siswa"),
    }
  }
}
