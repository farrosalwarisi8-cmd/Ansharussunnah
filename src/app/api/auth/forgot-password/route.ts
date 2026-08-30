// src/app/api/auth/forgot-password/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requestPasswordReset } from "@/actions/password-reset"
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const limiter = await rateLimitAsync(`api-forgot-password:${ip}`, {
      maxRequests: 3,
      windowMs: 5 * 60 * 1000,
    })

    if (!limiter.success) {
      return NextResponse.json(
        { success: false, message: "Batas limit tercapai. Silakan coba kembali dalam 5 menit." },
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