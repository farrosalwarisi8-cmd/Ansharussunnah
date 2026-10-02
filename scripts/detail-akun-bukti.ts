import * as fs from "fs";

const users = JSON.parse(fs.readFileSync("recovery/auth-users.json", "utf8"));
const identities = JSON.parse(fs.readFileSync("recovery/auth-identities.json", "utf8"));
const sessions = JSON.parse(fs.readFileSync("recovery/auth-sessions.json", "utf8"));
const refresh = JSON.parse(fs.readFileSync("recovery/auth-refresh-tokens.json", "utf8"));

console.log("=== SEMUA akun dengan pola siswa.reg (alur approval PPDB online) ===\n");
const regAccounts = users.filter((u: any) => (u.email || "").startsWith("siswa.reg"));
for (const u of regAccounts) {
  console.log(`${u.email}`);
  console.log(`  id: ${u.id}`);
  console.log(`  created: ${u.created_at} | last_sign_in: ${u.last_sign_in_at}`);
  console.log(`  confirmed: ${u.email_confirmed_at} | has_password: ${!!u.encrypted_password}`);
  console.log(`  meta: ${JSON.stringify(u.raw_user_meta_data)}`);
  const idn = identities.filter((i: any) => i.user_id === u.id);
  const ses = sessions.filter((s: any) => s.user_id === u.id);
  const rfr = refresh.filter((r: any) => r.user_id === u.id);
  console.log(`  identities: ${idn.length}, sessions: ${ses.length}, refresh_tokens: ${rfr.length}`);
  for (const s of ses) {
    console.log(`    session: ${s.created_at} → last_activity ${s.updated_at ?? "?"}`);
  }
  console.log("");
}

console.log("=== Akun yang pernah login (last_sign_in_at tidak null) ===\n");
const signedIn = users.filter((u: any) => u.last_sign_in_at);
for (const u of signedIn) {
  console.log(`${(u.email || "?").padEnd(45)} ${String(u.raw_user_meta_data?.nama ?? "-").padEnd(28)} ${u.raw_user_meta_data?.role ?? "-"} | sign_in ${u.last_sign_in_at}`);
}
console.log(`\n(total ${signedIn.length} dari ${users.length} akun pernah login)`);

console.log("\n=== Pencarian nama 'pagos'/'amba'/'ganteng'/'farros'/'faros'/'salim'/'asep' ===\n");
for (const u of users) {
  const n = String(u.raw_user_meta_data?.nama ?? "").toLowerCase();
  const e = String(u.email ?? "").toLowerCase();
  if (["pagos", "amba", "ganteng", "farros", "faros", "salim", "asep", "warisi"].some((k) => n.includes(k) || e.includes(k))) {
    console.log(`${u.email.padEnd(45)} ${u.raw_user_meta_data?.nama} (${u.raw_user_meta_data?.role}) | created ${u.created_at} | sign_in ${u.last_sign_in_at ?? "pernah"}`);
  }
}

console.log("\n=== REG number yang HARUS ada tapi TIDAK ditemukan di auth ===\n");
const expected = ["reg202600003", "reg202600004", "reg202600006", "reg202600008ra3k", "reg20260000967ye", "reg202600010lp6z", "reg202600009mwt7"];
const allEmails = users.map((u: any) => (u.email || "").toLowerCase());
for (const reg of expected) {
  const found = allEmails.some((e: string) => e.includes(reg));
  console.log(`siswa.${reg}@sekolah.internal → ${found ? "ADA" : "TIDAK ADA"}`);
}
