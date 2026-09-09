# 🔒 Security Maintenance — LMS Ansharussunnah

Checklist **berkala** untuk menjaga aplikasi tetap aman dalam jangka panjang
(harian/mingguan/bulanan/bulan-per-3-bulan/tahunan). Beda dari
`docs/PRODUCTION_CHECKLIST.md` yang fokus pada persiapan go-live; dokumen ini
fokus pada **pemeliharaan berkelanjutan** setelah aplikasi berjalan.

> Prinsip utama: keamanan itu **dinamis**, bukan sekali jadi. Tanpa perawatan
> rutin, aplikasi yang aman hari ini bisa rentan dalam 1–5 tahun ke depan.

---

## 1. RUTINITAS MINGGUAN

### 1.1 Audit Dependency (5 menit)

Cek apakah ada dependency dengan celah keamanan (CVE):

```bash
npm audit
```

**Tindakan jika ada temuan:**
- `SEVERITY: high/critical` → segera upgrade: `npm update <package>` lalu `npm run build` + `npm test`
- `SEVERITY: moderate` → jadwalkan upgrade di minggu berikutnya
- Selalu baca deskripsi CVE — apakah menyentuh jalur kode yang kita pakai?

**Rujukan:**
- [Snyk Vulnerability DB](https://security.snyk.io)
- [GitHub Advisory Database](https://github.com/advisories)
- [CVE Mitre](https://cve.mitre.org)

### 1.2 Uptime & Error (10 menit)

- [ ] Cek dashboard Sentry: apakah ada error spike yang tidak wajar?
- [ ] Cek dashboard Vercel: fungsi mana yang lambat / error?
- [ ] Konfirmasi tidak ada log login gagal massal (indikasi brute-force)

---

## 2. RUTINITAS BULANAN

### 2.1 Upgrade Dependency Minor/Patch

```bash
# Lihat versi terbaru yang tersedia
npm outdated

# Upgrade semua patch & minor (tetap di major yang sama)
npm update

# Build + test wajib setelah upgrade
npm run build
npm test
```

**Aturan:**
- Upgrade patch/minor → aman, lakukan rutin.
- Upgrade major (contoh Next 15 → 16, React 19 → 20) → **lakukan terpisah**,
  baca changelog, dan uji menyeluruh karena bisa memecah kode.
- Jangan pernah upgrade langsung ke major terbaru tanpa test di staging.

### 2.2 Review Log Keamanan

- [ ] Cek `login_audits` di database untuk percobaan login aneh:
  ```sql
  SELECT * FROM login_audits
  WHERE created_at > NOW() - INTERVAL '30 days'
  ORDER BY created_at DESC
  LIMIT 100;
  ```
- [ ] Cek rate-limit: apakah ada IP yang sering kena limit (indikasi serangan)?
- [ ] Cek Supabase Auth → Users: adakah akun yang dicurigai?

---

## 3. PERSIAPAN TIAP 3 BULAN (Quarterly)

### 3.1 Rotasi Secret

Rotasi **wajib** jika ada indikasi bocor, atau preventif tiap 3 bulan:

- [ ] `SUPABASE_SERVICE_ROLE_KEY` → regenerate di Supabase Dashboard → Settings → API
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` → regenerate
- [ ] `RESEND_API_KEY` → regenerate di Resend
- [ ] `UPSTASH_REDIS_REST_TOKEN` → regenerate di Upstash
- [ ] `CRON_SECRET` → ganti dengan nilai acak baru (mis. `openssl rand -hex 32`)
- [ ] Update semua di Vercel Dashboard → Settings → Environment Variables, lalu redeploy
- [ ] Hapus key lama dari `.env` lokal setelah diganti

### 3.2 Verifikasi Storage & RLS

- [ ] Pastikan **tidak ada** bucket yang berubah jadi public:
  ```sql
  SELECT id, public FROM storage.buckets;
  ```
  Semua harus `public = false`.
- [ ] Verifikasi RLS masih aktif di semua bucket:
  ```sql
  SELECT b.name, b.public FROM storage.buckets b;
  ```
- [ ] Uji manual: login sebagai user biasa → coba akses file orang lain → harus gagal

### 3.3 Scanning Otomatis

- [ ] Jalankan audit otomatis via [OWASP ZAP](https://www.zaproxy.org/) atau
      [csp-evaluator](https://csp-evaluator.withgoogle.com/) terhadap domain production
- [ ] Cek hasil di [Security Headers](https://securityheaders.com) — pastikan skor tidak turun
- [ ] Cek [Mozilla Observatory](https://observatory.mozilla.org) untuk skor keseluruhan

---

## 4. RUTINITAS TAHUNAN

### 4.1 Review Kode Keamanan Menyeluruh

Lakukan *code audit* menyeluruh (bisa dibantu tim/dev freelance):

- [ ] Cari kemunculan `dangerouslySetInnerHTML` / `innerHTML` — **harus 0**:
  ```bash
  grep -rn "dangerouslySetInnerHTML\|innerHTML" src/
  ```
- [ ] Cari `eval(` / `new Function(` — **harus 0** di kode aplikasi:
  ```bash
  grep -rn "eval(\|new Function(" src/
  ```
- [ ] Pastikan tidak ada rahasia/secret hard-coded di source:
  ```bash
  grep -rniE "(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][A-Za-z0-9]{16,}" src/
  ```
- [ ] Pastikan `.env` tidak terbaca oleh publik (cek file public/ dan .next/)
- [ ] Review endpoint API baru & server action: validasi input, otorisasi, rate-limit?

### 4.2 Verifikasi Keamanan Upgrade Framework

- [ ] Upgrade major framework/library (Next.js, React, Prisma, Supabase SDK) dan
      baca **breaking-change + security notes** dari changelog
- [ ] Pastikan `unsafe-eval` / `unsafe-inline` di CSP `script-src` **dihapus jika
      stack sudah tidak membutuhkannya** (hardening; lihat catatan di bawah)

> **Catatan `unsafe-eval`:**
> Saat ini aman dibiarkan karena tidak ada XSS di codebase. Namun ini *bom waktu*
> dalam jangka panjang — jika suatu saat fitur baru memasukkan
> `dangerouslySetInnerHTML` tanpa sanitasi, `unsafe-eval` akan memperbesar dampak
> menjadi eksekusi kode. Sebelum dihapus, verifikasi dev-mode & Sentry tetap jalan.

### 4.3 Backup & Restore Drill

- [ ] Lakukan test restore backup ke environment staging
- [ ] Konfirmasi data kritis (users, pendaftaran, tagihan, bukti transfer) pulih utuh
- [ ] Verifikasi PITR (Point-in-Time Recovery) aktif

---

## 5. RESPONS INSIDEN (Bila Ada Dugaan Pelanggaran)

1. **Isolasi** — nonaktifkan yang mencurigakan (revoke key, suspend akun)
2. **Investigate** — baca log Vercel/Sentry/Supabase, cari jejak dalam 7 hari terakhir
3. **Mitatigasi** — rotasi semua secret, hapus data yang terpengaruh, tutup celah
4. **Rotasi** — ganti `SERVICE_ROLE_KEY` & password admin
5. **Dokumentasikan** — catat insiden, penyebab, dan cara mencegah berulang

---

## Ringkasan Frekuensi

| Frekuensi  | Tindakan                                        | Durasi |
|------------|------------------------------------------------|--------|
| Mingguan   | `npm audit` + cek error Sentry/Vercel           | 15 mnt |
| Bulanan    | `npm update` (minor/patch) + review login log   | 30 mnt |
| 3 Bulanan  | Rotasi secret + verifikasi RLS + scan otomatis  | 1–2 jam |
| Tahunan    | Audit kode menyeluruh + upgrade major + backup drill | 1 hari |

---

*Terakhir diperbarui: 9 September 2026*
