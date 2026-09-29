// src/actions/pendaftaran-draft.ts
//
// Server-side draft pendaftaran (lapisan 2 dari draft hybrid).
//
// Kontrak:
//   createPendaftaranDraft(payload, lastStep)  → draft baru + resume token
//   resumePendaftaranDraft(resumeToken)        → baca draft (token wajib)
//   savePendaftaranDraft(resumeToken, payload, lastStep) → update
//   deletePendaftaranDraft(resumeToken)        → hapus manual oleh pengguna
//   finalizeDraftSetelahSubmit(draftToken, nomorPendaftaran) → tandai final
//
// Keamanan:
//   - Resume token plaintext TIDAK pernah disimpan; hanya SHA-256-nya
//     (pola sama dengan tokenAksesHash di Pendaftaran).
//   - Draft hanya bisa dibaca/ubah/dihapus dengan token yang cocok — tidak ada
//     pencarian lewat email/nama/HP tanpa token.
//   - Payload difilter ke field yang diizinkan lalu divalidasi schema draft
//     (parsial tapi tetap memvalidasi format field terisi).
//   - Draft finalized TIDAK bisa diubah lagi (immutable).
//   - TTL 30 hari sejak update terakhir; pembersihan oleh cron harian.

"use server"

import prisma from "@/lib/prisma"
import { rateLimitAsync, getClientIpFromHeaders } from "@/lib/rate-limit"
import { hashTokenAkses, isPendaftaranTokenValid } from "@/lib/pendaftaran-token"
import {
  pendaftaranDraftSchema,
  DRAFT_FIELDS,
  DRAFT_STEP_MIN,
  DRAFT_STEP_MAX,
  DRAFT_MAX_PAYLOAD_BYTES,
} from "@/lib/validations/pendaftaran-draft"
import type { ActionResponse } from "@/types"
import { nanoid } from "nanoid"
import type { Prisma } from "@prisma/client"

// TTL draft: 30 hari sejak terakhir disimpan.
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000

// Rate limit per IP untuk semua operasi draft.
const RATE_DRAFT = { maxRequests: 60, windowMs: 10 * 60 * 1000 }

export type DraftPayload = Record<string, string>

function batasiStep(step: unknown): number {
  const n = typeof step === "number" ? Math.floor(step) : parseInt(String(step || ""), 10)
  if (Number.isNaN(n)) return DRAFT_STEP_MIN
  return Math.min(DRAFT_STEP_MAX, Math.max(DRAFT_STEP_MIN, n))
}

/** Filter payload ke field yang diizinkan + validasi schema draft parsial. */
function bersihkanPayload(
  raw: unknown
): { ok: true; data: DraftPayload } | { ok: false; message: string } {
  if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "Payload draft tidak valid" }
  }

  // Filter ke field yang dikenal; semua nilai dipaksa string.
  const masukan: Record<string, unknown> = {}
  const obj = raw as Record<string, unknown>
  for (const key of DRAFT_FIELDS) {
    const v = obj[key]
    if (v === undefined || v === null) continue
    if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") {
      return { ok: false, message: "Payload draft tidak valid" }
    }
    masukan[key] = String(v)
  }

  const parsed = pendaftaranDraftSchema.safeParse(masukan)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      message: `Data draft tidak valid${issue ? `: ${issue.message}` : ""}`,
    }
  }

  // Buang key bernilai undefined/null (hasil .optional()).
  const data: DraftPayload = {}
  for (const [k, v] of Object.entries(parsed.data)) {
    if (typeof v === "string" && v.length > 0) data[k] = v
  }
  return { ok: true, data }
}

/** Cek ukuran payload ter-serialisasi supaya tabel draft tidak bisa dipenuhi data besar. */
function ukuranPayload(payload: DraftPayload): number {
  return JSON.stringify(payload).length
}

function draftKedaluwarsa(expiresAt: Date): boolean {
  return expiresAt.getTime() <= Date.now()
}

