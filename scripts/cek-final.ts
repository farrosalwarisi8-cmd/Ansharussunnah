import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  // kolom dok_* di siswas (migrasi #17)
  const cols = await prisma.$queryRawUnsafe<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='siswas' AND column_name LIKE 'dok_%'`);
  console.log("siswas dok_* kolom:", cols.length ? cols.map(c=>c.column_name).join(", ") : "HILANG SEMUA");
  // enum Role di public
  try {
    const vals = await prisma.$queryRawUnsafe<{ label: string }>(
      `SELECT unnest(enum_range(NULL::"Role")) AS label`);
    console.log("Role enum:", vals.map(v=>v.label).join(", "));
  } catch (e) { console.log("Role enum: ERROR", (e as Error).message.slice(0,80)); }
  // FK users.auth_id -> auth.users ?
  const fk = await prisma.$queryRawUnsafe<{ conname: string }>(
    `SELECT conname FROM pg_constraint WHERE conrelid='public.users'::regclass AND contype='f'`);
  console.log("users FK:", fk.map(f=>f.conname).join(", ") || "(none)");
  await prisma.$disconnect();
}
main();
