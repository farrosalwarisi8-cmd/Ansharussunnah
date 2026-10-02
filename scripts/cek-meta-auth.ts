import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const j = (v: unknown) => JSON.stringify(v);

async function main() {
  console.log("=== auth.users: sampel raw_user_meta_data & raw_app_meta_data ===");
  const users = await prisma.$queryRawUnsafe<{
    id: string;
    email: string | null;
    raw_user_meta_data: Record<string, unknown> | null;
    raw_app_meta_data: Record<string, unknown> | null;
    created_at: Date;
  }>(
    `SELECT id, email, raw_user_meta_data, raw_app_meta_data, created_at
     FROM auth.users ORDER BY created_at DESC LIMIT 15`
  );
  for (const u of users) {
    console.log(
      `${u.email} | ${u.created_at.toISOString()}\n  user_meta: ${j(u.raw_user_meta_data)}\n  app_meta:  ${j(u.raw_app_meta_data)}`
    );
  }

  console.log("\n=== auth.identities: sampel identity_data ===");
  const ids = await prisma.$queryRawUnsafe<{
    user_id: string;
    provider: string;
    identity_data: Record<string, unknown> | null;
  }>(
    `SELECT user_id, provider, identity_data FROM auth.identities ORDER BY user_id LIMIT 15`
  );
  for (const i of ids) {
    console.log(`${i.provider} / ${i.user_id}: ${j(i.identity_data)}`);
  }

  console.log("\n=== login_audits (6 baris, forensik aktor) ===");
  const audits = await prisma.$queryRawUnsafe<{
    email: string;
    ip_address: string | null;
    user_agent: string | null;
    status: string;
    reason: string | null;
    created_at: Date;
  }>(`SELECT email, ip_address, user_agent, status, reason, created_at FROM login_audits ORDER BY created_at`);
  for (const a of audits) {
    console.log(
      `${a.created_at.toISOString()} | ${a.email} | status=${a.status} | ip=${a.ip_address ?? "-"} | ua=${(a.user_agent ?? "-").slice(0, 80)} | reason=${a.reason ?? "-"}`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("GAGAL:", e);
  process.exit(1);
});
