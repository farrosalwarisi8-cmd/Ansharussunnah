"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarCheck2,
  Award,
  FileCheck2,
  CreditCard,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { type DashboardUser } from "@/components/dashboard/dashboard-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { getRangkumanSiswaHome, type RangkumanSiswa } from "@/actions/dashboard"

function formatDeadline(iso: string): string {
  const d = new Date(iso)
  const diff = d.getTime() - Date.now()
  const jam = Math.ceil(diff / (1000 * 60 * 60))
  if (jam <= 0) return "Deadline: Sudah lewat"
  if (jam < 24) return `Deadline: ${jam} jam lagi`
  return `Deadline: ${d.toLocaleDateString("id-ID")}`
}

export function SiswaDashboardHome({ user }: { user: DashboardUser }) {
  const [data, setData] = React.useState<RangkumanSiswa | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    async function fetchData() {
      try {
        const result = await getRangkumanSiswaHome()
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

  const sosialisasi = "Tetap Semangat Menuntut Ilmu"

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
              {sosialisasi}, {user.nama.split(" ")[0]}!
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

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
          <span className="ml-3 text-sm text-slate-500">Memuat rangkuman data...</span>
        </div>
      ) : error || !data ? (
        <EmptyState
          icon={AlertCircle}
          title="Gagal Memuat Rangkuman"
          description={error || "Data tidak tersedia."}
        />
      ) : (
        <>
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Tugas Belum Dikirim</span>
                  <FileCheck2 className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-2">
                  {data.tugasBelumDikirim} Tugas
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  {data.daftarTugas[0]
                    ? formatDeadline(data.daftarTugas[0].deadline)
                    : "Semua tugas sudah dikumpulkan"}
                </span>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Ujian Menunggu</span>
                  <Award className="h-4 w-4 text-yellow-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-2">
                  {data.ujianTersedia} Ujian
                </div>
                <span className="text-xs text-yellow-500 mt-1 block font-medium">
                  {data.daftarUjianTersedia[0]?.mapel || "Tidak ada ujian aktif"}
                </span>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Kehadiran Bulan Ini</span>
                  <CalendarCheck2 className="h-4 w-4 text-yellow-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-teal-700 mt-2">
                  {data.kehadiranPersen}%
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  {data.hadir} Hadir dari {data.totalAbsensi} absensi
                </span>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Status SPP</span>
                  <CreditCard className="h-4 w-4 text-yellow-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-2">
                  {data.spp?.status || "Belum Ada"}
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  {data.spp
                    ? data.spp.namaTagihan
                    : `SPP ${new Date().toLocaleDateString("id-ID", { month: "long" })}`}
                </span>
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
                {data.daftarTugas.length > 0 ? (
                  data.daftarTugas.map((t) => (
                    <div key={t.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">
                          {t.mapel}
                        </span>
                        <div className="text-sm font-bold text-slate-800">{t.judul}</div>
                        <div className="text-xs text-slate-500">{formatDeadline(t.deadline)}</div>
                      </div>
                      <Button asChild size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl min-h-[38px]">
                        <Link href="/dashboard/tugas">Kirim</Link>
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-sm text-slate-400">
                    Tidak ada tugas yang menunggu dikumpulkan.
                  </p>
                )}
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
              <CardContent className="p-5 space-y-3">
                {data.daftarUjianTersedia.length > 0 ? (
                  data.daftarUjianTersedia.slice(0, 3).map((u) => (
                    <div key={u.id} className="p-4 rounded-2xl bg-yellow-50/70 border border-yellow-200/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-yellow-700 bg-white px-2.5 py-1 rounded-full shadow-sm">
                          {u.mapel}
                        </span>
                        <span className="text-xs font-semibold text-yellow-600 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {u.durasiMenit} Menit
                        </span>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{u.judul}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{u.totalSoal} butir soal</p>
                      </div>
                      <Button asChild className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[44px]">
                        <Link href={`/dashboard/ujian/${u.id}/kerjakan`}>Mulai Ujian Sekarang</Link>
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-sm text-slate-400">
                    Tidak ada ujian yang sedang berlangsung.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Riwayat Nilai Ujian */}
          {data.daftarNilai.length > 0 && (
            <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
              <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-800">
                  Nilai Ujian Terbaru
                </CardTitle>
                <span className="text-xs font-semibold text-yellow-600">
                  Rata-rata: {data.rataRataNilai ?? "-"}
                </span>
              </CardHeader>
              <CardContent className="p-5 divide-y divide-slate-100">
                {data.daftarNilai.map((n) => (
                  <div key={n.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-slate-500">{n.mapel}</span>
                      <div className="text-sm font-bold text-slate-800">{n.judul}</div>
                    </div>
                    <div className="text-lg font-extrabold text-yellow-600 bg-yellow-50 px-3 py-1 rounded-xl border border-yellow-200">
                      {n.nilai}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}