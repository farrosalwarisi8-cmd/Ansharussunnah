"use client"

import dynamic from "next/dynamic"

const DashboardNav = dynamic(
  () => import("@/components/dashboard/dashboard-nav").then((m) => m.DashboardNav),
  { ssr: false }
)

export function DashboardNavWrapper() {
  return <DashboardNav />
}
