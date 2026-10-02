import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EIGHT = [
  "ukasya.abdullah.@sekolah.internal",
  "roihan.abdullah@sekolah.internal",
  "gerai.ahmad2015@gmail.com",
  "ahmad.al.ghifari@sekolah.internal",
  "abdurrohman.harist@sekolah.internal",
  "muhammad.nashiruddin@sekolah.internal",
  "cemet12155@gmai.com",
  "muqbil.hadi@sekolah.internal",
];

async function main() {
  console.log("=== 8 akun yang dibuat hari ini (2026-10-02) ===\n");
  for (const email of EIGHT) {
    const u = await prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        nama: true,
        role: true,
        authId: true,
        aktif: true,
        mustChangePassword: true,
        lastPasswordChange: true,
        createdAt: true,
      },
    });
    if (!u) {
      console.log(`${email}: ❌ TIDAK ADA di public.users`);
      continue;
    }
    console.log(
      `${email}\n  public id=${u.id} authId=${u.authId} nama=${u.nama} role=${u.role} aktif=${u.aktif} mustChange=${u.mustChangePassword} lastPwChange=${u.lastPasswordChange ?? "-"} createdAt=${u.createdAt?.toISOString()}`
    );
    if (u.role === "SISWA") {
      const s = await prisma.siswa.findUnique({ where: { userId: u.id } }).catch(() => null);
      console.log(`  siswa record: ${s ? "ADA" : "❌ TIDAK ADA"}`);
    }
    if (u.role === "ORANG_TUA") {
      const o = await prisma.orangTua.findUnique({ where: { userId: u.id } }).catch(() => null);
      console.log(`  orang_tua record: ${o ? "ADA" : "❌ TIDAK ADA"}`);
    }
  }

  // distribusi created_at public.users hari ini
  console.log("\n=== public.users dibuat hari ini ===");
  const today = await prisma.user.findMany({
    where: { createdAt: { gte: new Date("2026-10-02T00:00:00Z") } },
    select: { email: true, nama: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  for (const u of today) {
    console.log(`  ${u.createdAt.toISOString()} | ${u.email} | ${u.nama} | ${u.role}`);
  }
  console.log(`total: ${today.length}`);

  await prisma.$disconnect();
}

main();
