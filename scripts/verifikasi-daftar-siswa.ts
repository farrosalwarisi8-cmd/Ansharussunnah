// Read-only: verifikasi pemulihan — replikasi query daftar siswa pada
// getDaftarSiswaManual (src/actions/siswa-manual.ts) + cek tidak ada data
// yang berkurang.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [users, siswas, ortu, links, kelas, gurus, loginAudits] = await Promise.all([
    prisma.user.count(),
    prisma.siswa.count({ where: { deleted_at: null } }),
    prisma.orangTua.count(),
    prisma.parentStudent.count(),
    prisma.kelas.count(),
    prisma.guru.count(),
    prisma.$queryRawUnsafe<any[]>(`SELECT count(*)::int AS n FROM login_audits`),
  ]);
  console.log(
    `users=${users} siswas=${siswas} orang_tuas=${ortu} parent_students=${links} ` +
      `kelas=${kelas} gurus=${gurus} login_audits=${loginAudits[0].n}`,
  );

  // Query yang sama dengan getDaftarSiswaManual (tanpa filter).
  const total = await prisma.siswa.count({ where: { deleted_at: null } });
  const rows = await prisma.siswa.findMany({
    where: { deleted_at: null },
    include: {
      user: { select: { id: true, nama: true, email: true, username: true, aktif: true } },
      kelas: { select: { nama: true, jenjang: { select: { nama: true } } } },
      orangTua: {
        include: {
          orangTua: {
            include: { user: { select: { id: true, nama: true, email: true } } },
          },
        },
      },
    },
    orderBy: [{ user: { createdAt: "desc" } }, { id: "desc" }],
    take: 5,
  });

  console.log(`\nTotal daftar siswa (halaman 1): ${total}`);
  for (const s of rows) {
    const parents = s.orangTua
      .map((ps) => `${ps.orangTua.user.nama} <${ps.orangTua.user.email}>`)
      .join(", ");
    console.log(
      `- ${s.user.nama} | ${s.user.email} | gender=${s.jenisKelamin ?? "belum diketahui"} | ` +
        `kelas=${s.kelas?.nama ?? "-"} | ortu=${parents || "(belum ada relasi)"}`,
    );
  }

  const tanpaOrtu = await prisma.siswa.count({
    where: { deleted_at: null, orangTua: { none: {} } },
  });
  const genderNull = await prisma.siswa.count({
    where: { deleted_at: null, jenisKelamin: null },
  });
  console.log(`\nsiswa tanpa relasi ortu: ${tanpaOrtu}`);
  console.log(`siswa dengan gender belum diketahui: ${genderNull}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("GAGAL:", e);
  process.exit(1);
});
