import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  for (const t of ["pendaftarans", "nilai_rapors", "berkas_siswas"]) {
    try {
      const cols = await prisma.$queryRawUnsafe<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, t);
      console.log(`${t} (${cols.length} kolom):`, cols.map(c => c.column_name).join(", "));
    } catch (e) { console.log(`${t}: ERROR`, (e as Error).message.slice(0,80)); }
}
await prisma.$disconnect();
}
main();
