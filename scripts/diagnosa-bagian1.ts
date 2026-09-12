// scripts/diagnosa-bagian1.ts — READ-ONLY diagnosis Bagian 1.
// Memeriksa:
//   1. Jumlah Jenjang aktif vs non-aktif
//   2. Akun User role GURU (isAdmin) + relasi Guru/GuruKelas
//   3. Simulasi filter getStrukturKelasSiswaAkademik untuk admin-guru vs guru biasa
import { PrismaClient } from "@prisma/client"
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
})

async function main() {
  console.log("=== 1. JENJANG (aktif) ===")
  const jenjangAktif = await prisma.jenjang.count({ where: { aktif: true } })
  const jenjangNonAktif = await prisma.jenjang.count({ where: { aktif: false } })
  const jenjangs = await prisma.jenjang.findMany({ orderBy: { urutan: "asc" } })
  console.log(`  Total jenjang:               ${jenjangAktif + jenjangNonAktif}`)
  console.log(`  Jenjang aktif = true:        ${jenjangAktif}`)
  console.log(`  Jenjang aktif = false:       ${jenjangNonAktif}`)
  for (const j of jenjangs) {
    const kls = await prisma.kelas.count({ where: { jenjangId: j.id } })
    const klsAktif = await prisma.kelas.count({ where: { jenjangId: j.id, aktif: true } })
    console.log(`    - [${j.aktif ? "aktif" : "NON-AKTIF"}] ${j.nama} | urutan=${j.urutan} | kelas=${kls} (aktif ${klsAktif})`)
  }

  console.log("\n=== 2. AKUN USER ROLE GURU (+ isAdmin) ===")
  const guruUsers = await prisma.user.findMany({
    where: { role: "GURU", deleted_at: null, aktif: true },
    include: {
      guru: {
        include: { mengajar: { select: { kelasId: true, mataPelajaranId: true } } },
      },
    },
    orderBy: { email: "asc" },
  })
  console.log(`  Total akun GURU aktif: ${guruUsers.length}`)
  for (const u of guruUsers) {
    const wali = u.guru ? await prisma.kelas.findMany({ where: { waliKelasId: u.guru.id }, select: { id: true, nama: true } }) : []
    const kelasDiajar = new Set(u.guru?.mengajar.map((m) => m.kelasId) ?? [])
    console.log(`  - ${u.email} | nama=${u.nama} | isAdmin=${u.isAdmin} | guru=${u.guru?.id ?? "-"} | walikelas=${wali.map((w) => w.nama).join(",") || "-"} | kelasDiajar=${kelasDiajar.size}`)
  }

  console.log("\n=== 3. SISWA TANPA KELAS / KELAS NON-AKTIF (judul: log konteks) ===")
  const siswaNoKelas = await prisma.siswa.count({ where: { deleted_at: null, OR: [{ kelasId: null }, { kelas: { aktif: false } }] } })
  console.log(`  Siswa tanpa kelas / kelas non-aktif: ${siswaNoKelas}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Gagal:", e)
    prisma.$disconnect()
    process.exit(1)
  })