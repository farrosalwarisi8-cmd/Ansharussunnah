// scripts/verifikasi-promosi.ts — read-only: verifikasi logika getSiswaUntukPromosi terhadap data live
import { PrismaClient } from "@prisma/client"
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL || process.env.DIRECT_URL } },
})

function urutanNumerikKelas(nama: string): number {
  const match = nama.match(/(\d+)/)
  return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER
}

// Reproduksi persis logika di src/actions/kenaikan-kelas.ts:getSiswaUntukPromosi
interface HasilPromosi {
  error?: string
  kelasAsal?: string
  jenisPromosi?: string | null
  jenjangTujuan?: string | null
  kelasTujuan?: Array<{ nama: string; terisi: number; sisa: number }>
  rekomendasi?: string | null
}

async function hitungPromosi(kelasId: string): Promise<HasilPromosi> {
  const kelas = await prisma.kelas.findUnique({
    where: { id: kelasId },
    include: { jenjang: true },
  })
  if (!kelas) return { error: "Kelas tidak ditemukan" }

  const urutanKelasSekarang = urutanNumerikKelas(kelas.nama)
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
  const kelasBerikutnyaSamaJenjang = kelasSamaJenjang.filter(
    (k) => urutanNumerikKelas(k.nama) > urutanKelasSekarang
  )

  const siswaList = await prisma.siswa.findMany({
    where: { kelasId, deleted_at: null },
    include: { user: { select: { nama: true } } },
    orderBy: { user: { nama: "asc" } },
  })

  let jenisPromosi: "NAIK_KELAS" | "LULUS" | null = null
  let jenjangNamaTujuan: string | null = null
  let targetKelas: Array<{ nama: string; terisi: number; sisa: number }> = []
  let rekomendasiKelasId: string | null = null

  if (kelasBerikutnyaSamaJenjang.length > 0) {
    jenisPromosi = "NAIK_KELAS"
    jenjangNamaTujuan = kelas.jenjang.nama
    targetKelas = kelasBerikutnyaSamaJenjang.map((k) => ({
      nama: k.nama,
      terisi: k._count.siswa,
      sisa: k.kapasitas - k._count.siswa,
    }))
    if (siswaList[0]) {
      const s = siswaList[0]
      const kandidat = targetKelas.filter((k) => k.sisa > 0)
      const kandidatGenderSama = kelasBerikutnyaSamaJenjang.filter(
        (k) => !k.jenisKelamin || s.jenisKelamin === k.jenisKelamin
      )
      const rek = kandidatGenderSama.find((k) => k.kapasitas - k._count.siswa > 0)
      rekomendasiKelasId = rek?.id || null
    }
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
      jenjangNamaTujuan = jenjangBerikutnya.nama
      const kelasLulus = [...jenjangBerikutnya.kelas].sort(
        (a, b) => urutanNumerikKelas(a.nama) - urutanNumerikKelas(b.nama)
      )
      targetKelas = kelasLulus.map((k) => ({
        nama: k.nama,
        terisi: k._count.siswa,
        sisa: k.kapasitas - k._count.siswa,
      }))
      if (siswaList[0]) {
        const s = siswaList[0]
        const kandidat = kelasLulus.filter((k) => k.kapasitas - k._count.siswa > 0)
        const kandidatGenderSama = kandidat.filter(
          (k) => !k.jenisKelamin || s.jenisKelamin === k.jenisKelamin
        )
        rekomendasiKelasId = kandidatGenderSama[0]?.id || kandidat[0]?.id || null
      }
    }
  }

  const namaRekomendasi = rekomendasiKelasId
    ? (await prisma.kelas.findUnique({ where: { id: rekomendasiKelasId }, select: { nama: true } }))?.nama ?? null
    : null

  return {
    kelasAsal: `${kelas.jenjang.nama} - ${kelas.nama} (${siswaList.length} siswa)`,
    jenisPromosi,
    jenjangTujuan: jenjangNamaTujuan,
    kelasTujuan: targetKelas,
    rekomendasi: namaRekomendasi,
  }
}

async function main() {
  console.log("=== VERIFIKASI LOGIKA PROMOSI (data live) ===\n")

  const kelasSemua = await prisma.kelas.findMany({
    where: { aktif: true },
    select: { id: true, nama: true, jenjang: { select: { nama: true, urutan: true } } },
    orderBy: [{ jenjang: { urutan: "asc" } }, { nama: "asc" }],
  })

  for (const k of kelasSemua) {
    const r = await hitungPromosi(k.id)
    if (r.error) {
      console.log(`  [ERROR] ${k.jenjang.nama} - ${k.nama}: ${r.error}`)
      continue
    }
    const tujuan = (r.kelasTujuan ?? []).length
      ? (r.kelasTujuan ?? []).map((t) => `${t.nama} (${t.sisa} slot)`).join(", ")
      : "— (jenjang tertinggi)"
    console.log(`  ${r.kelasAsal}`)
    console.log(`    jenisPromosi : ${r.jenisPromosi}${r.jenisPromosi ? ` → ${r.jenjangTujuan}` : ""}`)
    console.log(`    kelasTujuan  : ${tujuan}`)
    console.log(`    rekomendasi  : ${r.rekomendasi ?? "-"}`)
  }
}

main().finally(() => prisma.$disconnect())