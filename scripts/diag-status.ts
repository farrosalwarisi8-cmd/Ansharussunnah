import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  // Distribusi role
  const dist = await p.$queryRawUnsafe<{ role: string; n: bigint }>(
    `SELECT role, count(*) AS n FROM public.users GROUP BY role ORDER BY role`
  );
  console.log(
    "distribusi users:",
    dist.map((d) => `${d.role}=${d.n.toString()}`).join(", ")
  );

  // Baris guru & keuangan (apakah isi profile-nya lengkap?)
  const admins = await p.$queryRawUnsafe<{
    email: string;
    nama: string;
    is_admin: boolean;
    must_change_password: boolean;
    auth_id: string;
    created_at: Date;
  }>(
    `SELECT email, nama, is_admin, must_change_password, auth_id, created_at
     FROM public.users WHERE email IN ('guru@sekolah.sch.id','keuangan@sekolah.sch.id')`
  );
  console.log("\nbaris admin:");
  for (const a of admins) {
    console.log(
      `  ${a.email} | nama=${a.nama} | isAdmin=${a.is_admin} | mustChange=${a.must_change_password} | created=${a.created_at?.toISOString?.() ?? a.created_at}`
    );
  }

  // Profile guru
  const guruCount = await p.$queryRawUnsafe<{ n: bigint }>(
    `SELECT count(*) AS n FROM public.gurus`
  );
  console.log(`\ngurus: ${guruCount[0].n.toString()}`);

  // Kapan referensi dibuat (mendeteksi apa yang sudah jalan)
  const timestamps = await p.$queryRawUnsafe<{ t: string; min: Date; max: Date }>(
    `SELECT 'jenjangs' AS t, min(created_at) AS min, max(created_at) AS max FROM public.jenjangs
     UNION ALL SELECT 'kelas', min(created_at), max(created_at) FROM public.kelas
     UNION ALL SELECT 'periode', min(created_at), max(created_at) FROM public.periode_ajarans
     UNION ALL SELECT 'users', min(created_at), max(created_at) FROM public.users`
  );
  console.log("\ntimestamps:");
  for (const r of timestamps) {
    console.log(
      `  ${r.t}: ${r.min?.toISOString?.() ?? r.min} .. ${r.max?.toISOString?.() ?? r.max}`
    );
  }

  // Isi pengaturan PPDB
  const ppdb = await p.$queryRawUnsafe<{
    bank_nama: string;
    bank_no_rekening: string;
    bank_atas_nama: string;
    kontak_wa: string;
  }>(`SELECT * FROM public.pengaturan_ppdb WHERE id = 1`);
  console.log("\npengaturan_ppdb:", JSON.stringify(ppdb));

  // Periode aktif
  const periode = await p.$queryRawUnsafe<{
    nama: string;
    aktif: boolean;
  }>(`SELECT nama, aktif FROM public.periode_ajarans ORDER BY id`);
  console.log("periode:", JSON.stringify(periode));

  await p.$disconnect();
}
main().catch((e) => {
  console.error("GAGAL:", e);
  process.exit(1);
});
