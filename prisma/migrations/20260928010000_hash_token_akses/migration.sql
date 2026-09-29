-- KEAMANAN: token akses tidak lagi disimpan plaintext.
--
-- Sebelumnya "token_akses" menyimpan nanoid(32) apa adanya, sehingga siapa pun
-- yang memperoleh dump/read-replica database bisa mengambil kredensial upload
-- milik semua pemilik pendaftaran yang masih aktif. Sekarang hanya disimpan
-- SHA-256 hex-nya.
--
-- Kenapa SHA-256 dan bukan bcrypt/argon2? Karena token adalah 32 char nanoid
-- (alphanumeric + "-"/"_") => ~192 bit entropy, sehingga TIDAK bisa di-brute
-- force dan tidak rentan rainbow table. Hash lambat hanya dibutuhkan untuk
-- secret BERENTI DUA PILIHAN (mis. password), bukan untuk token acak. Fungsi
-- Node yang dipakai server adalah:
--   createHash("sha256").update(token).digest("hex")
-- dan encode(sha256(convert_to(x,'UTF8')),'hex') di bawah menghasilkan hex
-- lowercase yang sama persis, sehingga baris lama tetap bisa diverifikasi.
--
-- Backfill memakai fungsi bawaan PostgreSQL >= 11 (sha256), jadi tidak perlu
-- CREATE EXTENSION pgcrypto di sini.

ALTER TABLE "pendaftarans" ADD COLUMN "token_akses_hash" TEXT;

-- Backfill: token yang sudah terbit tetap berlaku, tidak ada pengguna yang
-- kehilangan akses upload karena migrasi ini.
UPDATE "pendaftarans"
SET "token_akses_hash" = encode(
  sha256(convert_to("token_akses", 'UTF8')),
  'hex'
)
WHERE "token_akses" IS NOT NULL;

CREATE UNIQUE INDEX "pendaftarans_token_akses_hash_key"
  ON "pendaftarans"("token_akses_hash");

-- Kolom plaintext dihapus setelah hash terisi, supaya tidak ada dua sumber
-- kebenaran dan tidak ada string yang bisa bocor dari dump lama.
ALTER TABLE "pendaftarans" DROP COLUMN "token_akses";
