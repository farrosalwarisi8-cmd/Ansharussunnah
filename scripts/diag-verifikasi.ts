/// <reference types="node" />

import * as fs from "fs";
import prisma from "../src/lib/prisma";

function loadEnvFile(file: string) {
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // file tidak ada — abaikan
  }
}

async function safeQueryMany<T>(sql: string): Promise<Array<T>> {
  try {
    return await prisma.$queryRawUnsafe<Array<T>>(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[diag-verifikasi] query skipped: ${message}`);
    return [];
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

async function main() {
  const total = await prisma.pendaftaran.count();
  const aktif = await prisma.pendaftaran.count({ where: { deleted_at: null } });
  console.log(`pendaftaran: total=${total}, aktif(deleted_at null)=${aktif}`);

  const jenjangCount = await prisma.jenjang.count();
  const kelasCount = await prisma.kelas.count();
  console.log(`referensi: jenjang=${jenjangCount}, kelas=${kelasCount}`);

  // Pendaftaran dengan jenjangTujuanId yang TIDAK merujuk ke jenjang yang ada.
  const danglingJenjang = await safeQueryMany<{
    id: string;
    nomor_pendaftaran: string;
    jenjang_tujuan_id: string | null;
  }>(`SELECT p.id, p."nomor_pendaftaran" AS "nomor_pendaftaran", p."jenjang_tujuan_id" AS "jenjang_tujuan_id"
     FROM "pendaftarans" p
     LEFT JOIN "jenjangs" j ON j.id = p."jenjang_tujuan_id"
     WHERE p."deleted_at" IS NULL AND p."jenjang_tujuan_id" IS NOT NULL AND j.id IS NULL`);
  console.log(
    `\npendaftaran dengan jenjangTujuanId MENGGANTUNG: ${danglingJenjang.length}`
  );
  for (const r of danglingJenjang) console.log(`  ${r.id} | ${r.nomor_pendaftaran} | jenjangTujuanId=${r.jenjang_tujuan_id}`);

  const nullJenjangRows = await safeQueryMany<{ count: bigint }>(`SELECT COUNT(*)::bigint AS count
    FROM "pendaftarans"
    WHERE "deleted_at" IS NULL AND "jenjang_tujuan_id" IS NULL`);
  const nullJenjang = Number(nullJenjangRows[0]?.count ?? 0n);
  console.log(`pendaftaran dengan jenjangTujuanId = NULL: ${nullJenjang}`);

  // Pendaftaran dengan kelasTujuanId yang tidak merujuk ke kelas yang ada.
  const danglingKelas = await safeQueryMany<{
    id: string;
    nomor_pendaftaran: string;
    kelas_tujuan_id: string | null;
  }>(`SELECT p.id, p."nomor_pendaftaran" AS "nomor_pendaftaran", p."kelas_tujuan_id" AS "kelas_tujuan_id"
     FROM "pendaftarans" p
     LEFT JOIN "kelas" k ON k.id = p."kelas_tujuan_id"
     WHERE p."deleted_at" IS NULL AND p."kelas_tujuan_id" IS NOT NULL AND k.id IS NULL`);
  console.log(
    `\npendaftaran dengan kelasTujuanId MENGGANTUNG: ${danglingKelas.length}`
  );
  for (const r of danglingKelas) console.log(`  ${r.id} | ${r.nomor_pendaftaran} | kelasTujuanId=${r.kelas_tujuan_id}`);

  // Simulasi persis query getPendaftaranList: include jenjangTujuan+kelas.
  // Cek apakah ada baris yang relasi jenjangTujuan-nya null (akan membuat
  // p.jenjangTujuan.nama throw di UI).
  const sample = await prisma.pendaftaran.findMany({
    where: { deleted_at: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 10,
    include: {
      jenjangTujuan: { include: { kelas: true } },
      kelasTujuan: true,
      buktiTransfer: { orderBy: { waktuUpload: "desc" } },
      diverifikasiOleh: true,
      kontakWaliDikonfirmasiOleh: true,
    },
  });
  console.log(`\nsimulasi getPendaftaranList: ${sample.length} baris`);
  for (const p of sample) {
    const masalah: string[] = [];
    if (!p.jenjangTujuan) masalah.push("jenjangTujuan=NULL → UI THROW p.jenjangTujuan.nama");
    if (p.kelasTujuanId && !p.kelasTujuan) masalah.push("kelasTujuan=NULL");
    console.log(
      `  ${p.nomorPendaftaran} | status=${p.status} | jenjang=${p.jenjangTujuan?.nama ?? "NULL"} ${masalah.length ? "⚠️ " + masalah.join("; ") : "OK"}`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("DIAG ERROR:", e);
  process.exit(1);
});
