// scripts/diagnosa-siswa-kelas.ts
//
// Script READ-ONLY untuk mendiagnosa konsistensi data siswa dan kelas.
// Script ini TIDAK mengubah data apa pun.
//
// Cara menjalankan:
//   npx tsx scripts/diagnosa-siswa-kelas.ts
//
// Output:
//   - Total siswa aktif
//   - Total siswa soft-deleted
//   - Siswa tanpa kelas
//   - Jumlah siswa per kelas
//   - Kelas aktif tanpa siswa
//   - Siswa dengan kelasId tidak valid
//   - Pendaftaran diterima tanpa kelas
//   - Pendaftaran MENUNGGU_VERIFIKASI tanpa bukti pembayaran
//   - Pendaftaran dengan bukti pembayaran tetapi status tidak konsisten

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== DIAGNOSA DATA SISWA DAN KELAS ===\n");

  // 1. Total siswa aktif
  const totalSiswaAktif = await prisma.siswa.count({
    where: { deleted_at: null },
  });
  console.log(`Total siswa aktif: ${totalSiswaAktif}`);

  // 2. Total siswa soft-deleted
  const totalSiswaDeleted = await prisma.siswa.count({
    where: { deleted_at: { not: null } },
  });
  console.log(`Total siswa soft-deleted: ${totalSiswaDeleted}`);

  // 3. Siswa tanpa kelas
  const siswaTanpaKelas = await prisma.siswa.findMany({
    where: { deleted_at: null, kelasId: null },
    include: { user: { select: { nama: true } } },
  });
  console.log(`\nSiswa tanpa kelas: ${siswaTanpaKelas.length}`);
  if (siswaTanpaKelas.length > 0) {
    siswaTanpaKelas.forEach((s) => {
      console.log(`  - ${s.user.nama} (ID: ${s.id})`);
    });
  }

  // 4. Jumlah siswa per kelas
  const kelasList = await prisma.kelas.findMany({
    where: { aktif: true },
    include: {
      _count: {
        select: { siswa: { where: { deleted_at: null } } },
      },
    },
    orderBy: { nama: "asc" },
  });
  console.log(`\nJumlah siswa per kelas:`);
  kelasList.forEach((k) => {
    console.log(`  - ${k.nama}: ${k._count.siswa} siswa`);
  });

  // 5. Kelas aktif tanpa siswa
  const kelasTanpaSiswa = kelasList.filter((k) => k._count.siswa === 0);
  console.log(`\nKelas aktif tanpa siswa: ${kelasTanpaSiswa.length}`);
  if (kelasTanpaSiswa.length > 0) {
    kelasTanpaSiswa.forEach((k) => {
      console.log(`  - ${k.nama} (ID: ${k.id})`);
    });
  }

  // 6. Siswa dengan kelasId tidak valid
  const semuaSiswa = await prisma.siswa.findMany({
    where: { deleted_at: null },
    include: { kelas: true },
  });
  const siswaKelasInvalid = semuaSiswa.filter((s) => s.kelasId && !s.kelas);
  console.log(`\nSiswa dengan kelasId tidak valid: ${siswaKelasInvalid.length}`);
  if (siswaKelasInvalid.length > 0) {
    siswaKelasInvalid.forEach((s) => {
      console.log(`  - ${s.user?.nama || "Unknown"} (ID: ${s.id}, kelasId: ${s.kelasId})`);
    });
  }

  // 7. Pendaftaran diterima tanpa kelas
  const pendaftaranDiterimaTanpaKelas = await prisma.pendaftaran.findMany({
    where: {
      status: "DITERIMA",
      deleted_at: null,
      kelasTujuanId: null,
    },
    include: { siswa: true },
  });
  console.log(`\nPendaftaran diterima tanpa kelas: ${pendaftaranDiterimaTanpaKelas.length}`);
  if (pendaftaranDiterimaTanpaKelas.length > 0) {
    pendaftaranDiterimaTanpaKelas.forEach((p) => {
      console.log(`  - ${p.namaLengkap} (Nomor: ${p.nomorPendaftaran})`);
    });
  }

  // 8. Pendaftaran MENUNGGU_VERIFIKASI tanpa bukti pembayaran
  const pendaftaranMenungguTanpaBukti = await prisma.pendaftaran.findMany({
    where: {
      status: "MENUNGGU_VERIFIKASI",
      deleted_at: null,
    },
    include: { buktiTransfer: true },
  });
  const menungguTanpaBukti = pendaftaranMenungguTanpaBukti.filter(
    (p) => p.buktiTransfer.length === 0,
  );
  console.log(`\nPendaftaran MENUNGGU_VERIFIKASI tanpa bukti pembayaran: ${menungguTanpaBukti.length}`);
  if (menungguTanpaBukti.length > 0) {
    menungguTanpaBukti.forEach((p) => {
      console.log(`  - ${p.namaLengkap} (Nomor: ${p.nomorPendaftaran})`);
    });
  }

  // 9. Pendaftaran dengan bukti pembayaran tetapi status tidak konsisten
  const pendaftaranDenganBukti = await prisma.pendaftaran.findMany({
    where: {
      deleted_at: null,
      status: { in: ["MENUNGGU_PEMBAYARAN", "DITERIMA", "DITOLAK"] },
    },
    include: { buktiTransfer: true },
  });
  const tidakKonsisten = pendaftaranDenganBukti.filter(
    (p) => p.buktiTransfer.length > 0 && p.status === "MENUNGGU_PEMBAYARAN",
  );
  console.log(`\nPendaftaran dengan bukti pembayaran tetapi status MENUNGGU_PEMBAYARAN: ${tidakKonsisten.length}`);
  if (tidakKonsisten.length > 0) {
    tidakKonsisten.forEach((p) => {
      console.log(`  - ${p.namaLengkap} (Nomor: ${p.nomorPendaftaran})`);
    });
  }

  console.log("\n=== SELESAI ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
