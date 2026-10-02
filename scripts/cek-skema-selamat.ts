import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SCHEMAS = [
  "auth",
  "storage",
  "vault",
  "graphql",
  "realtime",
  "supabase_migrations",
  "supabase_functions",
];

async function main() {
  const schemas = await prisma.$queryRawUnsafe<{ schema_name: string }>(
    `SELECT schema_name FROM information_schema.schemata
     WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
     ORDER BY 1`
  );
  console.log(
    "SCHEMAS:",
    schemas.map((s) => s.schema_name).join(", ")
  );

  for (const schema of SCHEMAS) {
    if (!schemas.some((s) => s.schema_name === schema)) continue;
    let tables: { table_name: string }[] = [];
    try {
      tables = await prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY 1`,
        schema
      );
    } catch (e) {
      console.log(`\n[${schema}] tidak bisa dibaca:`, (e as Error).message);
      continue;
    }
    for (const t of tables) {
      try {
        const c = await prisma.$queryRawUnsafe<{ n: bigint }>(
          `SELECT count(*) AS n FROM "${schema}"."${t.table_name}"`
        );
        console.log(`${schema}.${t.table_name}: ${c[0].n}`);
      } catch (e) {
        console.log(`${schema}.${t.table_name}: ERROR ${(e as Error).message}`);
      }
    }
  }

  // Sampel isi auth.users (tanpa data sensitif selain email/status)
  try {
    const users = await prisma.$queryRawUnsafe<{
      id: string;
      email: string | null;
      created_at: Date;
    }>(
      `SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 10`
    );
    console.log("\n=== auth.users (10 terakhir) ===");
    for (const u of users) {
      console.log(`${u.email} | ${u.created_at.toISOString()}`);
    }
  } catch (e) {
    console.log("\nauth.users tidak bisa dibaca:", (e as Error).message);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("GAGAL:", e.message);
  process.exit(1);
});
