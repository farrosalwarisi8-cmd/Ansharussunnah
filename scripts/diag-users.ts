// scripts/diag-users.ts
// Diagnostic: kondisi akun user yang memengaruhi render dashboard.
// - user.aktif = false → loadUserRecord() THROW AppError → error boundary
//   di SEMUA halaman dashboard (layout memanggil getCurrentUser()).
// - mustChangePassword = true → redirect ke /ganti-password (bukan error).
import prisma from "../src/lib/prisma";

async function main() {
  const total = await prisma.user.count();
  const inactive = await prisma.user.findMany({
    where: { aktif: false, deleted_at: null },
    select: { id: true, nama: true, email: true, role: true, username: true },
  });
  const mustChange = await prisma.user.findMany({
    where: { mustChangePassword: true, deleted_at: null },
    select: { id: true, nama: true, email: true, role: true },
  });
  const byRole = await prisma.user.groupBy({
    by: ["role"],
    _count: { _all: true },
  });
  const sample = await prisma.user.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      isAdmin: true,
      aktif: true,
      mustChangePassword: true,
    },
    take: 20,
  });

  console.log(JSON.stringify({
    totalUsers: total,
    inactiveAccounts: inactive,
    mustChangePassword: mustChange,
    roleDistribution: byRole,
    sample,
  }, null, 2));
}

main()
  .catch((e) => {
    console.error("DIAG_ERROR:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
