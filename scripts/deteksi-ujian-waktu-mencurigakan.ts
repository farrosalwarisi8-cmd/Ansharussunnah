/**
 * scripts/deteksi-ujian-waktu-mencurigakan.ts
 *
 * Diagnostik READ-ONLY untuk mendeteksi ujian (PUBLISHED/SELESAI) yang
 * waktunya diduga tergeser oleh bug pre-fill input datetime-local.
 *
 * PENTING — SEMANTIK KOLOM WAKTU:
 * Sejak migrasi 20260910120000_make_timestamps_timestamptz, semua kolom
 * Prisma `DateTime` adalah `timestamp WITH time zone`. Nilai tersimpan sebagai
 * instant absolut (UTC); UI (zona WIB) menampilkannya via AT TIME ZONE 'Asia/Jakarta'.
 *
 * Jadi waktu yang benar-benar terlihat pengguna = `waktu_* AT TIME ZONE 'Asia/Jakarta'`
 * (tanpa bungkus AT TIME ZONE 'UTC' — hemat saja untuk kolom naive pra-migrasi).
 *
 * LATAR BELAKANG BUG:
 * Sebelumnya pre-fill edit memakai `new Date(...).toISOString().slice(0, 16)`
 * (UTC) padahal input datetime-local mengharapkan waktu LOKAL. Contoh: ujian
 * yang seharusnya 12:26 WIB tersimpan naive 05:26. Saat diedit, dialog lama
 * menampilkan "05:26" (bukan 12:26); jika guru menyimpan tanpa menyadarinya,
 * waktu tampil bergeser mundur 7 jam, dan berulang setiap edit.
 *
 * DETEKSI:
 *   1. Hitung waktu TAMPIL (WIB) setiap ujian via formula di atas.
 *   2. Beri tanda ⚠️ bila jam tampil mulai < 06:00 WIB atau selesai >= 22:00 WIB
 *      (jam tak realistis untuk ujian sekolah) — indikasi data tergeser.
 *   3. Untuk yang ditandai, tampilkan estimasi waktu asli (+7 jam dari waktu
 *      tampil saat ini) sebagai pertimbangan koreksi manual.
 *
 * CATATAN: Script ini TIDAK mengubah data. Koreksi hanya via UI edit (sesuaikan
 * jam) atau update DB secara sadar setelah dikonfirmasi.
 *
 * CARA JALANKAN:
 *   npx tsx scripts/deteksi-ujian-waktu-mencurigakan.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const WIB = "Asia/Jakarta"

type UjianRow = {
  id: string
  judul: string
  status: string
  kelas: string
  mapel: string
  pembuat: string | null
  pembuatEmail: string
  tampilMulai: string // teks "YYYY-MM-DD HH24:MI" (waktu tampil WIB)
  tampilSelesai: string
  jamTampilMulai: number
  jamTampilSelesai: number
  durasiMenit: number
}

function isMencurigakan(r: UjianRow): boolean {
  return r.jamTampilMulai < 6 || r.jamTampilSelesai >= 22
}

function estimasiTergeser7(tampil: string): string {
  // tampil = "YYYY-MM-DD HH:mm" waktu tampil WIB. Interpretasikan sebagai
  // instant (WIB), lalu +7 jam untuk memperkirakan waktu asli.
  const d = new Date(`${tampil.replace(" ", "T")}:00+07:00`)
  const shifted = new Date(d.getTime() + 7 * 3600 * 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())} ${pad(shifted.getHours())}:${pad(shifted.getMinutes())}`
}

async function main() {
  console.log("================= UJIAN PUBLISHED / SELESAI (waktu TAMPIL WIB) =================")
  console.log("Formula: waktu_* AT TIME ZONE 'Asia/Jakarta' (kolom kini timestamptz) — sesuai yang dilihat UI.\n")

  const rows: UjianRow[] = await prisma.$queryRaw`
    SELECT
      u.id,
      u.judul,
      u.status,
      k.nama  AS kelas,
      mp.nama AS mapel,
      usr.nama AS pembuat,
      usr.email AS "pembuatEmail",
      to_char(u.waktu_mulai AT TIME ZONE ${WIB}::text, 'YYYY-MM-DD HH24:MI') AS "tampilMulai",
      to_char(u.waktu_selesai AT TIME ZONE ${WIB}::text, 'YYYY-MM-DD HH24:MI') AS "tampilSelesai",
      EXTRACT(HOUR FROM (u.waktu_mulai AT TIME ZONE ${WIB}::text))::int AS "jamTampilMulai",
      EXTRACT(HOUR FROM (u.waktu_selesai AT TIME ZONE ${WIB}::text))::int AS "jamTampilSelesai",
      u.durasi_menit AS "durasiMenit"
    FROM ujians u
    JOIN kelas k ON k.id = u.kelas_id
    JOIN mata_pelajarans mp ON mp.id = u.mata_pelajaran_id
    JOIN users usr ON usr.id = u.dibuat_oleh_id
    WHERE u.status IN ('PUBLISHED', 'SELESAI')
    ORDER BY u.waktu_mulai;
  `

  console.log(`Total ujian terpublikasi/selesai: ${rows.length}\n`)

  if (rows.length === 0) return

  const mencurigakan = rows.filter(isMencurigakan)

  for (const r of rows) {
    const flag = isMencurigakan(r) ? "⚠️  " : "   "
    console.log(`${flag}[${r.status}] ${r.judul}`)
    if (isMencurigakan(r)) {
      console.log(`      Kelas: ${r.kelas} | Mapel: ${r.mapel} | Durasi: ${r.durasiMenit} menit`)
      console.log(`      Pembuat: ${r.pembuat ?? "-"} (${r.pembuatEmail})`)
      console.log(`      TAMPIL: mulai ${r.tampilMulai} WIB | selesai ${r.tampilSelesai} WIB`)
      console.log(`      ⚠️  Estimasi waktu asli (bila tergeser 7 jam): mulai ${estimasiTergeser7(r.tampilMulai)} | selesai ${estimasiTergeser7(r.tampilSelesai)}`)
    } else {
      console.log(`      Waktu tampil: mulai ${r.tampilMulai} WIB | selesai ${r.tampilSelesai} WIB`)
    }
    console.log("")
  }

  console.log("================= KESIMPULAN =================")
  if (mencurigakan.length === 0) {
    console.log("✅ TIDAK ada ujian pada jam mencurigakan (mulai tampil < 06:00 WIB atau selesai >= 22:00 WIB).")
    console.log("   Semua waktu tampil wajar untuk jam sekolah; tidak ada data yang perlu dikoreksi.")
  } else {
    console.log(`⚠️  DITEMUKAN ${mencurigakan.length} ujian pada jam mencurigakan:`)
    for (const r of mencurigakan) {
      console.log(`   - ${r.judul} (mulai ${r.tampilMulai} WIB, selesai ${r.tampilSelesai} WIB) — dibuat oleh ${r.pembuat ?? "-"} (${r.pembuatEmail})`)
    }
    console.log("\n   Kemungkinan data tergeser oleh bug pre-fill UTC (-7 jam per edit untuk WIB).")
    console.log("   Koreksi manual: buka fitur edit ujian di dashboard dan sesuaikan jam, atau update DB")
    console.log("   (tambahkan 7 jam pada jam tampil) setelah dikonfirmasi.")
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Gagal menjalankan diagnostik:", e)
    prisma.$disconnect()
    process.exit(1)
  })