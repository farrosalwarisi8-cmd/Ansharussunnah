-- AlterTable: Remove unique constraint on email, add compound unique on (authId, role)
-- This allows one Supabase Auth user to have multiple role-based user records
-- (e.g., same email for both ADMIN_AKADEMIK and ORANG_TUA)

-- Step 1: Drop the unique constraint on email
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";

-- Step 2: Add compound unique constraint on (auth_id, role)
-- This prevents duplicate role assignments for the same auth user
ALTER TABLE "users" ADD CONSTRAINT "users_auth_id_role_key" UNIQUE ("auth_id", "role");
