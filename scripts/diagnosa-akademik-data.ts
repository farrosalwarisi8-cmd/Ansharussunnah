/**
 * diagnosa-akademik-data.ts
 * Script read-only untuk memeriksa konsistensi data akademik.
 * TIDAK melakukan update, delete, upsert, atau migrasi data.
 */

import prisma from "@/lib/prisma";

async function runDiagnostics(): Promise<void> {
  console.log("=== DIAGNOSA DATA AKADEMIK ===\n");

  // 1. Total siswa aktif
  const activeSiswa = await prisma.siswa.count({ where: { deleted_at: null } });
  console.log(`1. Total siswa aktif: ${activeSiswa}`);

  // 2. Total siswa soft-deleted
  const deletedSiswa = await prisma.siswa.count({ where: { deleted_at: { not: null } } });
  console.log(`2. Total siswa soft-deleted: ${deletedSiswa}`);

  // 3. Siswa aktif tanpa kelas
  const siswaTanpaKelas = await prisma.siswa.findMany({
    where: { deleted_at: null, kelasId: null },
    select: { id: true, nisn: true, user: { select: { nama: true, email: true, aktif: true } } },
    take: 100,
  });
  console.log(`3. Siswa aktif tanpa kelas: ${siswaTanpaKelas.length}`);
  if (siswaTanpaKelas.length > 0) {
    console.log("   Contoh (max 5):");
    siswaTanpaKelas.slice(0, 5).forEach((s, i) => {
      console.log(`   ${i + 1}. NISN: ${s.nisn}, Nama: ${s.user.nama}, Email: ${s.user.email}, User Aktif: ${s.user.aktif}`);
    });
  }

  // 4. Siswa aktif per kelas
  const kelasWithStudentCount = await prisma.kelas.findMany({
    where: { aktif: true },
    include: {
      _count: {
        select: {
          siswa: { where: { deleted_at: null } },
        },
      },
    },
    orderBy: { nama: "asc" },
  });

  console.log(`\n4. Kelas aktif: ${kelasWithStudentCount.length}`);
  const kelasKosong = kelasWithStudentCount.filter((k) => k._count.siswa === 0);
  console.log(`   Kelas aktif tanpa siswa: ${kelasKosong.length}`);

  // 5. Kelas aktif tanpa wali kelas
  const kelasTanpaWali = await prisma.kelas.findMany({
    where: { aktif: true, waliKelasId: null },
    select: { id: true, nama: true, jenjang: { select: { nama: true } } },
  });
  console.log(`\n5. Kelas aktif tanpa wali kelas: ${kelasTanpaWali.length}`);
  if (kelasTanpaWali.length > 0) {
    console.log("   Contoh (max 5):");
    kelasTanpaWali.slice(0, 5).forEach((k) => {
      console.log(`   - ${k.jenjang.nama} - ${k.nama}`);
    });
  }

  // 6. Materi tanpa relasi valid
  const materiInvalid = await prisma.materiPembelajaran.findMany({
    where: {
      OR: [
        { kelasId: null },
        { mataPelajaranId: null },
        { periodeAjaranId: null },
      ],
    },
    select: { id: true, judul: true, kelasId: true, mataPelajaranId: true, periodeAjaranId: true },
    take: 100,
  });
  console.log(`\n6. Materi tanpa relasi lengkap: ${materiInvalid.length}`);

  // 7. Tugas tanpa relasi valid
  const tugasInvalid = await prisma.tugas.findMany({
    where: {
      OR: [
        { kelasId: null },
        { mataPelajaranId: null },
        { periodeAjaranId: null },
      ],
    },
    select: { id: true, judul: true, kelasId: true, mataPelajaranId: true, periodeAjaranId: true },
    take: 100,
  });
  console.log(`7. Tugas tanpa relasi lengkap: ${tugasInvalid.length}`);

  // 8. Ujian tanpa relasi valid
  const ujianInvalid = await prisma.ujian.findMany({
    where: {
      OR: [
        { kelasId: null },
        { mataPelajaranId: null },
        { periodeAjaranId: null },
      ],
    },
    select: { id: true, judul: true, kelasId: true, mataPelajaranId: true, periodeAjaranId: true },
    take: 100,
  });
  console.log(`8. Ujian tanpa relasi lengkap: ${ujianInvalid.length}`);

  // 9. Siswa dengan kelasId yang tidak ditemukan di tabel kelas
  const allSiswaWithKelas = await prisma.siswa.findMany({
    where: { kelasId: { not: null } },
    select: { id: true, kelasId: true },
    take: 1000,
  });

  const kelasIdsInDb = new Set(
    (await prisma.kelas.findMany({ select: { id: true } })).map((k) => k.id)
  );

  const siswaInvalidKelas = allSiswaWithKelas.filter((s) => !kelasIdsInDb.has(s.kelasId!));
  console.log(`\n9. Siswa dengan kelasId tidak valid: ${siswaInvalidKelas.length}`);

  // 10. Mapel aktif tanpa guruKelas (tidak ada penugasan)
  const mapelTanpaGuru = await prisma.mataPelajaran.findMany({
    where: { aktif: true },
    include: {
      _count: {
        select: { guruKelas: true },
      },
    },
  });

  const mapelKosong = mapelTanpaGuru.filter((m) => m._count.guruKelas === 0);
  console.log(`\n10. Mapel aktif tanpa penugasan guru: ${mapelKosong.length}`);
  if (mapelKosong.length > 0) {
    console.log("   Contoh (max 5):");
    mapelKosong.slice(0, 5).forEach((m) => {
      console.log(`   - ${m.kode}: ${m.nama}`);
    });
  }

  // 11. Guru tanpa user aktif
  const guruTanpaUserAktif = await prisma.guru.findMany({
    where: {
      user: { aktif: false },
    },
    select: { id: true, userId: true, user: { select: { nama: true, email: true, aktif: true } } },
    take: 100,
  });
  console.log(`\n11. Guru dengan user tidak aktif: ${guruTanpaUserAktif.length}`);

  // 12. Guru tanpa profil (user ada tapi tidak ada record Guru)
  const usersWithRoleGuru = await prisma.user.findMany({
    where: { role: "GURU", aktif: true },
    select: { id: true, nama: true, email: true, role: true },
  });

  const guruIdsInDb = new Set(
    (await prisma.guru.findMany({ select: { userId: true } })).map((g) => g.userId)
  );

  const guruTanpaProfil = usersWithRoleGuru.filter((u) => !guruIdsInDb.has(u.id));
  console.log(`\n12. User dengan role GURU tapi tanpa profil Guru: ${guruTanpaProfil.length}`);
  if (guruTanpaProfil.length > 0) {
    console.log("   Contoh (max 5):");
    guruTanpaProfil.slice(0, 5).forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.nama} (${u.email})`);
    });
  }

  console.log("\n=== DIAGNOSA SELESAI ===");
}

// Jalankan jika dipanggil langsung (bukan di-import)
runDiagnostics().catch(console.error);
