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


