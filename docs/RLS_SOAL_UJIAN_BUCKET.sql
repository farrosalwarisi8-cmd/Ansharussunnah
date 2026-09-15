-- =====================================================
-- RLS Policy untuk Bucket 'soal-ujian' (Gambar Soal Ujian)
-- =====================================================
-- Cara pakai: Jalankan script ini di Supabase SQL Editor
-- Pastikan bucket 'soal-ujian' sudah dibuat di Supabase Dashboard → Storage
-- dan toggle "Enable RLS" sudah aktif.
--
-- Struktur path: soal-ujian/ujian-{ujianId}/{randomFile}
--
-- Catatan: Upload dilakukan server-side via service role (bukti-transfer pattern).
-- RLS di sini sebagai defense-in-depth agar tidak ada yang bypass.
-- =====================================================

-- =============================================
-- INSERT (Upload gambar soal ujian)
-- =============================================
-- Hanya guru atau admin akademik yang boleh upload gambar soal.
CREATE POLICY "Guru dapat upload gambar soal ujian"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'soal-ujian'
  AND (storage.foldername(name))[1] = 'soal-ujian'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'GURU'
  )
);

CREATE POLICY "Admin akademik dapat upload gambar soal ujian"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'soal-ujian'
  AND (storage.foldername(name))[1] = 'soal-ujian'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'ADMIN_AKADEMIK'
  )
);

-- =============================================
-- SELECT (Baca gambar soal)
-- =============================================
-- Guru & admin bisa baca semua gambar soal.
CREATE POLICY "Guru dapat membaca gambar soal ujian"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'soal-ujian'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role IN ('GURU', 'ADMIN_AKADEMIK', 'ADMIN_KEUANGAN')
  )
);

-- Siswa bisa baca gambar soal (saat mengerjakan ujian).
CREATE POLICY "Siswa dapat membaca gambar soal ujian"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'soal-ujian'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'SISWA'
  )
);

-- =============================================
-- DELETE
-- =============================================
-- Guru bisa menghapus gambar soal.
CREATE POLICY "Guru dapat menghapus gambar soal ujian"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'soal-ujian'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'GURU'
  )
);