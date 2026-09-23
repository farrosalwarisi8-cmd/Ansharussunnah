-- Biaya PPDB per jenjang (diatur admin). NULL = pakai default dari src/lib/biaya-ppdb.ts.
ALTER TABLE "jenjangs"
  ADD COLUMN IF NOT EXISTS "biaya_pendaftaran_ppdb" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "biaya_uang_gedung"      DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "biaya_sarpras"          DECIMAL(12,2);

-- Snapshot komponen biaya saat pendaftaran dibuat (kebal perubahan tarif oleh admin).
ALTER TABLE "pendaftarans"
  ADD COLUMN IF NOT EXISTS "biaya_uang_gedung" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "biaya_sarpras"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "bank_nama"         TEXT,
  ADD COLUMN IF NOT EXISTS "bank_no_rekening"  TEXT,
  ADD COLUMN IF NOT EXISTS "bank_atas_nama"    TEXT,
  ADD COLUMN IF NOT EXISTS "kontak_wa"         TEXT;

-- Pengaturan global PPDB: rekening tujuan transfer & kontak WA konfirmasi.
CREATE TABLE IF NOT EXISTS "pengaturan_ppdb" (
  "id"              INTEGER     NOT NULL DEFAULT 1,
  "bank_nama"       TEXT        NOT NULL DEFAULT 'BRI',
  "bank_no_rekening" TEXT       NOT NULL DEFAULT '321301015889536',
  "bank_atas_nama"  TEXT        NOT NULL DEFAULT 'Sadiman',
  "kontak_wa"       TEXT        NOT NULL DEFAULT '6285702854133',
  "nama_kontak_wa"  TEXT        NOT NULL DEFAULT 'Ust. Abu Wafidah',
  "created_at"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "pengaturan_ppdb_pkey" PRIMARY KEY ("id")
);

-- Baris tunggal pengaturan (idempotent).
INSERT INTO "pengaturan_ppdb" ("id", "updated_at")
VALUES (1, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Backfill snapshot: pendaftaran lama memakai nilai rekening yang berlaku saat ini.
UPDATE "pendaftarans"
SET "bank_nama"        = p."bank_nama",
    "bank_no_rekening" = p."bank_no_rekening",
    "bank_atas_nama"   = p."bank_atas_nama",
    "kontak_wa"        = p."kontak_wa"
FROM "pengaturan_ppdb" p
WHERE p."id" = 1
  AND "pendaftarans"."bank_no_rekening" IS NULL;
