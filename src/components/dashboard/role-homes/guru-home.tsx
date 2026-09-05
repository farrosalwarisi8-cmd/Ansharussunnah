"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarCheck2,
  Award,
  FileCheck2,
  Users2,
  Sparkles,
  Plus,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { getRangkumanGuruHome, type RangkumanGuru } from "@/actions/dashboard"

export function GuruDashboardHome() {
  const [data, setData] = React.useState<RangkumanGuru | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    async function fetchData() {
      try {
        const result = await getRangkumanGuruHome()
        if (!mounted) return
        if (result.success && result.data) {
          setData(result.data)
        } else {
          setError(result.message || "Gagal memuat rangkuman")
        }
      } catch {
        if (mounted) setError("Gagal memuat rangkuman dashboard")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchData()
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        <span className="ml-3 text-sm text-slate-500">Memuat rangkuman data...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Gagal Memuat Rangkuman"
        description={error || "Data tidak tersedia."}
      />
    )
  }

  const tugasPerluDinilai = data.daftarTugas.filter((t) => t.pending > 0)

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
              {data.jumlahKelas} Kelas
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              Total {data.jumlahSantri} Santri
            </span>
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
              {data.tugasPerluDinilai} Tugas
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Pengumpulan menunggu nilai</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Ujian Aktif
              </span>
              <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                <Award className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-2">
              {data.ujianAktif} Ujian
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Sedang berlangsung</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Sesi Esai Dinilai
              </span>
              <div className="p-2 rounded-xl bg-yellow-50 text-yellow-500">
                <CalendarCheck2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-2">
              {data.ujianPerluDinilai} Sesi
            </div>
            <span className="text-xs text-yellow-500 mt-1 block font-medium">
              Menunggu koreksi esai
            </span>
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
                Pengumpulan tugas santri yang belum dinilai
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-yellow-600 hover:text-yellow-700">
              <Link href="/dashboard/tugas">Lihat Semua</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-5 divide-y divide-slate-100">
            {tugasPerluDinilai.length > 0 ? (
              tugasPerluDinilai.map((item) => (
                <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
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
              ))
            ) : (
              <p className="py-6 text-center text-sm text-slate-400">
                Tidak ada pengumpulan tugas yang menunggu penilaian.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Ujian Terbaru */}
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-800">
                Daftar Ujian
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Ujian di kelas yang Anda ampu
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-yellow-600 hover:text-yellow-700">
              <Link href="/dashboard/ujian">Kelola Ujian</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-5 divide-y divide-slate-100">
            {data.daftarUjian.length > 0 ? (
              data.daftarUjian.map((item) => (
                <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                        {item.mapel}
                      </span>
                      <span className="text-xs text-slate-500">{item.kelas}</span>
                    </div>
                    <div className="text-sm font-bold text-slate-800">{item.judul}</div>
                  </div>
                  <StatusBadge status={item.status as "DRAFT" | "AKTIF" | "SELESAI" | "PUBLISHED"} />
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-slate-400">
                Belum ada ujian di kelas yang Anda ampu.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}