-- ============================================================================
-- VERIFIKASI & PERBAIKAN RLS — SUPABASE STORAGE (semua bucket)
-- ============================================================================
-- Cara pakai: Supabase Dashboard → SQL Editor → paste seluruh file ini → Run.
--
-- Script ini IDEMPOTEN (aman dijalankan berulang kali):
--   1. Membuat bucket bila belum ada + memastikan BUKAN public bucket (RLS aktif).
--   2. Menghapus & membuat ulang semua policy agar sesuai struktur path aplikasi.
--   3. Di akhir, mencetak laporan verifikasi policy yang aktif.
--
-- Struktur path yang diharapkan aplikasi (src/lib/storage.ts & actions):
--   bukti-transfer        → bukti-transfer/{pendaftaranId}/{file}
--   bukti-spp             → spp/{tagihanId}/{file}
--   tugas-siswa           → lampiran/{tugasId}/{file}  |  submission/{tugasId}/{siswaId}/{file}
--   nota                  → nota/{file}
--   materi                → materi/{kelasId}/{file}
--   dokumen-pendaftaran   → dokumen-pendaftaran/pendaftaran/{tempId}/{file}
-- ============================================================================

-- ============================================================================
-- 1. PASTIKAN BUCKET ADA & BUKAN PUBLIC (RLS aktif)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('bukti-transfer',      'bukti-transfer',      false),
  ('bukti-spp',           'bukti-spp',           false),
  ('tugas-siswa',         'tugas-siswa',         false),
  ('nota',                'nota',                false),
  ('materi',              'materi',              false),
  ('dokumen-pendaftaran', 'dokumen-pendaftaran', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ============================================================================
-- 2. HAPUS POLICY LAMA (agar idempoten & tidak ada duplikat)
-- ============================================================================
DROP POLICY IF EXISTS "Calon siswa dapat upload dokumen pendaftaran"      ON storage.objects;
DROP POLICY IF EXISTS "Guru dapat membaca dokumen pendaftaran"             ON storage.objects;
DROP POLICY IF EXISTS "Admin keuangan dapat membaca dokumen pendaftaran"   ON storage.objects;
DROP POLICY IF EXISTS "Guru dapat menghapus dokumen pendaftaran"           ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can upload bukti transfer"      ON storage.objects;
DROP POLICY IF EXISTS "Admin can read all bukti transfer"                  ON storage.objects;
DROP POLICY IF EXISTS "Only admin can delete bukti transfer"               ON storage.objects;

DROP POLICY IF EXISTS "Siswa dan OrangTua dapat upload bukti SPP"          ON storage.objects;
DROP POLICY IF EXISTS "Admin keuangan dapat membaca bukti SPP"             ON storage.objects;
DROP POLICY IF EXISTS "Hanya admin keuangan yang dapat menghapus bukti SPP" ON storage.objects;

DROP POLICY IF EXISTS "Siswa hanya bisa upload ke folder dirinya sendiri"  ON storage.objects;
DROP POLICY IF EXISTS "Guru dapat upload lampiran tugas"                   ON storage.objects;
DROP POLICY IF EXISTS "Guru dapat membaca semua submission tugas"          ON storage.objects;
DROP POLICY IF EXISTS "Siswa dapat membaca file tugas miliknya"            ON storage.objects;
DROP POLICY IF EXISTS "Guru dapat menghapus lampiran yang dibuatnya"       ON storage.objects;

DROP POLICY IF EXISTS "Hanya admin keuangan dapat upload nota"             ON storage.objects;
DROP POLICY IF EXISTS "Hanya admin keuangan dapat membaca nota"            ON storage.objects;
DROP POLICY IF EXISTS "Hanya admin keuangan dapat menghapus nota"          ON storage.objects;

DROP POLICY IF EXISTS "Guru dapat upload materi pembelajaran"              ON storage.objects;
DROP POLICY IF EXISTS "Guru dapat membaca semua materi"                    ON storage.objects;
DROP POLICY IF EXISTS "Siswa dapat membaca materi di kelasnya"             ON storage.objects;
DROP POLICY IF EXISTS "OrangTua dapat membaca materi anaknya"              ON storage.objects;
DROP POLICY IF EXISTS "Guru dapat menghapus materi"                        ON storage.objects;

-- ============================================================================
-- 3. BUCKET: dokumen-pendaftaran  (upload publik anonim — form pendaftaran)
-- ============================================================================
CREATE POLICY "Calon siswa dapat upload dokumen pendaftaran"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'dokumen-pendaftaran'
  AND (storage.foldername(name))[1] = 'dokumen-pendaftaran'
);

