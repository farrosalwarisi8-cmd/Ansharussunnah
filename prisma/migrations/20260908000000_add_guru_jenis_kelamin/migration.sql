-- AlterTable: Tambahkan kolom jenis_kelamin pada gurus DAN kelas
-- Jenis kelamin guru: LAKI_LAKI = Ikhwan, PEREMPUAN = Akhwat, NULL = belum diisi
-- Jenis kelamin kelas: LAKI_LAKI = Ikhwan, PEREMPUAN = Akhwat, NULL = Campuran
ALTER TABLE "gurus" ADD COLUMN IF NOT EXISTS "jenis_kelamin" "JenisKelamin";
ALTER TABLE "kelas" ADD COLUMN IF NOT EXISTS "jenis_kelamin" "JenisKelamin";