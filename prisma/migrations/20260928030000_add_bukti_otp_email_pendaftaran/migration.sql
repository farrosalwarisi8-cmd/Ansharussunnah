-- Bukti OTP yang SESUNGGUHNYA, terpisah dari gerbang "terverifikasi".
--
-- Kolom `email_orang_tua_terverifikasi_at` sebelumnya dipakai dua purposes
-- sekaligus: (1) menandai gerbang upload terbuka, dan (2) menyatakan bahwa
-- email orang tua sudah dibuktikan. Hanya purpose (1) yang benar. Saat
-- grandfathering, semua baris lama diisi `created_at` tanpa ada bukti apa pun.
--
-- Akibatnya committee tidak bisa membedakan:
--   - "sudah diverifikasi beneran" (OTP selesai)
--   - "cuma warisan"           (diisi otomatis saat migrasi)
--
-- Kolom baru ini menutup gap itu. Sengaja TIDAK di-backfill: justru itulah
-- bedanya. Semua baris lama (termasuk yang sudah menerima OTP setelah
-- migrasi 20260928020000) akan punya NULL di sini sampai orang tuanya
-- sendiri menyelesaikan OTP — itu yang membuat upgrade itu mungkin.
--
-- Tidak ada DEFAULT, tidak ada UPDATE: data lama harus tetap jujur menyatakan
-- "belum pernah dibuktikan".

ALTER TABLE "pendaftarans"
  ADD COLUMN "email_orang_tua_diverifikasi_otp_at" TIMESTAMPTZ(3);

-- Query committee ("mana yang belum beneran terverifikasi") akan selalu
-- memfilter atau mengurutkan berdasarkan kolom ini, jadi diberi index.
CREATE INDEX "idx_pendaftarans_email_otp"
  ON "pendaftarans" ("email_orang_tua_diverifikasi_otp_at");
