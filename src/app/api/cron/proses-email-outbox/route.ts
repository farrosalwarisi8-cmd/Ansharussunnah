// src/app/api/cron/proses-email-outbox/route.ts
//
// Worker LEGACY untuk data outbox lama. Email BARU tidak lagi masuk outbox —
// semua email dikirim langsung melalui Resend (src/lib/email.ts →
// src/lib/email-provider.ts), sehingga route ini BUKAN dependency email baru
// dan jadwal cron-nya sudah dihapus dari vercel.json.
//
// Route ini dipertahankan agar baris lama berstatus PENDING/FAILED masih bisa
// diproses/di-retry secara manual oleh admin (dipanggil eksplisit dengan
// Bearer CRON_SECRET), tanpa menghapus tabel, migration, atau histori email.
// Dilindungi CRON_SECRET dengan pembandingan konstan-waktu — tanpa ini siapa
// pun bisa memicu pengiriman.
//
// Aman dipanggil berulang/paralel: setiap baris diklaim secara atomik
// (updateMany bersyarat) sebelum dikirim, jadi tidak ada double-send.
// Klaim memakai lease (nextRetryAt = sekarang + LEASE_MS) dan panggilan
// provider dibatasi waktu (EMAIL_PROVIDER_TIMEOUT_MS << LEASE_MS), sehingga
// provider yang hang tidak membuat worker kedua mengklaim baris yang sama.

import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { prosesEmailOutbox } from "@/lib/email-outbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization")
  const secret = process.env.CRON_SECRET
  const expected = `Bearer ${secret ?? ""}`

  const safeToRun =
    !!secret &&
    authHeader !== null &&
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))

  if (!safeToRun) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    )
  }

  try {
    const hasil = await prosesEmailOutbox({ limit: 50 })
    return NextResponse.json({
      success: true,
      message: "Pemrosesan outbox email selesai",
      ...hasil,
    })
  } catch (error: unknown) {
    console.error("Error cron proses-email-outbox:", error)
    return NextResponse.json(
      { success: false, message: "Gagal memproses outbox email" },
      { status: 500 },
    )
  }
}
