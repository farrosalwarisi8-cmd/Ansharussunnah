-- =====================================================
-- RLS Policy untuk Bucket 'dokumen-pendaftaran'
-- (Dokumen Pendaftaran: Kartu Keluarga, Akte Lahir, Foto)
-- =====================================================
-- Cara pakai: Jalankan script ini di Supabase SQL Editor
-- Pastikan bucket 'dokumen-pendaftaran' sudah dibuat di
-- Supabase Dashboard → Storage dan toggle "Enable RLS" sudah aktif.
--
-- Struktur path: dokumen-pendaftaran/pendaftaran/{tempId}/{randomFile}
-- =====================================================

-- =============================================
-- INSERT (Upload dokumen pendaftaran)
-- =============================================
-- Calon siswa bisa upload dokumen pendaftaran (KK, akte, foto)
-- ke folder milik pendaftaran tertentu.
-- PendaftaranId adalah UUID yang tidak bisa ditebak.
CREATE POLICY "Calon siswa dapat upload dokumen pendaftaran"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'dokumen-pendaftaran'
  AND (storage.foldername(name))[1] = 'dokumen-pendaftaran'
);

-- =============================================
-- SELECT (Baca/download dokumen pendaftaran)
-- =============================================
-- Hanya guru (yang memverifikasi pendaftaran) dan admin keuangan
-- yang bisa mengakses dokumen pendaftaran.
-- Signed URL dibuat server-side untuk akses yang lebih granular.
CREATE POLICY "Guru dapat membaca dokumen pendaftaran"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'dokumen-pendaftaran'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'GURU'
  )
);

CREATE POLICY "Admin keuangan dapat membaca dokumen pendaftaran"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'dokumen-pendaftaran'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'ADMIN_KEUANGAN'
  )
);

-- =============================================
-- DELETE
-- =============================================
-- Hanya guru yang bisa menghapus dokumen pendaftaran
-- (misal: saat menolak pendaftaran dan membersihkan file).
CREATE POLICY "Guru dapat menghapus dokumen pendaftaran"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'dokumen-pendaftaran'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'GURU'
  )
);
