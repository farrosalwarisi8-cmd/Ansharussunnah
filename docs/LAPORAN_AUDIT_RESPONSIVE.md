# Laporan — Audit & Perbaikan Responsif Mobile/Desktop

Tanggal: 30 September 2026
Cakupan: kenyamanan UI/UX di mobile **dan** desktop (seimbang), tanpa mengubah business logic, API, database, server action, maupun role permission.

---

## 1. Metode verifikasi (bukan hanya membaca kode)

Sebelumnya breakpoint 320–1440px belum pernah diverifikasi secara visual (catatan `LAPORAN_REDESIGN_DASHBOARD.md` bagian 9). Kali ini diverifikasi dengan browser sungguhan:

- **Script baru `scripts/audit-responsive.mjs`** — Chrome headless + CDP tanpa dependensi tambahan:
  - `node scripts/audit-responsive.mjs <baseURL>` → audit semua halaman × semua viewport
  - `node scripts/audit-responsive.mjs <baseURL> landing:mobile-360` → satu halaman/viewport
- Halaman yang diperiksa: `/`, `/login`, `/pendaftaran`, `/cek-pendaftaran`, `/lupa-password`, `/lupa-password/reset`, `/lupa-password/verifikasi`, `/pilih-role`, `/pendaftaran/sukses`, 404 (11 halaman).
- Viewport: **320, 360, 390, 640, 768, 1024, 1440** (7 ukuran) → 77 pemeriksaan.
- Pemeriksaan per halaman: overflow horizontal (elemen melebihi viewport di luar wadah scroll), tap target < 40px, teks < 12px, bottom-nav mobile menutupi konten utama.
- Area dashboard diaudit **statik** (shell sidebar/header/bottom-nav, tabel, grid, sticky/fixed, breakpoint) karena halaman login memerlukan kredensial Supabase yang tidak tersedia di lingkungan ini.

---

## 2. Temuan & perbaikan

| # | Temuan | Perbaikan | File |
|---|---|---|---|
| 1 | Stepper form pendaftaran: lingkaran langkah hanya **28×28px** (label disembunyikan di mobile) — sulit disentuh | Tombol diberi `min-h-[44px] min-w-[44px]` + `touch-manipulation` + state disabled | `src/components/pendaftaran/pendaftaran-form.tsx` |
| 2 | `Input`/`Textarea`/`Select` font 14px → **iOS auto-zoom** saat fokus (font < 16px) | `text-base sm:text-sm` (16px di mobile, 14px ≥ 640px) | `src/components/ui/input.tsx`, `textarea.tsx`, `select.tsx` |
| 3 | **"Rekap Kehadiran Kelas" (guru) tidak muncul sama sekali di mobile** — tabel `hidden md:block` tanpa padanan mobile, kartu jadi kosong saat ada data | Ditambah kartu rekap `md:hidden` (nama, total hari, %, grid Hadir/Izin/Sakit/Alpa) | `src/components/dashboard/absensi-guru-view.tsx` |
| 4 | Bar timer sticky ujian `top-0` **sama persis** dengan header global `top-0 z-30` → saling menimpa saat scroll | Dipindah ke `top-[72px]` (tepat di bawah header global) | `src/components/dashboard/ujian-kerjakan-page-client.tsx` |
| 5 | Label bottom-nav mobile berpotensi terpotong (`Kelola Keuangan`, `Absensi Anak`, `Tagihan SPP`, dst. di lebar ≤ 68px) | Field baru `mobileTitle` pada `NavItem` + label pendek khusus bottom-nav | `src/components/dashboard/dashboard-nav.tsx` |
| 6 | Header landing di mobile hanya menampilkan **ikon** `Cek Status` tanpa `aria-label`, dan tombol **Masuk/Daftar tidak tersedia** di header mobile | Ikon diberi `aria-label`, link login jadi ikon+teks (teks tampil ≥ 640px), CTA "Daftar" tampil di mobile; blok nama brand disembunyikan < 640px agar tidak sempit | `src/app/page.tsx` |
| 7 | Footer landing di 640px **terlalu padat** — link "Cek Status" pecah 2 baris jadi target sentuh 37×32px | Footer menumpuk sampai `lg`, link `flex-wrap` + `min-h-[36px]` | `src/app/page.tsx` |

---

## 3. Yang sudah nyaman (diverifikasi, tidak diubah)

- **Shell dashboard**: sidebar desktop bisa collapse, drawer mobile menutup setelah memilih, bottom-nav dengan `safe-area-inset-bottom`, `main` `pb-24` (96px) > tinggi bottom-nav (~61px) → konten tidak tertimpa.
- **Tabel**: semua `<table class="data-table">` (min-w 640px) punya pembungkus `overflow-x-auto`; 10 halaman yang menyembunyikan tabel di mobile (`hidden md:block`) sudah punya daftar kartu `md:hidden` (kecuali temuan #3).
- **Dialog**: bottom-sheet di mobile, dialog terpusat di desktop; action bar `PageHeader` sticky `bottom-[76px]` (di atas bottom-nav).
- **Grid**: semua grid kartu memakai breakpoint (`grid-cols-1 sm:grid-cols-2 xl:…`) — tidak ada grid mentah yang memaksa overflow di 320px.
- **Halaman publik**: 0 overflow horizontal di 77 pemeriksaan; tidak ada teks < 12px; tap target utama ≥ 44px.

---

## 4. Hasil verifikasi

| Pemeriksaan | Perintah | Hasil |
|---|---|---|
| Audit responsif browser | `node scripts/audit-responsive.mjs http://localhost:3000` | ✅ **77/77 OK** (0 overflow, 0 tap kecil, 0 teks < 12px, 0 tumpang tindih bottom-nav) |
| TypeScript | `npx tsc --noEmit` | ✅ 0 error |
| Lint | `npm run lint` | ✅ No ESLint warnings or errors |
| Test | `npm test` | ✅ 592/592 lulus (39 file) |

---

## 5. Batasan & saran lanjutan

1. **Halaman dashboard (setelah login) belum diaudit di browser** — butuh kredensial akun uji. Jika tersedia, jalankan ulang `scripts/audit-responsive.mjs` dengan route `/dashboard/*` (perlu login sekali di Chrome profile yang sama, atau tambahkan daftar halaman login-gated ke `PAGES`).
2. Tabel mentah dengan `overflow-x-auto` polos (tanpa bleed `-mx-4 px-4` seperti `.table-scroll`) masih terasa "mepet" di tepi saat di-scroll; bisa diseragamkan menyusul.
3. Tidak ada perubahan warna, dependency baru, business logic, maupun permission.
