import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TARGETS = [
  { id: "4af6897d-bb52-4402-9c2a-0a2e8f82cb4e", label: "SISWA REG-2026-00011-3J33 (pagos amba ganteng)" },
  { id: "5cc6c6d8-902a-4a96-bbb5-12322c8a5df6", label: "SISWA REG-2026-00001-4JC3 (faros)" },
  { id: "377a8083-c95a-4240-85d2-ca8b2aa5f7e4", label: "SISWA REG-2026-00005-W7BQ (faros)" },
  { id: "lombakuy12@gmail.com", label: "ORANG_TUA REG-2026-00001-4JC3 (salim)" },
  { id: "farrosalwarisi8@gmail.com", label: "ORANG_TUA REG-2026-00005-W7BQ (asep)" },
];

async function main() {
  for (const t of TARGETS) {
    const byId = await prisma.user.findUnique({ where: { id: t.id } });
    const byEmail = await prisma.user.findFirst({ where: { email: t.id } });
    const row = byId ?? byEmail;
    console.log(`\n${t.label}`);
    if (!row) {
      console.log("  ❌ TIDAK ADA baris di public.users");
      continue;
    }
    console.log(`  ✅ public.users: id=${row.id} email=${row.email} nama=${row.nama} role=${row.role} createdAt=${row.createdAt?.toISOString()}`);
    // cek apakah ada siswa/orang_tua terkait
    if (row.role === "SISWA") {
      const siswa = await prisma.siswa.findUnique({ where: { userId: row.id } }).catch(() => null);
      console.log(`  siswa record: ${siswa ? "ADA" : "TIDAK ADA (tabel siswa kosong)"}`);
    }
    if (row.role === "ORANG_TUA") {
      const ortu = await prisma.orangTua.findUnique({ where: { userId: row.id } }).catch(() => null);
      console.log(`  orang_tua record: ${ortu ? "ADA" : "TIDAK ADA (tabel orang_tuas kosong)"}`);
    }
    // pendaftaran terkait (seharusnya tidak ada — tabel kosong)
    const pend = await prisma.pendaftaran.findMany({ where: { emailOrangTua: row.email } });
    console.log(`  pendaftaran dengan email ini: ${pend.length}`);
  }

  // cek tabel bukti transfer pendaftaran
  const bkti = await prisma.buktiTransferPendaftaran.findMany();
  console.log(`\n=== buktiTransferPendaftaran: ${bkti.length} baris ===`);
  for (const b of bkti) {
    console.log(JSON.stringify(b));
  }

  const pendCount = await prisma.pendaftaran.count();
  console.log(`\npendaftaran total: ${pendCount}`);
  await prisma.$disconnect();
}

main();
