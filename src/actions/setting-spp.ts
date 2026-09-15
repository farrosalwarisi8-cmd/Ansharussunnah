// src/actions/setting-spp.ts

"use server"

import prisma from "@/lib/prisma"
import { requireRole } from "@/lib/auth"
import {
  updateTarifSppJenjangSchema,
  type UpdateTarifSppJenjangValues,
} from "@/lib/validations/akuntansi"
import type { ActionResponse } from "@/types"
import { Role, Prisma } from "@prisma/client"
import { toUserFriendlyError } from "@/lib/prisma-error"
import { revalidatePath } from "next/cache"

// ========================================================
// HELPER OTORISASI
// ========================================================

async function requireAdminKeuangan() {
  // SUPER_ADMIN punya akses penuh ke seluruh modul, termasuk keuangan.
  return requireRole([Role.ADMIN_KEUANGAN, Role.SUPER_ADMIN])
}

// ========================================================
// TARIF SPP PER JENJANG
// ========================================================

/**
 * Daftar jenjang beserta tarif SPP bulanannya — khusus admin keuangan.
 * Dipakai untuk panel "Set Tarif SPP per Jenjang" di tab Generate SPP.
 */
export async function getTarifSppPerJenjang(): Promise<
  ActionResponse<Array<{ id: string; nama: string; tarifSppBulanan: number | null }>>
> {
  try {
    await requireAdminKeuangan()

    const jenjangList = await prisma.jenjang.findMany({
      orderBy: [{ urutan: "asc" }],
      select: {
        id: true,
        nama: true,
        tarifSppBulanan: true,
      },
    })

    return {
      success: true,
      message: "Tarif SPP per jenjang berhasil dimuat",
      data: jenjangList.map((o) => ({
        id: o.id,
        nama: o.nama,
        tarifSppBulanan: o.tarifSppBulanan ? Number(o.tarifSppBulanan) : null,
      })),
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memuat tarif SPP per jenjang"),
    }
  }
}

/**
 * Update tarif SPP bulanan untuk sebuah jenjang.
 * Nilai 0 akan menghapus tarif (kosong) sehingga fallback ke nominalDefault.
 */
export async function updateTarifSppJenjang(
  payload: UpdateTarifSppJenjangValues
): Promise<ActionResponse<{ jenjangId: string; tarifSppBulanan: number | null }>> {
  try {
    await requireAdminKeuangan()

    const validated = updateTarifSppJenjangSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data tarif tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { jenjangId, tarifSppBulanan } = validated.data

    const jenjang = await prisma.jenjang.findUnique({
      where: { id: jenjangId },
      select: { id: true, nama: true },
    })
    if (!jenjang) {
      return { success: false, message: "Jenjang tidak ditemukan" }
    }

    const tarifBaru = tarifSppBulanan > 0 ? new Prisma.Decimal(tarifSppBulanan) : null

    await prisma.jenjang.update({
      where: { id: jenjangId },
      data: { tarifSppBulanan: tarifBaru },
    })

    revalidatePath("/dashboard/keuangan")
    return {
      success: true,
      message:
        tarifBaru !== null
          ? `Tarif SPP jenjang "${jenjang.nama}" diset ke Rp ${tarifSppBulanan.toLocaleString("id-ID")}`
          : `Tarif SPP jenjang "${jenjang.nama}" dihapus (fallback ke tarif default)`,
      data: {
        jenjangId,
        tarifSppBulanan: tarifBaru !== null ? Number(tarifBaru) : null,
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memperbarui tarif SPP jenjang"),
    }
  }
}