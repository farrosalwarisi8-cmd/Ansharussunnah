-- Penomoran otomatis tugas/ujian per kelas+mapel+periode + input nilai manual.
-- Idempotent (IF NOT EXISTS + DO block) agar aman dijalankan ulang dari SQL Editor.

-- 0. Enum jenis ujian (ULANGAN_HARIAN, UJIAN_TENGAH_SEMESTER, UJIAN_SEMESTER)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JenisUjian') THEN
    CREATE TYPE "JenisUjian" AS ENUM ('ULANGAN_HARIAN', 'UJIAN_TENGAH_SEMESTER', 'UJIAN_SEMESTER');
  END IF;
END $$;

-- 1. Kolom baru pada tabel "ujians" (nomor urut, jenis ujian, tanda input manual)
ALTER TABLE "ujians"
  ADD COLUMN IF NOT EXISTS "nomor_ujian" INTEGER,
  ADD COLUMN IF NOT EXISTS "jenis_ujian" "JenisUjian" NOT NULL DEFAULT 'ULANGAN_HARIAN',
  ADD COLUMN IF NOT EXISTS "input_manual" BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Kolom baru pada tabel "tugas" (nomor urut, tanda input manual)
ALTER TABLE "tugas"
  ADD COLUMN IF NOT EXISTS "nomor_tugas" INTEGER,
  ADD COLUMN IF NOT EXISTS "input_manual" BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Unique constraint nomor ujian per kelas+mapel+periode (kolom nullable → NULL boleh banyak)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_ujian_nomor'
  ) THEN
    ALTER TABLE "ujians"
      ADD CONSTRAINT "uq_ujian_nomor"
      UNIQUE ("kelas_id", "mata_pelajaran_id", "periode_ajaran_id", "nomor_ujian");
  END IF;
END $$;

-- 4. Unique constraint nomor tugas per kelas+mapel+periode (kolom nullable → NULL boleh banyak)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_tugas_nomor'
  ) THEN
    ALTER TABLE "tugas"
      ADD CONSTRAINT "uq_tugas_nomor"
      UNIQUE ("kelas_id", "mata_pelajaran_id", "periode_ajaran_id", "nomor_tugas");
  END IF;
END $$;