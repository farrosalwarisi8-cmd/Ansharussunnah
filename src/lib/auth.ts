// src/lib/auth.ts

import { createSupabaseServerClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { Role } from "@prisma/client"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { cache } from "react"

const ROLE_COOKIE = "selected_role"
const USER_ID_COOKIE = "selected_user_id"

export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  // Check if user has selected a role (multi-role support)
  const cookieStore = await cookies()
  const selectedUserId = cookieStore.get(USER_ID_COOKIE)?.value
  const selectedRole = cookieStore.get(ROLE_COOKIE)?.value

  let user = null

  if (selectedUserId && selectedRole) {
    // Try to find the specific user record by ID + role
    user = await prisma.user.findFirst({
      where: {
        id: selectedUserId,
        authId: authUser.id,
        role: selectedRole as Role,
      },
      include: {
        guru: true,
        siswa: {
          include: {
            kelas: { include: { jenjang: true } },
          },
        },
        orangTua: true,
      },
    })
  }

  // Fallback: find by authId (single role or first match)
  if (!user) {
    user = await prisma.user.findFirst({
      where: { authId: authUser.id },
      include: {
        guru: true,
        siswa: {
          include: {
            kelas: { include: { jenjang: true } },
          },
        },
        orangTua: true,
      },
    })
  }

  // Defense-in-depth: cek apakah akun masih aktif
  if (user && !user.aktif) {
    throw new Error("Akun Anda telah dinonaktifkan. Hubungi admin sekolah.")
  }

  return user
})

/**
 * Get all roles available for the current auth user.
 * Used by login flow to determine if role selector is needed.
 */
export async function getAllRolesForCurrentUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return []

  const users = await prisma.user.findMany({
    where: { authId: authUser.id, aktif: true },
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      isAdmin: true,
    },
  })

  return users
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