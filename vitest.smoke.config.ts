// vitest.smoke.config.ts
//
// Config TERPISAH untuk smoke test end-to-end yang menyentuh infrastruktur
// nyata (database dev + Supabase Auth). TIDAK dijalankan oleh `npm test` —
// jalankan dengan: npm run test:smoke
//
// Include pattern sengaja berbeda (smoke/**/*.smoke.ts) agar file smoke
// tidak ikut tereksekusi saat unit test biasa berjalan.

import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["smoke/**/*.smoke.ts"],
    setupFiles: ["smoke/setup-env.ts"],
    testTimeout: 120_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    env: {
      // Fallback agar lib crypto tidak gagal bila env lokal tidak mengisi key
      PASSWORD_ENCRYPTION_KEY: "test-only-encryption-key-0123456789abcdef",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
