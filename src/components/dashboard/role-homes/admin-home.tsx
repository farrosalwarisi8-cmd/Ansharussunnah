"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function AdminDashboardHome() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500">Total Santri</span>
            <div className="text-2xl font-extrabold text-slate-800 mt-1">240 Santri</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500">Total Guru</span>
            <div className="text-2xl font-extrabold text-yellow-600 mt-1">18 Ustadz/ah</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500">Pendaftar Baru</span>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">14 Calon</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500">Total Kelas</span>
            <div className="text-2xl font-extrabold text-teal-700 mt-1">8 Rombel</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Button asChild className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold h-12 rounded-xl">
          <Link href="/dashboard/guru">Manajemen Akun Guru</Link>
        </Button>
        <Button asChild variant="outline" className="h-12 rounded-xl font-bold">
          <Link href="/dashboard/kelas">Kelola Jenjang &amp; Kelas</Link>
        </Button>
        <Button asChild variant="outline" className="h-12 rounded-xl font-bold">
          <Link href="/dashboard/kenaikan-kelas">Proses Kenaikan Kelas</Link>
        </Button>
      </div>
    </div>
  )
}
