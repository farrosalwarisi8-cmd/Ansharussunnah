// prisma/seed.ts

import { PrismaClient, Role, JenisKelamin, TipeTransaksi, Prisma } from "@prisma/client"
import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"

dotenv.config()

// ✅ FIX P1017: Paksa Prisma Client Seeder memakai DIRECT_URL (Port 5432)
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function createAuthUser(email: string, password: string, nama: string, role: Role): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nama, role },
  })

  if (error) {
    if (error.message.includes("already been registered")) {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers()
      const existing = users.users.find((u) => u.email === email)
      if (!existing) throw new Error(`Gagal mengambil auth user: ${email}`)
      console.log(`  ℹ️  Auth user ${email} sudah ada`)
      return existing.id
    }
    throw error
  }

  console.log(`  ✔ Auth user ${email} berhasil dibuat`)
  return data.user.id
}

async function main() {
  console.log("🌱 Memulai proses seeding database...\n")

  // ========================================================
  // 1. USER ACCOUNTS
  // ========================================================
  console.log("1. Membuat Akun Pengguna...")

  const guruAuthId = await createAuthUser(
    "guru@sekolah.sch.id",
    "AdminGuru123!",
    "Ustadz Ahmad Fauzi, S.Pd",
    Role.GURU
  )

  const guruUser = await prisma.user.upsert({
    where: { email: "guru@sekolah.sch.id" },
    update: { authId: guruAuthId, isAdmin: true },
    create: {
      email: "guru@sekolah.sch.id",
      nama: "Ustadz Ahmad Fauzi, S.Pd",
      role: Role.GURU,
      authId: guruAuthId,
      mustChangePassword: true,
      isAdmin: true,
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
  console.log("  ✔ Record Guru berhasil dibuat")

  const financeAuthId = await createAuthUser(
    "keuangan@sekolah.sch.id",
    "AdminKeu123!",
    "Hj. Siti Aminah, S.E",
    Role.ADMIN_KEUANGAN
  )

  await prisma.user.upsert({
    where: { email: "keuangan@sekolah.sch.id" },
    update: { authId: financeAuthId },
    create: {
      email: "keuangan@sekolah.sch.id",
      nama: "Hj. Siti Aminah, S.E",
      role: Role.ADMIN_KEUANGAN,
      authId: financeAuthId,
      mustChangePassword: true,
    },
  })
  console.log("  ✔ Record Admin Keuangan berhasil dibuat")

  // ========================================================
  // 2. PERIODE AJARAN
  // ========================================================
  console.log("\n2. Membuat Periode Ajaran...")

  await prisma.periodeAjaran.upsert({
    where: { nama: "2025/2026 - Ganjil" },
    update: {},
    create: {
      nama: "2025/2026 - Ganjil",
      tahunAjaran: "2025/2026",
      semester: "GANJIL",
      tanggalMulai: new Date("2025-07-01"),
      tanggalSelesai: new Date("2025-12-31"),
      aktif: true,
    },
  })

  await prisma.periodeAjaran.upsert({
    where: { nama: "2025/2026 - Genap" },
    update: {},
    create: {
      nama: "2025/2026 - Genap",
      tahunAjaran: "2025/2026",
      semester: "GENAP",
      tanggalMulai: new Date("2026-01-01"),
      tanggalSelesai: new Date("2026-06-30"),
      aktif: false,
    },
  })
  console.log("  ✔ 2 Periode Ajaran berhasil dibuat (Ganjil aktif)")

  // ========================================================
  // 3. JENJANG & KELAS (Format EMIS Pesantren)
  // ========================================================
  console.log("\n3. Membuat Jenjang & Kelas...")

  // Struktur jenjang sesuai EMIS Pesantren
  const strukturJenjang = [
    {
      nama: "Madrasah Ibtidaiyyah",
      urutan: 1,
      kelas: Array.from({ length: 6 }, (_, i) => `Kelas ${i + 1}`),
    },
    {
      nama: "Madrasah Mutawasithah",
      urutan: 2,
      kelas: Array.from({ length: 3 }, (_, i) => `Kelas ${i + 1}`),
    },
    {
      nama: "Madrasah Aliyah",
      urutan: 3,
      kelas: Array.from({ length: 3 }, (_, i) => `Kelas ${i + 1}`),
    },
    {
      nama: "Kuliah Jurusan Agama Islam",
      urutan: 4,
      kelas: Array.from({ length: 4 }, (_, i) => `Tingkat ${i + 1}`),
    },
  ]

  const jenjangMap: Record<string, string> = {}
  const kelasMap: Record<string, string> = {}

  for (const j of strukturJenjang) {
    const jenjang = await prisma.jenjang.upsert({
      where: { nama: j.nama },
      update: { urutan: j.urutan },
      create: {
        nama: j.nama,
        urutan: j.urutan,
        aktif: true,
        tarifSppBulanan: null,
      },
    })
    jenjangMap[j.nama] = jenjang.id

    for (const namaKelas of j.kelas) {
      const kelas = await prisma.kelas.upsert({
        where: {
          nama_jenjangId: {
            nama: namaKelas,
            jenjangId: jenjang.id,
          },
        },
        update: {},
        create: {
          nama: namaKelas,
          jenjangId: jenjang.id,
          kapasitas: 30,
          aktif: true,
        },
      })
      kelasMap[namaKelas] = kelas.id
    }
  }
  console.log("  ✔ 4 Jenjang berhasil dibuat")
  console.log(`  ✔ ${Object.keys(kelasMap).length} Kelas berhasil dibuat`)

  // Assign wali kelas untuk beberapa kelas contoh
  if (guruUser.guru) {
    const firstKelasIbtidaiyyah = kelasMap["Kelas 1"]
    if (firstKelasIbtidaiyyah) {
      await prisma.kelas.update({
        where: { id: firstKelasIbtidaiyyah },
        data: { waliKelasId: guruUser.guru.id },
      })
    }
  }

  // ========================================================
  // 4. GURU-KELAS (Relasi Mengajar)
  // ========================================================
  console.log("\n4. Membuat Mata Pelajaran & Relasi Guru Mengajar...")

  // Buat Mata Pelajaran terlebih dahulu
  const mapelData = [
    { kode: "ALQ", nama: "Al-Quran", kelompok: "A" },
    { kode: "FIQ", nama: "Fiqih", kelompok: "A" },
    { kode: "AQD", nama: "Aqidah Akhlak", kelompok: "A" },
  ]

  const mapelMap: Record<string, string> = {}
  for (const m of mapelData) {
    const mapel = await prisma.mataPelajaran.upsert({
      where: { kode: m.kode },
      update: {},
      create: { kode: m.kode, nama: m.nama, kelompok: m.kelompok, aktif: true },
    })
    mapelMap[m.nama] = mapel.id
  }
  console.log("  ✔ 3 Mata Pelajaran berhasil dibuat")

  if (guruUser.guru) {
    const mapelKelas = [
      { kelasNama: "Kelas 1", jenjang: "Madrasah Ibtidaiyyah", mapel: "Al-Quran" },
      { kelasNama: "Kelas 1", jenjang: "Madrasah Ibtidaiyyah", mapel: "Fiqih" },
      { kelasNama: "Kelas 2", jenjang: "Madrasah Ibtidaiyyah", mapel: "Al-Quran" },
      { kelasNama: "Kelas 1", jenjang: "Madrasah Mutawasithah", mapel: "Aqidah Akhlak" },
    ]

    for (const mk of mapelKelas) {
      // Cari ID kelas berdasarkan nama kelas + jenjang
      const kelasRecord = await prisma.kelas.findFirst({
        where: {
          nama: mk.kelasNama,
          jenjang: { nama: mk.jenjang },
        },
      })
      if (kelasRecord) {
        await prisma.guruKelas.upsert({
          where: {
            guruId_kelasId_mataPelajaranId: {
              guruId: guruUser.guru.id,
              kelasId: kelasRecord.id,
              mataPelajaranId: mapelMap[mk.mapel],
            },
          },
          update: {},
          create: {
            guruId: guruUser.guru.id,
            kelasId: kelasRecord.id,
            mataPelajaranId: mapelMap[mk.mapel],
          },
        })
      }
    }
    console.log("  ✔ 4 Relasi Guru-Kelas-Mata Pelajaran berhasil dibuat")
  }

  // ========================================================
  // 5. KATEGORI TRANSAKSI KEUANGAN
  // ========================================================
  console.log("\n5. Membuat Kategori Transaksi Keuangan...")

  const kategoriData = [
    { nama: "SPP Bulanan", tipe: TipeTransaksi.PEMASUKAN, deskripsi: "Pembayaran SPP rutin bulanan siswa" },
    { nama: "Uang Pangkal", tipe: TipeTransaksi.PEMASUKAN, deskripsi: "Biaya pendaftaran awal siswa baru" },
    { nama: "Donasi", tipe: TipeTransaksi.PEMASUKAN, deskripsi: "Donasi dari wali murid atau pihak luar" },
    { nama: "Pemasukan Lain", tipe: TipeTransaksi.PEMASUKAN, deskripsi: "Pemasukan lainnya" },
    { nama: "Gaji Guru & Staf", tipe: TipeTransaksi.PENGELUARAN, deskripsi: "Pembayaran gaji bulanan" },
    { nama: "Operasional Sekolah", tipe: TipeTransaksi.PENGELUARAN, deskripsi: "Biaya listrik, air, internet, dll" },
    { nama: "Pembelian Sarana", tipe: TipeTransaksi.PENGELUARAN, deskripsi: "Pembelian buku, alat tulis, furniture" },
    { nama: "Pengeluaran Lain", tipe: TipeTransaksi.PENGELUARAN, deskripsi: "Pengeluaran lainnya" },
  ]

  for (const kat of kategoriData) {
    await prisma.kategoriTransaksi.upsert({
      where: { nama: kat.nama },
      update: { tipe: kat.tipe, deskripsi: kat.deskripsi },
      create: {
        nama: kat.nama,
        tipe: kat.tipe,
        deskripsi: kat.deskripsi,
        aktif: true,
      },
    })
  }
  console.log("  ✔ 8 Kategori Transaksi berhasil dibuat")

  console.log("\n==========================================")
  console.log("🎉 SEEDING SELESAI!")
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