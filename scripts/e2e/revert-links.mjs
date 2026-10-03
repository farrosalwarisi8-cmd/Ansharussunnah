// revert-links.mjs — hapus HANYA relasi parent_students yang dibuat oleh uji
// end-to-end (baris yang ada di sesudah.json tapi tidak ada di sebelum.json).
// Relasi yang sudah ada sebelum uji tidak pernah disentuh.
import { PrismaClient } from "@prisma/client"
import fs from "node:fs"

const prisma = new PrismaClient()
const before = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"))
const after = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"))

const beforeIds = new Set(before.map((l) => l.id))
const dibuatUji = after.filter((l) => !beforeIds.has(l.id))

if (dibuatUji.length === 0) {
  console.log("Tidak ada relasi baru dari uji — tidak ada yang dihapus.")
} else {
  for (const l of dibuatUji) {
    await prisma.parentStudent.delete({ where: { id: l.id } })
    console.log(`Dihapus (relasi uji): ${l.id} ortu=${l.orangTuaId} siswa=${l.siswaId}`)
  }
}

const sisa = await prisma.parentStudent.count()
console.log(`Relasi tersisa: ${sisa} (sebelum uji: ${before.length})`)
await prisma.$disconnect()
