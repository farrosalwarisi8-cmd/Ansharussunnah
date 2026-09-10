/**
 * scripts/cek-constraint-users.ts
 *
 * Diagnostik untuk memverifikasi kondisi constraint/index pada tabel users
 * SEBELUM menjalankan migration restore_multirole_authid_constraint.
 *
 * Mengecek:
 *   1. Daftar index & constraint pada tabel users
 *   2. Status migration di _prisma_migrations
 *   3. Duplikat (auth_id, role) yang akan melanggar uq_users_authid_role
 *   4. Duplikat email yang tidak boleh ada di DB (untuk konfirmasi)
 *   5. Eksistensi CHECK constraint chk_admin_role_consistency
 *
 * CARA JALANKAN:
 *   npx tsx scripts/cek-constraint-users.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("================= 1. INDEX & CONSTRAINT PADA tabel users =================")
  const indexes: Array<{ indexname: string; indexdef: string }> = await prisma.$queryRaw`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'users'
    ORDER BY indexname;
  `
  for (const idx of indexes) {
    console.log(`  - ${idx.indexname}`)
    console.log(`      ${idx.indexdef}`)
  }

  console.log("\n================= 2. CHECK CONSTRAINT pada tabel users =================")
  const checkConstraints: Array<{ conname: string; pg_get_constraintdef: string }> = await prisma.$queryRaw`
    SELECT conname, pg_get_constraintdef(oid) AS pg_get_constraintdef
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND contype = 'c'
    ORDER BY conname;
  `
  if (checkConstraints.length === 0) {
    console.log("  (tidak ada CHECK constraint)")
  }
  for (const c of checkConstraints) {
    console.log(`  - ${c.conname}: ${c.pg_get_constraintdef}`)
  }

  console.log("\n================= 3. Unique / Primary Key constraint pada users =================")
  const uniqueConstraints: Array<{ conname: string; pg_get_constraintdef: string }> = await prisma.$queryRaw`
    SELECT conname, pg_get_constraintdef(oid) AS pg_get_constraintdef
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND contype IN ('u', 'p')
    ORDER BY conname;
  `
  for (const c of uniqueConstraints) {
    console.log(`  - ${c.conname}: ${c.pg_get_constraintdef}`)
  }

  console.log("\n================= 4. STATUS MIGRATION (_prisma_migrations) =================")
  const migrations: Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null; logs: string | null }> = await prisma.$queryRaw`
    SELECT migration_name, finished_at, rolled_back_at, logs
    FROM _prisma_migrations
    ORDER BY started_at;
  `
  for (const m of migrations) {
    const status = m.rolled_back_at
      ? "ROLLED BACK"
      : m.finished_at
        ? "APPLIED"
        : "PENDING/FAILED"
    console.log(`  [${status}] ${m.migration_name}`)
    if (m.logs) {
      console.log(`      logs: ${m.logs}`)
    }
  }

  console.log("\n================= 5. DUPLIKAT (auth_id, role) — akan melanggar uq_users_authid_role =================")
  const dupAuthRole: Array<{ auth_id: string; role: string; jumlah: number }> = await prisma.$queryRaw`
    SELECT auth_id, role, count(*) AS jumlah
    FROM users
    GROUP BY auth_id, role
    HAVING count(*) > 1;
  `
  if (dupAuthRole.length === 0) {
    console.log("  ✅ TIDAK ADA duplikat (auth_id, role). Constraint baru aman dijalankan.")
  } else {
    console.log(`  ⚠️ DITEMUKAN ${dupAuthRole.length} duplikat:`)
    for (const d of dupAuthRole) {
      console.log(`     - auth_id=${d.auth_id} role=${d.role} (${d.jumlah} row)`)
    }
  }

  console.log("\n================= 6. DUPLIKAT EMAIL (case-insensitive) SEMENTARA =================")
  const dupEmail: Array<{ email: string; jumlah: number }> = await prisma.$queryRaw`
    SELECT lower(email) AS email, count(*) AS jumlah
    FROM users
    GROUP BY lower(email)
    HAVING count(*) > 1;
  `
  if (dupEmail.length === 0) {
    console.log("  ✅ TIDAK ADA email yang duplikat.")
  } else {
    console.log(`  INFO: ${dupEmail.length} email terpakai lebih dari 1 baris user (ini NORMAL untuk multi-role):`)
    for (const d of dupEmail) {
      console.log(`     - ${d.email} (${d.jumlah} row)`)
    }
  }

  console.log("\n================= 7. JUMLAH USER PER ROLE =================")
  const roleCounts: Array<{ role: string; jumlah: number }> = await prisma.$queryRaw`
    SELECT role, count(*) AS jumlah
    FROM users
    GROUP BY role
    ORDER BY role;
  `
  for (const r of roleCounts) {
    console.log(`  - ${r.role}: ${r.jumlah}`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Gagal menjalankan diagnostik:", e)
    prisma.$disconnect()
    process.exit(1)
  })