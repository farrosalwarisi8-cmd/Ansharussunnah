// src/components/dashboard/role-homes/orang-tua-home.tsx

"use client"

import * as React from "react"
import Link from "next/link"
import {
  Award,
  CalendarCheck2,
  CreditCard,
  FileCheck2,
  GraduationCap,
  Receipt,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react"
import { useDashboard, type ChildStudent } from "@/components/dashboard/dashboard-context"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/ui/stat-card"
import { DashboardHeader } from "../dashboard-header"
import { getRangkumanOrangTuaHome, type RangkumanSiswa } from "@/actions/dashboard"

function initials(nama: string): string {
  return (
    nama
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID")
}

function ChildCardGrid({
  childList,
  onSelect,
}: {
  childList: ChildStudent[]
  onSelect: (c: ChildStudent) => void
}) {
  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Pilih Santri"
        subtitle={`Anda memiliki ${childList.length} santri terdaftar. Pilih salah satu untuk melihat data akademiknya.`}
        icon={Users}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {childList.map((child) => (
          <button
            key={child.id}
            onClick={() => onSelect(child)}
            className="group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-2xl"
            aria-label={`Lihat data ${child.nama}`}
          >
            <Card className="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-yellow-300 group-hover:shadow-soft">
              <CardContent className="flex h-full flex-col items-center gap-3 p-5 text-center">
                <Avatar className="h-16 w-16 border-2 border-yellow-200 ring-4 ring-yellow-50 transition-all group-hover:ring-yellow-100">
                  <AvatarImage src={child.avatar || ""} alt="" />
                  <AvatarFallback className="bg-yellow-500 text-lg font-bold text-white">
                    {initials(child.nama)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 space-y-1">
                  <p className="truncate text-base font-bold text-slate-800 transition-colors group-hover:text-yellow-700">
                    {child.nama}
                  </p>
                  <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                    <GraduationCap className="h-3.5 w-3.5 text-yellow-500" aria-hidden="true" />
                    {child.jenjangNama} — {child.kelasNama}
                  </p>
                  {child.nisn && (
                    <p className="font-mono text-[11px] text-slate-400">NISN: {child.nisn}</p>
                  )}
                </div>

                <div className="mt-auto w-full border-t border-slate-100 pt-3 transition-colors group-hover:border-yellow-100">
                  <span className="text-xs font-semibold text-yellow-600 transition-colors group-hover:text-yellow-700">
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

function ChildSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat data aluno…</span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
            <Skeleton className="mt-3 h-3 w-28" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ChildStatsDashboard({ selectedChild }: { selectedChild: ChildStudent }) {
  const childName = selectedChild.nama
  const firstName = childName.split(" ")[0]
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

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={`Pantau ${firstName}`}
        subtitle={`${childName} • ${childClass}`}
        icon={UserRound}
        action={
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard/berkas">
              <Receipt className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Berkas Santri
            </Link>
          </Button>
        }
      />

      {loading ? (
        <ChildSkeleton />
      ) : error ? (
        <EmptyState
          variant="error"
          title="Gagal Memuat Data"
          description={error || "Terjadi kesalahan saat memuat data."}
        />
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <StatCard
              label="Kehadiran Santri"
              value={`${data?.kehadiranPersen ?? "-"}%`}
              icon={CalendarCheck2}
              tone="gold"
              href="/dashboard/absensi"
              hint={
                data ? `${data.hadir} hadir dari ${data.totalAbsensi} absensi` : "Bulan ini"
              }
            />
            <StatCard
              label="Tugas Belum Dikumpulkan"
              value={data?.tugasBelumDikirim ?? "-"}
              icon={FileCheck2}
              tone={data && data.tugasBelumDikirim > 0 ? "warning" : "success"}
              href="/dashboard/tugas"
              hint={
                data && data.tugasBelumDikirim > 0
                  ? "tugas belum dikumpulkan"
                  : "semua tugas dikumpulkan"
              }
            />
            <StatCard
              label="Rata-rata Nilai Ujian"
              value={data?.rataRataNilai ?? "-"}
              icon={Award}
              tone="info"
              href="/dashboard/ujian"
              hint="dari ujian yang sudah dinilai"
            />
            <StatCard
              label="Tagihan SPP"
              value={data?.spp?.status || "Belum Ada"}
              icon={CreditCard}
              tone={data?.spp?.status === "Lunas" ? "success" : "warning"}
              href="/dashboard/tagihan"
              hint={data?.spp ? formatRupiah(data.spp.nominal) : "Bulan berjalan"}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Perkembangan belajar */}
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-500" aria-hidden="true" />
                    Perkembangan Belajar {firstName}
                  </CardTitle>
                  <CardDescription>{childClass}</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href="/dashboard/rapor">Buka Rapor</Link>
                </Button>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100">
                {data && data.daftarNilai.length > 0 ? (
                  data.daftarNilai.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-sm font-semibold text-slate-800">{n.mapel}</p>
                        <p className="truncate text-xs text-slate-500">{n.judul}</p>
                      </div>
                      <span className="tabular shrink-0 rounded-xl border border-yellow-100 bg-yellow-50 px-3 py-1.5 text-base font-extrabold text-yellow-700">
                        {n.nilai}
                      </span>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    className="mt-1 border-slate-200 bg-slate-50/50 py-8"
                    icon={Award}
                    title="Belum ada nilai"
                    description="Nilai ujian yang sudah dinilai guru akan tampil di sini."
                    actionLabel="Buka Rapor"
                    actionHref="/dashboard/rapor"
                  />
                )}
              </CardContent>
            </Card>

            {/* Administrasi & SPP */}
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    Administrasi &amp; SPP
                  </CardTitle>
                  <CardDescription>Status kewajiban SPP {firstName}</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href="/dashboard/tagihan">Riwayat SPP</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-yellow-200/80 bg-yellow-50 p-4">
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold text-yellow-700">
                      {data?.spp?.namaTagihan || "SPP Bulan Ini"}
                    </span>
                    <span className="tabular block text-base font-extrabold text-yellow-800">
                      {data?.spp ? formatRupiah(data.spp.nominal) : "-"}
                    </span>
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

                <Button asChild className="w-full">
                  <Link href="/dashboard/tagihan">
                    <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />
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

export function OrangTuaDashboardHome({
  selectedChild,
}: {
  selectedChild: ChildStudent | null
}) {
  const { user, setSelectedChild } = useDashboard()
  const children = user.children || []

  if (children.length === 0) {
    return (
      <div className="space-y-6">
        <DashboardHeader
          title="Dashboard Wali"
          subtitle="Belum ada santri yang terhubung dengan akun Anda."
          icon={UserRound}
        />
        <EmptyState
          icon={Users}
          title="Belum ada data Santri"
          description="Hubungi admin sekolah untuk menghubungkan akun wali dengan data Santri."
        />
      </div>
    )
  }

  // Belum pilih anak -> tampilkan grid pilihan.
  if (!selectedChild) {
    return <ChildCardGrid childList={children} onSelect={setSelectedChild} />
  }

  // Sudah pilih -> tampilkan ringkasan monitoring.
  return <ChildStatsDashboard selectedChild={selectedChild} />
}
