// src/lib/auth.ts

import { createSupabaseServerClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { Role, Prisma } from "@prisma/client"
import { redirect } from "next/navigation"
import { cookies, headers } from "next/headers"
import { cache } from "react"

const ROLE_COOKIE = "selected_role"
const USER_ID_COOKIE = "selected_user_id"

// Tipe return konsisten: selalu punya relasi guru/siswa/orangTua (nullable).
// Dipakai agar semua caller yang mengakses `.guru` / `.siswa` / `.orangTua`
// tetap typecheck walaupun include runtime dibuat dinamis per-role.
type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    guru: true
    siswa: { include: { kelas: { include: { jenjang: true } } } }
    orangTua: true
  }
}>

// Role yang butuh relasi siswa.kelas.jenjang (untuk menampilkan info kelas).
const ROLES_BUTUH_KELAS: Role[] = [Role.SISWA, Role.ORANG_TUA]

/**
 * Include relasi yang dibuat dinamis per role.
 * - guru, siswa, orangTua SELALU di-include (1:1 lookup murah, nullable).
 * - nested siswa.kelas.jenjang hanya di-include untuk role yang membutuhkannya
 *   (SISWA/ORANG_TUA), mengurangi join berat untuk Guru/Admin.
 */
function buildUserInclude(role?: Role): Prisma.UserInclude {
  const withKelas = role !== undefined && ROLES_BUTUH_KELAS.includes(role)
  return {
    guru: true,
    siswa: withKelas
      ? { include: { kelas: { include: { jenjang: true } } } }
      : true,
    orangTua: true,
  }
}

export const getCurrentUser = cache(async (): Promise<UserWithRelations | null> => {
  // Trust hasil verifikasi middleware bila tersedia (menghemat 1 panggilan
  // Supabase getUser() per request pada route yang dilindungi).
  const authUserId = await getAuthUserIdFromMiddleware()

  if (!authUserId) {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    if (!authUser) return null
    return loadUserRecord(authUser.id)
  }

  return loadUserRecord(authUserId)
})

/**
 * Membaca hasil verifikasi middleware dari request header (jika ada).
 * Nilai ini SELALU ditimpa middleware dari getUser() yang trusted pada route
 * yang dilindungi. Mengembalikan null bila tidak tersedia (mis. route publik
 * yang di-short-circuit sebelum middleware memverifikasi).
 */
async function getAuthUserIdFromMiddleware(): Promise<string | null> {
  try {
    const headerStore = await headers()
    // Next.js dapat men-prefix header middleware dengan 'x-middleware-' saat
    // dibaca dari Server Component; cek kedua bentuk demi robust.
    return (
      headerStore.get("x-opencode-auth-user-id") ??
      headerStore.get("x-middleware-opencode-auth-user-id") ??
      null
    )
  } catch {
    return null
  }
}

async function loadUserRecord(authUserId: string): Promise<UserWithRelations | null> {
  // Check if user has selected a role (multi-role support)
  const cookieStore = await cookies()
  const selectedUserId = cookieStore.get(USER_ID_COOKIE)?.value
  const selectedRole = cookieStore.get(ROLE_COOKIE)?.value

  let user: UserWithRelations | null = null

  if (selectedUserId && selectedRole) {
    // Try to find the specific user record by ID + role
    user = (await prisma.user.findFirst({
      where: {
        id: selectedUserId,
        authId: authUserId,
        role: selectedRole as Role,
      },
      include: buildUserInclude(selectedRole as Role),
    })) as UserWithRelations | null
  }

  // Fallback: find by authId (single role or first match) — sertakan nested kelas
  // karena role belum diketahui pasti.
  if (!user) {
    user = (await prisma.user.findFirst({
      where: { authId: authUserId },
      include: {
        guru: true,
        siswa: {
          include: {
            kelas: { include: { jenjang: true } },
          },
        },
        orangTua: true,
      },
    })) as UserWithRelations | null
  }

  // Defense-in-depth: cek apakah akun masih aktif
  if (user && !user.aktif) {
    throw new Error("Akun Anda telah dinonaktifkan. Hubungi admin sekolah.")
  }

  return user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error("Unauthorized: Anda harus login terlebih dahulu")
  }
  return user
}

export async function requireRole(allowedRoles: Role[]) {
  const user = await requireAuth()
  if (!allowedRoles.includes(user.role)) {
    throw new Error(
      `Forbidden: Anda tidak memiliki akses. Role yang dibutuhkan: ${allowedRoles.join(", ")}`
    )
  }
  return user
}

/**
 * Role yang boleh mengakses fitur akademik (ujian, tugas, materi, absensi, rapor).
 * SUPER_ADMIN dan ADMIN_AKADEMIK diperlakukan sebagai "guru admin" yang punya akses penuh
 * ke seluruh kelas & jenjang, sedangkan Role.GURU hanya kelas yang diajarnya.
 */
const AKADEMIK_ROLES = [Role.GURU, Role.SUPER_ADMIN, Role.ADMIN_AKADEMIK] as const

export async function requireGuru() {
  return requireRole([...AKADEMIK_ROLES])
}

/**
 * Apakah role yang sedang login adalah admin akademik / super admin
 * (boleh mengelola seluruh kelas & jenjang, bukan hanya tugasan guru).
 */
export function isAcademicAdminRole(role: Role): boolean {
  return role === Role.SUPER_ADMIN || role === Role.ADMIN_AKADEMIK
}

/**
 * Guard yang memastikan user adalah guru dengan hak admin penuh.
 * SUPER_ADMIN dan ADMIN_AKADEMIK selalu dianggap admin;
 * Role.GURU hanya dianggap admin bila user.isAdmin === true.
 */
export async function requireGuruAdmin() {
  const user = await requireGuru()
  if (isAcademicAdminRole(user.role)) {
    return user
  }
  if (!user.isAdmin) {
    throw new Error("Akses ditolak: Fitur ini hanya untuk admin")
  }
  return user
}

/**
 * Guard yang memaksa user melakukan ganti password default
 */
export async function enforcePasswordChange(currentPathname: string) {
  const user = await getCurrentUser()
  if (!user) return

  if (user.mustChangePassword && currentPathname !== "/ganti-password") {
    redirect("/ganti-password")
  }
}