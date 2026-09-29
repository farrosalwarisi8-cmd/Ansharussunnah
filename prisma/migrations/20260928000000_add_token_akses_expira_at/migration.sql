-- Batas berlaku token akses pendaftaran (90 hari sejak pendaftaran dibuat).
-- Setelah lewat, alur publik (upload bukti transfer & upload dokumen) mengunci
-- dan pemilik melengkapi berkas dari dashboard.
ALTER TABLE "pendaftarans"
  ADD COLUMN IF NOT EXISTS "token_akses_expira_at" TIMESTAMPTZ(3);

-- Backfill baris lama: 90 hari sejak pendaftaran dibuat. Pendaftaran yang memang
-- sudah lewat 90 hari ikut kedaluwarsa sesuai kebijakan; kasus seperti itu
-- masih bisa ditangani panitia secara manual.
UPDATE "pendaftarans"
SET "token_akses_expira_at" = "created_at" + INTERVAL '90 days'
WHERE "token_akses_expira_at" IS NULL;

-- Default sama dengan bentuk baris baru, sehingga Sisip di luar aplikasi
-- (mis. skrip-operasional) tetap mendapat token yang berlaku 90 hari.
ALTER TABLE "pendaftarans"
  ALTER COLUMN "token_akses_expira_at" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days');
