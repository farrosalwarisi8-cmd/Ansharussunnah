# ✅ Production Deployment Checklist — LMS Ansharussunnah

Dokumen ini berisi checklist lengkap untuk deployment production LMS Ansharussunnah.
Gunakan sebagai panduan sebelum dan sesuai go-live.

---

## 1. DATABASE & BACKUP

### Supabase Backup

- [ ] **Aktifkan Point-in-Time Recovery (PITR)**
  - Supabase free plan: backup manual harian
  - Supabase Pro plan ($25/bulan): PITR otomatis + daily backups
  - Pengaturan: Supabase Dashboard → Database → Backups
  - **Rekomendasi minimal: Pro plan untuk PITR**

- [ ] **Verifikasi backup bisa di-restore**
  - Jalankan test restore ke staging environment
  - Pastikan data kritis (users, pendaftaran, tagihan) bisa dipulihkan

- [ ] **Export manual periodik (opsional, defense-in-depth)**
  ```bash
  # Export schema + data via pg_dump (jalankan dari direct connection)
  pg_dump $DIRECT_URL > backup_$(date +%Y%m%d).sql
  ```
  - Simpan di storage external (Google Drive, S3, dsb.)
  - Jadwalkan via cron job mingguan

### Connection Pooling

- [ ] **DATABASE_URL** → port 6543 (Transaction Pooler) untuk operasi normal
- [ ] **DIRECT_URL** → port 5432 (Direct Connection) untuk migration & seed
- [ ] Verifikasi keduanya terkonfigurasi di `.env` production

---

## 2. MONITORING & ALERTING

### Error Tracking (Sentry)

