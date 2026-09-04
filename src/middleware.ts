// src/middleware.ts

import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Route yang boleh diakses tanpa login
const PUBLIC_ROUTES = [
  "/",
  "/pendaftaran",
  "/pendaftaran/sukses",
  "/cek-pendaftaran",
  "/login",
  "/lupa-password",
  "/api/cek-pendaftaran",
  "/api/jenjang-kelas",
  "/api/pendaftaran",
  "/api/auth/login",
  "/api/pilih-role",
  "/pilih-role",
]



// Route yang TIDAK boleh diakses jika sudah login (redirect ke dashboard)
const GUEST_ONLY_ROUTES = ["/login", "/lupa-password"]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  )
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const { pathname } = request.nextUrl

  // Abaikan static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return supabaseResponse
  }

  // If Supabase env vars are not configured, skip auth check entirely
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "[middleware] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Auth middleware is disabled."
    )
    return supabaseResponse
  }

  // Short-circuit: untuk route publik, kita TIDAK perlu menyentuh Supabase.
  // Ini menghilangkan 1 round-trip jaringan tiap navigasi ke halaman publik.
  if (isPublicRoute(pathname)) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Forward hasil verifikasi middleware ke Server Components via request header.
  // Nilai SELALU ditimpa oleh middleware (diambil dari getUser() yang trusted),
  // jadi client tidak bisa memalsukannya. Dipakai getCurrentUser untuk melewati
  // panggilan getUser() yang redundan di server render.
  const AUTH_USER_ID_HEADER = "x-opencode-auth-user-id"
  if (user) {
    request.headers.set(AUTH_USER_ID_HEADER, user.id)
    supabaseResponse.headers.set(AUTH_USER_ID_HEADER, user.id)
  } else {
    request.headers.delete(AUTH_USER_ID_HEADER)
    supabaseResponse.headers.delete(AUTH_USER_ID_HEADER)
  }

  // Jika TIDAK login dan mencoba akses protected route
  if (!user && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirectedFrom", pathname)
    return NextResponse.redirect(url)
  }

  // Jika SUDAH login dan mencoba akses halaman login/lupa-password
  if (user && GUEST_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}