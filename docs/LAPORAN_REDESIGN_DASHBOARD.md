# Laporan Akhir — Redesign Dashboard Anshorussunnah

Tanggal laporan: 30 September 2026
Cakupan: seluruh dashboard (5 role) + halaman publik terkait, mobile-first, tanpa mengubah business logic, API, database, server action, maupun role permission.

---

## 1. Ringkasan

Pekerjaan dibagi dua gelombang:

1. **Gelombang utama** — design system, dashboard shell (sidebar/header), 5 home role, dan ±80 file halaman/fitur dirapikan (layout, hierarchy, spacing, responsive, loading/empty/error state).
2. **Gelombang lanjutan** (dokumen ini) — menutup sisa temuan audit:
   - Komponen upload dirapikan (progress, pratinjau, kamera, ganti berkas).
   - State **permission denied**, **session expired**, dan **unsaved changes warning**.
   - **Grafik keuangan** (arus kas & tunggakan) dan **rincian status pendaftar** di dashboard admin.
   - 2 warning lint dibersihkan + laporan ini ditulis.

Total perubahan di working tree: **97 file** (85 termodifikasi + 12 baru), ±5.571 baris ditambah / ±3.060 baris dihapus.

---

## 2. Design system

### Token (dipertahankan sesuai identitas Anshorussunnah)

| Token | Nilai |
|---|---|
| Primary Gold | `#EAB308` (`--primary`, `--gold`) |
| Primary Dark | `#CA8A04` (`--primary-dark`) |
| Primary Soft | `#FEF9C3` (`--primary-soft`) |
| Background | `#F8FAFC` / slate-50 |
| Surface | `#FFFFFF` |
| Text primary / secondary | `#1E293B` / `#64748B` (slate) |
| Border | `#E2E8F0` |
| Success / Warning / Danger / Info | `#16A34A` / `#D97706` / `#DC2626` / `#2563EB` |

File: `src/app/globals.css`, `tailwind.config.ts` (shadow `card/soft/lifted/gold`, radius, spacing, `maxWidth.content`, animasi `shimmer/fade-up`, key `2xs`).

### Komponen design system

**Baru:**
- `src/components/ui/page-header.tsx` — kepala halaman seragam (breadcrumb, judul, deskripsi, aksi, sticky action mobile).
- `src/components/ui/page-skeleton.tsx` — skeleton halaman.
- `src/components/ui/stat-card.tsx` — kartu ringkasan dengan loading/hint/link.
- `src/components/ui/alert.tsx` — alert variant.
- `src/components/ui/access-denied.tsx` — **state "Akses Ditolak"** (block penuh + banner).
- `src/components/ui/bar-chart.tsx` — **grafik batang murni CSS** (tanpa dependency chart baru).
- `src/hooks/use-unsaved-changes.ts` — **peringatan perubahan belum disimpan**.

**Diperbarui:** `button`, `card`, `badge`, `status-badge`, `table`, `empty-state`, `dialog`, `input`, `select`, `textarea`, `label`, `file-upload`.

---

## 3. Dashboard shell (konsisten semua role)

- **Sidebar**: section Beranda / Akademik / Pendaftaran / Siswa & Sekolah / Keuangan / Pengaturan; menu per-role; **collapse + tooltip**; active state jelas; **bottom-nav mobile**; **drawer mobile** (tutup setelah memilih menu).
- **Header sticky** (backdrop-blur): section + judul halaman, tombol menu mobile, role aktif, **notifikasi** (empty state jujur), **profile menu** (nama, email, badge role, Profil, Ganti Password, Ganti Akun/Role, Keluar).
- Konten utama `max-w-7xl`, padding bawah besar agar tidak tertimpa bottom-nav.

---

## 4. Role & halaman yang dirapikan

Semua role: **Orang Tua/Wali, Siswa, Guru, Admin, Keuangan** — memakai design system yang sama.

Fitur yang disentuh (server page tetap, client view dirapikan): dashboard utama (5 home role), profil, berkas siswa, data siswa/daftar siswa, verifikasi pendaftaran (+ detail & konfirmasi kontak wali), daftar guru, daftar kelas, pengajar kelas, mata pelajaran, materi, tugas + detail + buat, ujian + buat + preview + kerjakan + rekap, absensi (3 view), nilai/rekap nilai, rapor (guru/siswa), tagihan, SPP/kasir/laporan/rekap/verifikasi/generate/potongan (tab keuangan), biaya PPDB, periode ajaran, kelola akun keuangan, kenaikan kelas, ganti password, lupa password, pilih role, cek pendaftaran, form pendaftaran + upload dokumen/bukti, loading/error/not-found global.

---

## 5. Perbaikan responsive

- Mobile: drawer navigasi, bottom-nav, header compact, tombol ≥44px, card 1 kolom, aksi sticky pada `PageHeader`, tabel via `.table-scroll` (scroll horizontal nyaman, `-mx-4`), tanpa lebar tetap penyebab overflow.
- Desktop: sidebar kiri bisa diciutkan, grid multi kolom, spacing lebih luas, container `max-w-7xl`.
- Breakpoint teruji lewat build statis (320–1440px perlu verifikasi visual manual — lihat bagian 9).

---

## 6. Perbaikan UX & state

| State | Status |
|---|---|
| Normal / loading skeleton | ✅ `PageSkeleton` + skeleton internal (45 file) |
| Empty / no result / no filter | ✅ `EmptyState` (32 file) + varian `filter` |
| Error | ✅ `EmptyState variant="error"`, `app/error.tsx`, `global-error.tsx` |
| Not found | ✅ `app/not-found.tsx` |
| **Permission denied** | ✅ `AccessDenied` + `AccessDeniedBanner` (baru) |
| **Session expired** | ✅ banner di `/login?sesi=berakhir` (baru) |
| **Unsaved changes** | ✅ `useUnsavedChangesWarning` di halaman Profil (baru) |
| Success / validation error | ✅ toast (35 file), inline `role="alert"` |
| Confirmation / delete confirmation | ✅ `ConfirmDialog` (14 file) |
| **Upload progress / success / failure** | ✅ `FileUpload` status `uploading/success/error` (baru) |

### 6a. Komponen upload (gelombang lanjutan)

`src/components/ui/file-upload.tsx` ditulis ulang:

- Palet slate/gold konsisten (hapus `gray`, `bg-primary/5`, `border-destructive`).
- Error validasi **inline `role="alert"`** — tidak lagi `window.alert()`.
- Format file & batas ukuran ditampilkan sebelum memilih (label ramah: "Gambar (JPG/PNG/WEBP) • PDF • Maks. 5 MB").
- Tombol **"Pilih Berkas"** (44px) + **"Ambil Foto"** (`capture="environment"`) untuk perangkat yang mendukung.
- **Pratinjau thumbnail** per berkas + dialog pratinjau ukuran penuh (object URL, di-revoke saat unmount).
- Nama + ukuran berkas + status "Siap diunggah".
- Tombol **"Ganti"** per berkas (mengganti indeks terkait) dan **"Hapus"** ber-`aria-label`.
- Chip **"Sudah terunggah"** untuk berkas yang sudah ada di server.
- **Progress bar** + label status (dikendalikan induk form lewat prop `status`/`progress`).

Dipakai oleh: `pendaftaran-form.tsx`, `upload-dokumen-form.tsx`, `upload-bukti-form.tsx` (kedua form terakhir kini mengirim `status={isUploading ? "uploading" : "idle"}`, `disabled` saat mengirim, dan teks diseragamkan ke slate).

### 6b. Permission denied & session expired

- `src/app/dashboard/layout.tsx`: guard **tidak berubah** (aturan tetap sama), hanya tujuan redirect ditandai → `/dashboard?akses=ditolak` dan `/login?sesi=berakhir`.
- `dashboard-page-client.tsx` menampilkan `AccessDeniedBanner` saat param ada, lalu membersihkannya dari URL (refresh tidak mengulang).
- `login-form.tsx` menampilkan pesan "Sesi Anda telah berakhir…" / "Silakan masuk untuk membuka halaman yang Anda minta."
- `tagihan-page-client.tsx` & `daftar-siswa-keuangan-client.tsx` memakai `AccessDenied` (markup "Akses Ditolak" ad-hoc diganti komponen bersama).

### 6c. Grafik keuangan (dashboard Admin Keuangan)

- `role-homes/keuangan-home.tsx` menambahkan kartu **"Grafik Keuangan"**:
  - **Pemasukan & Pengeluaran 6 bulan terakhir** (batang berpasangan, kuning/rose).
  - **Tunggakan SPP per bulan** (batang tunggal, amber).
- Sumber data: `getLaporanKeuangan` + `getRekapTunggakanSpp` (action yang sudah ada, read-only, paralel, tanpa action baru & tanpa dependency chart).
- Memiliki loading skeleton, empty text, error state sendiri (gagal memuat grafik tidak menjatuhkan ringkasan angka).

### 6d. Rincian status pendaftar (dashboard Admin)

