// src/instrumentation.ts

export async function register() {
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

export const onRequestError = async (...args: unknown[]) => {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  const Sentry = await import("@sentry/nextjs")
  const captureRequestError = Sentry.captureRequestError as unknown as (
    ...a: unknown[]
  ) => void
  captureRequestError(...args)
}
