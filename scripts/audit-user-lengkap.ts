import * as fs from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function loadJson(file: string): any[] {
  return JSON.parse(fs.readFileSync(`recovery/${file}`, "utf8"));
}

// Normalisasi nilai agar bisa dibandingkan (Date → ISO, jsonb → JSON terurut)
function norm(v: any): string {
  if (v === null || v === undefined) return "∅";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if (typeof v === "string") {
      try {
        return norm(JSON.parse(v));
      } catch {
        return v;
      }
    }
    const sorted: any = {};
    for (const k of Object.keys(v).sort()) sorted[k] = norm(v[k]);
    return JSON.stringify(sorted);
  }
  return String(v);
}

const FIELDS_USER = [
  "instance_id",
  "aud",
  "role",
  "email",
  "encrypted_password",
  "email_confirmed_at",
  "invited_at",
  "confirmation_token",
  "confirmation_sent_at",
  "recovery_token",
  "recovery_sent_at",
  "email_change_token_new",
  "email_change",
  "email_change_sent_at",
  "last_sign_in_at",
  "raw_app_meta_data",
  "raw_user_meta_data",
  "is_super_admin",
  "created_at",
  "updated_at",
  "phone",
  "phone_confirmed_at",
  "phone_change",
  "phone_change_token",
  "phone_change_sent_at",
  "confirmed_at",
  "email_change_token_current",
  "email_change_confirm_status",
  "banned_until",
  "reauthentication_token",
  "reauthentication_sent_at",
  "is_sso_user",
  "deleted_at",
  "is_anonymous",
];

async function q(sql: string, ...params: any[]) {
  return prisma.$queryRawUnsafe<any[]>(sql, ...params);
}

