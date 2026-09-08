// vitest.config.ts

import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/actions/**"],
    },
    testTimeout: 10000,
    env: {
      PASSWORD_ENCRYPTION_KEY: "test-only-encryption-key-0123456789abcdef",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})