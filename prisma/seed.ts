// prisma/seed.ts

import { PrismaClient, Role, JenisKelamin } from "@prisma/client"
import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"

dotenv.config()

const prisma = new PrismaClient()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log("🌱 Memulai proses seeding database...")

  // ========================================================
  // 1. BUAT AKUN GURU (ADMIN) AWAL
  // ========================================================
  const guruEmail = "guru@sekolah.sch.id"
  const guruPassword = "AdminGuru123!"

  console.log(`\n1. Membuat User Auth Supabase untuk Guru (${guruEmail})...`)

  let authUserId: string

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: guruEmail,
      password: guruPassword,
      email_confirm: true,
      user_metadata: {
        nama: "Ustadz Ahmad Fauzi, S.Pd",
        role: Role.GURU,
      },
    })

  if (authError) {
    if (authError.message.includes("already been registered")) {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers()
      const existing = users.users.find((u) => u.email === guruEmail)
      if (!existing) throw new Error("Gagal mengambil data user auth lama")
      authUserId = existing.id
      console.log("ℹ️  User auth sudah ada di Supabase. Menggunakan authId yang ada.")
    } else {
      throw authError
    }
  } else {
    authUserId = authData.user.id
    console.log("✔ User auth Guru berhasil dibuat di Supabase.")
  }

  // Buat User di database Prisma
  const guruUser = await prisma.user.upsert({
    where: { email: guruEmail },
    update: { authId: authUserId },
    create: {
      email: guruEmail,
      nama: "Ustadz Ahmad Fauzi, S.Pd",
      role: Role.GURU,
      authId: authUserId,
      guru: {
        create: {
          nip: "198501012010011001",
          jabatan: "Kepala Panitia PPDB",
          noHp: "081234567890",
        },
      },
    },
    include: { guru: true },
  })
  console.log("✔ Record Guru berhasil dibuat di database.")

  // ========================================================
  // 2. SEED DAFTAR JENJANG (Kelas 1 - Kelas 6)
  // ========================================================
  console.log("\n2. Mengisi Master Jenjang...")

  const listJenjang = [
    { nama: "Kelas 1", urutan: 1 },
    { nama: "Kelas 2", urutan: 2 },
    { nama: "Kelas 3", urutan: 3 },
    { nama: "Kelas 4", urutan: 4 },
    { nama: "Kelas 5", urutan: 5 },
    { nama: "Kelas 6", urutan: 6 },
  ]

  for (const j of listJenjang) {
    await prisma.jenjang.upsert({
      where: { nama: j.nama },
      update: { urutan: j.urutan },
      create: {
        nama: j.nama,
        urutan: j.urutan,
        aktif: true,
      },
    })
  }
  console.log("✔ 6 Jenjang kelas berhasil dibuat.")

  // ========================================================
  // 3. SEED DAFTAR KELAS
  // ========================================================
  console.log("\n3. Mengisi Data Kelas Contoh...")

  const jenjang1 = await prisma.jenjang.findUnique({ where: { nama: "Kelas 1" } })
  const jenjang2 = await prisma.jenjang.findUnique({ where: { nama: "Kelas 2" } })

  if (jenjang1 && guruUser.guru) {
    await prisma.kelas.upsert({
      where: {
        nama_jenjangId: {
          nama: "1A (Ali bin Abi Thalib)",
          jenjangId: jenjang1.id,
        },
      },
      update: {},
      create: {
        nama: "1A (Ali bin Abi Thalib)",
        jenjangId: jenjang1.id,
        waliKelasId: guruUser.guru.id,
        kapasitas: 28,
        aktif: true,
      },
    })

    await prisma.kelas.upsert({
      where: {
        nama_jenjangId: {
          nama: "1B (Umar bin Khattab)",
          jenjangId: jenjang1.id,
        },
      },
      update: {},
      create: {
        nama: "1B (Umar bin Khattab)",
        jenjangId: jenjang1.id,
        kapasitas: 28,
        aktif: true,
      },
    })
  }

  if (jenjang2) {
    await prisma.kelas.upsert({
      where: {
        nama_jenjangId: {
          nama: "2A (Abu Bakar Ash-Shiddiq)",
          jenjangId: jenjang2.id,
        },
      },
      update: {},
      create: {
        nama: "2A (Abu Bakar Ash-Shiddiq)",
        jenjangId: jenjang2.id,
        kapasitas: 30,
        aktif: true,
      },
    })
  }
  console.log("✔ Sample kelas berhasil dibuat.")

  console.log("\n==========================================")
  console.log("🎉 SEEDING SELESAI!")
  console.log(`Akun Guru Login:`)
  console.log(`Email    : ${guruEmail}`)
  console.log(`Password : ${guruPassword}`)
  console.log("==========================================")
}

main()
  .catch((e) => {
    console.error("❌ Error saat seeding:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })