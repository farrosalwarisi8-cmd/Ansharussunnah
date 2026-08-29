// src/lib/auth.ts

import { createSupabaseServerClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { Role } from "@prisma/client"
import { redirect } from "next/navigation"

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const user = await prisma.user.findUnique({
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

  // Defense-in-depth: cek apakah akun masih aktif
  // Memastikan meskipun ban Supabase Auth gagal/belum ter-propagate,
  // aplikasi tetap menolak akses berdasarkan data di database
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

export async function requireGuru() {
  return requireRole([Role.GURU])
}

/**
 * Guard yang memastikan user adalah guru dengan hak admin.
 * Hanya guru dengan isAdmin === true yang boleh mengakses fitur ini.
 */
export async function requireGuruAdmin() {
  const user = await requireGuru()
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