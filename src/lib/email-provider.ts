// src/lib/email-provider.ts
//
// Provider pengiriman email mentah (Resend). SENGAJA dipisah dari
// src/lib/email.ts agar:
//   - email.ts (template + API publik) bisa mengantrikan ke outbox,
//   - email-outbox.ts (worker) memanggil provider langsung,
// tanpa saling impor melingkar.
//
// Tidak ada logika bisnis di sini — hanya panggilan API + normalisasi error.

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
const replyTo = process.env.EMAIL_REPLY_TO || "admin@sekolahmu.sch.id"

export interface SendEmailParams {
  to: string
  subject: string
  html: string
}

export type HasilKirimEmail =
  | { success: true; id?: string }
  | { success: false; error: string }

/**
 * Kirim email lewat provider. Tidak pernah melempar error — kegagalan
 * dikembalikan sebagai `{ success: false, error }` agar pemanggil (worker
 * outbox) bisa menyimpan status/backoff.
 */
export async function sendEmailViaProvider({
  to,
  subject,
  html,
}: SendEmailParams): Promise<HasilKirimEmail> {
  if (!resend) {
    return { success: false, error: "RESEND_API_KEY belum dikonfigurasi" }
  }
  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      replyTo,
      subject,
      html,
    })

    if (error) {
      console.error("Email send error:", error)
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id }
  } catch (error: unknown) {
    console.error("Email send exception:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
