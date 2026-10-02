import * as fs from "fs";
import { PrismaClient, Role } from "@prisma/client";
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
const supabaseAdmin = createSupabaseAdmin();

const EMAIL = "guru@sekolah.sch.id";
const AUTH_ID = "927fe78b-b4ad-4c1d-869c-20f9cc8fee20";

async function main() {
  // 1. Verifikasi kondisi sebelum
  const sebelum = await prisma.user.findFirst({
    where: { authId: AUTH_ID },
    select: { id: true, email: true, nama: true, role: true, isAdmin: true, aktif: true },
  });
  if (!sebelum) {
    console.log(`❌ User dengan authId ${AUTH_ID} tidak ditemukan`);
    process.exit(1);
  }
  console.log("=== SEBELUM ===");
  console.log(
    `id=${sebelum.id} email=${sebelum.email} nama=${sebelum.nama} role=${sebelum.role} isAdmin=${sebelum.isAdmin} aktif=${sebelum.aktif}`
  );

  if (sebelum.role === Role.SUPER_ADMIN) {
    console.log("ℹ️  Role sudah SUPER_ADMIN — tidak perlu diubah.");
  } else {
    // 2. Ubah role di public.users
    await prisma.user.update({
      where: { id: sebelum.id },
      data: { role: Role.SUPER_ADMIN, isAdmin: true },
    });
    console.log("\n✅ public.users.role → SUPER_ADMIN (isAdmin=true dipertahankan)");
  }

  // 3. Sinkronkan user_metadata di Supabase Auth (pertahankan nama & email_verified)
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.updateUserById(AUTH_ID, {
      user_metadata: {
        nama: sebelum.nama,
        role: Role.SUPER_ADMIN,
        email_verified: true,
      },
    });
  if (authError) {
    console.log(`⚠️  Gagal sinkron user_metadata auth: ${authError.message}`);
  } else {
    console.log(
      `✅ auth user_metadata.role → ${JSON.stringify(authData.user?.user_metadata)}`
    );
  }

  // 4. Verifikasi sesudah
  const sesudah = await prisma.user.findFirst({
    where: { authId: AUTH_ID },
    select: { id: true, email: true, nama: true, role: true, isAdmin: true, aktif: true },
  });
  console.log("\n=== SESUDAH ===");
  console.log(
    `id=${sesudah?.id} email=${sesudah?.email} nama=${sesudah?.nama} role=${sesudah?.role} isAdmin=${sesudah?.isAdmin} aktif=${sesudah?.aktif}`
  );

  await prisma.$disconnect();
}

main();
