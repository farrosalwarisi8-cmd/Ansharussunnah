-- ============================================================================
-- Migration: hilangkan OTP dari alur pendaftaran (ganti dengan konfirmasi
-- kontak wali manual oleh panitia) + draft pendaftaran server-side.
-- ============================================================================
-- PENTING: TIDAK ADA kolom/model OTP yang dihapus di sini.
-- `otp_verifikasi_email`, `email_orang_tua_terverifikasi_at`, dan
-- `email_orang_tua_diverifikasi_otp_at` dipertahankan sebagai data warisan/
-- audit pendaftaran lama. Alur baru tidak lagi membaca kolom tersebut sebagai
-- gerbang (lihat src/actions/upload-dokumen.ts, bukti-transfer.ts,
-- verifikasi.ts). Penghapusan fisik ditunda ke migration terpisah setelah
-- data lama dipastikan aman.
-- ============================================================================

-- ============================================================================
-- 1. KONFIRMASI KONTAK WALI — gerbang approval baru
-- ============================================================================
-- Sejak OTP dihapus, pemeriksaan "apakah kontak wali benar & bisa dihubungi"
-- dilakukan manual oleh panitia sebelum pendaftaran DITERIMA. Empat kolom ini
-- TERPISAH dari kolom verifikasi email warisan supaya makna auditnya jelas.
ALTER TABLE "pendaftarans"
  ADD COLUMN "kontak_wali_dikonfirmasi_at" TIMESTAMPTZ(3),
  ADD COLUMN "kontak_wali_dikonfirmasi_oleh_id" TEXT,
  ADD COLUMN "metode_konfirmasi_kontak" TEXT,
  ADD COLUMN "catatan_konfirmasi_kontak" TEXT;

-- Siapa yang mengonfirmasi (akuntabilitas). Restrict: jejak audit tidak boleh
-- hilang hanya karena user admin dihapus.
ALTER TABLE "pendaftarans"
  ADD CONSTRAINT "pendaftarans_kontak_wali_dikonfirmasi_oleh_id_fkey"
  FOREIGN KEY ("kontak_wali_dikonfirmasi_oleh_id")
  REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_pendaftaran_kontak_wali_oleh"
  ON "pendaftarans"("kontak_wali_dikonfirmasi_oleh_id");

-- ============================================================================
-- 2. DRAFT PENDAFTARAN — lapisan server dari draft hybrid
-- ============================================================================
-- resume_token_hash = SHA-256 dari resume token; plaintext TIDAK disimpan.
-- finalized_at + nomor_pendaftaran = idempotensi finalisasi (submit/retry
-- dengan draftToken yang sama TIDAK membuat pendaftaran kedua).
CREATE TABLE "pendaftaran_drafts" (
  "id" TEXT NOT NULL,
  "resume_token_hash" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "last_step" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "finalized_at" TIMESTAMPTZ(3),
  "nomor_pendaftaran" TEXT,

  CONSTRAINT "pendaftaran_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pendaftaran_drafts_resume_token_hash_key"
  ON "pendaftaran_drafts"("resume_token_hash");

CREATE UNIQUE INDEX "pendaftaran_drafts_nomor_pendaftaran_key"
  ON "pendaftaran_drafts"("nomor_pendaftaran");

CREATE INDEX "idx_pendaftaran_draft_expired"
  ON "pendaftaran_drafts"("expires_at");

CREATE INDEX "idx_pendaftaran_draft_finalized"
  ON "pendaftaran_drafts"("finalized_at");
