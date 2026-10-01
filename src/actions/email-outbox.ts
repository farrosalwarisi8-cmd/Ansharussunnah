// src/actions/email-outbox.ts
//
// Server actions admin untuk memantau & mengirim ulang email di outbox.
//
// KEAMANAN:
// - Hanya admin (SUPER_ADMIN / ADMIN_AKADEMIK / ADMIN_KEUANGAN) yang boleh.
// - `payload` (HTML email, bisa memuat password akun baru) TIDAK PERNAH
//   dikembalikan ke klien — hanya metadata yang ditampilkan.

"use server"

import prisma from "@/lib/prisma"
import { requireRole } from "@/lib/auth"
import { AppError, toUserFriendlyError } from "@/lib/prisma-error"
import { retryEmailOutboxManual } from "@/lib/email-outbox"
import type { ActionResponse } from "@/types"
import { Role, StatusEmailOutbox } from "@prisma/client"
import { revalidatePath } from "next/cache"

const PAGE_SIZE_DEFAULT = 25
const PAGE_SIZE_MAX = 100

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.ADMIN_AKADEMIK, Role.ADMIN_KEUANGAN]

export interface EmailOutboxItem {
  id: string
  jenisEmail: string
  recipient: string
  subject: string
  status: StatusEmailOutbox
  attempts: number
  lastError: string | null
  nextRetryAt: Date | null
  sentAt: Date | null
  createdAt: Date
}

export interface DaftarEmailOutbox {
  items: EmailOutboxItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  ringkasan: {
    pending: number
    sent: number
    failed: number
  }
}

function normalisasiStatus(status?: string): StatusEmailOutbox | undefined {
  if (!status || status === "SEMUA") return undefined
  if (status === "PENDING" || status === "SENT" || status === "FAILED") {
    return status
  }
  return undefined
}

/**
 * Daftar email outbox untuk admin — berpaginasi di server, hanya kolom
 * metadata (tanpa payload).
 */
export async function getDaftarEmailOutbox(options?: {
  status?: string
  page?: number
  pageSize?: number
}): Promise<ActionResponse<DaftarEmailOutbox>> {
  try {
    await requireRole(ADMIN_ROLES)

    const page = Math.max(1, Math.floor(options?.page ?? 1))
    const pageSize = Math.min(
      PAGE_SIZE_MAX,
      Math.max(1, Math.floor(options?.pageSize ?? PAGE_SIZE_DEFAULT)),
    )
    const skip = (page - 1) * pageSize
    const status = normalisasiStatus(options?.status)

    const where = status ? { status } : {}

    const [items, total, perStatus] = await Promise.all([
      prisma.emailOutbox.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        // select eksplisit: JANGAN ambil `payload`.
        select: {
          id: true,
          jenisEmail: true,
          recipient: true,
          subject: true,
          status: true,
          attempts: true,
          lastError: true,
          nextRetryAt: true,
          sentAt: true,
          createdAt: true,
        },
      }),
      prisma.emailOutbox.count({ where }),
      prisma.emailOutbox.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ])

    const jumlahStatus = (s: StatusEmailOutbox): number =>
      perStatus.find((r) => r.status === s)?._count._all ?? 0

    return {
      success: true,
      message: "Daftar email outbox berhasil dimuat",
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        ringkasan: {
          pending: jumlahStatus(StatusEmailOutbox.PENDING),
          sent: jumlahStatus(StatusEmailOutbox.SENT),
          failed: jumlahStatus(StatusEmailOutbox.FAILED),
        },
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memuat daftar email outbox"),
    }
  }
}

/**
 * Kirim ulang satu email (reset attempts lalu coba kirim sekarang).
 */
export async function retryEmailOutbox(id: string): Promise<ActionResponse> {
  try {
    await requireRole(ADMIN_ROLES)

    if (!id || typeof id !== "string") {
      throw new AppError("ID email tidak valid")
    }

    const hasil = await retryEmailOutboxManual(id)
    if (!hasil.success) {
      return { success: false, message: hasil.message }
    }

    revalidatePath("/dashboard/email-outbox")
    return { success: true, message: hasil.message }
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal mengirim ulang email"),
    }
  }
}
