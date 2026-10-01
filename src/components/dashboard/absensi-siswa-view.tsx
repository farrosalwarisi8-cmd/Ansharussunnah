"use client"

import * as React from "react"
import { getRiwayatKehadiranSiswa } from "@/actions/absensi"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { ListPagination } from "@/components/ui/list-pagination"

type RiwayatItem = {
  id: string
  mataPelajaranId?: string | null
  tanggal: string | Date
  status: string
  keterangan?: string | null
  kelas?: string
  mataPelajaran?: string
  periode?: string
}
type MapelOption = { id: string; nama: string }
type RiwayatData = {
  nama?: string
  namaSiswa?: string
  total: number
  ringkasan: { HADIR: number; SAKIT: number; IZIN: number; ALPHA: number }
  mataPelajaranList: MapelOption[]
  page: number
  pageSize: number
  totalPages: number
  riwayat: RiwayatItem[]
}

const PAGE_SIZE = 25
const EMPTY_RINGKASAN = { HADIR: 0, SAKIT: 0, IZIN: 0, ALPHA: 0 }

export function SiswaAbsensiView() {
  const [riwayatData, setRiwayatData] = React.useState<RiwayatData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedMapel, setSelectedMapel] = React.useState("SEMUA")
  const [page, setPage] = React.useState(1)

  const fetchRiwayat = React.useCallback(async (targetPage: number, mapelId: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await getRiwayatKehadiranSiswa({
        page: targetPage,
        pageSize: PAGE_SIZE,
        ...(mapelId !== "SEMUA" ? { mataPelajaranId: mapelId } : {}),
      })
      if (result.success && result.data) {
        const data = result.data as RiwayatData
        setRiwayatData(data)
        setPage(data.page)
      } else {
        setError(result.message || "Gagal memuat riwayat kehadiran")
      }
    } catch {
      setError("Gagal memuat riwayat kehadiran")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchRiwayat(page, selectedMapel)
  }, [page, selectedMapel, fetchRiwayat])

  if (loading && !riwayatData) {
    return (
      <PageSkeleton label="Memuat riwayat kehadiran..." />
    )
  }

  if (error) {
    return <EmptyState title="Gagal Memuat Data" description={error} />
  }

  if (!riwayatData || riwayatData.total === 0) {
    return <EmptyState title="Belum Ada Data Kehadiran" description="Belum ada catatan presensi untuk periode ini." />
  }

  const ringkasan = riwayatData.ringkasan ?? EMPTY_RINGKASAN
  const totalFiltered = riwayatData.total
  const persentase = totalFiltered > 0
    ? ((ringkasan.HADIR / totalFiltered) * 100).toFixed(1)
    : "0"

  return (
    <div className="space-y-6">
      {/* Filter Mapel */}
      {riwayatData.mataPelajaranList.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[{ id: "SEMUA", nama: "SEMUA" }, ...riwayatData.mataPelajaranList].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setSelectedMapel(m.id)
                setPage(1)
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[40px] touch-manipulation ${
                selectedMapel === m.id
                  ? "bg-yellow-600 text-white shadow-sm"
                  : "bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {m.nama}
            </button>
          ))}
        </div>
      )}

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
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-1">{ringkasan.HADIR} Sesi</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 text-center">
            <span className="text-xs text-slate-500 font-semibold uppercase">Izin / Sakit</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-1">{ringkasan.IZIN + ringkasan.SAKIT} Sesi</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 text-center">
            <span className="text-xs text-slate-500 font-semibold uppercase">Alpa</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-1">{ringkasan.ALPHA} Sesi</div>
          </CardContent>
        </Card>
      </div>

      {/* Riwayat Absensi Table */}
      <Card className="overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-800">
            Log Riwayat Kehadiran Per Mata Pelajaran
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Catatan presensi per sesi mata pelajaran yang diinput oleh para guru
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="divide-y divide-slate-100">
            {riwayatData.riwayat.map((log) => (
              <div key={log.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm">
                      {new Date(log.tanggal).toLocaleDateString("id-ID")}
                    </span>
                    {log.mataPelajaran && (
                      <span className="text-xs font-bold text-yellow-700 bg-yellow-50 px-2.5 py-0.5 rounded-md border border-yellow-200">
                        {log.mataPelajaran}
                      </span>
                    )}
                  </div>
                  {log.periode && (
                    <div className="text-xs text-slate-500">{log.periode}</div>
                  )}
                  {log.keterangan && <div className="text-xs text-slate-400 italic">{log.keterangan}</div>}
                </div>
                <StatusBadge status={log.status as "HADIR" | "IZIN" | "SAKIT" | "ALPHA"} />
              </div>
            ))}
          </div>

          <ListPagination
            page={riwayatData.page}
            pageSize={riwayatData.pageSize}
            total={riwayatData.total}
            totalPages={riwayatData.totalPages}
            onPageChange={setPage}
            loading={loading}
            itemLabel="catatan"
            className="border-t border-slate-100"
          />
        </CardContent>
      </Card>
    </div>
  )
}
