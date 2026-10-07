// src/lib/email-provider.ts
//
// Provider pengiriman email mentah (Resend). SENGAJA dipisah dari
// src/lib/email.ts agar:
//   - email.ts (template + API publik) memanggil provider ini secara LANGSUNG
//     dari alur aplikasi (kirim langsung, tanpa antrean),
//   - email-outbox.ts (worker LEGACY untuk memproses data outbox lama) memakai
//     provider yang sama,
// tanpa saling impor melingkar.
//
// Tidak ada logika bisnis di sini — hanya panggilan API + normalisasi error.
// TIDAK ada retry internal: percobaan ulang sepenuhnya di tangan pemanggil
// (admin/worker), agar email ganda tidak terjadi tanpa kontrol.

import { Resend } from "resend"

function createResend() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  try {
    return new Resend(apiKey)
  } catch {
    return null
  }
}

const resend = createResend()
const fromEmail =
  process.env.EMAIL_FROM || "Sistem Pendaftaran <onboarding@resend.dev>"
const replyTo = process.env.EMAIL_REPLY_TO?.trim() || "admin@sekolahmu.sch.id"

export interface SendEmailParams {
  to: string
  subject: string
  html: string
}

export type HasilKirimEmail =
  | { success: true; id?: string }
  | { success: false; error: string }

/**
 * Batas waktu panggilan provider (ms). Dibatasi agar proses aplikasi tidak
 * pernah menggantung menunggu provider (serverless action punya batas waktu
 * eksekusi). Kegagalan/timeout dikembalikan sebagai `success: false`.
 */
export const EMAIL_PROVIDER_TIMEOUT_MS = 30_000

/**
 * Bersihkan pesan error provider SEBELUM pesan itu dikembalikan ke pemanggil
 * atau dicetak ke log: buang API key Resend (`re_…`), bearer token, serta
 * nilai di sebelah kata kunci sensitif (password/token/secret/apikey), lalu
 * batasi panjangnya. Mencegah rahasia bocor ke response/UI admin.
 */
export function sanitasiErrorProvider(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : String(error ?? "Kesalahan tidak diketahui")
  return raw
    .replace(/\bre_[A-Za-z0-9_-]{8,}/g, "[REDACTED]")
    .replace(/(bearer\s+)[A-Za-z0-9._-]+/gi, "$1[REDACTED]")
    .replace(
      /((?:password|passwd|token|otp|secret|apikey|api[_-]?key)\s*[:=]\s*)(\S+)/gi,
      "$1[REDACTED]",
    )
    .slice(0, 500)
}

/** Race sebuah promise melawan timer; selalu resolve/reject dalam `ms`. */
async function denganTimeout<T>(janji: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} melebihi batas waktu ${Math.round(ms / 1000)} detik`)),
      ms
    )
  })
  try {
    return await Promise.race([janji, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Kirim email lewat provider (Resend) SECARA LANGSUNG. Tidak pernah melempar
 * error — kegagalan dikembalikan sebagai `{ success: false, error }` berisi
 * pesan aman yang bisa ditindaklanjuti admin (tanpa rahasia).
 */
export async function sendEmailViaProvider({
  to,
  subject,
  html,
}: SendEmailParams): Promise<HasilKirimEmail> {
  if (!resend) {
    return {
      success: false,
      error:
        "Konfigurasi email belum lengkap: RESEND_API_KEY belum di-set pada environment variable.",
    }
  }
  try {
    const { data, error } = await denganTimeout(
      resend.emails.send({
        from: fromEmail,
        to: [to],
        replyTo,
        subject,
        html,
      }),
      EMAIL_PROVIDER_TIMEOUT_MS,
      "Panggilan provider email"
    )

    if (error) {
      const aman = sanitasiErrorProvider(error.message || error)
      console.error("Email provider error:", aman)
      return { success: false, error: aman }
    }

    return { success: true, id: data?.id }
  } catch (error: unknown) {
    const aman = sanitasiErrorProvider(error)
    console.error("Email provider exception:", aman)
    return { success: false, error: aman }
  }
}
