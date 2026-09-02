"use client"

import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Role } from "@prisma/client"
import { Plus } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"

// Dynamic import memecah bundle per role. SSR aktif agar tampilan langsung muncul.
const GuruTugasView = dynamic(
  () => import("@/components/dashboard/tugas-guru-view").then((m) => m.GuruTugasView)
)
const SiswaTugasView = dynamic(
  () => import("@/components/dashboard/tugas-siswa-view").then((m) => m.SiswaTugasView)
)
const OrangTuaTugasView = dynamic(
  () => import("@/components/dashboard/tugas-orang-tua-view").then((m) => m.OrangTuaTugasView)
)

export default function TugasPage() {
  const { user, selectedChild } = useDashboard()

  const isTeacher = user.role === Role.GURU || user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_AKADEMIK
  const isStudent = user.role === Role.SISWA
  const isParent = user.role === Role.ORANG_TUA

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={isTeacher ? "Manajemen Tugas Santri" : "Tugas & Pekerjaan Rumah (PR)"}
        subtitle={
          isTeacher
            ? "Kelola penugasan kelas, periksa submisi santri, dan berikan nilai serta catatan evaluasi."
            : "Kumpulkan tugas sebelum batas waktu deadline dan pantau nilai feedback dari ustadz/ah."
        }
        action={
          isTeacher ? (
            <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-md min-h-[44px]">
              <Link href="/dashboard/tugas/buat">
                <Plus className="h-4 w-4 mr-1.5" />
                Buat Tugas Baru
              </Link>
            </Button>
          ) : null
        }
      />

      {isParent && <ChildSelector />}

      {isTeacher && <GuruTugasView />}
      {isStudent && <SiswaTugasView />}
      {isParent && <OrangTuaTugasView selectedChild={selectedChild} />}
    </div>
  )
}
