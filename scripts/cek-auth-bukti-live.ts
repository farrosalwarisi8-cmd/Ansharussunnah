import * as fs from "fs";
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

const supabaseAdmin = createSupabaseAdmin();

const TARGETS = [
  "4af6897d-bb52-4402-9c2a-0a2e8f82cb4e", // SISWA REG-2026-00011-3J33
  "5cc6c6d8-902a-4a96-bbb5-12322c8a5df6", // SISWA REG-2026-00001-4JC3
  "377a8083-c95a-4240-85d2-ca8b2aa5f7e4", // SISWA REG-2026-00005-W7BQ
  "de6fa6ba-1876-4789-a979-cdb50627990e", // ORTU salim lombakuy12
  "168d9a2f-2ae9-4eab-a5d9-53ff025265aa", // ORTU asep farrosalwarisi8
];

async function main() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (error) {
    console.log("ERROR listUsers:", error.message);
    return;
  }
  const users = data.users;
  console.log(`auth.users live: ${users.length} akun`);

  const ekspor = JSON.parse(
    fs.readFileSync("recovery/auth-users.json", "utf8")
  ) as any[];
  console.log(`auth.users ekspor forensik: ${ekspor.length} akun`);

  console.log("\n=== 5 AKUN BUKTI TRANSFER (live) ===");
  for (const id of TARGETS) {
    const u = users.find((x) => x.id === id);
    if (!u) {
      console.log(`${id}: ❌ TIDAK ADA di auth`);
      continue;
    }
    const meta = (u.user_metadata ?? {}) as { nama?: string; role?: string };
    console.log(
      `  ${u.id} | ${u.email} | ${meta.nama} | ${meta.role} | created ${u.created_at} | last_sign_in ${u.last_sign_in_at ?? "PERNAH"}`
    );
  }

  // akun yang pernah login
  const ever = users.filter((u) => u.last_sign_in_at);
  console.log(`\n=== AKUN PERNAH LOGIN: ${ever.length} ===`);
  for (const u of ever) {
    const meta = (u.user_metadata ?? {}) as { nama?: string; role?: string };
    console.log(
      `  ${u.email} | ${meta.nama} | ${meta.role} | last ${u.last_sign_in_at}`
    );
  }
}

main();