CREATE POLICY "Guru dapat membaca dokumen pendaftaran"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'dokumen-pendaftaran'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'GURU'
  )
);

CREATE POLICY "Admin keuangan dapat membaca dokumen pendaftaran"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'dokumen-pendaftaran'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'ADMIN_KEUANGAN'
  )
);

CREATE POLICY "Guru dapat menghapus dokumen pendaftaran"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'dokumen-pendaftaran'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'GURU'
  )
);

-- ============================================================================
-- 4. BUCKET: bukti-transfer  (bukti bayar pendaftaran — calon siswa)
-- ============================================================================
CREATE POLICY "Authenticated users can upload bukti transfer"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bukti-transfer'
  AND (storage.foldername(name))[1] = 'bukti-transfer'
);

CREATE POLICY "Admin can read all bukti transfer"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'bukti-transfer'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role IN ('ADMIN_KEUANGAN', 'GURU')
  )
);

CREATE POLICY "Only admin can delete bukti transfer"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'bukti-transfer'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'ADMIN_KEUANGAN'
  )
);

-- ============================================================================
-- 5. BUCKET: bukti-spp  (SISWA/ORANG_TUA upload; validasi kepemilikan di action)
-- ============================================================================
CREATE POLICY "Siswa dan OrangTua dapat upload bukti SPP"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bukti-spp'
  AND (storage.foldername(name))[1] = 'spp'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role IN ('SISWA', 'ORANG_TUA', 'ADMIN_KEUANGAN')
  )
);

CREATE POLICY "Admin keuangan dapat membaca bukti SPP"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'bukti-spp'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'ADMIN_KEUANGAN'
  )
);

CREATE POLICY "Hanya admin keuangan yang dapat menghapus bukti SPP"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'bukti-spp'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'ADMIN_KEUANGAN'
  )
);

-- ============================================================================
-- 6. BUCKET: tugas-siswa  (submission per-siswa + lampiran guru)
-- ============================================================================
-- Siswa hanya bisa upload ke subfolder submission/{tugasId}/{siswaId} MILIKNYA.
CREATE POLICY "Siswa hanya bisa upload ke folder dirinya sendiri"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tugas-siswa'
  AND (storage.foldername(name))[1] = 'submission'
  AND (storage.foldername(name))[3] = (
    SELECT s.id FROM public.siswas s
    JOIN public.users u ON u.id = s.user_id
    WHERE u.auth_id = auth.uid() AND u.role = 'SISWA'
  )
);

CREATE POLICY "Guru dapat upload lampiran tugas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tugas-siswa'
  AND (storage.foldername(name))[1] = 'lampiran'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'GURU'
  )
);

CREATE POLICY "Guru dapat membaca semua submission tugas"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tugas-siswa'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role IN ('GURU', 'ADMIN_KEUANGAN')
  )
);

CREATE POLICY "Siswa dapat membaca file tugas miliknya"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tugas-siswa'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'SISWA'
  )
  AND (
    (storage.foldername(name))[1] = 'lampiran'
    OR (
      (storage.foldername(name))[1] = 'submission'
      AND (storage.foldername(name))[3] = (
        SELECT s.id FROM public.siswas s
        JOIN public.users u ON u.id = s.user_id
        WHERE u.auth_id = auth.uid() AND u.role = 'SISWA'
      )
    )
  )
);

CREATE POLICY "Guru dapat menghapus lampiran yang dibuatnya"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tugas-siswa'
  AND (storage.foldername(name))[1] = 'lampiran'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'GURU'
  )
);