- [ ] **Daftar akun gratis di [sentry.io](https://sentry.io)**
- [ ] **Install SDK:**
  ```bash
  npm install @sentry/nextjs
  ```
- [ ] **Jalankan wizard:**
  ```bash
  npx @sentry/wizard@latest -i nextjs
  ```
- [ ] **Konfigurasi environment variables:**
  ```
  SENTRY_ORG=your-org
  SENTRY_PROJECT=your-project
  SENTRY_AUTH_TOKEN=your-token
  NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
  ```
- [ ] **Set sample rate di production:**
  ```ts
  // sentry.client.config.ts
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1, // 10% traces
    replaysSessionSampleRate: 0.01, // 1% replays
    replaysOnErrorSampleRate: 1.0, // 100% on error
  })
  ```

### Uptime Monitoring

- [ ] **Setup uptime check** (gratis):
  - [UptimeRobot](https://uptimerobot.com) — 50 monitor gratis
  - [BetterStack](https://betterstack.com) — free tier tersedia
- [ ] Monitor endpoint: `https://your-domain.com/api/auth/health`
- [ ] Alert via email/Telegram/Slack saat down

### Log Management

- [ ] **Vercel Logs** — otomatis tersedia di dashboard (3 hari gratis)
- [ ] **Opsional: Logtail/BetterStack** untuk log persistence
  ```bash
  npm install @logtail/node
  ```
- [ ] Pastikan `console.error` di semua server action sudah ada (sudah dilakukan)

---

## 3. SECURITY

### Environment Variables

- [ ] Semua env var di `.env.example` sudah diisi di production
- [ ] `.env` **TIDAK** di-commit ke repository
- [ ] `SUPABASE_SERVICE_ROLE_KEY` tidak pernah di-expose ke client-side
- [ ] `RESEND_API_KEY` aman dan tidak di-share

### Authentication

- [ ] Seed password sudah diganti setelah deployment
- [ ] `mustChangePassword: true` bekerja untuk semua akun baru
- [ ] Rate limiting aktif (Upstash Redis terkonfigurasi)
- [ ] Login audit trail aktif (tabel `login_audits` terbuat)

### Storage & RLS

- [ ] **Semua bucket** memiliki RLS aktif:
  - `bukti-transfer` ✅
  - `bukti-spp` ✅
  - `tugas-siswa` ✅
  - `nota` ✅
  - `materi` ✅
  - `dokumen-pendaftaran` ✅ (baru ditambahkan)
- [ ] **Tidak ada** bucket yang di-set sebagai "Public Bucket"
- [ ] Verifikasi RLS policy dengan test manual:
  ```sql
  SELECT policyname, cmd FROM pg_policies
  WHERE schemaname = 'storage' ORDER BY policyname;
  ```

### Security Headers

- [ ] CSP header aktif (sudah ditambahkan di `next.config.ts`)
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Referrer-Policy: strict-origin-when-cross-origin

---

## 4. DEPLOYMENT (VERCEL)

### Konfigurasi Vercel

- [ ] **Framework Preset:** Next.js
- [ ] **Build Command:** `prisma generate && next build`
- [ ] **Output Directory:** `.next` (default)
- [ ] **Install Command:** `npm install`

### Environment Variables di Vercel

- [ ] Copy semua variabel dari `.env.example` ke Vercel Dashboard → Settings → Environment Variables
- [ ] Set Environment: Production, Preview, Development (sesuai kebutuhan)
- [ ] **Sensitif variables** (SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, UPSTASH_*):
  - Set hanya untuk Production
  - Jangan set untuk Preview/Development

### Build & Deploy

- [ ] `npm run build` berhasil tanpa error
- [ ] `npx tsc --noEmit` berhasil tanpa error
- [ ] Semua test pass: `npm test`
- [ ] Deploy ke Vercel: `git push origin main`

### Post-Deploy Verification

- [ ] Buka aplikasi di browser → halaman login muncul
- [ ] Login dengan akun seed (setelah ganti password)
- [ ] Cek Vercel Function Logs untuk error
- [ ] Cek Supabase Dashboard → Auth → Users (pastikan ada)
- [ ] Cek Supabase Dashboard → Storage (pastikan bucket ada & RLS aktif)

---

## 5. OPERATIONAL

### Cron Jobs

- [ ] **Auto-close ujian kedaluwarsa** (opsional):
  - Buat Route Handler di `src/app/api/cron/tutup-ujian/route.ts`
  - Validasi header `Authorization: Bearer <CRON_SECRET>`
  - Set `CRON_SECRET` di environment variables
  - Konfigurasi di `vercel.json`:
    ```json
    {
      "crons": [{
        "path": "/api/cron/tutup-ujian",
        "schedule": "*/5 * * * *"
      }]
    }
    ```

### Cleanup Policy

- [ ] **Login audit logs**: bersihkan record lebih dari 90 hari
  ```sql
  DELETE FROM login_audits WHERE created_at < NOW() - INTERVAL '90 days';
  ```
  - Jadwalkan via Supabase SQL Editor atau cron job

- [ ] **Password reset tokens**: sudah di-invalidate otomatis (expired_at index)

### Scaling Considerations

- [ ] **Prisma connection pool**: default 10 connection, naikkan jika traffic tinggi
  ```env
  DATABASE_URL=...?connection_limit=20&pool_timeout=30
  ```
- [ ] **Upstash Redis**: pastikan plan mencukupi (free: 10,000 commands/day)
- [ ] **Supabase free plan**: 500MB database, 1GB storage — upgrade jika perlu

---

## 6. DOCUMENTATION

- [x] `.env.example` tersedia dengan semua variabel terdokumentasi
- [x] `README.md` berisi setup guide lengkap
- [x] RLS policies terdokumentasi di `docs/SUPABASE_STORAGE_RLS.md`
- [x] Production checklist ini tersedia

---

## Monitoring Contacts

| Service | Dashboard URL | Alert Channel |
|---------|---------------|---------------|
| Vercel | https://vercel.com/dashboard | Email |
| Supabase | https://supabase.com/dashboard | Email |
| Resend | https://resend.com | Email |
| Upstash | https://console.upstash.com | Email |
| Sentry | https://sentry.io | Email + Slack |

---

*Terakhir diperbarui: 30 Agustus 2026*
