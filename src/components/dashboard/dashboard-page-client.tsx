// src/components/dashboard/dashboard-page-client.tsx
"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { AccessDeniedBanner } from "@/components/ui/access-denied"
import { Role } from "@/lib/roles"

// Dynamic import memecah bundle per role — hanya chunk role user yang dimuat.
// SSR diaktifkan agar konten langsung tampil saat berpindah halaman.
const GuruDashboardHome = dynamic(
  () => import("@/components/dashboard/role-homes/guru-home").then((m) => m.GuruDashboardHome)
)
const SiswaDashboardHome = dynamic(
  () => import("@/components/dashboard/role-homes/siswa-home").then((m) => m.SiswaDashboardHome)
)
const OrangTuaDashboardHome = dynamic(
  () => import("@/components/dashboard/role-homes/orang-tua-home").then((m) => m.OrangTuaDashboardHome)
)
const KeuanganDashboardHome = dynamic(
  () => import("@/components/dashboard/role-homes/keuangan-home").then((m) => m.KeuanganDashboardHome)
)
const AdminDashboardHome = dynamic(
  () => import("@/components/dashboard/role-homes/admin-home").then((m) => m.AdminDashboardHome)
)

export function DashboardPageClient() {
  const { user, selectedChild } = useDashboard()

  // Server menandai pemblokiran route dengan `?akses=ditolak` (guard di
  // dashboard layout). Banner ini hanya tampil satu kali — param dibersihkan
  // dari URL agar refresh tidak menampilkan ulang.
  const [aksesDitolak, setAksesDitolak] = React.useState(false)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("akses") === "ditolak") {
      setAksesDitolak(true)
      params.delete("akses")
      const qs = params.toString()
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (qs ? `?${qs}` : "")
      )
    }
  }, [])

  // Kepala halaman (h1 + aksi) dimiliki masing-masing role home supaya judul,
  // deskripsi, dan tombol aksi sesuai konteks tiap role.
  return (
    <div className="space-y-6">
      {aksesDitolak && <AccessDeniedBanner />}

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
