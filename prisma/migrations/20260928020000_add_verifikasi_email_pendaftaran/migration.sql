-- KEAMANAN: gerbang verifikasi kepemilikan email orang tua.
--
-- Sebelumnya pendaftaran langsung "aktif" begitu form terkirim, sehingga siapa
-- pun bisa mendaftar memakai email orang lain (atau email fiktif) dan membuat
-- panitia menindaklanjuti data yang tidak pernah bisa dikonfirmasi. Sekarang
-- emailOrangTua harus dibuktikan lewat OTP 6 digit sebelum alur publik (unggah
-- dokumen & bukti transfer) terbuka.
--
-- Catatan grandfathering: baris yang SUDAH ada dianggap terverifikasi pada
-- saat pendaftaran dibuat. Pendaftaran yang sedang berjalan tidak boleh
-- dikunci retroactive hanya karena fitur ini baru dipasang, dan pada dasarnya
-- semua pendaftar yang sudah menyetor biaya tidak layak dibuang.

ALTER TABLE "pendaftarans"
  ADD COLUMN "email_orang_tua_terverifikasi_at" TIMESTAMPTZ(3);

-- Grandfathering: pendaftaran lama dianggap sudah "melewati" gerbang ini.
UPDATE "pendaftarans"
SET "email_orang_tua_terverifikasi_at" = "created_at"
WHERE "email_orang_tua_terverifikasi_at" IS NULL;

-- Pendaftaran baru: NULL = belum diverifikasi (fail-closed).
-- Kolom sengaja TIDAK diberi DEFAULT CURRENT_TIMESTAMP. Kalau diberi default,
-- setiap INSERT yang kelewat lupa kolom ini otomatis dianggap terverifikasi —
-- persis kebalikan dari yang diinginkan. Membiarkan NULL membuat "lupa
-- mengisi" dan "belum diverifikasi" menjadi hal yang sama, dan keduanya
-- MENUTUP alur publik, bukan membukanya.

CREATE TABLE "otp_verifikasi_email" (
  "id" TEXT NOT NULL,
  "pendaftaran_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "kode_otp_hash" TEXT NOT NULL,
  "expired_at" TIMESTAMPTZ(3) NOT NULL,
  "digunakan" BOOLEAN NOT NULL DEFAULT false,
  "jumlah_gagal" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "otp_verifikasi_email_pkey" PRIMARY KEY ("id")
);

-- Lookup utama: OTP aktif milik satu pendaftaran (belum dipakai & belum
-- kedaluwarsa). Dipakai juga untuk menjatuhkan token lama saat resend.
CREATE INDEX "idx_otp_email_pendaftaran_aktif"
  ON "otp_verifikasi_email"("pendaftaran_id", "digunakan");

-- Pembersihan token kedaluwarsa (mis. oleh cron) tidak boleh memindai tabel.
CREATE INDEX "idx_otp_email_expired"
  ON "otp_verifikasi_email"("expired_at");

ALTER TABLE "otp_verifikasi_email"
  ADD CONSTRAINT "otp_verifikasi_email_pendaftaran_id_fkey"
  FOREIGN KEY ("pendaftaran_id") REFERENCES "pendaftarans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
