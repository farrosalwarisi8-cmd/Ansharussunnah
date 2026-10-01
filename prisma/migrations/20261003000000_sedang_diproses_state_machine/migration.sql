-- State machine anti-race untuk approval pendaftaran.
--
-- Masalah: dua admin yang menekan "Terima" bersamaan sama-sama
-- menjalankan side effect Supabase Auth sebelum pendaftaran
-- di-claim, sehingga bisa membuat akun ganda.
--
-- Solusi: status perantara SEDANG_DIPROSES. Admin yang menang
-- mengklaim pendaftaran (updateMany bersyarat dari
-- MENUNGGU_VERIFIKASI → SEDANG_DIPROSES) SEBELUM membuat akun
-- Auth. Hanya satu request yang bisa berpindah status; request
-- kedua berhenti tanpa side effect.
--
-- Aman pada database kosong maupun existing:
--   - ALTER TYPE ... ADD VALUE IF NOT EXISTS (idempotent)
--   - Kolom baru nullable, tanpa default yang memakai enum baru
--     (dalam satu transaksi, nilai enum baru tidak boleh
--     dipakai sebagai default — kami tidak memakainya)
--   - Index dibuat IF NOT EXISTS
--
-- Risiko deployment: rendah. Tidak ada penulisan ulang data;
-- baris existing tetap MENUNGGU_VERIFIKASI.
--
-- Rollback plan: kolom & index bisa di-drop, nilai enum tidak
-- bisa dihapus di Postgres (tetap ada, tidak dipakai) — aman
-- ditinggalkan.

ALTER TYPE "StatusPendaftaran" ADD VALUE IF NOT EXISTS 'SEDANG_DIPROSES';

ALTER TABLE "pendaftarans" ADD COLUMN IF NOT EXISTS "diproses_oleh_id" TEXT;
ALTER TABLE "pendaftarans" ADD COLUMN IF NOT EXISTS "waktu_mulai_proses" TIMESTAMPTZ(3);

DO $$
BEGIN
  ALTER TABLE "pendaftarans"
    ADD CONSTRAINT "pendaftarans_diproses_oleh_id_fkey"
    FOREIGN KEY ("diproses_oleh_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Recovery klaim stale: cari SEDANG_DIPROSES dengan
-- waktu_mulai_proses sudah lewat tanpa scan seluruh tabel.
CREATE INDEX IF NOT EXISTS "idx_pendaftaran_status_waktu_proses"
ON "pendaftarans" ("status", "waktu_mulai_proses");
