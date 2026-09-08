// src/app/api/cron/tutup-ujian/route.ts
// Cron job: menutup otomatis sesi pengerjaan ujian yang sudah melewati
// deadline masing-masing (siswa menutup tab / tidak submit tepat waktu).
// Dipanggil Vercel Cron (lihat vercel.json). Dilindungi dengan CRON_SECRET.

import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { tutupPengerjaanUjianKedaluwarsa } from "@/actions/ujian"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization")
  const secret = process.env.CRON_SECRET
  const expected = `Bearer ${secret ?? ""}`

  // Guard: hanya panggilan cron yang sah (memiliki CRON_SECRET) yang boleh
  // menjalankan penutupan sesi. Tanpa secret yang valid → 401.
  // Pembandingan konstan-waktu (timingSafeEqual) agar pemain yang mengirim
  // tebakan tidak bisa mengukur panjang/isi secret dari waktu respons.
  const safeToRun =
    !!secret &&
    authHeader !== null &&
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))

  if (!safeToRun) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    )
  }

  // Tanpa ujianId → proses semua ujian (mode cron).
  const result = await tutupPengerjaanUjianKedaluwarsa()

  if (!result.success) {
    return NextResponse.json(result, { status: 422 })
  }

  return NextResponse.json(result)
}