export async function createPendaftaranDraft(
  payload: unknown,
  lastStep: number
): Promise<ActionResponse<{ resumeToken: string; expiresAt: string }>> {
  try {
    const ip = await getClientIpFromHeaders()
    const limiter = await rateLimitAsync(`draft-create:${ip}`, RATE_DRAFT)
    if (!limiter.success) {
      return {
        success: false,
        message: "Terlalu banyak permintaan draft. Silakan coba lagi nanti.",
      }
    }

    const bersih = bersihkanPayload(payload)
    if (!bersih.ok) return { success: false, message: bersih.message }

    if (ukuranPayload(bersih.data) > DRAFT_MAX_PAYLOAD_BYTES) {
      return { success: false, message: "Data draft terlalu besar" }
    }

    const resumeToken = nanoid(32)
    const expiresAt = new Date(Date.now() + DRAFT_TTL_MS)

    await prisma.pendaftaranDraft.create({
      data: {
        resumeTokenHash: hashTokenAkses(resumeToken),
        payload: bersih.data as Prisma.InputJsonValue,
        lastStep: batasiStep(lastStep),
        expiresAt,
      },
    })

    return {
      success: true,
      message: "Draft dibuat",
      data: { resumeToken, expiresAt: expiresAt.toISOString() },
    }
  } catch (error) {
    console.error("Error createPendaftaranDraft:", error)
    return { success: false, message: "Gagal membuat draft. Silakan coba lagi." }
  }
}

export async function resumePendaftaranDraft(
  resumeToken: string
): Promise<
  ActionResponse<{
    payload: DraftPayload
    lastStep: number
    updatedAt: string
    expiresAt: string
  }>
> {
  try {
    if (!resumeToken || typeof resumeToken !== "string") {
      return { success: false, message: "Resume token tidak valid" }
    }

    const ip = await getClientIpFromHeaders()
    const limiter = await rateLimitAsync(`draft-resume:${ip}`, RATE_DRAFT)
    if (!limiter.success) {
      return {
        success: false,
        message: "Terlalu banyak permintaan draft. Silakan coba lagi nanti.",
      }
    }

    const tokenHash = hashTokenAkses(resumeToken)
    const draft = await prisma.pendaftaranDraft.findUnique({
      where: { resumeTokenHash: tokenHash },
    })

    if (!draft) {
      return { success: false, message: "Draft tidak ditemukan" }
    }

    if (draftKedaluwarsa(draft.expiresAt)) {
      // Draft expired dianggap tidak ada (dan akan dibersihkan cron).
      return { success: false, message: "Draft sudah kedaluwarsa" }
    }

    if (draft.finalizedAt) {
      return { success: false, message: "Draft sudah difinalisasi" }
    }

    return {
      success: true,
      message: "Draft dimuat",
      data: {
        payload: (draft.payload ?? {}) as DraftPayload,
        lastStep: batasiStep(draft.lastStep),
        updatedAt: draft.updatedAt.toISOString(),
        expiresAt: draft.expiresAt.toISOString(),
      },
    }
  } catch (error) {
    console.error("Error resumePendaftaranDraft:", error)
    return { success: false, message: "Gagal memuat draft. Silakan coba lagi." }
  }
}

