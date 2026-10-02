import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  for (const email of ["lombakuy12@gmail.com", "farrosalwarisi8@gmail.com"]) {
    const u = await prisma.user.findFirst({ where: { email } });
    console.log(
      email,
      "->",
      u
        ? `ADA id=${u.id} authId=${u.authId} nama=${u.nama} role=${u.role} aktif=${u.aktif}`
        : "TIDAK ADA"
    );
  }
  console.log("buktiTransferPendaftaran rows:", await prisma.buktiTransferPendaftaran.count());
  console.log("pendaftaran rows:", await prisma.pendaftaran.count());
  console.log("siswa rows:", await prisma.siswa.count());
  console.log("orang_tua rows:", await prisma.orangTua.count());
  console.log("parentStudent rows:", await prisma.parentStudent.count());
  await prisma.$disconnect();
}

main();
