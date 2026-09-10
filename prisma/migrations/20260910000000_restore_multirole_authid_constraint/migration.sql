-- RestoreMultiRoleAuthIdConstraint
--
-- Memperbaiki regresi schema: menghapus unique constraint individual pada
-- email dan auth_id, sehingga arsitektur multi-role (1 orang = 1 identitas
-- Supabase Auth, bisa punya beberapa row User dengan role berbeda) berfungsi
-- kembali.
--
-- Constraint yang TETAP berlaku:
--   - @@unique([authId, role]) → mencegah 1 orang punya 2 row untuk role SAMA
--   - username @unique → login alias global tetap unik
--
-- CATATAN PERBAIKAN MIGRATION (commit 2026-09-10):
--   Versi sebelumnya memakai "DROP INDEX IF EXISTS" pada uq_users_email dan
--   uq_users_auth_id, tetapi kedua nama itu adalah CONSTRAINT unik (bukan index
--   berdiri sendiri). PostgreSQL menolak dengan error 2BP01:
--     "cannot drop index ... because constraint ... on table users requires it"
--   Solusi: gunakan ALTER TABLE ... DROP CONSTRAINT yang benar, sehingga
--   constraint beserta index backing-nya terhapus. Sisa statement dibuat
--   idempotent (IF EXISTS) agar aman dijalankan ulang.
--
--   Constraint gabungan (auth_id, role) yang dibuat oleh migration
--   20260902000000 (nama: users_auth_id_role_key) direname lewat
--   RENAME CONSTRAINT agar nama index + constraint konsisten dengan map name
--   di schema.prisma (uq_users_authid_role).

-- Step 1: Drop unique constraint pada email (mengizinkan email sama di role berbeda)
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "uq_users_email";

-- Step 2: Drop unique constraint pada auth_id individual (mengizinkan authId sama di role berbeda)
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "uq_users_auth_id";

-- Step 3: Rename compound unique constraint agar sesuai map name di schema
ALTER TABLE "users" RENAME CONSTRAINT "users_auth_id_role_key" TO "uq_users_authid_role";