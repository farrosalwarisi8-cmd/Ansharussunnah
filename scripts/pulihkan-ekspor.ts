import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OUT = path.join(process.cwd(), "recovery");

const replacer = (_k: string, v: unknown) =>
  v instanceof Date ? v.toISOString() : typeof v === "bigint" ? v.toString() : v;

async function main() {
  fs.mkdirSync(path.join(OUT, "files"), { recursive: true });

  const dump = async (name: string, sql: string) => {
    const rows = await prisma.$queryRawUnsafe(sql);
    fs.writeFileSync(path.join(OUT, name), JSON.stringify(rows, replacer, 2));
    console.log(`${name}: ${rows.length} baris`);
  };

  // Skema auth (selamat dari wipe)
  await dump("auth-users.json", `SELECT * FROM auth.users ORDER BY created_at`);
  await dump("auth-identities.json", `SELECT * FROM auth.identities`);
  await dump("auth-sessions.json", `SELECT * FROM auth.sessions`);
  await dump("auth-refresh-tokens.json", `SELECT * FROM auth.refresh_tokens`);
  await dump("auth-mfa-amr-claims.json", `SELECT * FROM auth.mfa_amr_claims`);

  // Skema storage (selamat dari wipe)
  await dump("storage-buckets.json", `SELECT * FROM storage.buckets`);
  await dump("storage-objects.json", `SELECT * FROM storage.objects ORDER BY created_at`);

  // Download isi file via Storage REST API (service role)
  const objects = await prisma.$queryRawUnsafe<{
    bucket_id: string;
    name: string;
  }>(`SELECT bucket_id, name FROM storage.objects ORDER BY created_at`);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    console.log("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tidak ditemukan — download file dilewati");
  } else {
    for (const o of objects) {
      const res = await fetch(`${base}/storage/v1/object/${o.bucket_id}/${o.name}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const dest = path.join(OUT, "files", o.bucket_id, ...o.name.split("/"));
      if (res.ok) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(dest, buf);
        console.log(`unduh ${o.bucket_id}/${o.name} (${buf.length} byte)`);
      } else {
        console.log(`GAGAL unduh ${o.bucket_id}/${o.name}: HTTP ${res.status}`);
      }
    }
  }

  console.log(`\nEkspor selesai -> ${OUT}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("GAGAL:", e);
  process.exit(1);
});
