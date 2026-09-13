// scripts/diag-promosi.ts — read-only: cek state siswa & riwayat kelas setelah promosi
import { PrismaClient } from "@prisma/client"
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL || process.env.DIRECT_URL } },
})

async function main() {
  console.log("=== KELAS ===")
  const kelas = await prisma.kelas.findMany({
    select: {
      id: true,
      nama: true,
      aktif: true,
      jenjang: { select: { nama: true, urutan: true } },
      _count: { select: { siswa: true } },
    },
    orderBy: [{ jenjang: { urutan: "asc" } }, { nama: "asc" }],
  })
  for (const k of kelas)
    console.log(
      `  ${k.id} | ${k.jenjang.nama} (urutan ${k.jenjang.urutan}) | ${k.nama} | aktif=${k.aktif} | siswa=${k._count.siswa}`
    )

  console.log("\n=== SISWA TANPA KELAS (kelasId null), tidak soft-deleted ===")
  const noClass = await prisma.siswa.findMany({
    where: { kelasId: null, deleted_at: null },
    select: { id: true, nisn: true, user: { select: { nama: true, aktif: true } } },
    orderBy: { user: { nama: "asc" } },
  })
  for (const s of noClass)
    console.log(`  ${s.id} | ${s.user.nama} | nisn=${s.nisn} | userAktif=${s.user.aktif}`)

  console.log("\n=== SISWA SOFT-DELETED (deleted_at NON null) ===")
  const softDeleted = await prisma.siswa.findMany({
    where: { deleted_at: { not: null } },
    select: { id: true, kelasId: true, user: { select: { nama: true } } },
    take: 20,
  })
  for (const s of softDeleted)
    console.log(`  ${s.id} | ${s.user.nama} | kelasId=${s.kelasId}`)

  console.log("\n=== RIWAYAT KELAS SISWA (semua) ===")
  const riwayat = await prisma.riwayatKelasSiswa.findMany({
    select: {
      id: true,
      siswaId: true,
      kelasId: true,
      kelasAsalId: true,
      periodeAjaranId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  })
  for (const r of riwayat)
    console.log(
      `  ${r.id} | siswa=${r.siswaId} | kelasBaru=${r.kelasId} | asal=${r.kelasAsalId} | periode=${r.periodeAjaranId} | ${r.createdAt.toISOString()}`
    )

  console.log("\n=== PERIODE AJARAN ===")
  const periodes = await prisma.periodeAjaran.findMany({
    select: { id: true, nama: true, tahunAjaran: true, semester: true, aktif: true },
    orderBy: { createdAt: "asc" },
  })
  for (const p of periodes)
    console.log(`  ${p.id} | ${p.nama} | ${p.tahunAjaran} ${p.semester} | aktif=${p.aktif}`)
}

main().finally(() => prisma.$disconnect())