-- AlterTable
ALTER TABLE "absensis" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "bukti_transfer_pendaftarans" ALTER COLUMN "waktu_verifikasi" TYPE TIMESTAMPTZ(3) USING ("waktu_verifikasi"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "waktu_upload" TYPE TIMESTAMPTZ(3) USING ("waktu_upload"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "catatan_rapors" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "ekstrakurikuler" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "guru_kelas" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "gurus" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "deleted_at" TYPE TIMESTAMPTZ(6) USING ("deleted_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "jawaban_siswas" ALTER COLUMN "waktu_penilaian" TYPE TIMESTAMPTZ(3) USING ("waktu_penilaian"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "jenjangs" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "kategori_transaksis" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "kelas" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "login_audits" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "mapel_kelas" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "mata_pelajarans" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "materi_pembelajarans" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "nilai_rapors" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "notifikasi" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(6) USING ("created_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "orang_tuas" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "deleted_at" TYPE TIMESTAMPTZ(6) USING ("deleted_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "parent_students" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "password_reset_tokens" ALTER COLUMN "expired_at" TYPE TIMESTAMPTZ(3) USING ("expired_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "pembayaran_siswas" ALTER COLUMN "tanggal_bayar" TYPE TIMESTAMPTZ(3) USING ("tanggal_bayar"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "waktu_konfirmasi" TYPE TIMESTAMPTZ(3) USING ("waktu_konfirmasi"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "pendaftarans" ALTER COLUMN "tanggal_lahir" TYPE TIMESTAMPTZ(3) USING ("tanggal_lahir"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "waktu_verifikasi" TYPE TIMESTAMPTZ(3) USING ("waktu_verifikasi"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "deleted_at" TYPE TIMESTAMPTZ(6) USING ("deleted_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "pengerjaan_ujians" ALTER COLUMN "waktu_mulai" TYPE TIMESTAMPTZ(3) USING ("waktu_mulai"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "waktu_submit" TYPE TIMESTAMPTZ(3) USING ("waktu_submit"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "pengumpulan_tugas" ALTER COLUMN "waktu_kumpul" TYPE TIMESTAMPTZ(3) USING ("waktu_kumpul"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "waktu_penilaian" TYPE TIMESTAMPTZ(3) USING ("waktu_penilaian"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "pengumumans" ALTER COLUMN "tanggal_mulai" TYPE TIMESTAMPTZ(6) USING ("tanggal_mulai"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "tanggal_selesai" TYPE TIMESTAMPTZ(6) USING ("tanggal_selesai"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(6) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(6) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "periode_ajarans" ALTER COLUMN "tanggal_mulai" TYPE TIMESTAMPTZ(3) USING ("tanggal_mulai"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "tanggal_selesai" TYPE TIMESTAMPTZ(3) USING ("tanggal_selesai"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "riwayat_kelas_siswas" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "riwayat_pengumpulan_tugas" ALTER COLUMN "waktu_kumpul" TYPE TIMESTAMPTZ(3) USING ("waktu_kumpul"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "siswas" ALTER COLUMN "tanggal_lahir" TYPE TIMESTAMPTZ(3) USING ("tanggal_lahir"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "deleted_at" TYPE TIMESTAMPTZ(6) USING ("deleted_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "soal_ujians" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "tagihan_siswas" ALTER COLUMN "jatuh_tempo" TYPE TIMESTAMPTZ(3) USING ("jatuh_tempo"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "waktu_pembatalan" TYPE TIMESTAMPTZ(3) USING ("waktu_pembatalan"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "deleted_at" TYPE TIMESTAMPTZ(6) USING ("deleted_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "transaksi_keuangans" ALTER COLUMN "tanggal" TYPE TIMESTAMPTZ(3) USING ("tanggal"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "waktu_pembatalan" TYPE TIMESTAMPTZ(3) USING ("waktu_pembatalan"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "deleted_at" TYPE TIMESTAMPTZ(6) USING ("deleted_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "tugas" ALTER COLUMN "deadline" TYPE TIMESTAMPTZ(3) USING ("deadline"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "ujians" ALTER COLUMN "waktu_mulai" TYPE TIMESTAMPTZ(3) USING ("waktu_mulai"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "waktu_selesai" TYPE TIMESTAMPTZ(3) USING ("waktu_selesai"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC');

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "last_password_change" TYPE TIMESTAMPTZ(3) USING ("last_password_change"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING ("created_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING ("updated_at"::timestamp AT TIME ZONE 'UTC'),
ALTER COLUMN "deleted_at" TYPE TIMESTAMPTZ(6) USING ("deleted_at"::timestamp AT TIME ZONE 'UTC');


