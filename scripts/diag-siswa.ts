import prisma from "../src/lib/prisma";

async function main() {
  const totalSiswa = await prisma.siswa.count();
  const siswaAktif = await prisma.siswa.count({ where: { deleted_at: null } });
  const siswaSoftDeleted = await prisma.siswa.count({ where: { deleted_at: { not: null } } });

  const userSiswa = await prisma.user.count({ where: { role: "SISWA" } });
  const userSiswaTanpaSiswa = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM users u
    LEFT JOIN siswas s ON s.user_id = u.id
    WHERE u.role = 'SISWA' AND s.id IS NULL`;

  const orphanSiswa = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM siswas s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.deleted_at IS NULL AND u.id IS NULL`;

  const pendaftaranDiterima = await prisma.pendaftaran.count({
    where: { status: "DITERIMA", deleted_at: null },
  });
  const diterimaTanpaSiswa = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM pendaftarans p
    LEFT JOIN siswas s ON s.pendaftaran_id = p.id
    WHERE p.status = 'DITERIMA' AND p.deleted_at IS NULL AND s.id IS NULL`;

  const statusDist = await prisma.pendaftaran.groupBy({
    by: ["status"],
    where: { deleted_at: null },
    _count: { _all: true },
  });

  const tanpaKelas = await prisma.siswa.count({ where: { deleted_at: null, kelasId: null } });

  console.log(JSON.stringify({
    totalSiswa,
    siswaAktif,
    siswaSoftDeleted,
    siswaTanpaKelas: tanpaKelas,
    orphanSiswaTanpaUser: Number(orphanSiswa[0]?.count ?? 0),
    userSiswa,
    userSiswaTanpaSiswa: Number(userSiswaTanpaSiswa[0]?.count ?? 0),
    pendaftaranDiterima,
    pendaftaranDiterimaTanpaSiswa: Number(diterimaTanpaSiswa[0]?.count ?? 0),
    statusDistribusi: statusDist.map((s) => ({ status: s.status, jumlah: s._count._all })),
  }, null, 2));
}

main().catch((e) => { console.error("DIAG ERROR:", e); process.exit(1); }).finally(() => prisma.$disconnect());
