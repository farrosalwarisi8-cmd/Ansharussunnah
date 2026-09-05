"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarCheck2,
  Award,
  FileCheck2,
  CreditCard,
  GraduationCap,
  Users,
  Loader2,
} from "lucide-react"
import { useDashboard, type ChildStudent } from "@/components/dashboard/dashboard-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmptyState } from "@/components/ui/empty-state"
import { getRangkumanOrangTuaHome, type RangkumanSiswa } from "@/actions/dashboard"

function ChildCardGrid({ childList, onSelect }: { childList: ChildStudent[]; onSelect: (c: ChildStudent) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-500 text-white shadow-lg mb-2">
          <Users className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-800">Pilih Santri yang Ingin Dipantau</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Anda memiliki {childList.length} santri terdaftar. Pilih salah satu untuk melihat data akademiknya.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {childList.map((child) => (
          <button
            key={child.id}
            onClick={() => onSelect(child)}
            className="group text-left"
          >
            <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm hover:shadow-md hover:border-yellow-300 transition-all cursor-pointer group-hover:scale-[1.02]">
              <CardContent className="p-5 flex flex-col items-center text-center space-y-3">
                <Avatar className="h-16 w-16 border-2 border-yellow-200 ring-4 ring-yellow-50 group-hover:ring-yellow-100 transition-all">
                  <AvatarImage src={child.avatar || ""} />
                  <AvatarFallback className="bg-yellow-500 text-white font-bold text-lg">
                    {child.nama
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </AvatarFallback>
                </Avatar>

                <div className="space-y-1">
                  <div className="text-base font-bold text-slate-800 group-hover:text-yellow-700 transition-colors">
                    {child.nama}
                  </div>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                    <GraduationCap className="h-3.5 w-3.5 text-yellow-500" />
                    <span>{child.jenjangNama} — {child.kelasNama}</span>
                  </div>
                  {child.nisn && (
                    <div className="text-[11px] text-slate-400 font-mono">NISN: {child.nisn}</div>
                  )}
                </div>

                <div className="w-full pt-2 border-t border-slate-100 group-hover:border-yellow-100 transition-colors">
                  <span className="text-xs font-semibold text-yellow-600 group-hover:text-yellow-700">
                    Lihat Data &rarr;
                  </span>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  )
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID")
}

function ChildStatsDashboard({ selectedChild }: { selectedChild: ChildStudent }) {
  const childName = selectedChild.nama
  const childClass = `${selectedChild.jenjangNama} - ${selectedChild.kelasNama}`

  const [data, setData] = React.useState<RangkumanSiswa | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const result = await getRangkumanOrangTuaHome(selectedChild.id)
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
  }, [selectedChild.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        <span className="ml-3 text-sm text-slate-500">Memuat data {childName.split(" ")[0]}...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Kehadiran Santri</span>
              <CalendarCheck2 className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-2">
              {data?.kehadiranPersen ?? "-"}%
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              {data ? `${data.hadir} hadir dari ${data.totalAbsensi} absensi` : "Bulan ini"}
            </span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Tugas Santri</span>
              <FileCheck2 className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-2">
              {data?.tugasBelumDikirim ?? "-"}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              {data && data.tugasBelumDikirim > 0
                ? "tugas belum dikumpulkan"
                : "semua tugas dikumpulkan"}
            </span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Rata-rata Nilai Ujian</span>
              <Award className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-700 mt-2">
              {data?.rataRataNilai ?? "-"}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              dari ujian yang sudah dinilai
            </span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Tagihan SPP</span>
              <CreditCard className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-2">
              {data?.spp?.status || "Belum Ada"}
            </div>
            <span className="text-xs text-yellow-500 mt-1 block font-medium">
              {data?.spp ? formatRupiah(data.spp.nominal) : "Bulan berjalan"}
            </span>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <EmptyState
          title="Gagal Memuat Data"
          description={error || "Terjadi kesalahan."}
        />
      ) : (
        <>
          {/* Two Column Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
              <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-800">
                    Perkembangan Belajar {childName.split(" ")[0]}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">{childClass}</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="text-xs text-yellow-600">
                  <Link href="/dashboard/rapor">Buka Rapor</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-5 space-y-3.5">
                {data && data.daftarNilai.length > 0 ? (
                  data.daftarNilai.map((n) => (
                    <div key={n.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-800 text-sm">{n.mapel}</div>
                        <div className="text-xs text-slate-500">{n.judul}</div>
                      </div>
                      <div className="text-base font-extrabold text-yellow-600 bg-white px-3 py-1.5 rounded-xl border border-yellow-100 shadow-sm shrink-0">
                        {n.nilai}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-sm text-slate-400">
                    Belum ada ujian yang dinilai untuk santri ini.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
              <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-800">
                    Administrasi &amp; SPP
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">Status kewajiban SPP santri</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="text-xs text-yellow-600">
                  <Link href="/dashboard/tagihan">Riwayat SPP</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="p-4 rounded-2xl bg-yellow-50 border border-yellow-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-yellow-700">
                      {data?.spp?.namaTagihan || "SPP Bulan Ini"}
                    </span>
                    <div className="text-base font-extrabold text-yellow-800">
                      {data?.spp ? formatRupiah(data.spp.nominal) : "-"}
                    </div>
                  </div>
                  <StatusBadge
                    status={
                      data?.spp?.status === "Lunas"
                        ? "SUDAH_BAYAR"
                        : data?.spp?.status === "Menunggu Verifikasi"
                          ? "MENUNGGU_VERIFIKASI"
                          : data?.spp?.status === "Sebagian"
                            ? "DIBAYAR_SEBAGIAN"
                            : "BELUM_BAYAR"
                    }
                  />
                </div>

                <Button asChild className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-xl min-h-[44px]">
                  <Link href="/dashboard/tagihan">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Lihat Tagihan &amp; Upload Bukti Transfer
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

export function OrangTuaDashboardHome({ selectedChild }: { selectedChild: ChildStudent | null }) {
  const { user, setSelectedChild } = useDashboard()
  const children = user.children || []

  // Belum pilih anak → tampilkan card grid
  if (!selectedChild) {
    return <ChildCardGrid childList={children} onSelect={setSelectedChild} />
  }

  // Sudah pilih → tampilkan statistik
  return <ChildStatsDashboard selectedChild={selectedChild} />
}