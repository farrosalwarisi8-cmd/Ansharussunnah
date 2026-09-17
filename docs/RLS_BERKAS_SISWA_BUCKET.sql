-- ============================================================================
-- RLS — BUCKET BERKAS SISWA (Siswa Manual)
-- ============================================================================
-- Cara pakai: Supabase Dashboard → SQL Editor → paste seluruh file ini → Run.
--
-- Bucket `berkas-siswa` menyimpan berkas siswa manual (KK, akte lahir, pas
-- foto, dokumen lain). Path yang diharapkan aplikasi:
--   berkas-siswa/{siswaId}/{kategori}/{file}
--   kategori ∈ { kartuKeluarga, akteLahir, foto, lainnya }
--
-- KEAMANAN: upload & delete DILAKUKAN SERVER-SIDE via service role
-- (src/actions/berkas-siswa.ts). Service role mem-bypass RLS, sehingga:
--   * TIDAK ADA policy INSERT — sengaja. Memberi policy INSERT pada bucket
--     non-public membuat siapa saja pemegang anon/authenticated key bisa
--     menulis file ke bucket ini.
--   * SELECT & DELETE hanya untuk guru admin (role GURU / ADMIN_AKADEMIK)
--     sebagai defense-in-depth.
--
-- Script ini IDEMPOTEN (aman dijalankan berulang kali).
-- ============================================================================

-- ============================================================================
-- 1. PASTIKAN BUCKET ADA & BUKAN PUBLIC (RLS aktif)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('berkas-siswa', 'berkas-siswa', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ============================================================================
-- 2. HAPUS POLICY LAMA (agar idempoten & tidak ada duplikat)
-- ============================================================================
DROP POLICY IF EXISTS "Guru admin dapat membaca berkas siswa" ON storage.objects;
DROP POLICY IF EXISTS "Guru admin dapat menghapus berkas siswa" ON storage.objects;

-- ============================================================================
-- 3. POLICY SELECT — baca pratinjau / signed URL oleh guru admin
-- ============================================================================
CREATE POLICY "Guru admin dapat membaca berkas siswa"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'berkas-siswa'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role IN ('GURU', 'ADMIN_AKADEMIK')
  )
);

-- ============================================================================
-- 4. POLICY DELETE — hapus berkas oleh guru admin
-- ============================================================================
CREATE POLICY "Guru admin dapat menghapus berkas siswa"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'berkas-siswa'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role IN ('GURU', 'ADMIN_AKADEMIK')
  )
);

-- ============================================================================
-- 5. VERIFIKASI
-- ============================================================================
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (qual::text LIKE '%berkas-siswa%' OR with_check::text LIKE '%berkas-siswa%')
ORDER BY policyname;

SELECT id AS bucket, public
FROM storage.buckets
WHERE id = 'berkas-siswa';