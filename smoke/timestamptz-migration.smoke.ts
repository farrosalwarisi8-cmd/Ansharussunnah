// smoke/timestamptz-migration.smoke.ts
//
// Smoke test READ-ONLY pada database nyata (dev). Memverifikasi bahwa migrasi
// 20260910120000_make_timestamps_timestamptz benar-benar terpasang dan bahwa
// waktu ujian yang tersimpan menghasilkan tampilan WIB yang wajar.
//
// Tidak mengubah data apa pun di sini.
//
// Jalankan: npm run test:smoke

import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const WIB = "Asia/Jakarta"

beforeAll(async () => {
  // Pastikan koneksi ke database dev benar-benar hidup.
  await prisma.$queryRaw`SELECT 1`
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe("Migrasi timestamptz terpasang di database nyata", () => {
  it("tidak boleh ada kolom timestamp tanpa time zone (naive) tersisa", async () => {
    const naive: Array<{ n: bigint }> = await prisma.$queryRaw`
      SELECT count(*)::bigint AS n
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type LIKE 'timestamp%'
        AND data_type NOT LIKE '%with time zone'
    `
    expect(Number(naive[0]?.n ?? 0)).toBe(0)
  })

  it("harus ada kolom timestamp with time zone (konversi benar-benar terjadi)", async () => {
    const tstz: Array<{ n: bigint }> = await prisma.$queryRaw`
      SELECT count(*)::bigint AS n
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type LIKE 'timestamp with time zone%'
    `
    expect(Number(tstz[0]?.n ?? 0)).toBeGreaterThan(0)
  })

  it("waktu ujian published/selesai tampil WIB dalam jam wajar (>= 06:00, < 22:00)", async () => {
    const rows: Array<{ judul: string; jamMulai: number; jamSelesai: number }> =
      await prisma.$queryRaw`
        SELECT
          u.judul,
          to_char(u.waktu_mulai AT TIME ZONE ${WIB}::text, 'HH24')::int AS "jamMulai",
          to_char(u.waktu_selesai AT TIME ZONE ${WIB}::text, 'HH24')::int AS "jamSelesai"
        FROM ujians u
        WHERE u.status IN ('PUBLISHED', 'SELESAI')
        ORDER BY u.waktu_mulai
      `

    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.jamMulai, `mulai "${r.judul}"`).toBeGreaterThanOrEqual(6)
      expect(r.jamSelesai, `selesai "${r.judul}"`).toBeLessThan(22)
    }
  })
})