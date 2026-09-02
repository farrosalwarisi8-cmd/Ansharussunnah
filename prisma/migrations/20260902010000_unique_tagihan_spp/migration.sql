-- AddUnique: mencegah tagihan SPP duplikat untuk kombinasi (siswa, bulan, tahun)
-- yang bisa terjadi saat generate tagihan dijalankan bersamaan (race condition).
-- Bulan/tahun nullable: beberapa baris NULL diperbolehkan (non-SPP), hanya nilai
-- non-NULL yang dipaksa unik per siswa.

-- Step 1: Hapus baris duplikat (jika ada) -- pertahankan yang paling lama (created_at terkecil)
DELETE FROM "tagihan_siswas" a
USING "tagihan_siswas" b
WHERE a."id" <> b."id"
  AND a."siswa_id" = b."siswa_id"
  AND a."bulan" = b."bulan"
  AND a."tahun" = b."tahun"
  AND a."bulan" IS NOT NULL
  AND a."tahun" IS NOT NULL
  AND a."created_at" > b."created_at";

-- Step 2: Tambah unique constraint pada (siswa_id, bulan, tahun)
CREATE UNIQUE INDEX "tagihan_siswas_siswa_bulan_tahun_unique"
ON "tagihan_siswas" ("siswa_id", "bulan", "tahun");
