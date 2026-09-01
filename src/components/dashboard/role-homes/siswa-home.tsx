"use client"

import Link from "next/link"
import {
  CalendarCheck2,
  Award,
  FileCheck2,
  CreditCard,
  Clock,
} from "lucide-react"
import { type DashboardUser } from "@/components/dashboard/dashboard-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function SiswaDashboardHome({ user }: { user: DashboardUser }) {
  return (
    <div className="space-y-6">
      {/* Top Banner with Student Class & Quick Motivation */}
      <div className="bg-gradient-to-tr from-yellow-700 to-teal-700 rounded-3xl p-5 sm:p-7 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs uppercase font-bold text-yellow-200 tracking-wider">
              {user.kelas ? `${user.kelas.jenjang?.nama} - ${user.kelas.nama}` : "Santri Ansharussunnah"}
            </span>
            <h2 className="text-xl sm:text-2xl font-black">
              Tetap Semangat Menuntut Ilmu, {user.nama.split(" ")[0]}!
            </h2>
            <p className="text-xs sm:text-sm text-yellow-100 max-w-lg leading-relaxed">
              &ldquo;Barangsiapa menempuh jalan untuk menuntut ilmu, Allah mudahkan jalannya menuju Surga.&rdquo; (HR. Muslim)
            </p>
          </div>
          <Button asChild className="bg-yellow-400 hover:bg-yellow-300 text-slate-800 font-bold rounded-xl shrink-0 min-h-[44px]">
            <Link href="/dashboard/ujian">
              <Award className="h-4 w-4 mr-1.5" />
              Kerjakan Ujian
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Tugas Belum Dikirim</span>
              <FileCheck2 className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-2">
              2 Tugas
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Deadline terdekat: Besok</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Ujian Menunggu</span>
              <Award className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-2">
              1 Ujian
            </div>
            <span className="text-xs text-yellow-500 mt-1 block font-medium">Fiqih Ibadah</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Kehadiran Bulan Ini</span>
              <CalendarCheck2 className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-teal-700 mt-2">
              98.2%
            </div>
            <span className="text-xs text-slate-500 mt-1 block">22 Hadir, 1 Izin</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Status SPP</span>
              <CreditCard className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-2">
              Lunas
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Bulan Berjalan</span>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tugas Pending */}
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-800">
              Tugas Mendatang
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs text-yellow-600">
              <Link href="/dashboard/tugas">Buka Tugas</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-5 divide-y divide-slate-100">
            <div className="py-3 first:pt-0 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">
                  Bahasa Arab
                </span>
                <div className="text-sm font-bold text-slate-800">
                  Latihan Tashrif Fi&apos;il Tsulatsi
                </div>
                <div className="text-xs text-slate-500">Deadline: 20:00 WIB Hari Ini</div>
              </div>
              <Button asChild size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl min-h-[38px]">
                <Link href="/dashboard/tugas">Kirim</Link>
              </Button>
            </div>
            <div className="py-3 last:pb-0 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                  Hadits Arba&apos;in
                </span>
                <div className="text-sm font-bold text-slate-800">
                  Resume Hadits Ke-1 &amp; Ke-2
                </div>
                <div className="text-xs text-slate-500">Deadline: 2 Hari Lagi</div>
              </div>
              <Button asChild size="sm" variant="outline" className="rounded-xl min-h-[38px]">
                <Link href="/dashboard/tugas">Detail</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Ujian Tersedia */}
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-800">
              Ujian Tersedia
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs text-yellow-600">
              <Link href="/dashboard/ujian">Semua Ujian</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-5">
            <div className="p-4 rounded-2xl bg-yellow-50/70 border border-yellow-200/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-yellow-700 bg-white px-2.5 py-1 rounded-full shadow-sm">
                  Fiqih Ibadah
                </span>
                <span className="text-xs font-semibold text-yellow-600 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> 60 Menit
                </span>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">
                  Penilaian Harian Thaharah &amp; Shalat Berjamaah
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  25 Soal Pilihan Ganda &amp; 2 Soal Esai
                </p>
              </div>
              <Button asChild className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[44px]">
                <Link href="/dashboard/ujian">Mulai Ujian Sekarang</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
