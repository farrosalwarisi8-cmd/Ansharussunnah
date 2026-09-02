// src/app/api/pilih-role/route.ts

import { NextResponse, type NextRequest } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import prisma from "@/lib/prisma"

const ROLE_COOKIE = "selected_role"
const USER_ID_COOKIE = "selected_user_id"

/**
 * GET /api/pilih-role — Return all roles for the current auth user
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ roles: [] })
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll() {},
    },
  })

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ roles: [] }, { status: 401 })
  }

  // Find all user records with this authId
  const users = await prisma.user.findMany({
    where: { authId: authUser.id },
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      isAdmin: true,
    },
  })

  return NextResponse.json({ roles: users })
}

/**
 * POST /api/pilih-role — Set the selected role in cookie
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { userId, role } = body

  if (!userId || !role) {
    return NextResponse.json({ success: false, message: "Data tidak lengkap" }, { status: 400 })
  }

  // Verify this user record exists and belongs to the current auth user
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ success: false, message: "Konfigurasi tidak valid" }, { status: 500 })
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll() {},
    },
  })

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  // Verify the user record belongs to this auth user
  const userRecord = await prisma.user.findFirst({
    where: {
      id: userId,
      authId: authUser.id,
      role: role,
    },
  })

  if (!userRecord) {
    return NextResponse.json({ success: false, message: "Role tidak valid" }, { status: 403 })
  }

  // Set cookies using response headers
  const response = NextResponse.json({ success: true, message: "Role berhasil dipilih" })

  response.cookies.set(ROLE_COOKIE, role, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  response.cookies.set(USER_ID_COOKIE, userId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  return response
}
