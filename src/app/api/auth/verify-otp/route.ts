// src/app/api/auth/verify-otp/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { verifyResetOtp } from "@/actions/password-reset"
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const limiter = await rateLimitAsync(`api-verify-otp:${ip}`, {
      maxRequests: 5,
      windowMs: 60 * 1000,
    })

    if (!limiter.success) {
      return NextResponse.json(
        { success: false, message: "Terlalu banyak percobaan. Coba lagi dalam 1 menit." },
        { status: 429 }
      )
    }

    const { email, otp } = await request.json()

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, message: "Email dan OTP wajib diisi" },
        { status: 400 }
      )
    }

    const result = await verifyResetOtp(email, otp)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch {
    return NextResponse.json(
      { success: false, message: "Format request tidak valid" },
      { status: 400 }
    )
  }
}