// src/app/api/cron/proses-email-outbox/route.ts
//
// Worker outbox email: mengirim email PENDING yang sudah jatuh tempo retry.
// Dipanggil Vercel Cron (lihat vercel.json) dan dilindungi CRON_SECRET dengan
// pembandingan konstan-waktu — tanpa ini siapa pun bisa memicu pengiriman.
//
// Aman dipanggil berulang/paralel: setiap baris diklaim secara atomik
// (updateMany bersyarat) sebelum dikirim, jadi tidak ada double-send.

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
