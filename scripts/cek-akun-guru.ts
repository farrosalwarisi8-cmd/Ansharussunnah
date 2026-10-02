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
const supabaseAdmin = createSupabaseAdmin();

const AUTH_ID = "927fe78b-b4ad-4c1d-869c-20f9cc8fee20";

async function main() {
  console.log("=== public.users dengan authId guru ===\n");
  const rows = await prisma.user.findMany({
    where: { authId: AUTH_ID },
    select: {
      id: true,
      email: true,
      nama: true,
      role: true,
      isAdmin: true,
      aktif: true,
      mustChangePassword: true,
      username: true,
      deleted_at: true,
    },
  });
  for (const r of rows) {
    console.log(
      `id=${r.id} email=${r.email} nama=${r.nama} role=${r.role} isAdmin=${r.isAdmin} aktif=${r.aktif} mustChange=${r.mustChangePassword} username=${r.username} deleted_at=${r.deleted_at}`
    );
  }
  console.log(`total: ${rows.length} baris`);

  console.log("\n=== auth user metadata ===");
  const { data, error } =
    await supabaseAdmin.auth.admin.getUserById(AUTH_ID);
  if (error) {
    console.log("error:", error.message);
  } else {
    console.log("email:", data.user?.email);
    console.log("user_metadata:", JSON.stringify(data.user?.user_metadata));
  }

  await prisma.$disconnect();
}

main();
