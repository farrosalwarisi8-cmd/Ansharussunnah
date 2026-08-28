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
 * ✅ FIX: Guard yang memaksa user ganti password jika mustChangePassword = true
 * Dipanggil di layout dashboard (Server Component)
 */
export async function enforcePasswordChange(currentPathname: string) {
  const user = await getCurrentUser()
  if (!user) return

  // Jika user masih harus ganti password DAN belum di halaman ganti-password
  if (user.mustChangePassword && currentPathname !== "/ganti-password") {
    redirect("/ganti-password")
  }
}