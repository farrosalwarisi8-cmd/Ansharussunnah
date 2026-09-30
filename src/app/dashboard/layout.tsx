// src/app/dashboard/layout.tsx

import type { Metadata } from "next"
import { getCurrentUser, enforcePasswordChange } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { Role } from "@prisma/client"
import { DashboardProvider, type DashboardUser, type ChildStudent } from "@/components/dashboard/dashboard-context"
import { DashboardNavWrapper } from "@/components/dashboard/dashboard-nav-wrapper"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

// Peta akses menu-admin per-prefix route (defense-in-depth di level layout).
// Action server tetap menjadi penjaga final, tapi layout mencegah pengguna
// yang menebak URL melihat kerangka menu di area terlarang.
const ADMIN_MANAGEMENT_PREFIXES = [
  "/dashboard/siswa",
  "/dashboard/guru",
  "/dashboard/kelas",
  "/dashboard/mapel",
  "/dashboard/periode-ajaran",
  "/dashboard/kelola-akun-keuangan",
  "/dashboard/kenaikan-kelas",
  "/dashboard/verifikasi-pendaftaran",
]

const KEUNGAN_ONLY_PREFIXES = ["/dashboard/keuangan", "/dashboard/daftar-siswa"]

function isAdminManagementRoute(pathname: string): boolean {
  return ADMIN_MANAGEMENT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )
}

function isKeuanganRoute(pathname: string): boolean {
  return KEUNGAN_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Guard: Paksa user ganti password jika mustChangePassword = true.
  await enforcePasswordChange("/dashboard")

  const user = await getCurrentUser()

  // Defense-in-depth: jangan pernah menyediakan akun default bila sesi tidak aktif.
  // Parameter `sesi=berakhir` dipakai halaman login untuk menampilkan state
  // "Sesi berakhir" (hanya tampilan — proses login tetap sama).
  if (!user) {
    redirect("/login?sesi=berakhir")
  }

  // Page-level role guard — jalur peran yang BUKAN admin akademik/admin keuangan
  // diblokir dari halaman manajemen data sekolah.
  try {
    const headerStore = await headers()
    const pathname = headerStore.get("x-next-pathname") ?? "/dashboard"

    const isAcademicAdmin =
      user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_AKADEMIK
    const isGuruAdmin = user.role === Role.GURU && user.isAdmin

    if (isAdminManagementRoute(pathname) && !isAcademicAdmin && !isGuruAdmin) {
      // Aturan permission tidak berubah — pengguna tetap dijauhkan dari route,
      // hanya tujuan redirect ditandai agar beranda menampilkan banner
      // "Akses ditolak" yang sudah didesain.
      redirect("/dashboard?akses=ditolak")
    }

    if (isKeuanganRoute(pathname) && user.role !== Role.ADMIN_KEUANGAN) {
      if (!isAcademicAdmin) redirect("/dashboard?akses=ditolak")
    }
  } catch {
    // Jika header tidak tersedia, lanjutkan — action server tetap mengamankan.
  }

  let childrenList: ChildStudent[] = []

  if (user && user.role === Role.ORANG_TUA && user.orangTua) {
    try {
      const parentRelations = await prisma.parentStudent.findMany({
        where: { orangTuaId: user.orangTua.id },
        select: {
          siswa: {
            select: {
              id: true,
              userId: true,
              nisn: true,
              nis: true,
              user: { select: { nama: true, avatar: true } },
              kelas: {
                select: {
                  nama: true,
                  jenjang: { select: { nama: true } },
                },
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
    username: user.username,
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
      <div className="screen-app flex min-h-screen flex-col bg-slate-50 transition-[padding] duration-300 lg:pl-[var(--sidebar-w,16rem)]">
        <DashboardNavWrapper />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>
    </DashboardProvider>
  )
}