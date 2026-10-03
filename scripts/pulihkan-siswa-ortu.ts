// scripts/pulihkan-siswa-ortu.ts
//
// Rekonstruksi data KELUARGA yang hilang akibat insiden wipe database
// 2026-10-02 (lihat docs/LAPORAN_HARDENING_BLOCKER.md):
//   - `siswas`         : 0 row, padahal 67 akun users role SISWA ada.
//   - `orang_tuas`     : 0 row, padahal 57 akun users role ORANG_TUA ada.
//   - `parent_students`: 0 row → relasi anak↔ortu hilang.
// Akun `users` sudah dipulihkan sebelumnya oleh scripts/pulihkan-users.ts.
//
// ATURAN KERAS (permintaan: perbaiki tanpa menghilangkan data yang sudah ada):
//   - HANYA INSERT. Tidak ada UPDATE, tidak ada DELETE, tidak ada soft-delete.
//   - Idempotent: row yang sudah ada (by userId / by pasangan) dilewati.
//   - Tidak pernah menyentuh tabel `users` atau schema auth.
//   - Pasangan ortu↔siswa hanya ditautkan bila jarak `created_at` kedua akun
//     ≤ 5 detik dan pasangannya UNIK (kedua row dibuat dalam transaksi
//     pembuatan yang sama; selisih terukur 0,3–2,2 detik). Tanpa keyakinan →
//     TIDAK ditautkan, dilaporkan agar admin melengkapi manual.
//   - Gender tidak dipulihkan (tidak ada sumber data) → NULL = "belum
//     diketahui"; admin melengkapi lewat fitur edit data siswa.
//
// Pemakaian:
//   npx tsx scripts/pulihkan-siswa-ortu.ts           # dry-run (laporan saja)
//   npx tsx scripts/pulihkan-siswa-ortu.ts --apply   # menulis data

