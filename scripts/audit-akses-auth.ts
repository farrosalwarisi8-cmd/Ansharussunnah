import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // coba akses langsung ke schema auth (Supabase GoTrue)
  try {
    const rows = await prisma.$queryRawUnsafe<
      { id: string; email: string | null; updated_at: Date; last_sign_in_at: Date | null }[]
    >("SELECT id, email, updated_at, last_sign_in_at FROM auth.users ORDER BY created_at DESC LIMIT 5");
    console.log("✅ akses auth.users OK. 5 user terakhir:");
    for (const r of rows) {
      console.log(`  ${r.email} | updated ${r.updated_at?.toISOString()} | last_sign_in ${r.last_sign_in_at?.toISOString() ?? "pernah"}`);
    }
  } catch (e: any) {
    console.log("❌ akses auth.users GAGAL:", e.message?.slice(0, 300));
  }

  // hitung tabel audit di public schema
  for (const t of [
    "password_reset_tokens",
    "login_audits",
    "email_outbox",
    "otp_verifikasi_emails",
    "pendaftaran_drafts",
  ]) {
    try {
      const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${t}`);
      console.log(`${t}: ${r[0]?.n}`);
    } catch (e: any) {
      console.log(`${t}: ERROR ${e.message?.slice(0, 120)}`);
    }
  }

  // User.lastPasswordChange — ada yang terisi?
  const lpc = await prisma.user.findMany({
    where: { lastPasswordChange: { not: null } },
    select: { id: true, email: true, nama: true, role: true, lastPasswordChange: true },
  });
  console.log(`\nUser dengan lastPasswordChange terisi: ${lpc.length}`);
  for (const u of lpc) console.log(`  ${u.email} | ${u.nama} | ${u.role} | ${u.lastPasswordChange?.toISOString()}`);

  // mustChangePassword terisi
  const mcp = await prisma.user.findMany({
    where: { mustChangePassword: true },
    select: { id: true, email: true, nama: true, role: true },
  });
  console.log(`\nUser dengan mustChangePassword=true: ${mcp.length}`);
  for (const u of mcp) console.log(`  ${u.email} | ${u.nama} | ${u.role}`);

  await prisma.$disconnect();
}

main();
