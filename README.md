# 📚 LMS Ansharussunnah

Sistem Learning Management System (LMS) untuk Pesantren Ansharussunnah. Mengelola pendaftaran siswa baru, pembayaran SPP, ujian online, tugas, absensi, rapor, dan manajemen keuangan.

## Tech Stack

- **Framework:** Next.js 15 (App Router, TypeScript)
- **Database:** PostgreSQL via Supabase
- **ORM:** Prisma
- **Auth:** Supabase Auth (email + password)
- **Storage:** Supabase Storage (file upload bukti transfer, materi, tugas, dll)
- **Email:** Resend
- **Rate Limiting:** Upstash Redis (production) / In-memory (development)
- **UI:** Tailwind CSS + Radix UI + shadcn/ui patterns
- **Form:** React Hook Form + Zod validation
- **Testing:** Vitest

## Struktur Folder

```
├── prisma/
│   ├── schema.prisma       # Definisi model database
│   └── seed.ts             # Seed data awal (akun guru admin, admin keuangan, master data)
├── src/
│   ├── actions/            # Server Actions (CRUD, bisnis logic)
│   │   ├── auth.ts         # Login, logout
│   │   ├── guru.ts         # CRUD akun guru
│   │   ├── admin-keuangan.ts # CRUD akun admin keuangan
│   │   ├── pendaftaran.ts  # Pendaftaran siswa baru
│   │   ├── verifikasi.ts   # Verifikasi pendaftaran oleh guru
│   │   ├── akuntansi.ts    # SPP, tagihan, pembayaran, laporan keuangan
│   │   ├── ujian.ts        # Manajemen ujian & pengerjaan siswa
│   │   ├── tugas.ts        # Manajemen tugas & pengumpulan
│   │   ├── absensi.ts      # Input absensi
│   │   ├── rapor.ts        # Catatan & nilai rapor
│   │   └── materi.ts       # Upload materi pembelajaran
│   ├── app/                # Next.js App Router pages
│   ├── components/         # React components (UI & page-specific)
│   ├── lib/                # Shared utilities
│   │   ├── auth.ts         # Auth guards (requireAuth, requireGuru, etc.)
│   │   ├── prisma.ts       # Prisma client singleton
│   │   ├── supabase/       # Supabase client setup (server, admin, browser)
│   │   ├── password.ts     # Password generation utilities
│   │   ├── rate-limit.ts   # Rate limiting (Upstash Redis / in-memory)
│   │   ├── email.ts        # Email templates & sending via Resend
│   │   ├── storage.ts      # Supabase Storage helpers
│   │   └── validations/    # Zod schemas per domain
│   ├── types/              # TypeScript type definitions
│   └── middleware.ts       # Next.js middleware (auth redirect)
├── docs/                   # Dokumentasi RLS policies Supabase Storage
└── .env.example            # Template environment variables
```

## Setup Lokal

### Prasyarat

- Node.js 18+
- npm / pnpm / yarn
- Akun Supabase (gratis) — buat di [supabase.com](https://supabase.com)
- Akun Resend (gratis) — buat di [resend.com](https://resend.com)

### Langkah Setup

1. **Clone repository**

   ```bash
   git clone https://github.com/username/ansharussunnah-lms.git
   cd ansharussunnah-lms
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Setup environment variables**

   ```bash
   cp .env.example .env
   ```

   Lalu edit `.env` dan isi semua variabel yang dibutuhkan. Lihat `.env.example` untuk penjelasan tiap variabel.

4. **Jalankan database migration**

   ```bash
   npx prisma migrate deploy
   ```

   Atau untuk development (membuat migration baru):

   ```bash
   npx prisma migrate dev
   ```

5. **Jalankan seed**

   ```bash
   npx prisma db seed
   ```

   > ⚠️ **PERINGATAN PRODUCTION:** Setelah seed dijalankan, segera login dan ganti password akun guru admin serta admin keuangan. Password seed hanya untuk akses awal. Kedua akun sudah memiliki `mustChangePassword: true` sehingga Anda akan dipaksa mengganti password saat pertama kali login.

6. **Setup Supabase Storage & RLS**

   Buat bucket-bucket berikut di Supabase Dashboard → Storage:
   - `bukti-transfer` — bukti pembayaran pendaftaran
   - `bukti-spp` — bukti pembayaran SPP
   - `tugas-siswa` — submission tugas & lampiran guru
   - `nota` — bukti transaksi keuangan non-SPP
   - `materi` — materi pembelajaran
   - `dokumen-pendaftaran` — dokumen pendaftaran (KK, akte, foto)

   Aktifkan RLS pada setiap bucket. Template SQL policy ada di folder `docs/`.

### Menjalankan Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

### Build Production

```bash
npm run build
npm start
```

## Akun Seed

| Role | Email | Keterangan |
|------|-------|------------|
| Guru Admin | `guru@sekolah.sch.id` | Password di-generate random atau dari env `SEED_GURU_PASSWORD` |
| Admin Keuangan | `keuangan@sekolah.sch.id` | Password di-generate random atau dari env `SEED_KEUANGAN_PASSWORD` |

> 🔴 **PENTING:** Segera ganti password setelah seed dijalankan di production!

## Testing

```bash
npm test              # Jalankan semua tes
npm run test:watch    # Watch mode
```

## Referensi

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Resend Documentation](https://resend.com/docs)
