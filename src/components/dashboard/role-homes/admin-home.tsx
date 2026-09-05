"use client"

import * as React from "react"
import Link from "next/link"
import { Users2, GraduationCap, FileCheck2, Award, CreditCard, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { getRangkumanAdminHome, type RangkumanAdmin } from "@/actions/dashboard"

export function AdminDashboardHome() {
  const [data, setData] = React.useState<RangkumanAdmin | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    async function fetchData() {
      try {
        const result = await getRangkumanAdminHome()
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

  return (
    <div className="space-y-6">
      {/* KPI Utama */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Santri Aktif</span>
              <Users2 className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-2">
              {data.jumlahSantri} Santri
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Guru</span>
              <GraduationCap className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-2">
              {data.jumlahGuru} Ustadz/ah
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Pendaftar Menunggu</span>
              <FileCheck2 className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-2">
              {data.pendaftarMenunggu} Calon
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Kelas</span>
              <Users2 className="h-4 w-4 text-teal-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-teal-700 mt-2">
              {data.jumlahKelas} Rombel
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Perlu Perhatian */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-amber-200/80 bg-amber-50/50 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                Esai Ujian Menunggu Nilai
              </span>
              <Award className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 mt-2">
              {data.ujianPerluDinilai} Sesi
            </div>
            <span className="text-xs text-amber-600 mt-1 block">
              {data.jumlahMapel} mapel aktif terdaftar
            </span>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-teal-200/80 bg-teal-50/50 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
                Tugas Perlu Dinilai
              </span>
              <FileCheck2 className="h-4 w-4 text-teal-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-teal-700 mt-2">
              {data.tugasPerluDinilai} Pengumpulan
            </div>
            <span className="text-xs text-teal-600 mt-1 block">Di seluruh kelas</span>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-rose-200/80 bg-rose-50/50 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
                Tagihan SPP Belum Bayar
              </span>
              <CreditCard className="h-4 w-4 text-rose-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-700 mt-2">
              {data.tagihanBelumBayar} Tagihan
            </div>
            <span className="text-xs text-rose-600 mt-1 block">Belum bayar / terlambat</span>
          </CardContent>
        </Card>
      </div>

      {/* Ujian Terbaru */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Ujian Terbaru di Semua Kelas
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Monitoring aktivitas penilaian guru
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-xs text-yellow-600">
            <Link href="/dashboard/ujian">Kelola Ujian</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-5 divide-y divide-slate-100">
          {data.daftarUjian.length > 0 ? (
            data.daftarUjian.map((item) => (
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
                <StatusBadge status={item.status as "DRAFT" | "AKTIF" | "SELESAI" | "PUBLISHED"} />
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">
              Belum ada ujian yang dibuat.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Aksi Cepat */}
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