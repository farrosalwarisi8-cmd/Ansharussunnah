-- Idempotency & anti-race untuk submit bukti pembayaran SPP.
--
-- Dua jaminan yang ditambahkan di level database (bukan hanya di application
-- layer, karena findUnique-lalu-create masih rentan race condition):
--
--   1. (tagihan_id, idempotency_key) unik — retry request dengan kunci sama
--      tidak boleh membuat baris pembayaran kedua. Kunci nullable: baris lama
--      dan klien yang belum mengirim kunci tetap boleh (banyak NULL).
--
--   2. Satu `PENDING` per tagihan (index unik PARSIAL) — jaring pengaman
--      terakhir agar dua request paralel tidak menghasilkan dua pembayaran
--      menunggu verifikasi untuk satu tagihan. Index parsial TIDAK bisa
--      direpresentasikan di Prisma schema, jadi hanya hidup di SQL ini.
--
-- Aman pada database kosong maupun existing: kolom ditambah dengan IF NOT
-- EXISTS, duplikat existing dibersihkan lebih dulu (pertahankan yang paling
-- awal), lalu index dibuat.

ALTER TABLE "pembayaran_siswas"
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

-- (1) Unique per tagihan + kunci.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pembayaran_tagihan_idempotency"
ON "pembayaran_siswas" ("tagihan_id", "idempotency_key");

-- (2) Bersihkan PENDING duplikat untuk tagihan yang sama (bila ada) sebelum
--     memasang index parsial; pertahankan baris paling awal.
DELETE FROM "pembayaran_siswas" a
USING "pembayaran_siswas" b
WHERE a."id" <> b."id"
  AND a."tagihan_id" = b."tagihan_id"
  AND a."status_pembayaran" = 'PENDING'
  AND b."status_pembayaran" = 'PENDING'
  AND a."created_at" > b."created_at";

CREATE UNIQUE INDEX IF NOT EXISTS "uq_pembayaran_pending_per_tagihan"
ON "pembayaran_siswas" ("tagihan_id")
WHERE "status_pembayaran" = 'PENDING';
