import * as fs from "fs";
import { PrismaClient } from "@prisma/client";
import { createSupabaseAdmin } from "../src/lib/supabase/admin";

function loadEnvFile(file: string) {
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // file tidak ada — abaikan
  }
}
loadEnvFile(".env");
loadEnvFile(".env.local");

const prisma = new PrismaClient();

const EIGHT = [
  "ukasya.abdullah.@sekolah.internal",
  "roihan.abdullah@sekolah.internal",
  "gerai.ahmad2015@gmail.com",
  "ahmad.al.ghifari@sekolah.internal",
  "abdurrohman.harist@sekolah.internal",
  "muhammad.nashiruddin@sekolah.internal",
  "cemet12155@gmai.com",
  "muqbil.hadi@sekolah.internal",
];

async function main() {
  // 1. user_metadata di auth.users (sumber data yang tersisa di luar public schema)
  console.log("=== 1. user_metadata auth.users untuk 8 akun ===\n");
  const supabaseAdmin = createSupabaseAdmin();
  const { data: authUsers, error } =
    await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.log("Gagal list auth users:", error.message);
  } else {
    for (const email of EIGHT) {
      const u = authUsers.users.find((x) => x.email === email);
      if (!u) {
        console.log(`${email}: ❌ tidak ada di auth`);
        continue;
      }
      console.log(`${email}`);
      console.log(`  user_metadata: ${JSON.stringify(u.user_metadata)}`);
      console.log(
        `  app_metadata:  ${JSON.stringify(u.app_metadata ?? {})}`
      );
    }
  }

  // 2. EmailOutbox — apakah ada email yang dikirim ke 8 akun ini
  console.log("\n=== 2. EmailOutbox ===");
  const outboxTotal = await prisma.emailOutbox.count().catch(() => -1);
  console.log(`total baris EmailOutbox: ${outboxTotal}`);
  if (outboxTotal > 0) {
    const rows = await prisma.emailOutbox.findMany({
      where: { to: { in: EIGHT } },
      select: { to: true, subject: true, createdAt: true },
    });
    console.log(
      rows.length
        ? rows.map((r) => `  ${r.createdAt?.toISOString()} | ${r.to} | ${r.subject}`).join("\n")
        : "  tidak ada email ke 8 akun ini"
    );
  }

  // 3. Semua tabel public yang punya kolom userId — cek apakah ada baris untuk 8 akun
  console.log("\n=== 3. Baris di tabel lain yang mereferensi 8 akun ===");
  const userIds = await prisma.user.findMany({
    where: { email: { in: EIGHT } },
    select: { id: true, email: true },
  });
  const idList = userIds.map((u) => u.id);
  const tables: Array<[string, string]> = [
    ["Siswa", "siswa"],
    ["OrangTua", "orangTua"],
    ["ParentStudent", "parentStudent"],
    ["LoginAudit", "loginAudit"],
    ["Absensi", "absensi"],
    ["Rapor", "rapor"],
    ["Pembayaran", "pembayaran"],
    ["Akuntansi", "akuntansi"],
  ];
  for (const [label, model] of tables) {
    try {
      // @ts-expect-error dynamic model access
      const count = await prisma[model].count({
        // @ts-expect-error dynamic where
        where: { userId: { in: idList } },
      });
      console.log(`  ${label}: ${count} baris untuk 8 akun`);
    } catch {
      console.log(`  ${label}: (model/kolom tidak relevan)`);
    }
  }

  // 4. LoginAudit khusus untuk 8 akun (kolom bisa userId atau email)
  console.log("\n=== 4. LoginAudit oleh 8 akun ===");
  try {
    // @ts-expect-error dynamic
    const la = await prisma.loginAudit.findMany({
      where: { OR: [{ userId: { in: idList } }, { email: { in: EIGHT } }] },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    console.log(
      la.length
        ? la.map((r: unknown) => JSON.stringify(r)).join("\n")
        : "  tidak ada login oleh 8 akun"
    );
  } catch (e) {
    console.log("  (tidak bisa query loginAudit:", (e as Error).message + ")");
  }

  await prisma.$disconnect();
}

main();
