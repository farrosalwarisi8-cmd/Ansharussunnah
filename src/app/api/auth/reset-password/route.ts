// src/app/api/auth/reset-password/route.ts

import { NextRequest, NextResponse } from "next/server"
import { resetPassword } from "@/actions/password-reset"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 percobaan per 5 menit per IP
    const ip = getClientIp(request)
    const limiter = rateLimit(`reset-password:${ip}`, {
      maxRequests: 3,
      windowMs: 5 * 60 * 1000,
    })

    if (!limiter.success) {
      return NextResponse.json(
        { success: false, message: "Terlalu banyak permintaan. Coba lagi nanti." },
        { status: 429 }
      )
    }

    const { email, resetToken, newPassword, confirmPassword } = await request.json()

    if (!email || !resetToken || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Semua field wajib diisi" },
        { status: 400 }
      )
    }

    const result = await resetPassword(email, resetToken, newPassword, confirmPassword)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch {
    return NextResponse.json(
      { success: false, message: "Format request tidak valid" },
      { status: 400 }
    )
  }
}