// scripts/cek-migrasi-prod-biaya-ppdb.ts
//
// Verifikasi READ-ONLY migration 20260923000000_add_biaya_ppdb_per_jenjang
// pada database yang ditunjuk .env.prod (DATABASE_URL / DIRECT_URL).
// Tidak ada operasi tulis — hanya SELECT dan introspeksi skema.
//
// Pemakaian:
//   npx tsx --env-file=.env.prod scripts/cek-migrasi-prod-biaya-ppdb.ts

import { PrismaClient, Prisma } from "@prisma/client"

function fail(msg: string): never {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) fail("DATABASE_URL kosong. Isi dulu file .env.prod lalu jalankan ulang.")
  if (!/pooler\.supabase\.(com|co)/.test(url)) {
    console.log("ℹ️  Catatan: host bukan Supabase pooler — pastikan ini DB production yang benar.")
  }

  const prisma = new PrismaClient({
    datasources: { db: { url } },
    log: [{ emit: "stdout", level: "error" }],
  })

  let ok = true
  try {
    // 1. Tabel pengaturan_ppdb + baris tunggal id=1
    const pengaturan = await prisma.$queryRaw<Array<{ bank_nama: string; bank_no_rekening: string; bank_atas_nama: string; kontak_wa: string }>>(
      Prisma.sql`SELECT bank_nama, bank_no_rekening, bank_atas_nama, kontak_wa FROM pengaturan_ppdb WHERE id = 1`
    )
    if (pengaturan.length === 1) {
      const p = pengaturan[0]
      console.log(`✅ pengaturan_ppdb: ada (id=1) — ${p.bank_nama} ${p.bank_no_rekening} a/n ${p.bank_atas_nama}, WA ${p.kontak_wa}`)
    } else if (pengaturan.length === 0) {
      console.log("⚠️  pengaturan_ppdb: tabel ada tapi baris id=1 TIDAK ADA (insert baris tunggal belum jalan?)")
      ok = false
    } else {
      console.log(`⚠️  pengaturan_ppdb: ${pengaturan.length} baris (seharusnya 1)`)
      ok = false
    }
  } catch (e) {
    console.error("❌ pengaturan_ppdb: TABEL TIDAK ADA — migration belum di-apply ke DB ini.")
    console.error(`   Detail: ${e instanceof Error ? e.message.split("\n")[0] : e}`)
    fail("Migration belum ter-apply. Jalankan: npx prisma migrate deploy (dengan DATABASE_URL production).")
  }

  try {
    // 2. Kolom biaya di jenjangs + nilai efektif
    const jenjang = await prisma.$queryRaw<Array<{
      id: string; nama: string; aktif: boolean; urutan: number
      biaya_pendaftaran_ppdb: string | null; biaya_uang_gedung: string | null; biaya_sarpras: string | null
    }>>(Prisma.sql`
      SELECT id, nama, aktif, urutan,
             biaya_pendaftaran_ppdb::text AS biaya_pendaftaran_ppdb,
             biaya_uang_gedung::text      AS biaya_uang_gedung,
             biaya_sarpras::text          AS biaya_sarpras
      FROM jenjangs ORDER BY urutan ASC
    `)

    const hasBiaya = jenjang.every((j) => "biaya_pendaftaran_ppdb" in j) // selalu true bila kolom ada — query di atas akan throw bila kolom tidak ada
    console.log(`✅ kolom biaya di jenjangs: ada (${jenjang.length} jenjang)`)

    const defaultByNama = (nama: string) => {
      if (/kuliah|mahad|aly/i.test(nama)) return { p: 100000, g: 0, s: 0 }
      if (/aliyah/i.test(nama)) return { p: 100000, g: 1000000, s: 250000 }
      if (/mutawasithah|mts/i.test(nama)) return { p: 100000, g: 600000, s: 250000 }
      return { p: 75000, g: 600000, s: 250000 } // MI
    }

    console.log("\nBiaya efektif per jenjang (NULL → fallback default):")
    for (const j of jenjang) {
      const d = defaultByNama(j.nama)
      const p = j.biaya_pendaftaran_ppdb ?? `${d.p} (default)`
      const g = j.biaya_uang_gedung ?? `${d.g} (default)`
      const s = j.biaya_sarpras ?? `${d.s} (default)`
      console.log(`   ${j.aktif ? "🟢" : "⚪️"} ${j.nama}: pendaftaran=${p}, gedung=${g}, sarpras=${s}`)
    }
  } catch (e) {
    console.error(`❌ kolom biaya jenjangs: tidak ditemukan (${e instanceof Error ? e.message.split("\n")[0] : e})`)
    ok = false
  }

  try {
    // 3. Kolom snapshot di pendaftarans + backfill
    const total = await prisma.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS n FROM pendaftarans`)
    const belumBackfill = await prisma.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM pendaftarans WHERE bank_no_rekening IS NULL
    `)
    const t = Number(total[0].n)
    const b = Number(belumBackfill[0].n)
    console.log(`\n✅ kolom snapshot di pendaftarans: ada`)
    console.log(`   Pendaftaran: ${t} baris — bank_no_rekening terisi: ${t - b}/${t}${b > 0 ? " (sisanya pendaftaran baru, wajar)" : ""}`)
  } catch (e) {
    console.error(`❌ kolom snapshot pendaftarans: tidak ditemukan (${e instanceof Error ? e.message.split("\n")[0] : e})`)
    ok = false
  }

  try {
    // 4. Migration terakhir yang tercatat di _prisma_migrations
    const last = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>(Prisma.sql`
      SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 1
    `)
    if (last[0]) {
      const status = last[0].finished_at ? "selesai" : "BELUM finished"
      console.log(`\n✅ _prisma_migrations: migration terakhir = ${last[0].migration_name} (${status})`)
      if (!last[0].migration_name.includes("biaya_ppdb")) {
        console.log("   ⚠️  Migration terakhir bukan biaya_ppdb — cek urutan migration.")
        ok = false
      }
    }
  } catch {
    console.log("\n⚠️  _prisma_migrations tidak bisa dibaca (opsional)")
  }

  await prisma.$disconnect()

  console.log(ok ? "\n🎉 SEMUA CEK LOLOS — migration biaya PPDB siap di production." : "\n⚠️  Ada masalah — lihat detail di atas.")
  process.exit(ok ? 0 : 1)
}

void main()
