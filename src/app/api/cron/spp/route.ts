// src/app/api/cron/spp/route.ts
// Cron job bulanan: membuat tagihan SPP untuk periode berjalan.
// Dipanggil Vercel Cron (lihat vercel.json). Dilindungi dengan CRON_SECRET.

import { NextRequest, NextResponse } from "next/server"
import { generateTagihanSppInternal } from "@/actions/akuntansi"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization")
  const secret = process.env.CRON_SECRET
  const expected = `Bearer ${secret}`

  // Guard: hanya panggilan cron yang sah (memiliki CRON_SECRET) yang boleh
  // menjalankan pembuatan tagihan. Tanpa secret yang valid → 401.
  if (!secret || authHeader !== expected) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    )
  }

  // Default: periode bulan & tahun saat ini. Bisa dioverride via query param
  // ?bulan=1-12&tahun=YYYY (untuk backfill periode sebelumnya).
  const now = new Date()
  const queryBulan = request.nextUrl.searchParams.get("bulan")
  const queryTahun = request.nextUrl.searchParams.get("tahun")

  const bulan = queryBulan ? Number(queryBulan) : now.getMonth() + 1
  const tahun = queryTahun ? Number(queryTahun) : now.getFullYear()

  if (Number.isNaN(bulan) || bulan < 1 || bulan > 12) {
    return NextResponse.json(
      { success: false, message: "Parameter 'bulan' harus 1-12" },
      { status: 400 }
    )
  }

  const result = await generateTagihanSppInternal({ bulan, tahun })

  if (!result.success) {
    return NextResponse.json(result, { status: 422 })
  }

  return NextResponse.json(result)
}
