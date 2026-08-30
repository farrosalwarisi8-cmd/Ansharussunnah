-- CreateEnum
CREATE TYPE "StatusOrangTua" AS ENUM ('MASIH_HIDUP', 'SUDAH_MENINGGAL', 'TIDAK_DIKETAHUI');

-- CreateEnum
CREATE TYPE "StatusWali" AS ENUM ('SAMA_DENGAN_AYAH', 'SAMA_DENGAN_IBU', 'LAINNYA');

-- CreateEnum
CREATE TYPE "Kewarganegaraan" AS ENUM ('WNI', 'WNA');

-- AlterTable: Siswa
ALTER TABLE "siswas" ADD COLUMN "no_hp_siswa" TEXT,
ADD COLUMN "nama_ayah_kandung" TEXT,
ADD COLUMN "status_ayah_kandung" "StatusOrangTua",
ADD COLUMN "nik_ayah" TEXT,
ADD COLUMN "nama_ibu_kandung" TEXT,
ADD COLUMN "status_ibu_kandung" "StatusOrangTua",
ADD COLUMN "nik_ibu" TEXT,
ADD COLUMN "status_wali" "StatusWali",
ADD COLUMN "nama_wali" TEXT,
ADD COLUMN "kewarganegaraan" "Kewarganegaraan" DEFAULT 'WNI',
ADD COLUMN "kitas" TEXT,
ADD COLUMN "asal_negara" TEXT;

-- AlterTable: Pendaftaran
ALTER TABLE "pendaftarans" ADD COLUMN "agama" TEXT,
ADD COLUMN "no_hp_siswa" TEXT,
ADD COLUMN "nama_ayah_kandung" TEXT,
ADD COLUMN "status_ayah_kandung" "StatusOrangTua",
ADD COLUMN "nik_ayah" TEXT,
ADD COLUMN "nama_ibu_kandung" TEXT,
ADD COLUMN "status_ibu_kandung" "StatusOrangTua",
ADD COLUMN "nik_ibu" TEXT,
ADD COLUMN "status_wali" "StatusWali",
ADD COLUMN "nama_wali" TEXT,
ADD COLUMN "kewarganegaraan" "Kewarganegaraan" DEFAULT 'WNI',
ADD COLUMN "kitas" TEXT,
ADD COLUMN "asal_negara" TEXT;
