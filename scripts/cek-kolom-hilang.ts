import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const checks: [string, string, string][] = [
  // [tabel, kolom, asal migrasi]
  ["pembayaran_siswas", "idempotency_key", "#31 pembayaran_idempotency"],
  ["pendaftarans", "status_diproses_oleh_id", "#34 state machine (cek nama kolom)"],
  ["pendaftarans", "kontak_wali_dikonfirmasi", "#28 konfirmasi kontak wali"],
  ["pendaftarans", "verifikasi_email", "#24 verifikasi email"],
  ["jenjangs", "biaya_pendaftaran_ppdb", "#23 biaya ppdb per jenjang"],
  ["nilai_rapors", "nomor", "#18 penomoran nilai manual"],
  ["gurus", "jenis_kelamin", "#9 guru jenis kelamin"],
  ["users", "username", "#8 username"],
];

async function main() {
  for (const [tabel, kolom, asal] of checks) {
    const r = await prisma.$queryRawUnsafe<{ n: bigint }>(
      `SELECT count(*) AS n FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      tabel,
      kolom
    );
    console.log(
      `${r[0].n > 0n ? "ADA " : "HILANG"} public.${tabel}.${kolom}  (${asal})`
    );
  }

  // Nilai enum status pendaftaran yang ada
  try {
    const vals = await prisma.$queryRawUnsafe<{ label: string }>(
      `SELECT unnest(enum_range(NULL::"StatusPendaftaran")) AS label`
    );
    console.log("\nStatusPendaftaran:", vals.map((v) => v.label).join(", "));
  } catch (e) {
    console.log("\nenum StatusPendaftaran: ERROR", (e as Error).message.slice(0, 100));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("GAGAL:", e.message);
  process.exit(1);
});
