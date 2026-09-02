"use client"

import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { Role } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Printer, Loader2 } from "lucide-react"
import dynamic from "next/dynamic"

// Lazy-load role-specific sub-views — only the active role's code is downloaded
const GuruRaporView = dynamic(
  () => import("@/components/dashboard/rapor-guru-view").then((m) => m.GuruRaporView),
  { ssr: false, loading: () => <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-yellow-500" /></div> }
)
const SiswaOrangTuaRaporView = dynamic(
  () => import("@/components/dashboard/rapor-siswa-view").then((m) => m.SiswaOrangTuaRaporView),
  { ssr: false, loading: () => <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-yellow-500" /></div> }
)

export default function RaporPage() {
  const { user, selectedChild } = useDashboard()

  const isTeacher = user.role === Role.GURU || user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_AKADEMIK
  const isParent = user.role === Role.ORANG_TUA

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <DashboardHeader
        title={isTeacher ? "Manajemen Rapor Santri" : "Rapor Hasil Belajar Digital"}
        subtitle={
          isTeacher
            ? "Input catatan wali kelas, tinjau rekapitulasi nilai komprehensif, dan finalisasi rapor santri."
            : "Laporan capaian akademik, hafalan Al-Qur'an, dan pembinaan akhlak santri."
        }
        action={
          <Button
            type="button"
            onClick={() => window.print()}
            variant="outline"
            className="rounded-xl min-h-[44px] text-xs font-bold"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Cetak / Download PDF
          </Button>
        }
      />

      {isParent && <ChildSelector />}

      {isTeacher && <GuruRaporView />}
      {!isTeacher && <SiswaOrangTuaRaporView isParent={isParent} selectedChild={selectedChild} />}
    </div>
  )
}
