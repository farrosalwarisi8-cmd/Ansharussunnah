-- AlterTable: berkas siswa manual (KK, akta lahir, pas foto, dokumen lain).
-- Siswa manual tidak memiliki record Pendaftaran, sehingga berkasnya disimpan
-- langsung di tabel siswas (paralel dengan kolom dok* di pendaftarans).

-- AlterTable. IF NOT EXISTS agar IDEMPOTEN: kolom bisa saja sudah terbuat
-- manual (error 42701) saat migrasi dijalankan ulang dari SQL Editor.
ALTER TABLE "siswas"
ADD COLUMN IF NOT EXISTS "dok_kartu_keluarga" TEXT,
ADD COLUMN IF NOT EXISTS "dok_akte_lahir" TEXT,
ADD COLUMN IF NOT EXISTS "dok_foto" TEXT,
ADD COLUMN IF NOT EXISTS "dok_lainnya" TEXT[] DEFAULT ARRAY[]::TEXT[];
