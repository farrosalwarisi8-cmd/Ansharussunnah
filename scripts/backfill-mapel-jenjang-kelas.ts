/**
 * scripts/backfill-mapel-jenjang-kelas.ts
 *
 * 🔄 SKRIP BACKFILL — Menetapkan jenjangId dan MapelKelas untuk MataPelajaran yang belum punya.
 *
 * LOGIKA:
 *   1. Untuk setiap MataPelajaran, cari semua GuruKelas yang menggunakannya.
 *   2. Dari GuruKelas → Kelas → Jenjang, tentukan jenjangId yang paling cocok.
 *      - Jika semua kelas berasal dari jenjang yang SAMA → jenjangId = jenjang tersebut.
 *      - Jika ada beberapa jenjang → pilih yang paling banyak digunakan.
 *   3. Buat MapelKelas dari data GuruKelas yang ada (mapel yang diajar di kelas tertentu).
 *
 * CARA JALANKAN:
 *   npx tsx scripts/backfill-mapel-jenjang-kelas.ts
 *   npx tsx scripts/backfill-mapel-jenjang-kelas.ts --dry-run   (hanya tampilkan, jangan ubah)
 *   npx tsx scripts/backfill-mapel-jenjang-kelas.ts --apply     (langsung apply perubahan)
 *
 * CATATAN:
 *   - Script ini aman: default-nya hanya DRY RUN (tidak mengubah data).
 *   - Gunakan --apply untuk benar-benar menjalankan UPDATE/INSERT.
 *   - Pastikan environment variable DATABASE_URL sudah benar.
 *   - Backup database terlebih dahulu sebelum menjalankan --apply.
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const DRY_RUN = !process.argv.includes("--apply")

async function main() {
  console.log("========================================================")
  console.log("  BACKFILL: jenjangId & MapelKelas untuk MataPelajaran")
  console.log(`  Mode: ${DRY_RUN ? "🔍 DRY RUN (tidak mengubah data)" : "⚡ APPLY (akan mengubah data)"}`)
  console.log("========================================================\n")

  // 1. Ambil semua MataPelajaran
  const allMapels = await prisma.mataPelajaran.findMany({
    select: {
      id: true,
      kode: true,
      nama: true,
      jenjangId: true,
    },
    orderBy: { nama: "asc" },
  })

  console.log(`Total MataPelajaran: ${allMapels.length}\n`)

  // 2. Ambil semua GuruKelas beserta relasi kelas → jenjang
  const allGuruKelas = await prisma.guruKelas.findMany({
    select: {
      mataPelajaranId: true,
      kelasId: true,
      kelas: {
        select: {
          id: true,
          nama: true,
          jenjangId: true,
          jenjang: { select: { id: true, nama: true } },
        },
      },
    },
  })

  console.log(`Total GuruKelas (penugasan guru): ${allGuruKelas.length}\n`)

  // 3. Kelompokkan GuruKelas per MataPelajaran
  const mapelToKelasData = new Map<
    string,
    Array<{
      kelasId: string
      kelasNama: string
      jenjangId: string
      jenjangNama: string
    }>
  >()

  for (const gk of allGuruKelas) {
    const existing = mapelToKelasData.get(gk.mataPelajaranId) || []
    existing.push({
      kelasId: gk.kelasId,
      kelasNama: gk.kelas.nama,
      jenjangId: gk.kelas.jenjangId,
      jenjangNama: gk.kelas.jenjang.nama,
    })
    mapelToKelasData.set(gk.mataPelajaranId, existing)
  }

  // 4. Analisis & tentukan jenjangId untuk setiap mapel
  type BackfillResult = {
    mapelId: string
    kode: string
    nama: string
    currentJenjangId: string | null
    proposedJenjangId: string | null
    proposedJenjangNama: string | null
    kelasList: Array<{ id: string; nama: string }>
    source: "guruKelas" | "no-data" | "already-set"
  }

  const results: BackfillResult[] = []

  for (const mapel of allMapels) {
    const kelasData = mapelToKelasData.get(mapel.id) || []

    // Jika sudah punya jenjangId, skip
    if (mapel.jenjangId) {
      results.push({
        mapelId: mapel.id,
        kode: mapel.kode,
        nama: mapel.nama,
        currentJenjangId: mapel.jenjangId,
        proposedJenjangId: null,
        proposedJenjangNama: null,
        kelasList: kelasData.map((k) => ({ id: k.kelasId, nama: k.kelasNama })),
        source: "already-set",
      })
      continue
    }

    // Tidak ada data GuruKelas
    if (kelasData.length === 0) {
      results.push({
        mapelId: mapel.id,
        kode: mapel.kode,
        nama: mapel.nama,
        currentJenjangId: null,
        proposedJenjangId: null,
        proposedJenjangNama: null,
        kelasList: [],
        source: "no-data",
      })
      continue
    }

    // Hitung jenjang mana yang paling banyak digunakan
    const jenjangCount = new Map<string, { id: string; nama: string; count: number }>()
    for (const k of kelasData) {
      const existing = jenjangCount.get(k.jenjangId)
      if (existing) {
        existing.count++
      } else {
        jenjangCount.set(k.jenjangId, { id: k.jenjangId, nama: k.jenjangNama, count: 1 })
      }
    }

    // Pilih jenjang dengan count tertinggi
    const sorted = Array.from(jenjangCount.values()).sort((a, b) => b.count - a.count)
    const bestJenjang = sorted[0]

    // Kumpulkan kelas unik
    const uniqueKelas = new Map<string, { id: string; nama: string }>()
    for (const k of kelasData) {
      uniqueKelas.set(k.kelasId, { id: k.kelasId, nama: k.kelasNama })
    }

    results.push({
      mapelId: mapel.id,
      kode: mapel.kode,
      nama: mapel.nama,
      currentJenjangId: null,
      proposedJenjangId: bestJenjang.id,
      proposedJenjangNama: bestJenjang.nama,
      kelasList: Array.from(uniqueKelas.values()),
      source: "guruKelas",
    })
  }

  // 5. Tampilkan laporan
  const alreadySet = results.filter((r) => r.source === "already-set")
  const canInfer = results.filter((r) => r.source === "guruKelas")
  const noData = results.filter((r) => r.source === "no-data")

  console.log("────────────────────────────────────────────────")
  console.log("  RINGKASAN ANALISIS")
  console.log("────────────────────────────────────────────────")
  console.log(`  Sudah punya jenjangId:     ${alreadySet.length}`)
  console.log(`  Bisa disinfer dari GuruKelas: ${canInfer.length}`)
  console.log(`  Tidak ada data GuruKelas:  ${noData.length}`)
  console.log("")

  // Tampilkan detail mapel yang bisa disinfer
  if (canInfer.length > 0) {
    console.log("────────────────────────────────────────────────")
    console.log("  MAPEL YANG AKAN DIUPDATE (jenjangId + MapelKelas)")
    console.log("────────────────────────────────────────────────\n")

    for (const r of canInfer) {
      console.log(`  📘 ${r.nama} (${r.kode})`)
      console.log(`     → Jenjang: ${r.proposedJenjangNama}`)
      console.log(`     → Kelas: ${r.kelasList.map((k) => k.nama).join(", ")}`)
      console.log("")
    }
  }

  // Tampilkan mapel yang tidak bisa disinfer
  if (noData.length > 0) {
    console.log("────────────────────────────────────────────────")
    console.log("  MAPEL TANPA DATA GURUKELAS (perlu diassign manual)")
    console.log("────────────────────────────────────────────────\n")

    for (const r of noData) {
      console.log(`  ⚠️  ${r.nama} (${r.kode}) — tidak ada penugasan guru`)
    }
    console.log("")
  }

  // 6. Apply jika mode --apply
  if (!DRY_RUN && canInfer.length > 0) {
    console.log("────────────────────────────────────────────────")
    console.log("  ⚡ MENGAPLIKASikan PERUBAHAN...")
    console.log("────────────────────────────────────────────────\n")

    let updatedCount = 0
    let mapelKelasCreated = 0

    for (const r of canInfer) {
      // Update jenjangId
      await prisma.mataPelajaran.update({
        where: { id: r.mapelId },
        data: { jenjangId: r.proposedJenjangId },
      })
      updatedCount++

      // Buat MapelKelas records
      if (r.kelasList.length > 0) {
        await prisma.mapelKelas.createMany({
          data: r.kelasList.map((k) => ({
            mapelId: r.mapelId,
            kelasId: k.id,
          })),
          skipDuplicates: true,
        })
        mapelKelasCreated += r.kelasList.length
      }

      console.log(`  ✅ ${r.nama} (${r.kode}) → jenjang: ${r.proposedJenjangNama}, ${r.kelasList.length} kelas`)
    }

    console.log("")
    console.log("────────────────────────────────────────────────")
    console.log("  RINGKASAN PERUBAHAN")
    console.log("────────────────────────────────────────────────")
    console.log(`  MataPelajaran diupdate:    ${updatedCount}`)
    console.log(`  MapelKelas dibuat:         ${mapelKelasCreated}`)
    console.log("────────────────────────────────────────────────\n")
  } else if (DRY_RUN && canInfer.length > 0) {
    console.log("────────────────────────────────────────────────")
    console.log("  ℹ️  Ini adalah DRY RUN. Tidak ada data yang diubah.")
    console.log("  Jalankan dengan --apply untuk menerapkan perubahan:")
    console.log("    npx tsx scripts/backfill-mapel-jenjang-kelas.ts --apply")
    console.log("────────────────────────────────────────────────\n")
  } else {
    console.log("  ✅ Tidak ada perubahan yang diperlukan.\n")
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("❌ Gagal menjalankan skrip backfill:", e)
  prisma.$disconnect()
  process.exit(1)
})
