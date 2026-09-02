// src/app/dashboard/layout.tsx

import type { Metadata } from "next"
import { getCurrentUser, enforcePasswordChange } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Role } from "@prisma/client"
import { DashboardProvider, type DashboardUser, type ChildStudent } from "@/components/dashboard/dashboard-context"
import { DashboardNavWrapper } from "@/components/dashboard/dashboard-nav-wrapper"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Guard: Paksa user ganti password jika mustChangePassword = true.
  // getCurrentUser di-memoize per-request (React cache), jadi pemanggilan
  // di bawah akan memakai hasil yang sama tanpa query Supabase/Prisma tambahan.
  await enforcePasswordChange("/dashboard")

  const user = await getCurrentUser()

  // Defense-in-depth: jangan pernah menyediakan akun default bila sesi tidak aktif.
  if (!user) {
    redirect("/login")
  }

  let childrenList: ChildStudent[] = []

  if (user && user.role === Role.ORANG_TUA && user.orangTua) {
    try {
      const parentRelations = await prisma.parentStudent.findMany({
        where: { orangTuaId: user.orangTua.id },
        include: {
          siswa: {
            include: {
              user: true,
              kelas: {
                include: { jenjang: true },
              },
            },
          },
        },
      })

      childrenList = parentRelations.map((pr) => ({
        id: pr.siswa.id,
        userId: pr.siswa.userId,
        nama: pr.siswa.user.nama,
        nisn: pr.siswa.nisn,
        nis: pr.siswa.nis,
        kelasNama: pr.siswa.kelas?.nama || "Belum Ditentukan",
        jenjangNama: pr.siswa.kelas?.jenjang?.nama || "-",
        avatar: pr.siswa.user.avatar,
      }))
    } catch {
      // Fallback
    }
  }

  // Siapkan dashboard user data
  const dashboardUser: DashboardUser = {
    id: user.id,
    nama: user.nama,
    email: user.email,
    role: user.role,
    isAdmin: user.isAdmin,
    avatar: user.avatar,
    kelas: user.siswa?.kelas
      ? {
          id: user.siswa.kelas.id,
          nama: user.siswa.kelas.nama,
          jenjang: {
            id: user.siswa.kelas.jenjang.id,
            nama: user.siswa.kelas.jenjang.nama,
          },
        }
      : null,
    children: childrenList,
  }

  return (
    <DashboardProvider user={dashboardUser}>
      <div className="min-h-screen bg-slate-50/60 flex flex-col">
        <DashboardNavWrapper />
        <main className="lg:pl-64 xl:pl-72 flex-1 pb-24 lg:pb-12 pt-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full transition-all">
          {children}
        </main>
      </div>
    </DashboardProvider>
  )
}