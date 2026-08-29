-- =====================================================
-- RLS Policy untuk Bucket 'materi' (Materi Pembelajaran)
-- =====================================================
-- Cara pakai: Jalankan script ini di Supabase SQL Editor
-- Pastikan bucket 'materi' sudah dibuat di Supabase Dashboard → Storage
-- dan toggle "Enable RLS" sudah aktif.
--
-- Struktur path: materi/{kelasId}/{randomFile}
-- =====================================================

-- =============================================
-- INSERT (Upload materi pembelajaran)
-- =============================================
-- Hanya guru yang boleh upload materi.
-- Path: materi/{kelasId}/{file}
-- Validasi akses kelas dilakukan di server action (verifyGuruAksesKelas).
-- RLS di sini sebagai defense-in-depth: pastikan hanya role GURU yang bisa upload.
CREATE POLICY "Guru dapat upload materi pembelajaran"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'materi'
  AND (storage.foldername(name))[1] = 'materi'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'GURU'
  )
);

-- =============================================
-- SELECT (Baca/download materi)
-- =============================================
-- Guru bisa baca semua materi (untuk manajemen).
CREATE POLICY "Guru dapat membaca semua materi"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'materi'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role IN ('GURU', 'ADMIN_KEUANGAN')
  )
);

-- Siswa bisa baca materi di kelasnya sendiri.
CREATE POLICY "Siswa dapat membaca materi di kelasnya"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'materi'
  AND EXISTS (
    SELECT 1 FROM public.siswas s
    JOIN public.users u ON u.id = s.user_id
    WHERE u.auth_id = auth.uid()
    AND u.role = 'SISWA'
    AND s.kelas_id = (storage.foldername(name))[2]::uuid
  )
);

-- Orang Tua bisa baca materi di kelas anaknya.
CREATE POLICY "OrangTua dapat membaca materi anaknya"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'materi'
  AND EXISTS (
    SELECT 1 FROM public.parent_students ps
    JOIN public.siswas sis ON sis.id = ps.siswa_id
    JOIN public.orang_tuas ot ON ot.id = ps.orang_tua_id
    JOIN public.users ortu_user ON ortu_user.id = ot.user_id
    WHERE ortu_user.auth_id = auth.uid()
    AND ortu_user.role = 'ORANG_TUA'
    AND sis.kelas_id = (storage.foldername(name))[2]::uuid
  )
);

-- =============================================
-- DELETE
-- =============================================
-- Hanya guru yang boleh menghapus materi.
CREATE POLICY "Guru dapat menghapus materi"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'materi'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'GURU'
  )
);
