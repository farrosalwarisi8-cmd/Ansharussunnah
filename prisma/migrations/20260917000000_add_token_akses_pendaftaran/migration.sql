-- KEAMANAN: token akses rahasia per pendaftaran.
-- Kredensial upload dokumen & bukti transfer = nomorPendaftaran (publik) +
-- tokenAkses (rahasia 32 char). Menutup IDOR tulis: tahu nomor saja tidak
-- cukup untuk menimpa berkas pendaftaran orang lain.
--
-- gen_random_uuid() tersedia built-in di PostgreSQL >= 13 (pgcrypto pada
-- versi lama). Existing rows di-backfill agar tetap valid (NOT NULL).

ALTER TABLE "pendaftarans" ADD COLUMN "token_akses" TEXT;

UPDATE "pendaftarans"
SET "token_akses" = regexp_replace(
  gen_random_uuid()::text || gen_random_uuid()::text,
  '-',
  '',
  'g'
)
WHERE "token_akses" IS NULL;

ALTER TABLE "pendaftarans" ALTER COLUMN "token_akses" SET NOT NULL;

CREATE UNIQUE INDEX "pendaftarans_token_akses_key" ON "pendaftarans"("token_akses");