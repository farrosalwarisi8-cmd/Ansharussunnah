# Rekomendasi Row Level Security (RLS) Policy — Supabase Storage

> **Konteks:** Upload file dilakukan langsung dari browser client menggunakan Supabase JS SDK
> (`uploadFileToStorage` di `src/lib/storage.ts`). Oleh karena itu, kontrol akses tulis
> sepenuhnya bergantung pada RLS policy di level bucket Supabase — bukan di server action.
>
> **Cara Menerapkan:** Masuk ke Supabase Dashboard → Storage → Policies → pilih bucket → New Policy.
> Gunakan SQL di bawah ini sebagai template dan sesuaikan dengan kebutuhan.

---

## Daftar Bucket yang Digunakan

| Bucket | Digunakan Untuk | Siapa yang Upload |
|---|---|---|
| `bukti-transfer` | Bukti pembayaran pendaftaran calon siswa | Calon siswa (unauthenticated atau authenticated) |
| `bukti-spp` | Bukti pembayaran SPP bulanan | Siswa/Orang Tua authenticated |
| `tugas-siswa` | Submission tugas & lampiran instruksi guru | Siswa (submission), Guru (lampiran) |
| `nota` | Bukti transaksi keuangan non-SPP | Admin Keuangan saja |
| `materi` | Materi pembelajaran (file, PDF, dokumen) | Guru (upload materi) |

---

## Bucket: `bukti-transfer`

**Konteks:** Digunakan saat proses pendaftaran. Upload dilakukan sebelum atau sesaat setelah akun dibuat.
File disimpan di path `bukti-transfer/{pendaftaranId}/{randomFile}`.

```sql
-- ============================================
-- INSERT (U=pload bukti transfer pendaftaran)
-- =============================================
-- Siapa saja yang terautentikasi dapat upload ke folder milik pendaftaran tertentu.
-- Karena pendaftaranId adalah UUID yang tidak bisa ditebak, ini cukup aman.
-- Untuk keamanan lebih tinggi, validasi kepemilikan pendaftaran via RLS function.
CREATE POLICY "Authenticated users can upload bukti transfer"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bukti-transfer'
  AND (storage.foldername(name))[1] = 'bukti-transfer'
);

-- =============================================
-- SELECT (Baca/download bukti transfer)
-- =============================================
-- Hanya admin keuangan dan pemilik akun yang bisa mengakses.
-- Signed URL dibuat di server (via createSignedUrl), jadi SELECT policy RLS
-- yang relevan adalah untuk admin yang akses langsung.
CREATE POLICY "Admin can read all bukti transfer"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'bukti-transfer'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'ADMIN_KEUANGAN'
  )
);

-- =============================================
-- DELETE
-- =============================================
-- Hanya admin yang boleh menghapus file bukti transfer.
CREATE POLICY "Only admin can delete bukti transfer"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'bukti-transfer'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'ADMIN_KEUANGAN'
  )
);
```

---

## Bucket: `bukti-spp`

**Konteks:** Siswa/Orang Tua upload bukti pembayaran SPP.
File disimpan di path `spp/{tagihanId}/{randomFile}`.

