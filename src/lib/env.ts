// src/lib/env.ts

/**
 * Validasi environment variables saat startup.
 * Import file ini di layout.tsx atau instrumentation.ts
 * agar aplikasi gagal start jika ada env yang kosong.
 */

const requiredEnvVars = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "NEXT_PUBLIC_APP_URL",
] as const

const optionalEnvVars = [
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
  "OTP_EXPIRY_MINUTES",
  "OTP_MAX_ATTEMPTS",
  "OTP_RESEND_COOLDOWN_SECONDS",
  "RATE_LIMIT_CEK_PENDAFTARAN",
  "NEXT_PUBLIC_BANK_NAME",
  "NEXT_PUBLIC_BANK_ACCOUNT_NUMBER",
  "NEXT_PUBLIC_BANK_ACCOUNT_NAME",
  "NEXT_PUBLIC_REGISTRATION_FEE",
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
      `\n❌ Environment variables yang wajib berikut belum diset:\n` +
        missing.map((v) => `   - ${v}`).join("\n") +
        `\n\nSilakan tambahkan ke file .env\n`
    )
  }

  console.log("✅ Semua environment variables wajib sudah diset")
}

// Helper untuk mendapatkan env dengan default value
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