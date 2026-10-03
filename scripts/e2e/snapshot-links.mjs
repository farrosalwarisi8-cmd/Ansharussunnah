// snapshot-links.mjs — simpan seluruh relasi parent_students ke JSON (read-only).
// Dipakai sebelum & sesudah uji end-to-end supaya baris yang DIBUAT uji bisa
// dikembalikan persis (hanya baris uji yang dihapus; data asli tak tersentuh).
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const outFile = process.argv[2] || ".tmp-e2e/links-before.json"

const links = await prisma.parentStudent.findMany({
  select: { id: true, orangTuaId: true, siswaId: true, hubungan: true },
  orderBy: { id: "asc" },
})

const fs = await import("node:fs")
fs.mkdirSync(".tmp-e2e", { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(links, null, 2))

console.log(`${links.length} relasi disimpan ke ${outFile}`)
await prisma.$disconnect()
