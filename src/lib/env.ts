// src/lib/env.ts

const requiredEnvVars = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "NEXT_PUBLIC_APP_URL",
] as const

export function validateEnv() {
  const missing: string[] = []

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `\n❌ Environment variables wajib berikut belum didefinisikan:\n` +
        missing.map((v) => `   - ${v}`).join("\n") +
        `\n\nSilakan cek kembali file .env Anda\n`
    )
  }
}

export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue
  if (!value) {
    throw new Error(`Environment variable ${key} tidak ditemukan`)
  }
  return value
}

export function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key]
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}