-- ============================================================================
-- 7. BUCKET: nota  (transaksi keuangan non-SPP — khusus admin keuangan)
-- ============================================================================
CREATE POLICY "Hanya admin keuangan dapat upload nota"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'nota'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'ADMIN_KEUANGAN'
  )
);

CREATE POLICY "Hanya admin keuangan dapat membaca nota"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'nota'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'ADMIN_KEUANGAN'
  )
);

CREATE POLICY "Hanya admin keuangan dapat menghapus nota"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'nota'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'ADMIN_KEUANGAN'
  )
);

-- ============================================================================
-- 8. BUCKET: materi  (guru upload; siswa/ortu baca materi kelas anaknya)
-- ============================================================================
CREATE POLICY "Guru dapat upload materi pembelajaran"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'materi'
  AND (storage.foldername(name))[1] = 'materi'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'GURU'
  )
);

CREATE POLICY "Guru dapat membaca semua materi"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'materi'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role IN ('GURU', 'ADMIN_KEUANGAN')
  )
);

-- Siswa hanya bisa baca materi di KELASNYA sendiri (foldername[2] = kelas_id).
CREATE POLICY "Siswa dapat membaca materi di kelasnya"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'materi'
  AND (storage.foldername(name))[1] = 'materi'
  AND EXISTS (
    SELECT 1 FROM public.siswas s
    JOIN public.users u ON u.id = s.user_id
    WHERE u.auth_id = auth.uid() AND u.role = 'SISWA'
      AND s.kelas_id = (storage.foldername(name))[2]
  )
);

-- Orang tua bisa baca materi di kelas anaknya (via relasi parent_students).
CREATE POLICY "OrangTua dapat membaca materi anaknya"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'materi'
  AND (storage.foldername(name))[1] = 'materi'
  AND EXISTS (
    SELECT 1 FROM public.parent_students ps
    JOIN public.orang_tuas ot ON ot.id = ps.orang_tua_id
    JOIN public.users ou ON ou.id = ot.user_id
    JOIN public.siswas s ON s.id = ps.siswa_id
    WHERE ou.auth_id = auth.uid() AND ou.role = 'ORANG_TUA'
      AND s.kelas_id = (storage.foldername(name))[2]
  )
);

CREATE POLICY "Guru dapat menghapus materi"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'materi'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'GURU'
  )
);

-- ============================================================================
-- 9. LAPORAN VERIFIKASI
-- ============================================================================
-- Jalankan bagian ini SETELAH policy dibuat untuk memastikan semuanya aktif.
-- Setiap bucket harus punya minimal policy INSERT (dan SELECT/DELETE sesuai tabel).
SELECT
  CASE
    WHEN qual::text LIKE '%bukti-transfer%'      OR with_check::text LIKE '%bukti-transfer%'      THEN 'bukti-transfer'
    WHEN qual::text LIKE '%bukti-spp%'           OR with_check::text LIKE '%bukti-spp%'           THEN 'bukti-spp'
    WHEN qual::text LIKE '%tugas-siswa%'         OR with_check::text LIKE '%tugas-siswa%'         THEN 'tugas-siswa'
    WHEN qual::text LIKE '%bucket_id = ''nota''%' OR with_check::text LIKE '%bucket_id = ''nota''%' THEN 'nota'
    WHEN qual::text LIKE '%bucket_id = ''materi''%' OR with_check::text LIKE '%bucket_id = ''materi''%' THEN 'materi'
    WHEN qual::text LIKE '%dokumen-pendaftaran%' OR with_check::text LIKE '%dokumen-pendaftaran%' THEN 'dokumen-pendaftaran'
    ELSE '(lainnya)'
  END AS bucket,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY 1, 2;

-- Cek status RLS tiap bucket (public = false berarti RLS aktif / bukan public bucket):
SELECT id AS bucket, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('bukti-transfer', 'bukti-spp', 'tugas-siswa', 'nota', 'materi', 'dokumen-pendaftaran')
ORDER BY id;