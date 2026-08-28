// src/app/api/auth/forgot-password/route.ts

import { NextRequest, NextResponse } from "next/server"
import { requestPasswordReset } from "@/actions/password-reset"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 request per 5 menit per IP
    const ip = getClientIp(request)
    const limiter = rateLimit(`forgot-password:${ip}`, {
      maxRequests: 3,
      windowMs: 5 * 60 * 1000,
    })

    if (!limiter.success) {
      return NextResponse.json(
        { success: false, message: "Terlalu banyak permintaan. Coba lagi nanti." },
        { status: 429 }
      )
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email wajib diisi" },
        { status: 400 }
      )
    }

    const result = await requestPasswordReset(email)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch {
    return NextResponse.json(
      { success: false, message: "Format request tidak valid" },
      { status: 400 }
    )
  }
}