// src/app/api/auth/logout/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      return NextResponse.json(
        { success: false, message: "Gagal logout" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Logout berhasil",
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan saat logout" },
      { status: 500 }
    )
  }
}