import * as fs from "fs";

const users = JSON.parse(fs.readFileSync("recovery/auth-users.json", "utf8")) as any[];
const identities = JSON.parse(fs.readFileSync("recovery/auth-identities.json", "utf8")) as any[];
const sessions = JSON.parse(fs.readFileSync("recovery/auth-sessions.json", "utf8")) as any[];
const refresh = JSON.parse(fs.readFileSync("recovery/auth-refresh-tokens.json", "utf8")) as any[];

const TARGET_IDS = [
  "4af6897d-bb52-4402-9c2a-0a2e8f82cb4e", // SISWA REG-2026-00011-3J33
  "5cc6c6d8-902a-4a96-bbb5-12322c8a5df6", // SISWA REG-2026-00001-4JC3
  "377a8083-c95a-4240-85d2-ca8b2aa5f7e4", // SISWA REG-2026-00005-W7BQ
  "de6fa6ba-1876-4789-a979-cdb50627990e", // ORTU salim
  "168d9a2f-2ae9-4eab-a5d9-53ff025265aa", // ORTU asep
];

console.log("=== 5 AKUN BUKTI TRANSFER — PERBANDINGAN ===\n");
for (const id of TARGET_IDS) {
  const u = users.find((x) => x.id === id);
  if (!u) {
    console.log(`${id}: TIDAK ADA di ekspor`);
    continue;
  }
  const meta = u.raw_user_meta_data ?? {};
  const idn = identities.filter((i) => i.user_id === id);
  const ses = sessions.filter((s) => s.user_id === id);
  const rfr = refresh.filter((r) => r.user_id === id);
  console.log(`EMAIL: ${u.email}`);
  console.log(`  nama meta: ${meta.nama} | role meta: ${meta.role}`);
  console.log(`  created: ${u.created_at} | last_sign_in: ${u.last_sign_in_at ?? "pernah"} | confirmed: ${u.email_confirmed_at}`);
  console.log(`  encrypted_password: ${u.encrypted_password}`);
  console.log(`  identities: ${idn.length}`);
  for (const i of idn) {
    console.log(`    provider=${i.provider} identity_id=${i.identity_id ?? "-"} email=${i.email ?? "-"}`);
  }
  console.log(`  sessions: ${ses.length}, refresh_tokens: ${rfr.length}`);
  for (const s of ses) {
    const ua = s.user_agent ?? "(tanpa user_agent)";
    const ip = s.ip ?? "(tanpa ip)";
    console.log(`    session ${s.id?.slice(0, 8)} | UA: ${ua} | IP: ${ip} | created ${s.created_at}`);
  }
  console.log("");
}

// scan: apakah ada hash password yang SAMA di antara 126 akun?
console.log("=== SCAN: hash password identik di antara semua akun auth ===");
const byHash = new Map<string, string[]>();
for (const u of users) {
  if (!u.encrypted_password) continue;
  const arr = byHash.get(u.encrypted_password) ?? [];
  arr.push(u.email ?? "?");
  byHash.set(u.encrypted_password, arr);
}
let dup = 0;
for (const [hash, emails] of byHash) {
  if (emails.length > 1) {
    dup++;
    console.log(`  ⚠️ hash sama dipakai ${emails.length} akun: ${emails.join(", ")}`);
    console.log(`    hash: ${hash.slice(0, 40)}...`);
  }
}
if (dup === 0) console.log("  ✅ TIDAK ada dua akun dengan hash password identik (semua berbeda)");

// scan: email yang dipakai >1 akun
console.log("\n=== SCAN: email yang dipakai lebih dari satu akun ===");
const byEmail = new Map<string, string[]>();
for (const u of users) {
  if (!u.email) continue;
  const arr = byEmail.get(u.email.toLowerCase()) ?? [];
  arr.push(u.id);
  byEmail.set(u.email.toLowerCase(), arr);
}
let dupEmail = 0;
for (const [email, ids] of byEmail) {
  if (ids.length > 1) {
    dupEmail++;
    console.log(`  ${email}: ${ids.length} akun (${ids.join(", ")})`);
  }
}
if (dupEmail === 0) console.log("  ✅ Tidak ada email duplikat di auth.users");

// bandingkan metadata nama untuk akun 'faros'
console.log("\n=== AKUN DENGAN nama meta 'faros' ===");
for (const u of users) {
  const meta = u.raw_user_meta_data ?? {};
  if (String(meta.nama ?? "").toLowerCase().includes("faros")) {
    console.log(`  ${u.email} | id=${u.id} | meta=${JSON.stringify(meta)} | created=${u.created_at}`);
  }
}
