"use client"

import * as React from "react"
import { getRiwayatKehadiranSiswa } from "@/actions/absensi"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Loader2 } from "lucide-react"

type RiwayatItem = {
  id: string
  tanggal: string | Date
  status: string
  keterangan?: string | null
  kelas?: string
  periode?: string
}
type RiwayatData = {
  nama?: string
  namaSiswa?: string
  total: number
  ringkasan: { HADIR: number; SAKIT: number; IZIN: number; ALPHA: number }
  riwayat: RiwayatItem[]
}

export function SiswaAbsensiView() {
  const [riwayatData, setRiwayatData] = React.useState<RiwayatData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchRiwayat() {
      setLoading(true)
      setError(null)
      try {
        const result = await getRiwayatKehadiranSiswa()
        if (result.success && result.data) {
          setRiwayatData(result.data as RiwayatData)
        } else {
          setError(result.message || "Gagal memuat riwayat kehadiran")
        }
      } catch {
        setError("Gagal memuat riwayat kehadiran")
      } finally {
        setLoading(false)
      }
    }
    fetchRiwayat()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        <span className="ml-3 text-sm text-slate-500">Memuat riwayat kehadiran...</span>
      </div>
    )
  }

  if (error) {
    return <EmptyState title="Gagal Memuat Data" description={error} />
  }

  if (!riwayatData || riwayatData.total === 0) {
    return <EmptyState title="Belum Ada Data Kehadiran" description="Belum ada catatan presensi untuk periode ini." />
  }

  const persentase = riwayatData.total > 0
    ? ((riwayatData.ringkasan.HADIR / riwayatData.total) * 100).toFixed(1)
    : "0"

  return (
    <div className="space-y-6">
      {/* Kehadiran KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 text-center">
            <span className="text-xs text-slate-500 font-semibold uppercase">Persentase Hadir</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-1">{persentase}%</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 text-center">
            <span className="text-xs text-slate-500 font-semibold uppercase">Total Hadir</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-1">{riwayatData.ringkasan.HADIR} Hari</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 text-center">
            <span className="text-xs text-slate-500 font-semibold uppercase">Izin / Sakit</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-1">{riwayatData.ringkasan.IZIN + riwayatData.ringkasan.SAKIT} Hari</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 text-center">
            <span className="text-xs text-slate-500 font-semibold uppercase">Alpa</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-1">{riwayatData.ringkasan.ALPHA} Hari</div>
          </CardContent>
        </Card>
      </div>

      {/* Riwayat Absensi Table */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-800">
            Log Riwayat Kehadiran Harian
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Catatan presensi yang diinput oleh wali kelas &amp; pengajar
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 divide-y divide-slate-100">
          {riwayatData.riwayat.map((log) => (
            <div key={log.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="font-bold text-slate-800 text-sm">
                  {new Date(log.tanggal).toLocaleDateString("id-ID")}
                </div>
                {log.periode && (
                  <div className="text-xs text-slate-500">{log.periode}</div>
                )}
                {log.keterangan && <div className="text-xs text-slate-400 italic">{log.keterangan}</div>}
              </div>
              <StatusBadge status={log.status as "HADIR" | "IZIN" | "SAKIT" | "ALPHA"} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
