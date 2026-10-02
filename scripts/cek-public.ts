import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Tabel di public
  const tables = await prisma.$queryRawUnsafe<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`
  );
  console.log(`public: ${tables.length} tabel`);

  // _prisma_migrations ada? berapa baris?
  try {
    const m = await prisma.$queryRawUnsafe<{ count: bigint }>(
      `SELECT count(*) AS count FROM public._prisma_migrations`
    );
    console.log(`_prisma_migrations: ${m[0].count} baris`);
    const last = await prisma.$queryRawUnsafe<{ migration_name: string }>(
      `SELECT migration_name FROM public._prisma_migrations ORDER BY started_at DESC LIMIT 3`
    );
    console.log("3 migrasi terakhir:", last.map((x) => x.migration_name).join(", "));
  } catch (e) {
    console.log("_prisma_migrations: TIDAK ADA / ERROR", (e as Error).message.slice(0, 120));
  }

  for (const t of tables) {
    if (t.table_name === "_prisma_migrations") continue;
    try {
      const c = await prisma.$queryRawUnsafe<{ n: bigint }>(
        `SELECT count(*) AS n FROM public."${t.table_name}"`
      );
      console.log(`public.${t.table_name}: ${c[0].n}`);
    } catch (e) {
      console.log(`public.${t.table_name}: ERROR`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("GAGAL:", e.message);
  process.exit(1);
});
