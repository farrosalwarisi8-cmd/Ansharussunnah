// src/app/api/auth/change-password/route.ts

import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest } from "@/lib/api-auth"
import { changePassword } from "@/actions/change-password"

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (!auth.authenticated) return auth.errorResponse!

    const { currentPassword, newPassword, confirmPassword } = await request.json()

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Semua data wajib dilengkapi" },
        { status: 400 }
      )
    }

    const result = await changePassword(currentPassword, newPassword, confirmPassword)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch {
    return NextResponse.json(
      { success: false, message: "Format request tidak valid" },
      { status: 400 }
    )
  }
}