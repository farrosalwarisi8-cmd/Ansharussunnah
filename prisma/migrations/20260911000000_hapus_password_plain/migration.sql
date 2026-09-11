-- AlterTable: Hapus salinan password yang bisa dibaca ulang dari tabel users.
-- password_plain adalah salinan password (reversible encryption) yang dipakai
-- untuk fitur "lihat password lama" — dihapus karena risiko keamanan (satu kunci
-- enkripsi bocor = semua password ter-expose). Reset password tetap tersedia
-- lewat resetPasswordSiswaManual / resetPasswordOrangTuaManual.
-- password_encrypted ikut dihapus karena tidak pernah dipakai di kode.

ALTER TABLE "users" DROP COLUMN IF EXISTS "password_plain";
ALTER TABLE "users" DROP COLUMN IF EXISTS "password_encrypted";