"use client"

import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { Role } from "@prisma/client"
import { EmptyState } from "@/components/ui/empty-state"
import { Loader2 } from "lucide-react"
import dynamic from "next/dynamic"

// Lazy-load role-specific sub-views — only the active role's code is downloaded
const GuruAbsensiView = dynamic(
  () => import("@/components/dashboard/absensi-guru-view").then((m) => m.GuruAbsensiView),
  { ssr: false, loading: () => <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-yellow-500" /></div> }
)
const SiswaAbsensiView = dynamic(
  () => import("@/components/dashboard/absensi-siswa-view").then((m) => m.SiswaAbsensiView),
  { ssr: false, loading: () => <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-yellow-500" /></div> }
)
const OrangTuaAbsensiView = dynamic(
  () => import("@/components/dashboard/absensi-orang-tua-view").then((m) => m.OrangTuaAbsensiView),
  { ssr: false, loading: () => <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-yellow-500" /></div> }
)

export default function AbsensiPage() {
  const { user, selectedChild } = useDashboard()

  const isTeacher = user.role === Role.GURU || user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_AKADEMIK
  const isStudent = user.role === Role.SISWA
  const isParent = user.role === Role.ORANG_TUA

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={isTeacher ? "Presensi & Absensi Kelas" : "Riwayat Kehadiran"}
        subtitle={
          isTeacher
            ? "Input dan rekap kehadiran santri per kelas secara cepat & akurat."
            : "Pantau persentase kehadiran dan riwayat absensi harian."
        }
      />

      {isParent && <ChildSelector />}

      {isTeacher && <GuruAbsensiView />}
      {isStudent && <SiswaAbsensiView />}
      {isParent && selectedChild && <OrangTuaAbsensiView selectedChild={selectedChild} />}
      {isParent && !selectedChild && (
        <EmptyState
          title="Pilih Anak Terlebih Dahulu"
          description="Gunakan selector di atas untuk memilih anak yang ingin dipantau."
        />
      )}
    </div>
  )
}
