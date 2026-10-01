// src/lib/email-outbox.ts
//
// Sistem outbox email: email penting disimpan ke DB lebih dulu, lalu dikirim
// oleh worker (cron /api/cron/proses-email-outbox) dengan retry berjenjang.
//
// Mengapa: sebelumnya email dikirim fire-and-forget. Di serverless, instance
// bisa dimatikan begitu response terkirim → email hilang tanpa jejak, dan
// kegagalan provider tidak bisa dilihat/di-retry. Outbox membuat email tahan
// banting, teraudit, dan bisa dikirim ulang admin.
//
// Jaminan:
//   - enqueueEmail tidak pernah melempar — event bisnis tidak boleh gagal
//     hanya karena email.
//   - idempotencyKey unik mencegah email ganda untuk event yang sama.
//   - Klaim atomik (updateMany bersyarat) mencegah dua worker mengirim baris
//     yang sama (double-send).
//   - Retry dengan backoff; setelah MAX_EMAIL_ATTEMPTS → FAILED (terlihat
//     admin, bisa di-retry manual).
//   - Error provider disanitasi sebelum disimpan/di-log (tidak ada rahasia).

import prisma from "@/lib/prisma"
import { sendEmailViaProvider } from "@/lib/email-provider"
import { Prisma, StatusEmailOutbox } from "@prisma/client"

/** Percobaan maksimum sebelum email dinyatakan FAILED. */
export const MAX_EMAIL_ATTEMPTS = 5

/** Lama "sewa" baris saat diproses, agar worker paralel tidak double-send. */
const LEASE_MS = 2 * 60 * 1000

/** Backoff (menit) sebelum percobaan berikutnya, per nomor percobaan. */
const BACKOFF_MENIT = [1, 5, 15, 60, 360] as const

/** Hitung kapan percobaan ke-`attempts` berikutnya boleh dijalankan. */
export function hitungBackoff(attempts: number, sekarang: Date = new Date()): Date {
  const idx = Math.min(Math.max(attempts - 1, 0), BACKOFF_MENIT.length - 1)
  return new Date(sekarang.getTime() + BACKOFF_MENIT[idx] * 60 * 1000)
}

/**
 * Bersihkan pesan error sebelum disimpan/di-log: buang token/bearer, samarkan
 * nilai di sebelah kata kunci sensitif, dan batasi panjangnya.
 */
export function sanitasiErrorEmail(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : String(error ?? "Kesalahan tidak diketahui")
  return raw
    .replace(/(bearer\s+)[A-Za-z0-9._-]+/gi, "$1[REDACTED]")
    .replace(/((?:password|passwd|token|otp|secret|apikey|api_key)\s*[:=]\s*)(\S+)/gi, "$1[REDACTED]")
    .slice(0, 500)
}

export type JenisEmail =
  | "pendaftaran_berhasil"
  | "pendaftaran_ditolak"
  | "kredensial_akun"
  | "role_baru"
  | "tagihan_spp"
  | "reset_password"
  | "umum"

export interface EnqueueEmailParams {
  jenisEmail: JenisEmail | string
  recipient: string
  subject: string
  html: string
  /** Kunci idempotency; isi agar retry event yang sama tidak membuat email ganda. */
  idempotencyKey?: string
  /** Metadata kecil non-sensitif (JANGAN taruh password/token di sini). */
  meta?: Record<string, string | number | boolean | null>
}

export interface HasilEnqueue {
  ok: boolean
  /** true bila baris dengan idempotencyKey sama sudah ada (bukan error). */
  duplicate: boolean
  id?: string
}

/**
 * Simpan email ke outbox untuk dikirim worker. TIDAK PERNAH melempar.
 */
export async function enqueueEmail(params: EnqueueEmailParams): Promise<HasilEnqueue> {
  const { jenisEmail, recipient, subject, html, idempotencyKey, meta } = params
  try {
    const row = await prisma.emailOutbox.create({
      data: {
        jenisEmail: String(jenisEmail),
        recipient,
        subject,
        payload: { html, meta: meta ?? {} } as Prisma.InputJsonValue,
        status: StatusEmailOutbox.PENDING,
        nextRetryAt: new Date(),
        idempotencyKey: idempotencyKey ?? null,
      },
      select: { id: true },
    })
    return { ok: true, duplicate: false, id: row.id }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Event yang sama sudah punya email di outbox → jangan duplikat.
      return { ok: true, duplicate: true }
    }
    console.error("[email-outbox] gagal enqueue:", sanitasiErrorEmail(error))
    return { ok: false, duplicate: false }
  }
}

