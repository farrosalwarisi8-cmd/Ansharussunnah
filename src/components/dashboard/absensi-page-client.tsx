"use client"

import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { Role } from "@prisma/client"
import { EmptyState } from "@/components/ui/empty-state"
import dynamic from "next/dynamic"

// Dynamic import memecah bundle per role — hanya chunk role user yang dimuat.
// SSR aktif agar tampilan langsung muncul saat berpindah halaman (tanpa spinner).
const GuruAbsensiView = dynamic(
  () => import("@/components/dashboard/absensi-guru-view").then((m) => m.GuruAbsensiView)
)
const SiswaAbsensiView = dynamic(
  () => import("@/components/dashboard/absensi-siswa-view").then((m) => m.SiswaAbsensiView)
)
const OrangTuaAbsensiView = dynamic(
  () => import("@/components/dashboard/absensi-orang-tua-view").then((m) => m.OrangTuaAbsensiView)
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
