// src/components/dashboard/role-homes/siswa-home.tsx

"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  Award,
  CalendarCheck2,
  Clock,
  CreditCard,
  FileCheck2,
  GraduationCap,
  Sparkles,
} from "lucide-react"
import { type DashboardUser } from "@/components/dashboard/dashboard-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/ui/stat-card"
import { DashboardHeader } from "../dashboard-header"
import { getRangkumanSiswaHome, type RangkumanSiswa } from "@/actions/dashboard"

const MOTIVASI = "Tetap Semangat Menuntut Ilmu"

function formatDeadline(iso: string): string {
  const d = new Date(iso)
  const diff = d.getTime() - Date.now()
  const jam = Math.ceil(diff / (1000 * 60 * 60))
  if (jam <= 0) return "Deadline sudah lewat"
  if (jam < 24) return `Deadline ${jam} jam lagi`
  return `Deadline ${d.toLocaleDateString("id-ID")}`
}

function SiswaSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat ringkasan data Santri…</span>
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
              <Skeleton className="h-4 w-36" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
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

  const firstName = user.nama.split(" ")[0]

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={`Assalamu'alaikum, ${firstName}!`}
        subtitle="Pantau tugas, ujian, kehadiran, dan status SPP kamu dalam satu layar."
        icon={GraduationCap}
        action={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/ujian">
              <Award className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Kerjakan Ujian
            </Link>
          </Button>
        }
      />

      {/* Banner motivasi — identitas Anshorussunnah */}
      <div className="batik-dark relative overflow-hidden rounded-3xl p-5 text-white shadow-lifted sm:p-7">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-yellow-200">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {user.kelas
                ? `${user.kelas.jenjang?.nama} - ${user.kelas.nama}`
                : "Santri Anshorussunnah"}
            </span>
            <h2 className="text-lg font-black leading-tight sm:text-2xl">
              {MOTIVASI}!
            </h2>
            <p className="max-w-xl text-xs leading-relaxed text-yellow-100/90 sm:text-sm">
              &ldquo;Barangsiapa menempuh jalan untuk menuntut ilmu, Allah mudahkan jalannya
              menuju Surga.&rdquo; (HR. Muslim)
            </p>
          </div>
          <Button
            asChild
            variant="soft"
            className="w-full shrink-0 border border-yellow-300/40 bg-yellow-400 text-slate-900 hover:bg-yellow-300 sm:w-auto"
          >
            <Link href="/dashboard/materi">
              <FileCheck2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Buka Materi Belajar
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <SiswaSkeleton />
      ) : error || !data ? (
        <EmptyState
          variant="error"
          icon={AlertCircle}
          title="Gagal Memuat Ringkuman"
          description={error || "Data tidak tersedia."}
        />
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <StatCard
              label="Tugas Belum Dikirim"
              value={`${data.tugasBelumDikirim} tugas`}
              icon={FileCheck2}
              tone={data.tugasBelumDikirim > 0 ? "warning" : "success"}
              href="/dashboard/tugas"
              hint={
                data.daftarTugas[0]
                  ? formatDeadline(data.daftarTugas[0].deadline)
                  : "Semua tugas sudah dikumpulkan"
              }
            />
            <StatCard
              label="Ujian Menunggu"
              value={`${data.ujianTersedia} ujian`}
              icon={Award}
              tone={data.ujianTersedia > 0 ? "gold" : "slate"}
              href="/dashboard/ujian"
              hint={data.daftarUjianTersedia[0]?.mapel || "Tidak ada ujian aktif"}
            />
            <StatCard
              label="Kehadiran Bulan Ini"
              value={`${data.kehadiranPersen}%`}
              icon={CalendarCheck2}
              tone={
                data.kehadiranPersen >= 90
                  ? "success"
                  : data.kehadiranPersen >= 75
                    ? "warning"
                    : "danger"
              }
              href="/dashboard/absensi"
              hint={`${data.hadir} hadir dari ${data.totalAbsensi} absensi`}
            />
            <StatCard
              label="Status SPP"
              value={data.spp?.status || "Belum Ada"}
              icon={CreditCard}
              tone={data.spp?.status === "Lunas" ? "success" : "warning"}
              href="/dashboard/tagihan"
              hint={
                data.spp
                  ? data.spp.namaTagihan
                  : `SPP ${new Date().toLocaleDateString("id-ID", { month: "long" })}`
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Tugas mendatang */}
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle>Tugas Mendatang</CardTitle>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href="/dashboard/tugas">Buka Tugas</Link>
                </Button>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100">
                {data.daftarTugas.length > 0 ? (
                  data.daftarTugas.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 space-y-1">
                        <Badge variant="soft-gold" size="sm">
                          {t.mapel}
                        </Badge>
                        <p className="truncate text-sm font-semibold text-slate-800">{t.judul}</p>
                        <p className="text-xs text-slate-500">{formatDeadline(t.deadline)}</p>
                      </div>
                      <Button asChild size="sm" className="shrink-0">
                        <Link href="/dashboard/tugas">Kirim</Link>
                      </Button>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    className="mt-1 border-slate-200 bg-slate-50/50 py-8"
                    icon={FileCheck2}
                    title="Tidak ada tugas menunggu"
                    description="Semua tugas kamu sudah dikumpulkan. Tetap semangat!"
                  />
                )}
              </CardContent>
            </Card>

            {/* Ujian tersedia */}
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle>Ujian Tersedia</CardTitle>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href="/dashboard/ujian">Semua Ujian</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.daftarUjianTersedia.length > 0 ? (
                  data.daftarUjianTersedia.slice(0, 3).map((u) => (
                    <div
                      key={u.id}
                      className="space-y-3 rounded-2xl border border-yellow-200/60 bg-yellow-50/60 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="soft-gold">{u.mapel}</Badge>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {u.durasiMenit} menit
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{u.judul}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {u.totalSoal} butir soal
                        </p>
                      </div>
                      <Button asChild className="w-full">
                        <Link href={`/dashboard/ujian/${u.id}/kerjakan`}>Mulai Ujian Sekarang</Link>
                      </Button>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    className="mt-1 border-slate-200 bg-slate-50/50 py-8"
                    icon={Award}
                    title="Tidak ada ujian berlangsung"
                    description="Ujian yang sedang aktif akan tampil di sini beserta durasinya."
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Nilai ujian terbaru */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <CardTitle>Nilai Ujian Terbaru</CardTitle>
                <CardDescription>Rata-rata: {data.rataRataNilai ?? "-"}</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href="/dashboard/rapor">Buka Rapor</Link>
              </Button>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100">
              {data.daftarNilai.length > 0 ? (
                data.daftarNilai.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-semibold text-slate-500">{n.mapel}</p>
                      <p className="truncate text-sm font-semibold text-slate-800">{n.judul}</p>
                    </div>
                    <span className="tabular shrink-0 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-1 text-lg font-extrabold text-yellow-700">
                      {n.nilai}
                    </span>
                  </div>
                ))
              ) : (
                <EmptyState
                  className="mt-1 border-slate-200 bg-slate-50/50 py-8"
                  icon={Award}
                  title="Belum ada nilai ujian"
                  description="Nilai akan muncul setelah ujian kamu dinilai oleh pengajar."
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
