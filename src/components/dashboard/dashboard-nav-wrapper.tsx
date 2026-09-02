"use client"

import dynamic from "next/dynamic"

// Dimuat normal (SSR diaktifkan) agar navigasi langsung tampil saat
// berpindah halaman, tanpa menunggu hidrasi JavaScript.
const DashboardNav = dynamic(
  () => import("@/components/dashboard/dashboard-nav").then((m) => m.DashboardNav)
)

export function DashboardNavWrapper() {
  return <DashboardNav />
}
