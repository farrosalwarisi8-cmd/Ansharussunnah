// src/instrumentation.ts

import * as Sentry from "@sentry/nextjs"

export async function register() {
  // Muat config Sentry sesuai runtime (wajib agar captureMessage/captureException
  // dari src/lib/monitoring.ts benar-benar terkirim).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config")
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config")
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { validateEnv } = await import("@/lib/env")
      validateEnv()
      console.log("✅ Initialization: Environment variables successfully validated")
    } catch (error) {
      console.error("❌ Initialization Error: Environment variables validation failed!")
      console.error(error)
      if (process.env.NODE_ENV === "production") {
        throw error
      }
    }
  }
}

// Teruskan error yang tidak tertangani dari request ke Sentry (Next.js 15).
export const onRequestError = Sentry.captureRequestError
