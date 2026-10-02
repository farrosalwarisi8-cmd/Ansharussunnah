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
  const danglingJenjang = await prisma.$queryRawUnsafe<
    Array<{ id: string; nomor_pendaftaran: string; jenjang_tujuan_id: string | null }>
  >(
    `SELECT p.id, p."nomorPendaftaran" AS "nomor_pendaftaran", p."jenjangTujuanId" AS "jenjang_tujuan_id"
     FROM "Pendaftaran" p
     LEFT JOIN "Jenjang" j ON j.id = p."jenjangTujuanId"
     WHERE p."deleted_at" IS NULL AND p."jenjangTujuanId" IS NOT NULL AND j.id IS NULL`
  );
  console.log(
    `\npendaftaran dengan jenjangTujuanId MENGGANTUNG: ${danglingJenjang.length}`
  );
  for (const r of danglingJenjang) console.log(`  ${r.id} | ${r.nomor_pendaftaran} | jenjangTujuanId=${r.jenjang_tujuan_id}`);

  const nullJenjang = await prisma.pendaftaran.count({
    where: { deleted_at: null, jenjangTujuanId: null },
  });
  console.log(`pendaftaran dengan jenjangTujuanId = NULL: ${nullJenjang}`);

  // Pendaftaran dengan kelasTujuanId yang tidak merujuk ke kelas yang ada.
  const danglingKelas = await prisma.$queryRawUnsafe<
    Array<{ id: string; nomor_pendaftaran: string; kelas_tujuan_id: string | null }>
  >(
    `SELECT p.id, p."nomorPendaftaran" AS "nomor_pendaftaran", p."kelasTujuanId" AS "kelas_tujuan_id"
     FROM "Pendaftaran" p
     LEFT JOIN "Kelas" k ON k.id = p."kelasTujuanId"
     WHERE p."deleted_at" IS NULL AND p."kelasTujuanId" IS NOT NULL AND k.id IS NULL`
  );
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
