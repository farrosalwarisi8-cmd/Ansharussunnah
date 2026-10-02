// Memulihkan baris `users` (public) yang terhapus saat wipe, dari ekspor
// auth.users yang selamat (recovery/auth-users.json).
//
// Mengapa aman:
//   - Skema auth TIDAK tersentuh wipe — 126 identitas + password hash utuh.
//   - `users` tidak punya FK ke auth.users (aplikasi yang menegakkan),
//     jadi mengisi ulang baris tidak mengubah auth sedikit pun.
//   - Idempotent: createMany + skipDuplicates → jalankan ulang tidak duplikat.
//
// Yang TIDAK bisa dipulihkan (harus dibuat ulang manual bila perlu):
//   - username (alias login) — tidak tersimpan di auth metadata
//   - baris multi-role tambahan (1 authId bisa punya beberapa role) —
//     auth.users hanya menyimpan satu role di raw_user_meta_data
//   - flag mustChangePassword asli — diisi false (password masih dikenal user)
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { PrismaClient, Role } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const ROLES = new Set<string>(Object.values(Role));

async function main() {
  const file = path.join(process.cwd(), "recovery", "auth-users.json");
  const users = JSON.parse(fs.readFileSync(file, "utf-8")) as {
    id: string;
    email: string | null;
    created_at: string;
    raw_user_meta_data?: { nama?: string; role?: string };
  }[];

  const rows: {
    email: string;
    nama: string;
    role: Role;
    authId: string;
    aktif: boolean;
    mustChangePassword: boolean;
    createdAt: Date;
  }[] = [];
  const dilewati: string[] = [];

  for (const u of users) {
    const meta = u.raw_user_meta_data ?? {};
    const role = meta.role;
    if (!u.email || !role || !ROLES.has(role)) {
      dilewati.push(`${u.email ?? "(tanpa email)"} (role=${role ?? "?"})`);
      continue;
    }
    rows.push({
      email: u.email,
      nama: (meta.nama ?? u.email.split("@")[0]).trim(),
      role: role as Role,
      authId: u.id,
      aktif: true,
      mustChangePassword: false,
      createdAt: new Date(u.created_at),
    });
  }

  console.log(`Ekspor auth.users: ${users.length} identitas`);
  if (dilewati.length) {
    console.log(`Dilewati (role tak valid / email null): ${dilewati.length}`);
    for (const d of dilewati) console.log(`  - ${d}`);
  }

  const hasil = await prisma.user.createMany({
    data: rows,
    skipDuplicates: true,
  });
  console.log(`Baris users dibuat: ${hasil.count}`);

  const sekarang = await prisma.user.groupBy({
    by: ["role"],
    _count: { _all: true },
  });
  console.log(
    "Distribusi users sekarang:",
    sekarang.map((g) => `${g.role}=${g._count._all}`).join(", ")
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("GAGAL:", e);
  process.exit(1);
});
