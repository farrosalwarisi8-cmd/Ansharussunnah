// scripts/tambah-kelas-5-mi.mjs
// Menambahkan "Kelas 5" yang hilang pada jenjang Madrasah Ibtidaiyyah (idempotent).
// Skrip meniru pola pembuatan kelas di seed: kapasitas 30, aktif, campuran (NULL),
// sesuai struktur kelas lain di jenjang yang sama.
//
// Cara pakai:
//   node scripts/tambah-kelas-5-mi.mjs          # mode kering (hanya laporan)
//   node scripts/tambah-kelas-5-mi.mjs --apply  # benar-benar menambahkan ke DB
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const JENJANG_NAMA = "Madrasah Ibtidaiyyah"
const KELAS_NAMA = "Kelas 5"
const KAPASITAS = 30

const apply = process.argv.includes("--apply")

const jenjang = await prisma.jenjang.findUnique({
  where: { nama: JENJANG_NAMA },
  include: {
    kelas: {
      where: { aktif: true },
      select: { id: true, nama: true, kapasitas: true, jenisKelamin: true },
      orderBy: { nama: "asc" },
    },
  },
})

if (!jenjang) {
  console.error(`⚠️  Jenjang "${JENJANG_NAMA}" tidak ditemukan.`)
  process.exit(1)
}

console.log(`Jenjang ditemukan: ${jenjang.nama} (${jenjang.kelas.length} kelas aktif)`)
console.log("Kelas saat ini:", jenjang.kelas.map((k) => k.nama).join(", ") || "(kosong)")

const sudahAda = jenjang.kelas.some((k) => k.nama === KELAS_NAMA)

if (sudahAda) {
  console.log(`\n✅ "${KELAS_NAMA}" SUDAH ADA. Tidak ada yang perlu dilakukan.`)
  process.exit(0)
}

if (!apply) {
  console.log(
    `\nℹ️  MODE KERING (--apply tidak dipakai): "${KELAS_NAMA}" akan ditambahkan dengan ` +
      `kapasitas ${KAPASITAS}, aktif, jenis kelamin Campuran.`
  )
  console.log("Jalankan:  node scripts/tambah-kelas-5-mi.mjs --apply")
  process.exit(0)
}

const kelasBaru = await prisma.kelas.create({
  data: {
    nama: KELAS_NAMA,
    jenjangId: jenjang.id,
    kapasitas: KAPASITAS,
    aktif: true,
    jenisKelamin: null, // Campuran — menerima ikhwan & akhwat
  },
})

console.log(`\n✅ "${KELAS_NAMA}" berhasil ditambahkan ke ${jenjang.nama} (id: ${kelasBaru.id})`)
console.log("Kelas sekarang:", (
  await prisma.kelas.findMany({
    where: { jenjangId: jenjang.id, aktif: true },
    select: { nama: true },
    orderBy: { nama: "asc" },
  })
).map((k) => k.nama).join(", "))

await prisma.$disconnect()