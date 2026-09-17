// src/lib/cron-auth.ts

import { headers } from "next/headers"
import { timingSafeEqual } from "crypto"

/**
 * Deteksi apakah permintaan saat ini adalah panggilan cron yang sah
 * (membawa header "Authorization: Bearer <CRON_SECRET>").
 *
 * Dipakai sebagai lapisan otentikasi kedua di dalam server action yang
 * berfungsi ganda: dipanggil oleh UI (sesi pengguna) DAN oleh Route Handler
 * cron (CRON_SECRET). Tanpa header cron yang valid, action yang memakai
 * helper ini harus menolak/menurunkan scope ke pemanggil sesi.
 *
 * Pembandingan dengan timingSafeEqual agar isi/panjang secret tidak bisa
 * diukur pemain dari selisih waktu respons. Kegagalan apa pun (header
 * hilang, secret tidak terkonfigurasi, diluar scope request) → false.
 */
export async function isCronAuthorized(): Promise<boolean> {
  try {
    const headerStore = await headers()
    const authHeader = headerStore.get("authorization")
    const secret = process.env.CRON_SECRET
    const expected = `Bearer ${secret ?? ""}`

    if (!secret || !authHeader || authHeader.length !== expected.length) {
      return false
    }

    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  } catch {
    return false
  }
}