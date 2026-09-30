// src/components/dashboard/role-homes/guru-home.tsx

"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  Award,
  CalendarCheck2,
  CheckCircle2,
  FileCheck2,
  Plus,
  Sparkles,
  Users2,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/ui/stat-card"
import { DashboardHeader } from "../dashboard-header"
import { getRangkumanGuruHome, type RangkumanGuru } from "@/actions/dashboard"

function GuruSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat ringkasan data Guru…</span>
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
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-32" />
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

function ExamRow({ item }: { item: { mapel: string; kelas: string; judul: string; status: string } }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="soft-info" size="sm">
            {item.mapel}
          </Badge>
          <span className="text-xs text-slate-500">{item.kelas}</span>
        </div>
        <p className="truncate text-sm font-semibold text-slate-800">{item.judul}</p>
      </div>
      <StatusBadge status={item.status as "DRAFT" | "AKTIF" | "SELESAI" | "PUBLISHED"} />
    </div>
  )
}

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

  const tugasPerluDinilai = data?.daftarTugas.filter((t) => t.pending > 0) ?? []
  const antreanDinilai = tugasPerluDinilai.reduce((total, t) => total + t.pending, 0)
  const adaAntreanUjian = (data?.ujianPerluDinilai ?? 0) > 0
  const statItems: Array<{
    label: string
    value: string
    icon: LucideIcon
    tone: "gold" | "slate" | "success" | "warning" | "info"
    href: string
    hint: string
  }> = data
    ? [
        {
          label: "Kelas Diampu",
          value: `${data.jumlahKelas} kelas`,
          icon: Users2,
          tone: "gold",
          href: "/dashboard/kelas",
          hint: `Total ${data.jumlahSantri} Santri`,
        },
        {
          label: "Tugas Perlu Dinilai",
          value: `${data.tugasPerluDinilai} tugas`,
          icon: FileCheck2,
          tone: data.tugasPerluDinilai > 0 ? "warning" : "success",
          href: "/dashboard/tugas",
          hint:
            antreanDinilai > 0 ? `${antreanDinilai} pengumpulan menunggu` : "Semua sudah dinilai",
        },
        {
          label: "Ujian Aktif",
          value: `${data.ujianAktif} ujian`,
          icon: Award,
          tone: data.ujianAktif > 0 ? "info" : "slate",
          href: "/dashboard/ujian",
          hint: "Sedang berlangsung",
        },
        {
          label: "Esai Menunggu Koreksi",
          value: `${data.ujianPerluDinilai} sesi`,
          icon: CalendarCheck2,
          tone: adaAntreanUjian ? "warning" : "success",
          href: "/dashboard/ujian",
          hint: adaAntreanUjian ? "Menunggu koreksi esai" : "Tidak ada antrean",
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Dashboard Guru"
        subtitle="Kelola absensi, tugas, dan penilaian untuk kelas yang Anda ampu."
        icon={CheckCircle2}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/dashboard/absensi">
                <CalendarCheck2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Absensi Cepat
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/dashboard/ujian/buat">
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Buat Ujian
              </Link>
            </Button>
          </div>
        }
      />

      {error ? (
        <EmptyState
          variant="error"
          icon={AlertCircle}
          title="Gagal Memuat Rangkuman"
          description={error}
        />
      ) : loading ? (
        <GuruSkeleton />
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            {statItems.map((item) => (
              <StatCard
                key={item.label}
                label={item.label}
                value={item.value}
                icon={item.icon}
                tone={item.tone}
                href={item.href}
                hint={item.hint}
              />
            ))}
          </div>

          {/* Ajakan aksi */}
          <div className="batik-dark relative overflow-hidden rounded-3xl p-5 text-white shadow-lifted sm:p-6">
            <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="min-w-0 space-y-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-600/60 px-2.5 py-1 text-xs font-semibold text-yellow-100">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Aksi Cepat Guru
                </span>
                <h2 className="text-lg font-bold sm:text-xl">Isi Absensi Kelas Hari Ini</h2>
                <p className="max-w-xl text-xs leading-relaxed text-yellow-100/85 sm:text-sm">
                  Pastikan seluruh kehadiran santri tercatat tepat waktu untuk laporan harian wali
                  santri.
                </p>
              </div>
              <Button
                asChild
                variant="soft"
                className="w-full shrink-0 border border-yellow-300/40 bg-yellow-400 text-slate-900 hover:bg-yellow-300 sm:w-auto"
              >
                <Link href="/dashboard/absensi">
                  <CalendarCheck2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Buka Absensi Cepat
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Tugas menunggu penilaian */}
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <CardTitle>Tugas Memerlukan Penilaian</CardTitle>
                  <CardDescription>
                    Pengumpulan tugas santri yang belum dinilai
                  </CardDescription>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href="/dashboard/tugas">Lihat Semua</Link>
                </Button>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100">
                {tugasPerluDinilai.length > 0 ? (
                  tugasPerluDinilai.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="soft-gold" size="sm">
                            {item.mapel}
                          </Badge>
                          <span className="text-xs text-slate-500">{item.kelas}</span>
                        </div>
                        <p className="truncate text-sm font-semibold text-slate-800">{item.judul}</p>
                      </div>
                      <Badge variant="soft-warning" className="shrink-0 tabular">
                        {item.pending} belum dinilai
                      </Badge>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    className="mt-1 border-slate-200 bg-slate-50/50 py-8"
                    icon={CheckCircle2}
                    title="Semua tugas sudah dinilai"
                    description="Tidak ada pengumpulan tugas yang menunggu penilaian saat ini."
                    actionLabel="Buat Tugas Baru"
                    actionHref="/dashboard/tugas/buat"
                  />
                )}
              </CardContent>
            </Card>

            {/* Daftar ujian */}
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <CardTitle>Daftar Ujian</CardTitle>
                  <CardDescription>Ujian di kelas yang Anda ampu</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href="/dashboard/ujian">Kelola Ujian</Link>
                </Button>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100">
                {data && data.daftarUjian.length > 0 ? (
                  data.daftarUjian.map((item) => (
                    <ExamRow key={item.id} item={item} />
                  ))
                ) : (
                  <EmptyState
                    className="mt-1 border-slate-200 bg-slate-50/50 py-8"
                    icon={Award}
                    title="Belum ada ujian"
                    description="Buat ujian pertama Anda untuk kelas yang diampu."
                    actionLabel="Buat Ujian"
                    actionHref="/dashboard/ujian/buat"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