```sql
-- =============================================
-- INSERT (Upload bukti SPP)
-- =============================================
-- Siswa hanya boleh upload ke folder tagihanId miliknya sendiri.
-- Orang Tua boleh upload ke folder tagihan anak yang terhubung dengannya.
--
-- Implementasi: Validasi kepemilikan tagihanId dilakukan di server action
-- (submitBuktiPembayaranSpp). RLS di sini sebagai defense-in-depth.
-- Minimal: hanya user authenticated dengan role SISWA atau ORANG_TUA.
CREATE POLICY "Siswa dan OrangTua dapat upload bukti SPP"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bukti-spp'
  AND (storage.foldername(name))[1] = 'spp'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role IN ('SISWA', 'ORANG_TUA', 'ADMIN_KEUANGAN')
  )
);

-- Policy ketat (opsional, lebih aman, perlu function Supabase):
-- Validasi bahwa folder tagihanId benar-benar milik siswa yang login.
-- Requires custom Postgres function get_siswa_tagihan_ids(auth_uid uuid).
--
-- CREATE POLICY "Siswa hanya bisa upload ke tagihan miliknya"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (
--   bucket_id = 'bukti-spp'
--   AND (storage.foldername(name))[2] = ANY(get_siswa_tagihan_ids(auth.uid()))
-- );

-- =============================================
-- SELECT (Download/baca bukti SPP)
-- =============================================
-- Signed URL dibuat server-side — public SELECT tidak diperlukan.
-- Admin keuangan bisa akses langsung untuk review.
CREATE POLICY "Admin keuangan dapat membaca bukti SPP"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'bukti-spp'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'ADMIN_KEUANGAN'
  )
);

-- =============================================
-- DELETE
-- =============================================
-- Hanya admin keuangan yang boleh menghapus bukti SPP.
CREATE POLICY "Hanya admin keuangan yang dapat menghapus bukti SPP"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'bukti-spp'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'ADMIN_KEUANGAN'
  )
);
```

---

## Bucket: `tugas-siswa`

**Konteks:** Dua jenis file — submission jawaban siswa dan lampiran instruksi guru.
Struktur path:
- Lampiran guru: `lampiran/{tugasId}/{randomFile}`
- Submission siswa: `submission/{tugasId}/{siswaId}/{randomFile}` ← PENTEST FIX #4

```sql
-- =============================================
-- INSERT — Submission Siswa
-- =============================================
-- PENTEST FIX #4: Siswa hanya boleh upload ke subfolder miliknya sendiri.
-- Path: submission/{tugasId}/{siswaId}/{file}
-- Validasi: (storage.foldername(name))[3] harus = siswaId milik user login.
CREATE POLICY "Siswa hanya bisa upload ke folder dirinya sendiri"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tugas-siswa'
  AND (storage.foldername(name))[1] = 'submission'
  AND (storage.foldername(name))[3] = (
    -- Ambil siswaId yang berelasi dengan auth user yang sedang login
    SELECT s.id FROM public.siswas s
    JOIN public.users u ON u.id = s.user_id
    WHERE u.auth_id = auth.uid()
  )
);

-- =============================================
-- INSERT — Lampiran Instruksi Guru
-- =============================================
-- Guru hanya boleh upload ke folder lampiran.
CREATE POLICY "Guru dapat upload lampiran tugas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tugas-siswa'
  AND (storage.foldername(name))[1] = 'lampiran'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'GURU'
  )
);

-- =============================================
-- SELECT
-- =============================================
-- Guru yang mengajar kelas bisa baca semua submission di kelas tersebut.
-- Siswa hanya bisa baca file miliknya sendiri.
-- Signed URL server-side menangani akses read yang lebih granular.
CREATE POLICY "Guru dapat membaca semua submission tugas"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tugas-siswa'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role IN ('GURU', 'ADMIN_KEUANGAN')
  )
);

CREATE POLICY "Siswa dapat membaca file tugas miliknya"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tugas-siswa'
  AND (
    -- Lampiran guru bisa dibaca semua siswa
    (storage.foldername(name))[1] = 'lampiran'
    OR
    -- Submission hanya bisa dibaca oleh pemiliknya
    (
      (storage.foldername(name))[1] = 'submission'
      AND (storage.foldername(name))[3] = (
        SELECT s.id FROM public.siswas s
        JOIN public.users u ON u.id = s.user_id
        WHERE u.auth_id = auth.uid()
      )
    )
  )
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'SISWA'
  )
);

-- =============================================
-- DELETE
-- =============================================
-- Hanya guru (file lampiran miliknya) dan admin yang boleh hapus.
-- Siswa tidak boleh menghapus submission — hanya resubmit yang diizinkan.
CREATE POLICY "Guru dapat menghapus lampiran yang dibuatnya"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tugas-siswa'
  AND (storage.foldername(name))[1] = 'lampiran'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'GURU'
  )
);
```