export async function savePendaftaranDraft(
  resumeToken: string,
  payload: unknown,
  lastStep: number
): Promise<ActionResponse<{ updatedAt: string }>> {
  try {
    if (!isPendaftaranTokenValid("__bentuk_only__", resumeToken) && resumeToken.length < 16) {
      // Bentuk token dicek murah di sini; kecocokan hash dicek via DB lookup.
      return { success: false, message: "Resume token tidak valid" }
    }

    const ip = await getClientIpFromHeaders()
    const limiter = await rateLimitAsync(`draft-save:${ip}`, RATE_DRAFT)
    if (!limiter.success) {
      return {
        success: false,
        message: "Terlalu banyak permintaan draft. Silakan coba lagi nanti.",
      }
    }

    const bersih = bersihkanPayload(payload)
    if (!bersih.ok) return { success: false, message: bersih.message }

    if (ukuranPayload(bersih.data) > DRAFT_MAX_PAYLOAD_BYTES) {
      return { success: false, message: "Data draft terlalu besar" }
    }

    const tokenHash = hashTokenAkses(resumeToken)
    const draft = await prisma.pendaftaranDraft.findUnique({
      where: { resumeTokenHash: tokenHash },
      select: { id: true, finalizedAt: true, expiresAt: true },
    })

    if (!draft) {
      return { success: false, message: "Draft tidak ditemukan" }
    }
    if (draft.finalizedAt) {
      return { success: false, message: "Draft sudah difinalisasi dan tidak bisa diubah" }
    }
    if (draftKedaluwarsa(draft.expiresAt)) {
      return { success: false, message: "Draft sudah kedaluwarsa" }
    }

    const hasil = await prisma.pendaftaranDraft.update({
      where: { id: draft.id },
      data: {
        payload: bersih.data as Prisma.InputJsonValue,
        lastStep: batasiStep(lastStep),
        // Perpanjang TTL setiap kali disimpan — draft aktif tidak mati di tengah jalan.
        expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
      },
    })

    return {
      success: true,
      message: "Draft tersimpan",
      data: { updatedAt: hasil.updatedAt.toISOString() },
    }
  } catch (error) {
    console.error("Error savePendaftaranDraft:", error)
    return { success: false, message: "Gagal menyimpan draft. Silakan coba lagi." }
  }
}

export async function deletePendaftaranDraft(
  resumeToken: string
): Promise<ActionResponse> {
  try {
    const ip = await getClientIpFromHeaders()
    const limiter = await rateLimitAsync(`draft-delete:${ip}`, RATE_DRAFT)
    if (!limiter.success) {
      return {
        success: false,
        message: "Terlalu banyak permintaan draft. Silakan coba lagi nanti.",
      }
    }

    const tokenHash = hashTokenAkses(resumeToken)
    const draft = await prisma.pendaftaranDraft.findUnique({
      where: { resumeTokenHash: tokenHash },
      select: { id: true },
    })

    if (!draft) {
      // Sudah tidak ada: dihapus sebelumnya atau token salah. Respon sama
      // supaya tidak bisa dipakai membedakan keduanya.
      return { success: true, message: "Draft tidak ada" }
    }

    await prisma.pendaftaranDraft.delete({ where: { id: draft.id } })
    return { success: true, message: "Draft dihapus" }
  } catch (error) {
    console.error("Error deletePendaftaranDraft:", error)
    return { success: false, message: "Gagal menghapus draft. Silakan coba lagi." }
  }
}

/**
 * Tandai draft sebagai finalized setelah pendaftaran berhasil dibuat.
 * Dipanggil dari createPendaftaran (di dalam transaksi finalisasi) sehingga
 * retry submit dengan draftToken yang sama tidak akan membuat pendaftaran
 * kedua — draft yang sudah finalized dikembalikan nomornya, bukan dibuat ulang.
 *
 * @returns true bila draft memang ada dan masih bisa difinalisasi.
 */
export async function finalizeDraftRow(
  tx: { pendaftaranDraft: Prisma.PendaftaranDraftDelegate },
  resumeToken: string | null | undefined,
  nomorPendaftaran: string
): Promise<boolean> {
  if (!resumeToken) return false
  const tokenHash = hashTokenAkses(resumeToken)

  try {
    // updateMany dengan kondisi = atomik: hanya draft yang belum finalized
    // yang akan ter-update; retry mengembalikan count 0 (sudah final).
    const hasil = await tx.pendaftaranDraft.updateMany({
      where: { resumeTokenHash: tokenHash, finalizedAt: null },
      data: {
        finalizedAt: new Date(),
        nomorPendaftaran,
      },
    })
    return hasil.count > 0
  } catch (error) {
    console.error("Error finalizeDraftRow:", error)
    return false
  }
}