export interface HasilProses {
  diambil: number
  terkirim: number
  gagalSementara: number
  gagalPermanen: number
}

type OutboxRow = {
  id: string
  recipient: string
  subject: string
  payload: Prisma.JsonValue
  attempts: number
}

/**
 * Proses satu baris: klaim atomik dulu, kirim, lalu tandai hasilnya.
 * `dilewati` = baris sudah diambil worker lain / sudah bukan PENDING.
 */
async function prosesBaris(
  row: OutboxRow
): Promise<"terkirim" | "gagal_sementara" | "gagal_permanen" | "dilewati"> {
  const klaim = await prisma.emailOutbox.updateMany({
    where: {
      id: row.id,
      status: StatusEmailOutbox.PENDING,
      // Hanya klaim bila sudah jatuh tempo (mencegah rebutan saat lease).
      nextRetryAt: { lte: new Date() },
    },
    data: {
      attempts: { increment: 1 },
      nextRetryAt: new Date(Date.now() + LEASE_MS),
    },
  })
  if (klaim.count === 0) return "dilewati"

  const percobaan = row.attempts + 1
  const payload = row.payload as { html?: unknown } | null
  const html = typeof payload?.html === "string" ? payload.html : ""

  const hasil = await sendEmailViaProvider({
    to: row.recipient,
    subject: row.subject,
    html,
  })

  if (hasil.success) {
    await prisma.emailOutbox.update({
      where: { id: row.id },
      data: {
        status: StatusEmailOutbox.SENT,
        sentAt: new Date(),
        lastError: null,
        nextRetryAt: null,
      },
    })
    return "terkirim"
  }

  const habis = percobaan >= MAX_EMAIL_ATTEMPTS
  await prisma.emailOutbox.update({
    where: { id: row.id },
    data: {
      status: habis ? StatusEmailOutbox.FAILED : StatusEmailOutbox.PENDING,
      lastError: sanitasiErrorEmail(hasil.error),
      nextRetryAt: habis ? null : hitungBackoff(percobaan),
    },
  })
  return habis ? "gagal_permanen" : "gagal_sementara"
}

/**
 * Worker: ambil baris PENDING yang jatuh tempo dan kirim. Aman dipanggil
 * berulang/paralel (klaim atomik per baris).
 */
export async function prosesEmailOutbox(opts?: { limit?: number }): Promise<HasilProses> {
  const limit = Math.min(Math.max(opts?.limit ?? 25, 1), 100)
  const rows = await prisma.emailOutbox.findMany({
    where: {
      status: StatusEmailOutbox.PENDING,
      nextRetryAt: { lte: new Date() },
    },
    orderBy: { nextRetryAt: "asc" },
    take: limit,
    select: {
      id: true,
      recipient: true,
      subject: true,
      payload: true,
      attempts: true,
    },
  })

  const hasil: HasilProses = {
    diambil: rows.length,
    terkirim: 0,
    gagalSementara: 0,
    gagalPermanen: 0,
  }

  for (const row of rows) {
    const status = await prosesBaris(row)
    if (status === "terkirim") hasil.terkirim++
    else if (status === "gagal_sementara") hasil.gagalSementara++
    else if (status === "gagal_permanen") hasil.gagalPermanen++
  }

  return hasil
}

/**
 * Retry manual oleh admin: reset baris (attempts 0) lalu coba kirim SEKARANG.
 * Mengembalikan pesan ramah untuk UI.
 */
export async function retryEmailOutboxManual(id: string): Promise<{
  success: boolean
  message: string
}> {
  const row = await prisma.emailOutbox.findUnique({
    where: { id },
    select: { id: true, status: true },
  })
  if (!row) {
    return { success: false, message: "Email tidak ditemukan" }
  }
  if (row.status === StatusEmailOutbox.SENT) {
    return { success: false, message: "Email ini sudah terkirim" }
  }

  // Reset agar worker langsung memprosesnya (attempts dimulai dari 0).
  await prisma.emailOutbox.update({
    where: { id },
    data: {
      status: StatusEmailOutbox.PENDING,
      attempts: 0,
      lastError: null,
      nextRetryAt: new Date(),
    },
  })

  const hasil = await prosesEmailOutbox({ limit: 1 })
  if (hasil.terkirim > 0) {
    return { success: true, message: "Email berhasil dikirim ulang" }
  }
  return {
    success: false,
    message:
      "Email diantrikan, tetapi pengiriman ulang gagal. Periksa pesan error dan coba lagi nanti.",
  }
}
