// scripts/cek-kelas-gender.mjs
// Cek READ-ONLY: pastikan setiap jenjang punya kelas untuk laki-laki (Ikhwan)
// dan perempuan (Akhwat) — campuran (NULL) bisa dipakai kedua gender.
// Cara pakai: node scripts/cek-kelas-gender.mjs
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const jenjangs = await prisma.jenjang.findMany({
  where: { aktif: true },
  orderBy: { urutan: "asc" },
  include: {
    kelas: {
      where: { aktif: true },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true, kapasitas: true, jenisKelamin: true, _count: { select: { siswa: true } } },
    },
  },
})

console.log("=== CEK KELAS PER JENJANG (gender coverage) ===\n")
let adaMasalah = false

for (const j of jenjangs) {
  const kelas = j.kelas
  const punyaIkhwan = kelas.some((k) => k.jenisKelamin === "LAKI_LAKI")
  const punyaAkhwat = kelas.some((k) => k.jenisKelamin === "PEREMPUAN")
  const punyaCampuran = kelas.some((k) => k.jenisKelamin === null)

  const bisaLaki = punyaIkhwan || punyaCampuran
  const bisaPerempuan = punyaAkhwat || punyaCampuran

  console.log(`\n[${j.urutan}] ${j.nama} (${kelas.length} kelas)`)
  for (const k of kelas) {
    const label =
      k.jenisKelamin === "LAKI_LAKI" ? "Ikhwan" : k.jenisKelamin === "PEREMPUAN" ? "Akhwat" : "Campuran"
    console.log(`   - ${k.nama.padEnd(14)} ${label.padEnd(9)} kapasitas ${k.kapasitas} | siswa ${k._count.siswa}`)
  }

  if (kelas.length === 0) {
    console.log("   ⚠️  TIDAK ADA KELAS — calon siswa tidak bisa memilih apa pun di jenjang ini!")
    adaMasalah = true
  } else {
    if (!bisaLaki) {
      console.log("   ⚠️  TIDAK ADA kelas untuk LAKI-LAKI (Ikhwan) di jenjang ini!")
      adaMasalah = true
    }
    if (!bisaPerempuan) {
      console.log("   ⚠️  TIDAK ADA kelas untuk PEREMPUAN (Akhwat) di jenjang ini!")
      adaMasalah = true
    }
  }
}

console.log("\n================================================")
console.log(
  adaMasalah
    ? "⚠️  DITEMUKAN MASALAH: ada jenjang yang tidak bisa menerima salah satu (atau kedua) gender."
    : "✅ OK: semua jenjang punya kelas yang bisa menampung laki-laki DAN perempuan."
)
await prisma.$disconnect()