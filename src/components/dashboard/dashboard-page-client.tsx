// src/components/dashboard/dashboard-page-client.tsx
"use client"

import dynamic from "next/dynamic"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Role } from "@prisma/client"

// Lazy-load each role-specific dashboard — only the user's role is loaded
const GuruDashboardHome = dynamic(
  () => import("@/components/dashboard/role-homes/guru-home").then((m) => m.GuruDashboardHome),
  { ssr: false }
)
const SiswaDashboardHome = dynamic(
  () => import("@/components/dashboard/role-homes/siswa-home").then((m) => m.SiswaDashboardHome),
  { ssr: false }
)
const OrangTuaDashboardHome = dynamic(
  () => import("@/components/dashboard/role-homes/orang-tua-home").then((m) => m.OrangTuaDashboardHome),
  { ssr: false }
)
const KeuanganDashboardHome = dynamic(
  () => import("@/components/dashboard/role-homes/keuangan-home").then((m) => m.KeuanganDashboardHome),
  { ssr: false }
)
const AdminDashboardHome = dynamic(
  () => import("@/components/dashboard/role-homes/admin-home").then((m) => m.AdminDashboardHome),
  { ssr: false }
)

export function DashboardPageClient() {
  const { user, selectedChild } = useDashboard()

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={`Assalamu'alaikum, ${user.nama}`}
        subtitle="Selamat datang di Portal Akademik & LMS Terpadu Ansharussunnah."
      />

      {user.role === Role.ORANG_TUA && <ChildSelector />}

      {user.role === Role.GURU && <GuruDashboardHome />}
      {user.role === Role.SISWA && <SiswaDashboardHome user={user} />}
      {user.role === Role.ORANG_TUA && <OrangTuaDashboardHome selectedChild={selectedChild} />}
      {user.role === Role.ADMIN_KEUANGAN && <KeuanganDashboardHome />}
      {(user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_AKADEMIK) && (
        <AdminDashboardHome />
      )}
    </div>
  )
}
