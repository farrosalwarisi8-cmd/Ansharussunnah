import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const rows = await p.$queryRawUnsafe<{ role: string | null; n: bigint }>(
    `SELECT raw_user_meta_data->>'role' AS role, count(*) AS n
     FROM auth.users GROUP BY 1 ORDER BY 2 DESC`
  );
  console.log("=== distribusi role di auth.users ===");
  for (const r of rows) console.log(`${r.role} -> ${r.n.toString()}`);

  const withNama = await p.$queryRawUnsafe<{ n: bigint }>(
    `SELECT count(*) AS n FROM auth.users WHERE raw_user_meta_data ? 'nama'`
  );
  console.log("punya nama:", withNama[0].n.toString());

  const noEmail = await p.$queryRawUnsafe<{ n: bigint }>(
    `SELECT count(*) AS n FROM auth.users WHERE email IS NULL`
  );
  console.log("email null:", noEmail[0].n.toString());

  // user tanpa role valid (di luar enum)
  const invalid = await p.$queryRawUnsafe<{ role: string | null; n: bigint }>(
    `SELECT raw_user_meta_data->>'role' AS role, count(*) AS n
     FROM auth.users
     WHERE raw_user_meta_data->>'role' NOT IN ('SUPER_ADMIN','ADMIN_AKADEMIK','ADMIN_KEUANGAN','GURU','SISWA','ORANG_TUA')
     GROUP BY 1`
  );
  console.log("role di luar enum:", invalid.length ? invalid.map((r) => `${r.role}:${r.n}`).join(", ") : "(semua valid)");

  await p.$disconnect();
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