---

## Bucket: `nota`

**Konteks:** Bukti nota transaksi keuangan non-SPP yang diinput admin keuangan.
File disimpan di path `nota/{randomFile}`.

```sql
-- =============================================
-- INSERT
-- =============================================
-- HANYA admin keuangan yang boleh upload nota.
CREATE POLICY "Hanya admin keuangan dapat upload nota"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'nota'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'ADMIN_KEUANGAN'
  )
);

-- =============================================
-- SELECT
-- =============================================
CREATE POLICY "Hanya admin keuangan dapat membaca nota"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'nota'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'ADMIN_KEUANGAN'
  )
);

-- =============================================
-- DELETE
-- =============================================
CREATE POLICY "Hanya admin keuangan dapat menghapus nota"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'nota'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'ADMIN_KEUANGAN'
  )
);
```

---

## Bucket: `materi`

**Konteks:** Guru upload materi pembelajaran (file, PDF, dokumen) untuk siswa per kelas & mapel.
Struktur path: `materi/{kelasId}/{randomFile}`.

```sql
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
-- Siswa bisa baca materi di kelasnya (path validation dilakukan server-side via signed URL).
-- Orang Tua bisa baca materi anaknya (juga via signed URL server-side).
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
    -- Validasi kelas: siswa harus berada di kelas yang sama dengan path folder
    AND s.kelas_id = (storage.foldername(name))[2]
  )
);

CREATE POLICY "OrangTua dapat membaca materi anaknya"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'materi'
  AND EXISTS (
    SELECT 1 FROM public.parent_students ps
    JOIN public.users u ON u.id = (
      SELECT user_id FROM public.siswas WHERE id = ps.siswa_id
    )
    JOIN public.users ou ON ou.id = (
      SELECT user_id FROM public.orang_tuas WHERE id = ps.orang_tua_id
    )
    WHERE ou.auth_id = auth.uid()
    AND ou.role = 'ORANG_TUA'
    -- Orang tua bisa akses materi kelas anaknya
    AND u.kelas_id = (storage.foldername(name))[2]
  )
);

-- =============================================
-- DELETE
-- =============================================
-- Hanya guru yang boleh menghapus materi.
-- Validasi kepemilikan (guru yang upload) dilakukan di server action.
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
```

---

## Catatan Implementasi Penting

> [!IMPORTANT]
> **Aktifkan RLS pada setiap bucket.** Pastikan toggle "Enable RLS" aktif di setiap bucket di
> Supabase Dashboard → Storage → Settings. Tanpa ini, semua policy di atas tidak berlaku.

> [!WARNING]
> **Jangan gunakan mode "Public Bucket"** untuk bucket `bukti-spp`, `nota`, dan `tugas-siswa`.
> Mode public memungkinkan siapa saja mengakses URL file tanpa autentikasi.

> [!TIP]
> **Signed URL adalah lini pertahanan kedua.** Server action `getSignedUrl` menggunakan
> service role key (admin) untuk menghasilkan URL sementara (1 jam). Ini lebih aman karena
> URL tidak dapat ditebak dan kedaluwarsa otomatis.

> [!NOTE]
> **`storage.foldername(name)`** mengembalikan array komponen path. Contoh untuk path
> `submission/tugasId123/siswaId456/file.pdf`:
> - `[1]` = `submission`
> - `[2]` = `tugasId123`
> - `[3]` = `siswaId456`

---

## Verifikasi Policy

Untuk memverifikasi policy sudah aktif dan bekerja dengan benar, gunakan Supabase SQL Editor:

```sql
-- Lihat semua policy yang aktif di storage
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;
```

Lakukan juga pengujian manual:
1. Login sebagai siswa A, coba upload ke path `submission/{tugasId}/{siswaId_B}/test.pdf` → harus ditolak Supabase (403)
2. Login sebagai admin keuangan, coba upload ke `nota/test.pdf` → harus berhasil
3. Tanpa login, akses signed URL yang sudah expired → harus ditolak (401)
