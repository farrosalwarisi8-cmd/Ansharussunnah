import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const q = async (t: string) => (await p.$queryRawUnsafe<{ n: bigint }>(`SELECT count(*) AS n FROM public."${t}"`))[0].n.toString();
  console.log("users:", await q("users"));
  console.log("jenjangs:", await q("jenjangs"));
  console.log("kelas:", await q("kelas"));
  console.log("guru_kelas:", await q("guru_kelas"));
  console.log("mata_pelajarans:", await q("mata_pelajarans"));
  console.log("periode_ajarans:", await q("periode_ajarans"));
  console.log("kategori_transaksis:", await q("kategori_transaksis"));
  console.log("pengaturan_ppdb:", await q("pengaturan_ppdb"));
  console.log("gurus:", await q("gurus"));
  const wk = await p.$queryRawUnsafe<{ nama: string; jenjang: string; wali: string | null }>(
    `SELECT k.nama, j.nama AS jenjang, u.nama AS wali FROM kelas k JOIN jenjangs j ON j.id=k.jenjang_id LEFT JOIN gurus g ON g.id=k.wali_kelas_id LEFT JOIN users u ON u.id=g.user_id WHERE k.wali_kelas_id IS NOT NULL`);
  console.log("wali kelas:", JSON.stringify(wk));
  await p.$disconnect();
}
main();
