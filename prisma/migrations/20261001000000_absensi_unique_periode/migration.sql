-- Absensi: masukkan periode ajaran ke dalam unique key.
--
-- Sebelumnya unique = (siswa_id, tanggal, mata_pelajaran_id). Karena absensi
-- SELALU milik sebuah periode ajaran (kolom periode_ajaran_id NOT NULL di
-- semua jalur input: src/actions/absensi.ts), kunci tanpa periode membuat
-- satu baris periode lama memblokir penulisan periode baru pada tanggal+mapel
-- yang sama, dan membuat makna "unik" bergantung pada asumsi periode tidak
-- pernah tumpang tindih.
--
-- Migrasi ini aman dijalankan pada database kosong maupun existing:
--   1. Hapus index unik lama bila ada (IF EXISTS).
--   2. Bersihkan duplikat existing menurut kunci BARU, pertahankan baris
--      paling awal (created_at terkecil) — baris lama yang duplikat hanya
--      bisa muncul karena NULL pada mata_pelajaran_id (Postgres menganggap
--      tiap NULL berbeda) sehingga tidak akan kehilangan data bermakna.
--   3. Buat index unik baru + index rekap.

-- Step 1: index unik lama.
DROP INDEX IF EXISTS "uq_absensi_siswa_tanggal_mapel";

-- Step 2: dedupe menurut kunci baru. IS NOT DISTINCT FROM agar NULL
-- (mata pelajaran kosong = absensi harian) ikut dibandingkan.
DELETE FROM "absensis" a
USING "absensis" b
WHERE a."id" <> b."id"
  AND a."siswa_id" = b."siswa_id"
  AND a."tanggal" = b."tanggal"
  AND a."mata_pelajaran_id" IS NOT DISTINCT FROM b."mata_pelajaran_id"
  AND a."periode_ajaran_id" = b."periode_ajaran_id"
  AND a."created_at" > b."created_at";

-- Step 3a: index unik baru (siswa, tanggal, mapel, periode).
CREATE UNIQUE INDEX "uq_absensi_siswa_tanggal_mapel_periode"
ON "absensis" ("siswa_id", "tanggal", "mata_pelajaran_id", "periode_ajaran_id");

-- Step 3b: index rekap kehadiran berdasarkan siswa + periode + tanggal.
CREATE INDEX IF NOT EXISTS "idx_absensi_siswa_periode_tanggal"
ON "absensis" ("siswa_id", "periode_ajaran_id", "tanggal");
