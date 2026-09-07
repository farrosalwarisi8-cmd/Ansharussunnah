-- AlterTable: Tambahkan kolom username & password_plain pada users
-- username: nama pengguna (login alias) yang tersimpan di database
-- password_plain: salinan password agar admin/guru bisa melihat & membantu
-- siswa yang lupa password (disimpan plaintext sesuai kebutuhan internal sekolah)

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_plain" TEXT;

-- Username bersifat unik global (NULL diizinkan ganda, Postgres)
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");