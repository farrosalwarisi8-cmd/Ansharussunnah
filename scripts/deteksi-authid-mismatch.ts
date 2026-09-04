/**
 * scripts/deteksi-authid-mismatch.ts
 *
 * 🔍 SKRIP DIagnostik — Mendeteksi user dengan email sama tapi authId berbeda.
 *
 * MASALAH YANG DIDETEKSI:
 *   Sebelum bug "already been registered" diperbaiki, fungsi createAkunGuru dan
 *   createAkunAdminKeuangan bisa membuat Supabase Auth user BARU meskipun email
 *   sudah terdaftar dari role lain. Akibatnya: 1 email punya 2+ row di tabel
 *   users dengan authId YANG BERBEDA. User hanya bisa login ke 1 role (karena
 *   "Ganti Akun" hanya melihat authId yang cocok dengan session).
 *
 * CARA JALANKAN:
 *   npx tsx scripts/deteksi-authid-mismatch.ts
 *
 * CATATAN:
 *   - Script ini HANYA mendeteksi dan melaporkan. TIDAK mengubah data apapun.
 *   - SQL UPDATE yang dicetak harus dijalankan MANUAL oleh admin setelah verifikasi.
 *   - Pastikan environment variable DATABASE_URL sudah benar sebelum menjalankan.
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type UserRow = {
  id: string
  email: string
  nama: string
  role: string
  authId: string
  aktif: boolean
  createdAt: Date
}

async function main() {
  console.log("========================================================")
  console.log("  DETEKSI authId MISMATCH — User dengan email sama")
  console.log("  tapi authId BERBEDA di beberapa row")
  console.log("========================================================\n")

  // 1. Ambil semua user
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      nama: true,
      role: true,
      authId: true,
      aktif: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  console.log(`Total user di database: ${allUsers.length}\n`)

  // 2. Group by email (case-insensitive)
  const grouped = new Map<string, UserRow[]>()
  for (const user of allUsers) {
    const key = user.email.toLowerCase().trim()
    const existing = grouped.get(key) || []
    existing.push(user)
    grouped.set(key, existing)
  }

  // 3. Filter: hanya email yang punya >1 user DAN authId tidak semua sama
  const mismatches: Array<{ email: string; users: UserRow[] }> = []
  for (const [email, users] of grouped) {
    if (users.length < 2) continue
    const uniqueAuthIds = new Set(users.map((u) => u.authId))
    if (uniqueAuthIds.size > 1) {
      mismatches.push({ email, users })
    }
  }

  // 4. Laporan
  if (mismatches.length === 0) {
    console.log("✅ TIDAK DITEMUKAN user dengan authId mismatch.")
    console.log("   Semua email yang punya multiple role sudah memiliki authId yang konsisten.\n")
    await prisma.$disconnect()
    return
  }

  console.log(`⚠️  DITEMUKAN ${mismatches.length} email dengan authId MISMATCH:\n`)

  let totalAffectedRows = 0

  for (const { email, users } of mismatches) {
    totalAffectedRows += users.length
    console.log(`─── Email: ${email} ───`)
    console.log(`    Jumlah row: ${users.length}`)
    console.log("")

    // Pilih "authId yang benar": gunakan dari row paling lama (createdAt paling awal)
    // Karena itu kemungkinan besar akun Supabase Auth yang pertama kali dibuat.
    const sorted = [...users].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )
    const correctAuthId = sorted[0].authId

    for (const u of users) {
      const marker = u.authId === correctAuthId ? " ← ACUAN (paling awal)" : " ← PERLU UPDATE"
      console.log(`    [${u.role}]`)
      console.log(`      User ID:    ${u.id}`)
      console.log(`      Auth ID:    ${u.authId}${marker}`)
      console.log(`      Nama:       ${u.nama}`)
      console.log(`      Aktif:      ${u.aktif ? "Ya" : "Tidak"}`)
      console.log(`      Dibuat:     ${u.createdAt.toISOString()}`)
      console.log("")
    }

    // Cetak SQL saran untuk row yang perlu diupdate
    const rowsToUpdate = sorted.filter((u) => u.authId !== correctAuthId)
    if (rowsToUpdate.length > 0) {
      console.log(`    📝 SQL UPDATE (untuk menyamakan authId):`)
      for (const u of rowsToUpdate) {
        console.log(`       UPDATE "User" SET "auth_id" = '${correctAuthId}' WHERE id = '${u.id}';`)
      }
      console.log("")
    }
  }

  // 5. Ringkasan
  console.log("========================================================")
  console.log("  RINGKASAN")
  console.log("========================================================")
  console.log(`  Email dengan mismatch:     ${mismatches.length}`)
  console.log(`  Total row terdampak:       ${totalAffectedRows}`)
  console.log(`  Auth ID acuan (paling awal): ${mismatches[0]?.users[0]?.authId ?? "N/A"}`)
  console.log("")

  // 6. Peringatan penting
  console.log("========================================================")
  console.log("  ⚠️  PERINGATAN PENTING SEJALankan UPDATE")
  console.log("========================================================")
  console.log("")
  console.log("Mengubah authId User A menjadi sama dengan User B berarti:")
  console.log("  → Kedua row akan 'menyatu' identitasnya di sisi login Supabase.")
  console.log("  → Siapapun yang login dengan authId tersebut akan MELIHAT")
  console.log("    KEDUA role (misal: ORANG_TUA + ADMIN_KEUANGAN) dalam")
  console.log("    sesi yang sama — sesuai fitur 'Ganti Akun'.")
  console.log("")
  console.log("  INI ADALAH PERILAKU YANG DIINGINKAN. Namun pastikan:")
  console.log("  1. Email di kedua row MEMANG milik orang yang SAMA.")
  console.log("  2. Tidak ada row yang merupakan data uji/test/acuan.")
  console.log("  3. Backup database terlebih dahulu sebelum menjalankan UPDATE.")
  console.log("")
  console.log("  Contoh backup:")
  console.log('    pg_dump $DATABASE_URL > backup_before_authid_fix.sql')
  console.log("")
  console.log("  Setelah verifikasi, jalankan SQL UPDATE di atas secara manual,")
  console.log("  lalu JALANKAN LAGI skrip ini untuk memastikan tidak ada")
  console.log("  mismatch yang tersisa.")
  console.log("========================================================\n")

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("❌ Gagal menjalankan skrip diagnostik:", e)
  prisma.$disconnect()
  process.exit(1)
})
