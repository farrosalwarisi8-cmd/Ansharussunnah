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
  "/api/pilih-role",
  "/pilih-role",
]

// Route yang TIDAK boleh diakses jika sudah login (redirect ke dashboard).
// Sub-halaman /lupa-password/verifikasi & /lupa-password/reset dikecualikan
// agar user yang baru saja reset password tidak ter-bounce ke dashboard.
const GUEST_ONLY_ROUTES = ["/login", "/lupa-password"]
const EXCLUDE_FROM_GUEST_CHECK = ["/lupa-password/verifikasi", "/lupa-password/reset"]

// Header yang dipakai meng-forward hasil verifikasi middleware ke Server
// Components. Hanya boleh berisi user.id hasil agregasi getUser() yang trusted.
// Karena nilai ini dipakai getCurrentUser untuk melewati panggilan getUser(),
// header WAJIB dihapus di SEMUA cabang yang TIDAK menimpa nilainya (route
// publik / static / env tidak terkonfigurasi) agar tidak bisa dipalsukan klien.
const AUTH_USER_ID_HEADER = "x-opencode-auth-user-id"

function clearAuthUserHeader(
  request: NextRequest,
  response: NextResponse
): void {
  request.headers.delete(AUTH_USER_ID_HEADER)
  response.headers.delete(AUTH_USER_ID_HEADER)
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  )
}

function isGuestOnlyRoute(pathname: string): boolean {
  if (EXCLUDE_FROM_GUEST_CHECK.some((p) => pathname.startsWith(p))) return false
  return GUEST_ONLY_ROUTES.some((route) => pathname.startsWith(route))
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const { pathname } = request.nextUrl

  // Abaikan static files. (Ekstensi/aset statis sudah dikecualikan oleh
  // matcher; cek prefix ini sebagai lapisan kedua. Pemilahan via
  // "pathname.includes('.')" sengaja TIDAK dipakai karena bisa dipakai untuk
  // menciptakan path berbentuk `/foo.bar/...` yang lolos cek autentikasi.)
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    clearAuthUserHeader(request, supabaseResponse)
    return supabaseResponse
  }

  // If Supabase env vars are not configured, skip auth check entirely.
  // Header auth tetap dihapus agar nilai yang dikirim klien tidak sampai ke
  // Server Component sebagai identitas yang dipercaya.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "[middleware] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Auth middleware is disabled."
    )
    clearAuthUserHeader(request, supabaseResponse)
    return supabaseResponse
  }

  // Short-circuit: untuk route publik, kita TIDAK perlu menyentuh Supabase.
  // Ini menghilangkan 1 round-trip jaringan tiap navigasi ke halaman publik.
  // Header auth dihapus (bukan dibiarkan) agar nilai rampasan dari klien tidak
  // diteruskan sebagai identitas pengguna yang sudah terverifikasi.
  if (isPublicRoute(pathname)) {
    clearAuthUserHeader(request, supabaseResponse)
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
  if (user) {
    request.headers.set(AUTH_USER_ID_HEADER, user.id)
    supabaseResponse.headers.set(AUTH_USER_ID_HEADER, user.id)
  } else {
    request.headers.delete(AUTH_USER_ID_HEADER)
    supabaseResponse.headers.delete(AUTH_USER_ID_HEADER)
  }

  // Jika TIDAK login dan mencoba akses protected route.
  // /api/* dibiarkan sampai ke route handler agar mereka bisa menangani autentikasi
  // sendiri (Bearer token). Redirect ke /login bisa merusak respons JSON yang
  // diharapkan oleh klien API/token.
  if (!user && !isPublicRoute(pathname) && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirectedFrom", pathname)
    return NextResponse.redirect(url)
  }

  // Jika SUDAH login dan mencoba akses halaman login/lupa-password
  if (user && isGuestOnlyRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Setelah autentikasi lolos, terusan pathname agar layout/dashboard bisa
  // melakukan page-level role guard (defense-in-depth di sisi server).
  supabaseResponse.headers.set("x-next-pathname", pathname)

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}