- `role-homes/admin-home.tsx` menambahkan kartu **"Rincian Status Pendaftar"**:
  - 4 tile status: **Menunggu Pembayaran, Menunggu Verifikasi, Diterima, Ditolak** (memakai `StatusBadge`, klik → halaman verifikasi).
  - Baris **"Berkas belum lengkap"** (dihitung dari pendaftar menunggu: KK/akta/foto) dengan jumlah data yang diperiksa ditampilkan secara jujur.
- Sumber data: `getPendaftaranList` (4 pemanggilan paralel, read-only) — tanpa action baru.

### 6e. Lint

- `absensi-guru-view.tsx`: impor `BookOpen` tak terpakai dihapus.
- `modal-absensi-mapel.tsx`: impor `CheckCircle2` tak terpakai dihapus.

---

## 7. Daftar file yang diubah (gelombang lanjutan)

**Baru:**
- `src/components/ui/access-denied.tsx`
- `src/components/ui/bar-chart.tsx`
- `src/hooks/use-unsaved-changes.ts`
- `docs/LAPORAN_REDESIGN_DASHBOARD.md` (dokumen ini)

**Diubah:**
- `src/components/ui/file-upload.tsx` (tulis ulang)
- `src/components/pendaftaran/upload-dokumen-form.tsx`
- `src/components/pendaftaran/upload-bukti-form.tsx`
- `src/app/dashboard/layout.tsx`
- `src/components/dashboard/dashboard-page-client.tsx`
- `src/components/login-form.tsx`
- `src/components/dashboard/profil-page-client.tsx`
- `src/components/dashboard/tagihan-page-client.tsx`
- `src/components/dashboard/daftar-siswa-keuangan-client.tsx`
- `src/components/dashboard/role-homes/keuangan-home.tsx`
- `src/components/dashboard/role-homes/admin-home.tsx`
- `src/components/dashboard/absensi-guru-view.tsx` (lint)
- `src/components/dashboard/modal-absensi-mapel.tsx` (lint)

*(Gelombang utama: ±85 file — design system, shell, 5 home role, dan seluruh client view fitur.)*

---

## 8. Hasil verifikasi

| Pemeriksaan | Perintah | Hasil |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | ✅ **0 error** |
| Lint | `npm run lint` | ✅ **No ESLint warnings or errors** |
| Test | `npm test` | ✅ **592/592 lulus (39 file)** |
| Production build | `npm run build` | ✅ **Compiled successfully, 41/41 static pages** |

### Batasan yang dijaga

- ❌ Tidak ada perubahan database (diff `prisma/schema.prisma` hanya komentar deprecation).
- ❌ Tidak ada perubahan server action / API contract / role permission / business logic pada pekerjaan redesign.
- ❌ Tidak ada fitur dihapus, tidak ada halaman dummy, tidak ada dependency baru.
- ❌ Warna utama tidak diganti; tidak ada gradien/neon/glassmorphism berlebihan.

---

## 9. Catatan di luar scope redesign

1. **Verifikasi visual breakpoint manual** (320/375/390/768/1024/1280/1440) belum dilakukan — perlu cek browser/Lighthouse.
2. **Breadcrumb**: komponen `PageHeader` sudah siap, tetapi belum ada halaman mengirim `breadcrumbs=` (header saat ini menampilkan section + judul halaman).
3. **Global search** & **sumber data notifikasi** belum ada (keduanya bersifat opsional; notifikasi sekarang menampilkan empty state yang jujur).
4. **`loading.tsx` per-route** belum tersedia di ±15 route dashboard (beberapa kliennya sudah punya skeleton internal); route berikut belum: profil, siswa, mapel, berkas, biaya-ppdb, daftar-siswa, periode-ajaran, kelola-akun-keuangan, rekap-nilai, tugas/buat, ujian/buat, ujian/[id]/*, kelas/[id]/pengajar.
5. **Komponen pendukung kecil** yang belum ikut diseragamkan: `confirm-dialog`, `toast`, `ganti-akun-dialog`, `child-selector`, `kelas-mapel-selector`, `berkas-siswa-modal`, `modal-absensi-mapel`, `modals/add-admin` & `edit-admin`, `target-gender-selector`.
6. **Perubahan di luar scope redesign** yang ikut ada di working tree (tugas lain): penghapusan alur OTP email (`src/actions/verifikasi-email*`, `pendaftaran.ts`, `verifikasi.ts`, `email.ts`, `types/index.ts`) — hanya komentar pada schema, tidak ada migrasi baru.
