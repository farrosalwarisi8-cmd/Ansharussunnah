// scripts/cek-akun-uji.ts — read-only: list test accounts & tugas/materi sample data
import { PrismaClient } from "@prisma/client"
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL || process.env.DIRECT_URL } },
})

async function main() {
  console.log("=== USERS (email | role | mustChangePassword) ===")
  const users = await prisma.user.findMany({
    select: { email: true, role: true, mustChangePassword: true, siswa: { select: { id: true, kelasId: true } } },
    orderBy: { role: "asc" },
  })
  for (const u of users) console.log(`  ${u.email} | ${u.role} | mustChange=${u.mustChangePassword}${u.siswa ? ` | siswa=${u.siswa.id} kelas=${u.siswa.kelasId}` : ""}`)

  console.log("\n=== TUGAS TERAKHIR (5) ===")
  const tugas = await prisma.tugas.findMany({ take: 5, orderBy: { createdAt: "desc" }, select: { id: true, judul: true, kelasId: true, deadline: true, lampiranUrl: true } })
  for (const t of tugas) console.log(`  ${t.id} | ${t.judul} | kelas=${t.kelasId} | lampiran=${t.lampiranUrl ?? "-"}`)

  console.log("\n=== PENGUMPULAN TERAKHIR (5) ===")
  const peng = await prisma.pengumpulanTugas.findMany({ take: 5, orderBy: { waktuKumpul: "desc" }, select: { id: true, tugasId: true, siswaId: true, urlFile: true, namaFile: true, status: true } })
  for (const p of peng) console.log(`  ${p.id} | tugas=${p.tugasId} | siswa=${p.siswaId} | urlFile=${p.urlFile}`)

  console.log("\n=== MATERI TERAKHIR (5) ===")
  const materi = await prisma.materiPembelajaran.findMany({ take: 5, orderBy: { createdAt: "desc" }, select: { id: true, judul: true, kelasId: true, urlFile: true, urlLink: true } })
  for (const m of materi) console.log(`  ${m.id} | ${m.judul} | kelas=${m.kelasId} | urlFile=${m.urlFile ?? "-"} | urlLink=${m.urlLink ?? "-"}`)
}

main().finally(() => prisma.$disconnect())
