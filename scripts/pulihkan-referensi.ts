// Memulihkan DATA REFERENSI yang terhapus saat wipe skema public.
//
// Trim dari prisma/seed.ts — sengaja TANPA:
//   - pembuatan auth user (guru@ & keuangan@ SUDAH selamat di skema auth)
//   - 7 siswa contoh (akun auth-nya tidak selamat; tidak dibuat ulang
//     atas pilihan admin — produksi, bukan demo)
//
// Idempotent: semua upsert, aman dijalankan berulang kali.
import { PrismaClient, Role, JenisKelamin, TipeTransaksi, Prisma } from "@prisma/client"
import {
  defaultPendaftaranByNama,
  defaultGedungSarprasByNama,
  REKENING_PPDB_DEFAULT,
} from "../src/lib/biaya-ppdb"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL || process.env.DIRECT_URL },
  },
})

// auth.users tidak punya FK dari public — query langsung (read-only).
async function authIdByEmail(email: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }>(
    `SELECT id FROM auth.users WHERE email = $1`,
    email
  )
  return rows[0]?.id ?? null
}

async function main() {
  // ========================================================
  // 1. USER ADMIN (auth sudah ada — hanya isi baris users)
  // ========================================================
  console.log("1. Memulihkan record User admin...")

  const guruAuthId = await authIdByEmail("guru@sekolah.sch.id")
  if (!guruAuthId) throw new Error("auth guru@sekolah.sch.id TIDAK DITEMUKAN — berhenti")

  let guruUser = await prisma.user.findFirst({
    where: { authId: guruAuthId, role: Role.GURU },
    include: { guru: true },
  })

  if (!guruUser) {
    guruUser = await prisma.user.create({
      data: {
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
            jenisKelamin: JenisKelamin.LAKI_LAKI,
          },
        },
      },
      include: { guru: true },
    })
  } else {
    await prisma.user.update({
      where: { id: guruUser.id },
      data: { isAdmin: true },
    })
    // Baris users bisa jadi dipulihkan dari auth tanpa profile guru
    // (pulihan-users.ts hanya mengisi field dasar) — buat profile bila belum ada.
    if (!guruUser.guru) {
      await prisma.guru.create({
        data: {
          userId: guruUser.id,
          nip: "198501012010011001",
          jabatan: "Kepala Panitia PPDB",
          noHp: "081234567890",
          jenisKelamin: JenisKelamin.LAKI_LAKI,
        },
      })
      guruUser = await prisma.user.findFirst({
        where: { authId: guruAuthId, role: Role.GURU },
        include: { guru: true },
      })
    }
  }
  console.log("  ✔ Record Guru (Ustadz Ahmad Fauzi, S.Pd)")

  const financeAuthId = await authIdByEmail("keuangan@sekolah.sch.id")
  if (!financeAuthId) throw new Error("auth keuangan@sekolah.sch.id TIDAK DITEMUKAN — berhenti")

  const existingFinance = await prisma.user.findFirst({
    where: { authId: financeAuthId, role: Role.ADMIN_KEUANGAN },
  })

  if (!existingFinance) {
    await prisma.user.create({
      data: {
        email: "keuangan@sekolah.sch.id",
        nama: "Hj. Siti Aminah, S.E",
        role: Role.ADMIN_KEUANGAN,
        authId: financeAuthId,
        mustChangePassword: true,
      },
    })
  }
  console.log("  ✔ Record Admin Keuangan (Hj. Siti Aminah, S.E)")

  // ========================================================
  // 2. PERIODE AJARAN
  // ========================================================
  console.log("\n2. Memulihkan Periode Ajaran...")

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
  console.log("  ✔ 2 Periode Ajaran (Ganjil aktif)")

  // ========================================================
  // 3. JENJANG & KELAS (Format EMIS Pesantren)
  // ========================================================
  console.log("\n3. Memulihkan Jenjang & Kelas...")

  const strukturJenjang = [
    { nama: "Madrasah Ibtidaiyyah", urutan: 1, kelas: Array.from({ length: 6 }, (_, i) => `Kelas ${i + 1}`) },
    { nama: "Madrasah Mutawasithah", urutan: 2, kelas: Array.from({ length: 3 }, (_, i) => `Kelas ${i + 1}`) },
    { nama: "Madrasah Aliyah", urutan: 3, kelas: Array.from({ length: 3 }, (_, i) => `Kelas ${i + 1}`) },
    { nama: "Kuliah Jurusan Agama Islam", urutan: 4, kelas: Array.from({ length: 4 }, (_, i) => `Tingkat ${i + 1}`) },
  ]

  for (const j of strukturJenjang) {
    const biaya = defaultGedungSarprasByNama(j.nama)
    const biayaPendaftaran = defaultPendaftaranByNama(j.nama)

    const jenjang = await prisma.jenjang.upsert({
      where: { nama: j.nama },
      update: { urutan: j.urutan },
      create: {
        nama: j.nama,
        urutan: j.urutan,
        aktif: true,
        tarifSppBulanan: null,
        biayaPendaftaranPPDB: new Prisma.Decimal(biayaPendaftaran),
        biayaUangGedung: new Prisma.Decimal(biaya.uangGedung),
        biayaSarpras: new Prisma.Decimal(biaya.sarpras),
      },
    })
    for (const namaKelas of j.kelas) {
      await prisma.kelas.upsert({
        where: { nama_jenjangId: { nama: namaKelas, jenjangId: jenjang.id } },
        update: {},
        create: { nama: namaKelas, jenjangId: jenjang.id, kapasitas: 30, aktif: true },
      })
    }
  }
  console.log("  ✔ 4 Jenjang (beserta biaya PPDB default)")
  const jumlahKelas = await prisma.kelas.count()
  console.log(`  ✔ ${jumlahKelas} Kelas`)

  // ========================================================
  // 3b. PENGATURAN PPDB (Rekening & Kontak WA)
  // ========================================================
  console.log("\n3b. Memulihkan Pengaturan PPDB...")

  await prisma.pengaturanPPDB.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      bankNama: REKENING_PPDB_DEFAULT.bankNama,
      bankNoRekening: REKENING_PPDB_DEFAULT.bankNoRekening,
      bankAtasNama: REKENING_PPDB_DEFAULT.bankAtasNama,
      kontakWa: REKENING_PPDB_DEFAULT.kontakWa,
      namaKontakWa: REKENING_PPDB_DEFAULT.namaKontakWa,
    },
  })
  console.log(`  ✔ Rekening PPDB: ${REKENING_PPDB_DEFAULT.bankNama} ${REKENING_PPDB_DEFAULT.bankNoRekening}`)

  // Wali kelas: Kelas 1 Madrasah Ibtidaiyyah.
  // NB: jangan pakai kelasMap["Kelas 1"] — nama kelas sama di 3 jenjang
  // (MI/MTs/Aliyah) dan map akan tertimpa. Cari eksplisit per jenjang.
  if (guruUser.guru) {
    const miKelas1 = await prisma.kelas.findFirst({
      where: { nama: "Kelas 1", jenjang: { nama: "Madrasah Ibtidaiyyah" } },
    })
    if (miKelas1) {
      await prisma.kelas.update({
        where: { id: miKelas1.id },
        data: { waliKelasId: guruUser.guru.id },
      })
    }
  }

  // ========================================================
  // 4. GURU-KELAS (Relasi Mengajar)
  // ========================================================
  console.log("\n4. Memulihkan Mata Pelajaran & Relasi Guru Mengajar...")

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
  console.log("  ✔ 3 Mata Pelajaran")

  if (guruUser.guru) {
    const mapelKelas = [
      { kelasNama: "Kelas 1", jenjang: "Madrasah Ibtidaiyyah", mapel: "Al-Quran" },
      { kelasNama: "Kelas 1", jenjang: "Madrasah Ibtidaiyyah", mapel: "Fiqih" },
      { kelasNama: "Kelas 2", jenjang: "Madrasah Ibtidaiyyah", mapel: "Al-Quran" },
      { kelasNama: "Kelas 1", jenjang: "Madrasah Mutawasithah", mapel: "Aqidah Akhlak" },
    ]

    for (const mk of mapelKelas) {
      const kelasRecord = await prisma.kelas.findFirst({
        where: { nama: mk.kelasNama, jenjang: { nama: mk.jenjang } },
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
    console.log("  ✔ 4 Relasi Guru-Kelas-Mata Pelajaran")
  }

  // ========================================================
  // 6. KATEGORI TRANSAKSI KEUANGAN
  // ========================================================
  console.log("\n6. Memulihkan Kategori Transaksi Keuangan...")

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
      create: { nama: kat.nama, tipe: kat.tipe, deskripsi: kat.deskripsi, aktif: true },
    })
  }
  console.log("  ✔ 8 Kategori Transaksi")

  console.log("\n==========================================")
  console.log("🎉 PEMULIHAN DATA REFERENSI SELESAI!")
  console.log("==========================================")
}

main()
  .catch((e) => {
    console.error("❌ Error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
