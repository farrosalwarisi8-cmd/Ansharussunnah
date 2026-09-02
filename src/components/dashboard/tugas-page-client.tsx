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
import { Loader2 } from "lucide-react"

// Lazy-load role-specific sub-views — only the active role's code is downloaded
const GuruTugasView = dynamic(
  () => import("@/components/dashboard/tugas-guru-view").then((m) => m.GuruTugasView),
  { ssr: false, loading: () => <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-yellow-500" /></div> }
)
const SiswaTugasView = dynamic(
  () => import("@/components/dashboard/tugas-siswa-view").then((m) => m.SiswaTugasView),
  { ssr: false, loading: () => <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-yellow-500" /></div> }
)
const OrangTuaTugasView = dynamic(
  () => import("@/components/dashboard/tugas-orang-tua-view").then((m) => m.OrangTuaTugasView),
  { ssr: false, loading: () => <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-yellow-500" /></div> }
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
