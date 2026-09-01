"use client"

import Link from "next/link"
import {
  CalendarCheck2,
  Award,
  FileCheck2,
  Users2,
  Sparkles,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"

export function GuruDashboardHome() {
  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Kelas Diampu
              </span>
              <div className="p-2 rounded-xl bg-yellow-50 text-yellow-500">
                <Users2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-2">
              4 Kelas
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Total 120 Santri</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Perlu Dinilai
              </span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <FileCheck2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-2">
              18 Tugas
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Dari 2 tugas aktif</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Ujian Aktif
              </span>
              <div className="p-2 rounded-xl bg-teal-50 text-yellow-500">
                <Award className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-2">
              2 Ujian
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Pekan UTS Ganjil</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Kehadiran Hari Ini
              </span>
              <div className="p-2 rounded-xl bg-yellow-50 text-yellow-500">
                <CalendarCheck2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-2">
              96.5%
            </div>
            <span className="text-xs text-yellow-500 mt-1 block font-medium">3 kelas terinput</span>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Banner */}
      <div className="bg-gradient-to-r from-yellow-800 via-yellow-700 to-teal-900 rounded-3xl p-5 sm:p-6 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-yellow-600/60 text-yellow-200 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Aksi Cepat Guru</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold">Isi Absensi Kelas Hari Ini</h2>
          <p className="text-xs sm:text-sm text-yellow-200/80 max-w-xl">
            Pastikan seluruh kehadiran santri tercatat tepat waktu untuk laporan harian wali santri.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
          <Button asChild className="bg-yellow-400 hover:bg-yellow-300 text-slate-800 font-bold rounded-xl min-h-[44px]">
            <Link href="/dashboard/absensi">
              <CalendarCheck2 className="h-4 w-4 mr-1.5" />
              Buka Absensi Cepat
            </Link>
          </Button>
          <Button asChild variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl min-h-[44px]">
            <Link href="/dashboard/ujian/buat">
              <Plus className="h-4 w-4 mr-1.5" />
              Buat Ujian
            </Link>
          </Button>
        </div>
      </div>

      {/* Two Column Layout on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tugas Perlu Dinilai */}
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-800">
                Tugas Memerlukan Penilaian
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Pengumpulan tugas terbaru santri
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-yellow-600 hover:text-yellow-700">
              <Link href="/dashboard/tugas">Lihat Semua</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-5 divide-y divide-slate-100">
            {[
              { mapel: "Bahasa Arab", judul: "Tashrif Fi'il Tsulatsi Mujarrad", kelas: "7A - Ikhwan", pending: 12, deadline: "Hari Ini" },
              { mapel: "Tahfidz & Tajwid", judul: "Setoran Hafalan Surat Al-Mulk", kelas: "8B - Akhwat", pending: 6, deadline: "Kemarin" },
            ].map((item, idx) => (
              <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">
                      {item.mapel}
                    </span>
                    <span className="text-xs text-slate-500">{item.kelas}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-800">{item.judul}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    {item.pending} Belum Dinilai
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Ujian Mendatang / Aktif */}
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-800">
                Jadwal Ujian Aktif
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Monitoring pelaksanaan evaluasi
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-yellow-600 hover:text-yellow-700">
              <Link href="/dashboard/ujian">Kelola Ujian</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-5 divide-y divide-slate-100">
            {[
              { mapel: "Fiqih Ibadah", judul: "Penilaian Harian Thaharah & Shalat", kelas: "Kelas 7 & 8", status: "PUBLISHED", durasi: "60 Menit" },
              { mapel: "Aqidah Akhlak", judul: "Kuis Rukun Iman & Tauhid", kelas: "Kelas 9A", status: "DRAFT", durasi: "45 Menit" },
            ].map((item, idx) => (
              <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                      {item.mapel}
                    </span>
                    <span className="text-xs text-slate-500">{item.durasi}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-800">{item.judul}</div>
                </div>
                <StatusBadge status={item.status as "DRAFT" | "AKTIF" | "SELESAI" | "PUBLISHED"} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
