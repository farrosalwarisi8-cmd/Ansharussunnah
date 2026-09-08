// src/app/api/auth/logout/route.ts
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      return NextResponse.json(
        { success: false, message: "Gagal logout" },
        { status: 400 }
      )
    }

    const response = NextResponse.json({
      success: true,
      message: "Logout berhasil",
    })

    // Hapus cookie role terpilih agar tidak tersisa saat login berikutnya
    response.cookies.set("selected_role", "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    })
    response.cookies.set("selected_user_id", "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    })

    return response
  } catch {
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan saat logout" },
      { status: 500 }
    )
  }
}