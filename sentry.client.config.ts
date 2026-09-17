
// sentry.client.config.ts

import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    // Replay on-error dikecilkan ke 10%: replay merekam DOM & isian pengguna
    // (data pribadi pendaftaran/keuangan) ke pihak ketiga. Sample lebih kecil
    // tetap memberi sinyal debugging tanpa mengekspos semua sesi error.
    replaysOnErrorSampleRate: 0.1,
    integrations: [
      // Nonaktifkan pengukuran LCP & CLS: internal web-vitals bundled Sentry
      // (onLCP/onCLS dengan reportAllChanges=true) melempar
      // "Cannot read properties of undefined (reading 'startTime')"
      // sesekali di Chrome. INP/TTFB/FCP tetap diukur.
      Sentry.webVitalsIntegration({ ignore: ["cls", "lcp"] }),
    ],
  })
}

