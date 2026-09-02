"use client"

import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { Role } from "@prisma/client"
import { Plus } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"

// Dynamic import memecah bundle per role. SSR aktif agar tampilan langsung muncul.
const GuruUjianView = dynamic(
  () => import("@/components/dashboard/ujian-guru-view").then((m) => m.GuruUjianView)
)
const SiswaUjianView = dynamic(
  () => import("@/components/dashboard/ujian-siswa-view").then((m) => m.SiswaUjianView)
)
const OrangTuaUjianView = dynamic(
  () => import("@/components/dashboard/ujian-orang-tua-view").then((m) => m.OrangTuaUjianView)
)

export default function UjianPage() {
  const { user, selectedChild } = useDashboard()

  const isTeacher = user.role === Role.GURU || user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_AKADEMIK
  const isStudent = user.role === Role.SISWA
  const isParent = user.role === Role.ORANG_TUA

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={isTeacher ? "Manajemen Ujian & Evaluasi" : "Ujian & Penilaian Santri"}
        subtitle={
          isTeacher
            ? "Kelola ujian online, buat bank soal, dan evaluasi hasil belajar santri."
            : "Ikuti ujian aktif dengan timer terintegrasi atau lihat riwayat hasil ujian."
        }
        action={
          isTeacher ? (
            <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-md min-h-[44px]">
              <Link href="/dashboard/ujian/buat">
                <Plus className="h-4 w-4 mr-1.5" />
                Buat Ujian Baru
              </Link>
            </Button>
          ) : null
        }
      />

      {isParent && <ChildSelector />}

      {isTeacher && <GuruUjianView />}
      {isStudent && <SiswaUjianView />}
      {isParent && <OrangTuaUjianView selectedChild={selectedChild} />}
    </div>
  )
}
