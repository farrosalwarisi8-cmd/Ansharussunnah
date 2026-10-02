import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const cols = await p.$queryRawUnsafe<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='login_audits' ORDER BY ordinal_position`
  );
  console.log(
    "kolom:",
    cols.map((c) => c.column_name).join(", ")
  );

  const rows = await p.$queryRawUnsafe(
    `SELECT * FROM public.login_audits ORDER BY created_at`
  );
  console.log(`login_audits: ${rows.length} baris`);
  for (const r of rows) {
    console.log(JSON.stringify(r, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
  }

  await p.$disconnect();
}
main().catch((e) => {
  console.error("GAGAL:", e);
  process.exit(1);
});