async function main() {
  const expUsers = loadJson("auth-users.json");
  const expIdentities = loadJson("auth-identities.json");
  const expSessions = loadJson("auth-sessions.json");
  const expRefresh = loadJson("auth-refresh-tokens.json");
  const expMfa = loadJson("auth-mfa-amr-claims.json");

  const liveUsers = await q("SELECT * FROM auth.users");
  const liveIdentities = await q("SELECT * FROM auth.identities");
  const liveSessions = await q("SELECT * FROM auth.sessions");
  const liveRefresh = await q("SELECT * FROM auth.refresh_tokens");
  let liveMfa: any[] = [];
  try {
    liveMfa = await q("SELECT * FROM auth.mfa_amr_claims");
  } catch {
    liveMfa = [];
  }
  const loginAudits = await q("SELECT * FROM login_audits ORDER BY created_at DESC");

  const lines: string[] = [];
  const log = (s = "") => {
    lines.push(s);
    console.log(s);
  };

  const now = new Date().toISOString();
  log(`# Audit Integritas Data Pengguna — ${now}`);
  log("");
  log("Membandingkan data **live** (Supabase auth schema) vs **ekspor forensik**");
  log("(`recovery/auth-*.json`, diambil setelah penghapusan schema public).");
  log("");

  // ============ USERS ============
  log("## 1. auth.users");
  log("");
  log(`- Ekspor: ${expUsers.length} akun | Live: ${liveUsers.length} akun`);
  const expById = new Map<string, any>(expUsers.map((u) => [u.id, u]));
  const liveById = new Map<string, any>(liveUsers.map((u: any) => [u.id, u]));

  const onlyLive = liveUsers.filter((u: any) => !expById.has(u.id));
  const onlyExp = expUsers.filter((u) => !liveById.has(u.id));
  log(`- Akun baru di live (tidak ada di ekspor): ${onlyLive.length}`);
  for (const u of onlyLive) log(`  - ⚠️ ${u.email} (dibuat ${norm(u.created_at)})`);
  log(`- Akun hilang (ada di ekspor, tidak di live): ${onlyExp.length}`);
  for (const u of onlyExp) log(`  - ⚠️ ${u.email}`);

  // diff field per field
  let changed = 0;
  const changes: { email: string; id: string; diffs: string[] }[] = [];
  for (const u of expUsers) {
    const live = liveById.get(u.id);
    if (!live) continue;
    const diffs: string[] = [];
    for (const f of FIELDS_USER) {
      if (norm(u[f]) !== norm(live[f])) {
        const oldV = norm(u[f]);
        const newV = norm(live[f]);
        // sembunyikan detail password, tampilkan hanya "berubah/tetap"
        if (f === "encrypted_password") {
          diffs.push(`encrypted_password: ${oldV === newV ? "SAMA" : "**BERUBAH**"}`);
        } else if (f === "confirmation_token" || f === "recovery_token" || f === "reauthentication_token") {
          diffs.push(`${f}: token berubah (nilai disembunyikan)`);
        } else {
          diffs.push(`${f}: ${oldV} → ${newV}`);
        }
      }
    }
    if (diffs.length > 0) {
      changed++;
      changes.push({ email: u.email ?? "?", id: u.id, diffs });
    }
  }
  log(`- Akun dengan perubahan field: ${changed} dari ${expUsers.length}`);
  log("");
  if (changes.length > 0) {
    log("### Detail perubahan");
    for (const c of changes) {
      log(`- **${c.email}** (${c.id})`);
      for (const d of c.diffs) log(`  - ${d}`);
    }
    log("");
  }

  // ringkasan password
  const pwChanged = changes.filter((c) =>
    c.diffs.some((d) => d.includes("encrypted_password") && d.includes("BERUBAH"))
  );
  log("### Ringkasan password");
  log("");
  if (pwChanged.length === 0) {
    log(`✅ **${expUsers.length}/${expUsers.length} akun: hash password TIDAK BERUBAH** dari ekspor forensik.`);
    log("Tidak ada password yang di-reset atau diubah sejak ekspor diambil.");
  } else {
    log(`⚠️ ${pwChanged.length} akun hash password-nya BERUBAH:`);
    for (const c of pwChanged) log(`  - ${c.email}`);
  }
  log("");

  // ============ IDENTITIES ============
  log("## 2. auth.identities");
  log("");
  log(`- Ekspor: ${expIdentities.length} | Live: ${liveIdentities.length}`);
  const expIdn = new Map<string, any>(
    expIdentities.map((i: any) => [`${i.provider_id}|${i.user_id}`, i])
  );
  let idnDiff = 0;
  for (const i of expIdentities) {
    const live = liveIdentities.find(
      (x: any) => x.provider_id === i.provider_id && x.user_id === i.user_id
    );
    if (!live) {
      idnDiff++;
      log(`  - ⚠️ identity hilang: ${i.provider_id} untuk user ${i.user_id}`);
      continue;
    }
    for (const f of ["identity_data", "provider", "email", "last_sign_in_at"]) {
      if (norm(i[f]) !== norm(live[f])) {
        idnDiff++;
        log(`  - ⚠️ identity ${i.provider_id}/${i.user_id} field ${f} berubah`);
      }
    }
  }
  const newIdn = liveIdentities.filter(
    (x: any) => !expIdn.has(`${x.provider_id}|${x.user_id}`)
  );
  log(`- Identity baru di live: ${newIdn.length}`);
  for (const i of newIdn) log(`  - ⚠️ ${i.provider_id} untuk user ${i.user_id}`);
  log(`- Total perbedaan identity: ${idnDiff}`);
  log("");

  // ============ SESSIONS ============
  log("## 3. auth.sessions");
  log("");
  log(`- Ekspor: ${expSessions.length} | Live: ${liveSessions.length}`);
  const expSesIds = new Set(expSessions.map((s: any) => s.id));
  const newSes = liveSessions.filter((s: any) => !expSesIds.has(s.id));
  log(`- Sesi baru sejak ekspor: ${newSes.length}`);
  for (const s of newSes) {
    const u = expById.get(s.user_id) ?? liveById.get(s.user_id);
    log(
      `  - user ${u?.email ?? s.user_id} | UA: ${s.user_agent ?? "-"} | IP: ${s.ip ?? "-"} | dibuat ${norm(s.created_at)}`
    );
  }
  const goneSes = expSessions.filter((s: any) => !liveSessions.some((x: any) => x.id === s.id));
  log(`- Sesi di ekspor yang sudah tidak ada: ${goneSes.length}`);
  log("");

  // ============ REFRESH TOKENS ============
  log("## 4. auth.refresh_tokens");
  log("");
  log(`- Ekspor: ${expRefresh.length} | Live: ${liveRefresh.length}`);
  const expRfIds = new Set(expRefresh.map((r: any) => r.id));
  const newRf = liveRefresh.filter((r: any) => !expRfIds.has(r.id));
  log(`- Refresh token baru sejak ekspor: ${newRf.length}`);
  const revoked = liveRefresh.filter((r: any) => r.revoked === true);
  log(`- Refresh token yang di-revoke: ${revoked.length}`);
  log("");

  // ============ MFA ============
  log("## 5. auth.mfa_amr_claims");
  log("");
  log(`- Ekspor: ${expMfa.length} | Live: ${liveMfa.length}`);
  log("");

  // ============ LOGIN AUDITS ============
  log("## 6. login_audits (public schema)");
  log("");
  log(`- Baris: ${loginAudits.length}`);
  for (const a of loginAudits) {
    log(
      `  - ${norm(a.created_at)} | email=${a.email ?? "-"} | success=${a.success ?? "-"} | ip=${a.ip_address ?? a.ip ?? "-"} | userAgent=${(a.user_agent ?? "-")}`
    );
  }
  log("");

  // ============ PUBLIC.USERS LINKAGE ============
  log("## 7. Linkage public.users ↔ auth.users");
  log("");
  const pubUsers = await q("SELECT * FROM users ORDER BY created_at");
  log(`- public.users: ${pubUsers.length} baris`);
  let linkOk = 0;
  const linkProblems: string[] = [];
  for (const p of pubUsers) {
    const live = liveById.get(p.auth_id);
    if (!live) {
      linkProblems.push(`${p.email} (id=${p.id}): authId ${p.auth_id} TIDAK ADA di auth.users`);
      continue;
    }
    const metaRole = (live.raw_user_meta_data as any)?.role;
    const metaNama = (live.raw_user_meta_data as any)?.nama;
    const problems: string[] = [];
    if (metaRole && metaRole !== p.role) problems.push(`role ${p.role} ≠ meta role ${metaRole}`);
    if (live.email && live.email.toLowerCase() !== (p.email ?? "").toLowerCase())
      problems.push(`email ${p.email} ≠ auth email ${live.email}`);
    if (metaNama && norm(metaNama) !== norm(p.nama)) problems.push(`nama ${p.nama} ≠ meta nama ${metaNama}`);
    if (problems.length > 0) linkProblems.push(`${p.email}: ${problems.join("; ")}`);
    else linkOk++;
  }
  log(`- Linkage konsisten: ${linkOk}/${pubUsers.length}`);
  for (const p of linkProblems) log(`  - ⚠️ ${p}`);
  log("");

  // mustChangePassword / lastPasswordChange
  const mcp = pubUsers.filter((p: any) => p.must_change_password === true);
  const lpc = pubUsers.filter((p: any) => p.last_password_change !== null);
  log(`- mustChangePassword=true: ${mcp.length}`);
  log(`- lastPasswordChange terisi: ${lpc.length}`);
  log("");

  // ============ KESIMPULAN ============
  log("## Kesimpulan");
  log("");
  const pwOk = pwChanged.length === 0;
  log(
    pwOk
      ? "✅ Semua hash password 126 akun TIDAK BERUBAH vs ekspor forensik — tidak ada password yang direset/diubah."
      : `⚠️ ${pwChanged.length} akun mengalami perubahan password.`
  );
  log(
    changed === 0
      ? "✅ Tidak ada field auth.users yang berubah sama sekali."
      : `ℹ️ ${changed} akun memiliki perubahan field lain (lihat detail di atas — biasanya updated_at/last_sign_in_at karena login baru, bukan password).`
  );
  log("");

  fs.writeFileSync("recovery/AUDIT-PENGGUNA-2026-10-02.md", lines.join("\n"), "utf8");
  console.log("\n[Laporan disimpan: recovery/AUDIT-PENGGUNA-2026-10-02.md]");

  await prisma.$disconnect();
}

main();
