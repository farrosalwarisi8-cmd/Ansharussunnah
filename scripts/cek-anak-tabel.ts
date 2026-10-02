import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [siswa, orangTua, parentStudent, users, pendaftaran, bukti] =
    await Promise.all([
      prisma.siswa.count(),
      prisma.orangTua.count(),
      prisma.parentStudent.count(),
      prisma.user.count(),
      prisma.pendaftaran.count(),
      prisma.buktiTransferPendaftaran.count(),
    ]);

  console.log("=== Jumlah baris tabel (live) ===");
  console.log(`public.users:        ${users}`);
  console.log(`siswa:               ${siswa}`);
  console.log(`orang_tua:           ${orangTua}`);
  console.log(`parent_student:      ${parentStudent}`);
  console.log(`pendaftaran:         ${pendaftaran}`);
  console.log(`bukti_transfer:      ${bukti}`);

  // role distribution
  const roles = ["SUPER_ADMIN", "ADMIN_AKADEMIK", "ADMIN_KEUANGAN", "GURU", "SISWA", "ORANG_TUA"];
  console.log("\n=== Distribusi role public.users ===");
  for (const role of roles) {
    const n = await prisma.user.count({ where: { role: role as never } });
    if (n > 0) console.log(`${role}: ${n}`);
  }

  await prisma.$disconnect();
}

main();