import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const JENDELA_MS = 5000;

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (menulis)" : "DRY-RUN (tanpa tulis)"}`);

  const siswaUsers = await prisma.user.findMany({
    where: { role: Role.SISWA, deleted_at: null },
    include: { siswa: true },
    orderBy: { createdAt: "asc" },
  });
  const ortuUsers = await prisma.user.findMany({
    where: { role: Role.ORANG_TUA, deleted_at: null },
    include: { orangTua: true },
    orderBy: { createdAt: "asc" },
  });

  const siswaTanpaRow = siswaUsers.filter((u) => !u.siswa);
  const ortuTanpaRow = ortuUsers.filter((u) => !u.orangTua);
  console.log(`SISWA: ${siswaUsers.length} akun, ${siswaTanpaRow.length} tanpa row siswas`);
  console.log(`ORANG_TUA: ${ortuUsers.length} akun, ${ortuTanpaRow.length} tanpa row orang_tuas`);

  // ---- 1. Bangun row orang_tuas (insert saja) ----
  if (APPLY && ortuTanpaRow.length > 0) {
    await prisma.$transaction(
      ortuTanpaRow.map((u) =>
        prisma.orangTua.create({
          data: { userId: u.id, createdAt: u.createdAt },
        }),
      ),
      { timeout: 30000 },
    );
  }
  console.log(`${APPLY ? "Dibuat" : "Akan dibuat"}: ${ortuTanpaRow.length} row orang_tuas`);

  // ---- 2. Bangun row siswas (insert saja; gender NULL = belum diketahui) ----
  if (APPLY && siswaTanpaRow.length > 0) {
    await prisma.$transaction(
      siswaTanpaRow.map((u) =>
        prisma.siswa.create({
          data: {
            userId: u.id,
            jenisKelamin: null,
            createdAt: u.createdAt,
          },
        }),
      ),
      { timeout: 30000 },
    );
  }
  console.log(`${APPLY ? "Dibuat" : "Akan dibuat"}: ${siswaTanpaRow.length} row siswas`);

  // ---- 3. Pasangan ortu <-> siswa berdasarkan jarak created_at ----
  // Dihitung di LEVEL USER (created_at users adalah sumber yang selamat),
  // sehingga dry-run pun bisa melapor kandidat tanpa row yang baru dibuat.
  const [siswaRows, ortuRows, existingLinks] = await Promise.all([
    prisma.siswa.findMany({ select: { id: true, userId: true } }),
    prisma.orangTua.findMany({ select: { id: true, userId: true } }),
    prisma.parentStudent.findMany({ select: { orangTuaId: true, siswaId: true } }),
  ]);
  const siswaIdByUser = new Map(siswaRows.map((r) => [r.userId, r.id]));
  const ortuIdByUser = new Map(ortuRows.map((r) => [r.userId, r.id]));
  const siswaIdToUser = new Map(siswaRows.map((r) => [r.id, r.userId]));

  // Siswa yang SUDAH punya ortu (link lama) tidak boleh dipasangkan ulang.
  const linkedSiswaUser = new Set(
    existingLinks
      .map((l) => siswaIdToUser.get(l.siswaId))
      .filter((id): id is string => Boolean(id)),
  );

  type Pasangan = {
    ortuUser: string;
    siswaUser: string;
    namaOrtu: string;
    namaSiswa: string;
    selisih: number;
  };
  const pasangan: Pasangan[] = [];
  const siswaDipakai = new Set<string>(linkedSiswaUser);

  for (const ortu of ortuUsers) {
    const kandidat = siswaUsers
      .filter((s) => !siswaDipakai.has(s.id))
      .map((s) => ({
        s,
        selisih: Math.abs(s.createdAt.getTime() - ortu.createdAt.getTime()),
      }))
      .filter((x) => x.selisih <= JENDELA_MS)
      .sort((a, b) => a.selisih - b.selisih);
    if (kandidat.length === 0) continue;
    siswaDipakai.add(kandidat[0].s.id);
    pasangan.push({
      ortuUser: ortu.id,
      siswaUser: kandidat[0].s.id,
      namaOrtu: ortu.nama,
      namaSiswa: kandidat[0].s.nama,
      selisih: kandidat[0].selisih,
    });
  }

  const pasanganBaru = pasangan.filter((p) => {
    const ortuId = ortuIdByUser.get(p.ortuUser);
    const siswaId = siswaIdByUser.get(p.siswaUser);
    if (!ortuId || !siswaId) return false; // row belum ada (khusus dry-run)
    return !existingLinks.some((l) => l.orangTuaId === ortuId && l.siswaId === siswaId);
  });

  console.log(
    `Kandidat pasangan ortu<->siswa (jendela ${JENDELA_MS}ms): ${pasangan.length}; baru: ${pasanganBaru.length}`,
  );

  if (APPLY && pasanganBaru.length > 0) {
    await prisma.$transaction(
      pasanganBaru.map((p) =>
        prisma.parentStudent.create({
          data: {
            orangTuaId: ortuIdByUser.get(p.ortuUser)!,
            siswaId: siswaIdByUser.get(p.siswaUser)!,
            hubungan: "Orang Tua",
          },
        }),
      ),
      { timeout: 30000 },
    );
  }

  // ---- 4. Laporan siswa yang TIDAK bisa dipasangkan otomatis ----
  const tanpaOrtu = siswaUsers.filter((s) => !siswaDipakai.has(s.id));
  console.log(`\nSISWA TANPA RELASI ORANG TUA (${tanpaOrtu.length}) — lengkapi manual:`);
  for (const s of tanpaOrtu) console.log(`  - ${s.nama} <${s.email}>`);

  // ---- 5. Verifikasi akhir ----
  const [nSiswa, nOrtu, nLink] = await Promise.all([
    prisma.siswa.count(),
    prisma.orangTua.count(),
    prisma.parentStudent.count(),
  ]);
  console.log(`\nVerifikasi: siswas=${nSiswa} orang_tuas=${nOrtu} parent_students=${nLink}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("GAGAL:", e);
  await prisma.$disconnect();
  process.exit(1);
});
