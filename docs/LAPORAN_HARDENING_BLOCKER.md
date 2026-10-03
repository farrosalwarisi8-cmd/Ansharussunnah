# Laporan Hardening — Blocker 1–5 (+ Gerbang Verifikasi)

**Tanggal**: 2026-10-02
**Repo**: `sistem-pendaftaran-siswa` (branch `master`, lokal — **3 commit ahead of `origin/master`**)
**Commits**: `133e26f` (pagination/idempotensi/outbox, sudah di origin) → `d1a73f4` (cron harian, sudah di origin) → `0691476` (Blocker 1, lokal) → `47a3736` (Blocker 2–5, lokal) → `948fcd4` (perbaikan build, lokal)

---

## ⚠️ INSIDEN DB KRITIS — baca dulu

**Pada 2026-10-02 pukul 03:27–03:36 UTC (10:27–10:36 WIB), seluruh database ditulis ulang dari awal dan SEMUA data aplikasi hilang.** Detail forensik & pemulihan ada di bagian [Insiden DB](#insiden-db-kritis-forensik-dan-pemulihan) di bawah. Status: **BLOKIR — pemulihan data butuh akses konsol Supabase** (restore dari backup). Skema sudah sehat; data belum.

---

## Tabel Per-Blocker

| # | Blocker | Status | Commit | Bukti |
|---|---------|--------|--------|-------|
| 1 | State machine persetujuan atomik/idempoten (SEDANG_DIPROSES) | **PASS** | `0691476`, `948fcd4` | Klaim `updateMany` bersyarat sebelum side effect Auth; recovery klaim stale >15 mnt; rollback `SEDANG_DIPROSES → MENUNGGU_VERIFIKASI`; index parsial. 396 baris uji state machine. |
| 2 | Signed URL untuk semua UI bukti/berkas | **PASS** | `47a3736` | `getDaftarPembayaranPendingVerifikasi` → `signedUrlBukti` via `getSignedUrls("bukti-spp", …)` batch; UI keuangan & materi hanya memakai signed URL sebagai `href`; raw path private tidak pernah diekspos. |
| 3 | Validasi URL eksternal ketat | **PASS** | `47a3736` | `src/lib/validations/external-url.ts`: https-only + allowlist Google Drive, tolak kredensial/fragment/traversal; diterapkan pada bukti SPP, materi, pengumpulan tugas. |
| 4 | Paginasi query tak terbatas tersisa | **PASS** | `47a3736` (+`133e26f`) | `getSiswaUntukTagihanKhusus` mendukung `page/pageSize` (maks 100) + batas keras `MAX_BULK_SISWA=1000` untuk mode bulk; daftar tugas/materi/ujian & pembayaran pending sudah dipaginasi di `133e26f`. |
| 5 | Hardening outbox email (lease/retry/monitoring) | **PASS** (dengan catatan) | `47a3736` (+`133e26f`) | Timeout provider 30 detik << lease 2 menit → provider hang tidak bisa menyebabkan double-send; dashboard admin menampilkan indikator `emailGagal`/`emailTertunda` + alert ke `/dashboard/email-outbox`. **Catatan**: Vercel Hobby hanya mengizinkan cron HARIAN, jadi retry otomatis paling lambat ~24 jam — admin punya tombol retry manual. |
| 6 | Gerbang: prisma generate/validate/migrate + tsc + vitest + next build | **PASS** (setelah `948fcd4`) | `948fcd4` | vitest 678/678 (47 file), `tsc --noEmit` bersih, `prisma validate` valid, `prisma generate` ok, `migrate status` up to date (34 migrasi), `next build` sukses. |

---

## Detail Per-Blocker

### Blocker 1 — State machine persetujuan atomik
- Klaim pendaftaran ke `SEDANG_DIPROSES` lewat `updateMany` bersyarat (`status = MENUNGGU_VERIFIKASI`) **sebelum** side effect Supabase Auth → dua admin yang approve bersamaan hanya satu yang memproses.
- Recovery: klaim stale (> `STALE_PROSES_MS` = 15 menit, konstanta privat modul) dikembalikan ke `MENUNGGU_VERIFIKASI`; kegagalan verifikasi melakukan rollback status + hapus Auth user.
- Migrasi `20261003000000_sedang_diproses_state_machine`: kolom `waktu_mulai_proses`, `diproses_oleh_id`, index parsial `(status, waktu_mulai_proses) WHERE status = 'SEDANG_DIPROSES'` untuk deteksi stale tanpa scan tabel penuh.
- `STALE_PROSES_MS` sempat di-`export` dan mematahkan `next build` ("use server file can only export async functions") — diperbaiki di `948fcd4`.

### Blocker 2 — Signed URL bukti/berkas
- `getDaftarPembayaranPendingVerifikasi({page,pageSize})`: paginasi server-side (maks 100) + signed URL batch untuk semua path internal `spp/{tagihanId}/…` → field `signedUrlBukti`.
- `keuangan-verifikasi-tab.tsx`: tautan "Buka Foto Bukti Transfer" hanya memakai `signedUrlBukti`; bila null → pesan peringatan (tidak ada fallback ke raw path).
- `materi-page-client.tsx`: "Buka & Unduh Materi" hanya memakai `signedUrl || urlLink`; `urlFile` mentah TIDAK PERNAH jadi `href`. Bila berkas internal ada tapi signed URL gagal → pesan peringatan.
- URL eksternal (Google Drive) lolos validasi server-side (Blocker 3) dan diteruskan langsung.

### Blocker 3 — Validasi URL eksternal ketat
- `validasiUrlEksternal()`: harus bisa di-parse; protokol **hanya `https:`**; hostname persis/subdomain dari allowlist (`drive.google.com`, `docs.google.com`); tanpa userinfo (user:pass@); tanpa `..`; mengembalikan URL ternormalisasi (tanpa fragment).
- Diterapkan di 3 titik masuk server action: `submitBuktiPembayaranSpp`, `createMateri`/`updateMateri`, `submitTugas`.
- Uji: domain arbitrary ditolak, `http://` ditolak, `javascript:` ditolak, kredensial ditolak, fragment dibuang, query dipertahankan.

### Blocker 4 — Paginasi query tersisa
- `getSiswaUntukTagihanKhusus(params, {page,pageSize})`: pagination dinormalisasi (`normalizePagination`, maks 100/halaman). Tanpa opsi (mode bulk-select panel "Generate SPP Khusus"), query dibatasi keras `MAX_BULK_SISWA = 1000` — tidak ada lagi query `findMany` tanpa batas di codebase.
- Sudah dipaginasi sebelumnya (`133e26f`): daftar tugas, materi, ujian (guru/siswa/orang tua), daftar pembayaran pending verifikasi.

### Blocker 5 — Outbox email
- `EMAIL_PROVIDER_TIMEOUT_MS = 30_000` di `src/lib/email-provider.ts`: panggilan Resend di-race melawan timer; selalu selesai (sukses/gagal/timeout) sebelum lease klaim atomik (2 menit) habis → worker kedua tidak bisa mengklaim baris yang sama → tidak ada double-send akibat provider hang.
- Monitoring: `getRangkumanAdminHome` menambahkan `emailGagal` (count FAILED) & `emailTertunda` (count PENDING); `admin-home.tsx` menampilkan alert merah + tombol "Buka Outbox Email".
- Retry berjenjang (backoff 1/5/15/60/360 menit) + `retryEmailOutboxManual(id)` untuk intervensi admin segera.

---

## Rencana Migrasi

Semua migrasi **sudah diaplikasikan** ke database live (lihat `npx prisma migrate status` → "Database schema is up to date!", 34 migrasi):

| Migrasi | Isi | Status |
|---------|-----|--------|
| `20261001000000_absensi_unique_periode` | unique key absensi (siswa,tanggal,mapel,periode) | applied |
| `20261001010000_pembayaran_idempotency` | unique (tagihan_id, idempotency_key) + partial unique index satu PENDING per tagihan | applied |
| `20261002000000_email_outbox` | tabel `email_outbox` + index | applied |
| `20261002010000_pagination_indexes` | index pendukung query filter+sort utama | applied |
| `20261003000000_sedang_diproses_state_machine` | kolom + index parsial state machine | applied |

**Untuk lingkungan BARU (fresh deploy)**: riwayat migrasi **tidak self-contained** — migrasi pertama (`20260829000000_add_materi_riwayat_kelas`) membuat tabel yang mereferensi tabel baseline pra-Prisma (`kelas` dll). Deploy dari kosong akan gagal P1014/P3006. Prosedur yang benar untuk DB baru: (1) buat tabel baseline dulu lewat `prisma db push` terhadap DB kosong, (2) baru `prisma migrate deploy`.

**Untuk lingkungan production saat ini**: tidak ada migrasi tertunda. Cukup deploy kode (`git push` + Vercel deploy).

## Rencana Rollback

- **Kode**: 3 commit terakhir (`0691476`, `47a3736`, `948fcd4`) masih lokal; `133e26f` & `d1a73f4` sudah di-push ke origin. Rollback = `git revert 948fcd4 47a3736 0691476` (atau `git reset --hard d1a73f4` bila tidak perlu mempertahankan riwayat), lalu redeploy.
- **Database**: seluruh migrasi bersifat aditif (tabel/kolom/index baru). Kode lama tetap jalan terhadap skema baru (kolom tambahan diabaikan). Rollback penuh skema (drop kolom/index) tidak didukung Prisma (`migrate resolve` hanya untuk menandai, bukan membatalkan DDL) — bila benar-benar dibutuhkan, tulis SQL manual untuk membatalkan DDL migrasi di atas.
- **Tidak ada rollback data yang tersedia dari kode** — lihat insiden di bawah.

---

## Insiden DB Kritis — Forensik dan Pemulihan

**Kapan**: 2026-10-02, 03:27:10 – 03:36:04 UTC (10:27–10:36 WIB), ~1 jam sebelum sesi ini.

**Apa yang terjadi** (dari tabel `_prisma_migrations`):
1. `03:27:10` — upaya aplikasi migrasi `20260829000000_add_materi_riwayat_kelas` **GAGAL** (`relation "kelas" does not exist`, 42P01). Baris gagal (finished_at = NULL, berisi log error) masih ada di `_prisma_migrations`.
2. `03:32:30` — migrasi yang sama diaplikasikan **berhasil**, lalu **seluruh 34 migrasi diaplikasikan ulang dari awal** dalam ~4 menit. Artinya: seluruh riwayat migrasi database ditulis ulang hari ini — hanya mungkin terjadi pada database yang dikosongkan/dibuat ulang.
3. Tiga migrasi (`20260914`, `20260915`, `20260917`) diaplikasikan **di luar urutan** (setelah `20261003000000`) — artefak pemulihan.

**Dampak** (dihitung langsung dari database, read-only):
- **SEMUA tabel aplikasi KOSONG (0 baris)**: `users`, `gurus`, `siswas`, `kelas`, `jenjangs`, `mata_pelajarans`, `pendaftarans`, `pendaftaran_drafts`, `otp_verifikasi_email`, `bukti_transfer_pendaftarans`, `materi_pembelajarans`, `ujians`, `soal_ujians`, `pengerjaan_ujians`, `jawaban_siswas`, `tugas`, `pengumpulan_tugas`, `absensis`, `nilai_rapors`, `catatan_rapors`, `tagihan_siswas`, `pembayaran_siswas`, `email_outbox`, `kategori_transaksis`, `transaksi_keuangans`, `riwayat_kelas_siswas`, `periode_ajarans`.
- Hanya `login_audits` yang berisi: 6 baris, dibuat 03:32–03:42 UTC (aktivitas pasca-pemulihan).
- **Tidak ada** baris `pendaftaran` tersangkut di `SEDANG_DIPROSES` (recovery state machine bekerja / tidak ada klaim tergantung).
- `email_outbox` kosong → tidak ada email tertunda yang hilang.

**Penyebab (inferensi)**: replay migrasi dari awal (mis. `prisma migrate dev`/`migrate reset` atau reset manual) terhadap **database live** — `DATABASE_URL`/`DIRECT_URL` di `.env` dan `.env.prod` keduanya menunjuk ke Supabase project produksi (`jjybghdoagdumcdujdgm`). Replay dari awal mensyaratkan database kosong, jadi data sebelumnya sudah terhapus saat replay dimulai.

**Status pemulihan**: **SEBAGAIAN** — skema 100% pulih (34 migrasi applied, `migrate status` up to date); **DATA BELUM PULIH**.

### Pemulihan lanjutan 2026-10-03 — `siswas` / `orang_tuas` / `parent_students`

Gejala yang dilaporkan: menu **Kelola Siswa** menampilkan `Daftar Siswa (0 Siswa)`
padahal akun login siswa & orang tua ada. Penyebabnya bukan bug query — ketiga
tabel relasi keluarga masih kosong setelah insiden wipe di atas, sementara
tabel `users` sudah dipulihkan oleh `scripts/pulihkan-users.ts` (126 akun).

Yang dilakukan (semuanya **INSERT saja**, idempoten, tanpa UPDATE/DELETE):

| Aksi | Detail |
|------|--------|
| Migration `20261003010000_siswas_jenis_kelamin_nullable` | `ALTER TABLE siswas ALTER COLUMN jenis_kelamin DROP NOT NULL` — gender hasil rekonstruksi tidak punya sumber data, diwakili `NULL` ("belum diketahui"), bukan nilai karangan. Non-destruktif. |
| `scripts/pulihkan-siswa-ortu.ts --apply` | 67 row `siswas` (dari 67 akun `users` role SISWA), 57 row `orang_tuas`, 57 relasi `parent_students`. |
| Relasi anak↔ortu | Dipasangkan dari selisih `users.created_at` ≤ 5 detik (transaksi pembuatan yang sama; selisih terukur 0,3–2,2 detik, tanpa ambiguitas). |
| Verifikasi | `npx tsx scripts/verifikasi-daftar-siswa.ts` → `siswas=67 orang_tuas=57 parent_students=57`, `users=126` (tidak berkurang). |

**Yang TIDAK bisa dipulihkan** (tidak ada sumber data yang selamat): gender,
NISN/NIS, tanggal lahir, alamat, kelas, dan No. HP orang tua — kolomnya dibiarkan
`NULL` dan wajib dilengkapi admin. **10 siswa** tidak punya relasi orang tua yang
bisa dipasangkan secara aman (kemungkinan akun ortu reuse dari pendaftaran
sebelumnya) — daftarnya dicetak oleh script. Pemulihan **fidelitas penuh** tetap
hanya lewat restore backup Supabase (PITR) seperti langkah 1 di atas.

**Penuntasan manual oleh admin** (fitur baru, INSERT saja, idempoten): menu
**Kelola Siswa** → chip filter **"Tanpa Orang Tua"** (filter di server lewat
`getDaftarSiswaManual({ tanpaOrangTua: true })`, jadi total & pagination tetap
benar) → tombol **"Tautkan Ortu"** per baris → pilih akun ortu yang sudah ada
(`getDaftarOrangTuaUntukTautan`) **atau** buat akun baru langsung dari dialog
yang sama (`createOrangTuaBaruDanTautkan`; password baru ditampilkan sekali).
Relasi dibuat oleh `tautkanOrangTuaSiswa`. Data riwayat siswa (gender, kelas,
NISN/NIS) dilengkapi lewat tombol **"Lengkapi Data"** per baris →
`updateDataSiswaManual` (UPDATE satu row `siswas`; field yang tidak dikirim
tidak diubah, validasi kecocokan gender↔kelas & unik NISN/NIS tetap berlaku).

**Target waktu restore**: **≤ 2026-10-02 03:27 UTC**. Bukti: baris migrasi `20260829000000` gagal (`finished_at = NULL`, logs "A migration failed to apply...") pada upaya pertama ~03:27:10 UTC; replay yang berhasil dimulai 03:32:30 UTC. Data terakhir kali utuh sebelum 03:27 UTC.

**Yang harus dilakukan manusia (tidak bisa dari kode) — BLOKIR**:
1. Masuk ke konsol Supabase → project `jjybghdoagdumcdujdgm` → **Project Settings → Backups**.
   - **Paket Pro (PITR aktif default)**: pilih *Restore to point in time* → **2026-10-02 03:00 UTC** (aman; ≈nol loss). PITR tersedia untuk 7 hari terakhir.
   - **Free tier**: hanya *Daily backups* (retensi 7 hari) — restore backup terakhir sebelum insiden. Jika backup harian diambil ~02:00 UTC, loss window ≈1 jam; jika backup terakhir dari 2026-10-01, loss window ≈24 jam.
2. **Restore membuat project BARU** dengan connection string + API key baru. Catat dari project baru: URL, `anon/publishable key`, `service_role key`, DATABASE_URL (pooler 6543, `pgbouncer=true`), DIRECT_URL (5432).
3. Update semua tempat yang menunjuk project lama:
   - `.env`, `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/`..._ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`
   - `.env.prod`: `DATABASE_URL`, `DIRECT_URL`
   - **Environment variables di Vercel** (juga `NEXT_PUBLIC_SUPABASE_URL` + keys), lalu redeploy — kalau tidak, app tetap bicara ke project lama yang kosong (auth & storage juga kosong di sana).
4. `npx prisma generate && npx prisma migrate deploy` (diharapkan "up to date" — backup pra-insiden sudah punya 34 migrasi).
5. Verifikasi: `npx tsx scripts/cek-kondisi-db.ts` → baris `users`/`pendaftarans`/`siswas` harus > 0; `SEDANG_DIPROSES` harus 0.
6. Smoke test: login + buat pendaftaran + upload bukti.
7. Baru setelah semuanya jalan: pause/hapus project lama (`jjybghdoagdumcdujdgm`) agar tidak ada biaya ganda.

**Catatan**: PITR/backup restore memulihkan **seluruh cluster** termasuk `auth.users` dan `storage` (file disimpan di Postgres), jadi data auth & berkas ikut kembali bersama backup.

**Label jujur**: pemulihan data = **BLOCKED** (butuh akses konsol Supabase + kemungkinan ada loss window sesuai cadangan backup terbaru).

---

## Gerbang Verifikasi (2026-10-02, setelah `948fcd4`)

| Gerbang | Perintah | Hasil |
|---------|----------|-------|
| Uji unit/integrasi | `npx vitest run` | ✅ 47 file, **678/678 lulus** |
| Typecheck | `npx tsc --noEmit` | ✅ bersih |
| Skema Prisma | `npx prisma validate` | ✅ valid |
| Generate client | `npx prisma generate` | ✅ |
| Status migrasi | `npx prisma migrate status` | ✅ up to date (34 migrasi) |
| Build produksi | `npx next build` | ✅ sukses (semua rute terkompilasi) |

**Catatan jujur**:
- Semua uji menjalankan mock (`vi.fn()`), bukan database live — aman diulang.
- Build awalnya GAGAL akibat `STALE_PROSES_MS` yang di-export dari berkas `"use server"`; diperbaiki di `948fcd4` dan build ulang sukses.
- `next build` memanggil ESLint: 3 warning `no-explicit-any` di `verifikasi.test.ts` (sengaja, pola uji yang sudah ada) — bukan error.
