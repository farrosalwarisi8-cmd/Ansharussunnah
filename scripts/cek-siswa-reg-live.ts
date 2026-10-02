import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.user.count();
  console.log(`public.users total: ${total}`);

  const byRole = await prisma.user.groupBy({ by: ["role"], _count: { _all: true } });
  for (const r of byRole) console.log(`  ${r.role}: ${r._count._all}`);

  const regUsers = await prisma.user.findMany({
    where: { email: { contains: "siswa.reg" } },
    select: { id: true, email: true, nama: true, role: true, authId: true, aktif: true, mustChangePassword: true, createdAt: true },
  });
  console.log(`\npublic.users dengan email mengandung "siswa.reg": ${regUsers.length}`);
  for (const u of regUsers) {
    console.log(`  id=${u.id} authId=${u.authId} email=${u.email} nama=${u.nama} role=${u.role} aktif=${u.aktif} mustChange=${u.mustChangePassword} created=${u.createdAt?.toISOString()}`);
  }

  // cek berdasarkan authId langsung (UUID auth)
  const authIds = [
    "4af6897d-bb52-4402-9c2a-0a2e8f82cb4e",
    "5cc6c6d8-902a-4a96-bbb5-12322c8a5df6",
    "377a8083-c95a-4240-85d2-ca8b2aa5f7e4",
  ];
  for (const aid of authIds) {
    const u = await prisma.user.findFirst({ where: { authId: aid } });
    console.log(`\nauthId ${aid} → ${u ? `public id=${u.id} email=${u.email} nama=${u.nama} role=${u.role}` : "TIDAK DITEMUKAN"}`);
  }

  await prisma.$disconnect();
}

main();
