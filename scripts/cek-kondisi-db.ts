import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TABLES = [
  "users",
  "gurus",
  "siswas",
  "pendaftarans",
  "pendaftaran_drafts",
  "otp_verifikasi_email",
  "bukti_transfer_pendaftarans",
  "materi_pembelajarans",
  "ujians",
  "soal_ujians",
  "pengerjaan_ujians",
  "jawaban_siswas",
  "tugas",
  "pengumpulan_tugas",
  "absensis",
  "nilai_rapors",
  "catatan_rapors",
  "tagihan_siswas",
  "pembayaran_siswas",
  "email_outbox",
  "kategori_transaksis",
  "transaksi_keuangans",
  "riwayat_kelas_siswas",
  "periode_ajarans",
  "login_audits",
];

async function main() {
  console.log("=== ROW COUNTS (read-only) ===");
  for (const t of TABLES) {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }>(
      `SELECT count(*) AS n FROM "${t}"`
    );
    console.log(`${t}: ${rows[0].n.toString()}`);
  }

  console.log("\n=== _prisma_migrations (chronological) ===");
  const mig = await prisma.$queryRawUnsafe<{
    migration_name: string;
    finished_at: Date | null;
    logs: string | null;
  }>(
    `SELECT migration_name, finished_at, logs FROM _prisma_migrations ORDER BY id`
  );
  for (const m of mig) {
    const status = m.finished_at ? m.finished_at.toISOString() : "GAGAL/NULL";
    const logSnippet = m.logs ? ` | log: ${m.logs.slice(0, 80).replace(/\n/g, " ")}` : "";
    console.log(`${m.migration_name} -> ${status}${logSnippet}`);
  }

  console.log("\n=== pendaftaran tersangkut di SEDANG_DIPROSES ===");
  const stuck = await prisma.$queryRawUnsafe<{ n: bigint }>(
    `SELECT count(*) AS n FROM "pendaftarans" WHERE "status" = 'SEDANG_DIPROSES'`
  );
  console.log(`SEDANG_DIPROSES: ${stuck[0].n.toString()}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("GAGAL:", e.message);
  process.exit(1);
});
