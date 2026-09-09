-- AlterTable: Tambahkan kolom target_gender pada tugas, ujians, materi_pembelajarans
-- target_gender: LAKI_LAKI = khusus Ikhwan, PEREMPUAN = khusus Akhwat, NULL = semua gender (campuran)
ALTER TABLE "tugas" ADD COLUMN IF NOT EXISTS "target_gender" "JenisKelamin";
ALTER TABLE "ujians" ADD COLUMN IF NOT EXISTS "target_gender" "JenisKelamin";
ALTER TABLE "materi_pembelajarans" ADD COLUMN IF NOT EXISTS "target_gender" "JenisKelamin";

-- AlterTable: Tambahkan kolom jenis_kelamin pada mata_pelajarans
-- jenis_kelamin: LAKI_LAKI = mapel khusus Ikhwan, PEREMPUAN = khusus Akhwat, NULL = untuk semua gender
ALTER TABLE "mata_pelajarans" ADD COLUMN IF NOT EXISTS "jenis_kelamin" "JenisKelamin";