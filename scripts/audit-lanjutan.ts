import * as fs from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function q(sql: string, ...params: any[]) {
  return prisma.$queryRawUnsafe<any[]>(sql, ...params);
}

async function main() {
  // 1. 5 akun yang updated_at-nya pagi ini (sebelum baseline ekspor)
  console.log("=== 5 akun dengan updated_at pagi ini ===");
  const five = await q(
    `SELECT id, email, created_at, updated_at, last_sign_in_at,
            raw_user_meta_data, banned_until, deleted_at, email_change
     FROM auth.users
     WHERE updated_at::date = '2026-10-02'::date
       AND id != '927fe78b-b4ad-4c1d-869c-20f9cc8fee20'
     ORDER BY updated_at`
  );
  for (const u of five) {
    console.log(
      `${u.email} | created ${u.created_at?.toISOString()} | updated ${u.updated_at?.toISOString()} | last_sign_in ${u.last_sign_in_at?.toISOString() ?? "null (pernah? TIDAK — belum pernah login)"} | banned ${u.banned_until ?? "-"} | deleted ${u.deleted_at ?? "-"} | email_change ${u.email_change ?? "-"}`
    );
    console.log(`  meta: ${JSON.stringify(u.raw_user_meta_data)}`);
  }

  // semua user yang updated_at hari ini (termasuk guru)
  const allToday = await q(
    `SELECT email, updated_at, last_sign_in_at FROM auth.users WHERE updated_at::date = '2026-10-02'::date ORDER BY updated_at`
  );
  console.log(`\nSemua user dengan updated_at hari ini: ${allToday.length}`);
  for (const u of allToday) {
    console.log(
      `  ${u.email} | updated ${u.updated_at.toISOString()} | last_sign_in ${u.last_sign_in_at?.toISOString() ?? "null"}`
    );
  }

  // 2. perbedaan nama public.users vs meta — apakah hanya whitespace?
  console.log("\n=== perbedaan nama (cek whitespace) ===");
  const pubUsers = await q("SELECT id, email, nama, auth_id FROM users");
  const liveUsers = await q("SELECT id, raw_user_meta_data FROM auth.users");
  const metaById = new Map<string, any>(
    liveUsers.map((u: any) => [u.id, u.raw_user_meta_data])
  );
  for (const p of pubUsers) {
    const meta = metaById.get(p.auth_id);
    const metaNama = meta?.nama;
    if (metaNama && String(metaNama) !== String(p.nama)) {
      const a = JSON.stringify(p.nama);
      const b = JSON.stringify(metaNama);
      const trimmed = String(metaNama).trim() === String(p.nama).trim();
      console.log(
        `${p.email}: public=${a} meta=${b} | sama-jika-trim=${trimmed}`
      );
    }
  }

  // 3. session aktif saat ini untuk guru
  console.log("\n=== session guru (live) ===");
  const guruSessions = await q(
    `SELECT id, created_at, updated_at, user_agent, ip, aal FROM auth.sessions WHERE user_id = '927fe78b-b4ad-4c1d-869c-20f9cc8fee20' ORDER BY created_at DESC LIMIT 10`
  );
  for (const s of guruSessions) {
    console.log(
      `  ${s.created_at.toISOString()} | UA=${s.user_agent} | IP=${s.ip} | aal=${s.aal}`
    );
  }

  await prisma.$disconnect();
}

main();
