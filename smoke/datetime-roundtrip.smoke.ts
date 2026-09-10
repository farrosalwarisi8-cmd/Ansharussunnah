// smoke/datetime-roundtrip.smoke.ts
//
// Smoke test pada database nyata (dev): simpan → baca ulang → verifikasi waktu.
// Memvalidasi dua hal sekaligus:
//  1. Migrasi timestamptz: instan yang disimpan terbaca identik dan tampil WIB
//     (AT TIME ZONE 'Asia/Jakarta') sesuai jam yang dituju — tanpa geser 7 jam.
//  2. Helper pre-fill toDatetimeLocalValue round-trip terhadap nilai dari DB.
//
// AMAN: membuat ujian DRAFT dengan judul unik ber-prefix "__smoke__",
// lalu menghapusnya (before + after) sehingga tidak meninggalkan sampah.

import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { PrismaClient } from "@prisma/client"
import { toDatetimeLocalValue } from "@/lib/datetime-local"

const prisma = new PrismaClient()
const WIB = "Asia/Jakarta"
const PREFIX = "__smoke__timestamptz_"

const INTEN_MULAI = new Date("2026-09-25T06:00:00.000Z") // 13:00 WIB
const INTEN_SELESAI = new Date("2026-09-25T09:00:00.000Z") // 16:00 WIB

beforeAll(async () => {
  // Bersihkan sisa run sebelumnya (idempotent).
  await prisma.ujian.deleteMany({ where: { judul: { startsWith: PREFIX } } })
})

afterAll(async () => {
  await prisma.ujian.deleteMany({ where: { judul: { startsWith: PREFIX } } })
  await prisma.$disconnect()
})

describe("Round-trip waktu ujian di database nyata (timestamptz)", () => {
  it("simpan ujian → baca kembali → instan & tampilan WIB konsisten, lalu dibersihkan", async () => {
    // Ambil referensi FK dari data dev yang ada.
    const kelas = await prisma.kelas.findFirst()
    const mapel = await prisma.mataPelajaran.findFirst()
    const periode = await prisma.periodeAjaran.findFirst()
    const pembuat = await prisma.user.findFirst()
    expect(kelas, "tidak ada data kelas di DB dev").toBeTruthy()
    expect(mapel, "tidak ada data mapel di DB dev").toBeTruthy()
    expect(periode, "tidak ada data periode ajaran di DB dev").toBeTruthy()
    expect(pembuat, "tidak ada data user di DB dev").toBeTruthy()

    const judul = `${PREFIX}${Date.now()}`
    const dibuat = await prisma.ujian.create({
      data: {
        judul,
        mataPelajaranId: mapel!.id,
        kelasId: kelas!.id,
        periodeAjaranId: periode!.id,
        waktuMulai: INTEN_MULAI,
        waktuSelesai: INTEN_SELESAI,
        durasiMenit: 180,
        status: "DRAFT",
        dibuatOlehId: pembuat!.id,
      },
    })

    try {
      // 1) Prisma harus membaca kembali instan yang persis sama (tidak tergeser).
      const baca = await prisma.ujian.findUnique({ where: { id: dibuat.id } })
      expect(baca).not.toBeNull()
      expect(+baca!.waktuMulai).toBe(+INTEN_MULAI)
      expect(+baca!.waktuSelesai).toBe(+INTEN_SELESAI)

      // 2) Tampilan yang akan dilihat UI (SQL via AT TIME ZONE, seperti kode produksi)
      //    harus 13:00 & 16:00 WIB untuk instan 06:00Z & 09:00Z.
      const tampil: Array<{ mulai: string; selesai: string }> =
        await prisma.$queryRaw`
          SELECT
            to_char(u.waktu_mulai AT TIME ZONE ${WIB}::text, 'YYYY-MM-DD HH24:MI') AS mulai,
            to_char(u.waktu_selesai AT TIME ZONE ${WIB}::text, 'YYYY-MM-DD HH24:MI') AS selesai
          FROM ujians u
          WHERE u.id = ${dibuat.id}
        `
      expect(tampil[0]?.mulai).toBe("2026-09-25 13:00")
      expect(tampil[0]?.selesai).toBe("2026-09-25 16:00")

      // 3) Helper pre-fill: nilai yang dihasilkan jika di-parse sebagai waktu
      //    lokal harus mengembalikan instan yang sama (round-trip, zona-imun).
      const hasil = toDatetimeLocalValue(baca!.waktuMulai)
      expect(hasil).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      expect(new Date(hasil).toISOString()).toBe(INTEN_MULAI.toISOString())
    } finally {
      await prisma.ujian.deleteMany({ where: { id: dibuat.id } })
    }
  })
})