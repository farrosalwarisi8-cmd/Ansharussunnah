# Monitoring & Alerting Production

Panduan memasang dan mengelola monitoring error, khususnya error cache Redis
yang bersifat fail-open (app tetap jalan via DB sehingga satu-satunya tanda
bahaya adalah event monitoring).

## 1. Prasyarat (sekali)

1. Buat project di [sentry.io](https://sentry.io) (platform: Next.js).
2. Set environment variables di hosting production (Vercel/dll):

   ```
   SENTRY_DSN=https://xxx@sentry.io/xxx     # server & edge
   NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx   # client (browser)
   SENTRY_ORG=your-org                      # opsional: upload source maps
   SENTRY_PROJECT=your-project              # opsional: upload source maps
   SENTRY_AUTH_TOKEN=your-token             # opsional: upload source maps
   ```

   Tanpa DSN, Sentry no-op otomatis — app tetap jalan normal (fail-open),
   hanya saja event tidak terkirim.

3. Wiring sudah dilakukan di repo:
   - `next.config.ts` → `withSentryConfig` (source maps hanya di-upload bila
     `SENTRY_AUTH_TOKEN` tersedia).
   - `src/instrumentation.ts` → muat `sentry.server.config` / `sentry.edge.config`
     sesuai runtime + `onRequestError` untuk error request tak tertangani.
   - `sentry.{client,server,edge}.config.ts` → `Sentry.init` dengan DSN.

## 2. Pelaporan error cache (src/lib/monitoring.ts)

`reportCacheError(operation, key, error)` dipanggil dari `src/lib/cache.ts`
untuk operasi `read`, `write`, dan `invalidation` yang gagal ke Redis
(error dynamic-usage Next.js **tidak** dilaporkan — itu bukan kerusakan Redis).

Karakteristik penting:

- **Throttle:** maksimal 1 event per fingerprint `operasi:key` per 5 menit
  (default), agar satu insiden Redis down tidak menghabiskan kuota event.
- **Fingerprint per key:** insiden pada key berbeda tetap terlapor.
- **Fail-open:** pelapor tidak pernah melempar error ke alur request.
- **Tuning:** env `CACHE_ERROR_THROTTLE_SECONDS` (detik) untuk mengubah window.

## 3. Alert rule di Sentry (sekali setelah project dibuat)

Dashboard Sentry → **Alerts** → **Create Alert**:

1. **Cache Redis error** (palings penting):
   - Condition: `The event's message contains "[cache]"` → lebih dari `0`
     event dalam `5 menit`.
   - Filter (opsional): level `warning`.
   - Action: kirim notifikasi ke channel tim (email/Slack/Discord).
2. **Error spike umum:**
   - Condition: `issues` baru > `10` dalam `1 jam`.
   - Action: notifikasi ke on-call.

Alert pertama inilah yang menjadi pengganti "log berisik" yang dulu
terlihat di terminal — sekarang hanya muncul saat benar-benar terjadi.

## 4. Verifikasi setelah deploy

```bash
# 1. Pastikan event masuk: kirim error uji dari runtime server
curl -s "<APP_URL>/api/auth/health" && echo "OK"

# 2. (Opsional) sementara set env UPSTASH_REDIS_REST_URL ke nilai salah,
#    buka /pendaftaran beberapa kali, lalu cek issue "[cache] read gagal"
#    muncul di Sentry (maks 1x per key per 5 menit).
```

Cek juga di Vercel/hosting logs: tidak boleh ada lagi spam
`[cache] read miss-fallback` untuk kasus prerender — kasus itu kini hening.

## 5. Checklist mingguan (tambahan untuk SECURITY_MAINTENANCE.md)

- [ ] Cek dashboard Sentry: apakah ada event `[cache]`? Kalau ada, cek status
      Upstash & latency DB — app masih jalan tapi melayani dari DB.
- [ ] Cek kuota event Sentry (free tier 5k/bln) — throttle harus menjaga
      konsumsi tetap rendah.
