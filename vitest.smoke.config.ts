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
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
