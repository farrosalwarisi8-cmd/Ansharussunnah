// src/components/dashboard/role-homes/admin-home.tsx

"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  Award,
  CalendarCheck2,
  CreditCard,
  FileCheck2,
  GraduationCap,
  Layers,
  School,
  ShieldCheck,
  Sparkles,
  Users2,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { StatCard } from "@/components/ui/stat-card"
import { DashboardHeader } from "../dashboard-header"
import { getRangkumanAdminHome, type RangkumanAdmin } from "@/actions/dashboard"
import { getPendaftaranList } from "@/actions/verifikasi"
import type { StatusPendaftaran } from "@prisma/client"

/**
 * Rincian status pendaftar + kelengkapan berkasnya. Dihitung di client dari
 * `getPendaftaranList` (action yang sudah ada) — tanpa menambah action baru.
 */
interface RincianPendaftar {
  menungguPembayaran: number
  menungguVerifikasi: number
  diterima: number
  ditolak: number
  berkasBelumLengkap: number
  berkasDiperiksa: number
}

const QUICK_ACTIONS: Array<{
  title: string
  description: string
  href: string
  icon: LucideIcon
  primary?: boolean
}> = [
  {
    title: "Verifikasi Pendaftar",
    description: "Periksa berkas & aktifkan akun wali",
    href: "/dashboard/verifikasi-pendaftaran",
    icon: FileCheck2,
    primary: true,
  },
  {
    title: "Kelola Akun Guru",
    description: "Tambah, edit, dan atur akun pengajar",
    href: "/dashboard/guru",
    icon: Users2,
    primary: true,
  },
  {
    title: "Kelola Kelas",
    description: "Atur jenjang, tingkat, dan wali kelas",
    href: "/dashboard/kelas",
    icon: Layers,
  },
  {
    title: "Absensi Santri",
    description: "Pantau kehadiran harian siswa",
    href: "/dashboard/absensi",
    icon: CalendarCheck2,
  },
  {
    title: "Mata Pelajaran",
    description: "Kelola daftar mapel dan jenjang",
    href: "/dashboard/mapel",
    icon: School,
  },
  {
    title: "Kenaikan Kelas",
    description: "Proses kenaikan kelas akhir tahun",
    href: "/dashboard/kenaikan-kelas",
    icon: GraduationCap,
  },
]

export function AdminDashboardHome() {
  const [data, setData] = React.useState<RangkumanAdmin | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [pendaftar, setPendaftar] = React.useState<RincianPendaftar | null>(null)
  const [loadingPendaftar, setLoadingPendaftar] = React.useState(true)

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

  // Rincian status pendaftar — 4 pemanggilan paralel (read-only) ke action
  // getPendaftaranList yang sudah ada. Dua status menunggu diambil beserta
  // barisnya supaya kelengkapan berkas bisa dihitung tanpa action baru.
  React.useEffect(() => {
    let mounted = true

    async function fetchPendaftar() {
      try {
        const BATAS_BARIS = 100
        const [bayar, verifikasi, diterima, ditolak] = await Promise.all([
          getPendaftaranList({
            status: "MENUNGGU_PEMBAYARAN" as StatusPendaftaran,
            limit: BATAS_BARIS,
          }),
          getPendaftaranList({
            status: "MENUNGGU_VERIFIKASI" as StatusPendaftaran,
            limit: BATAS_BARIS,
          }),
          getPendaftaranList({
            status: "DITERIMA" as StatusPendaftaran,
            limit: 1,
          }),
          getPendaftaranList({
            status: "DITOLAK" as StatusPendaftaran,
            limit: 1,
          }),
        ])

        if (!mounted) return
        if (!bayar.success || !verifikasi.success || !diterima.success || !ditolak.success) {
          setLoadingPendaftar(false)
          return
        }

        const barisMenunggu = [
          ...(bayar.data?.items ?? []),
          ...(verifikasi.data?.items ?? []),
        ]
        const belumLengkap = barisMenunggu.filter(
          (p) => !p.dokKartuKeluarga || !p.dokAkteLahir || !p.dokFoto
        ).length

        setPendaftar({
          menungguPembayaran: bayar.data?.total ?? 0,
          menungguVerifikasi: verifikasi.data?.total ?? 0,
          diterima: diterima.data?.total ?? 0,
          ditolak: ditolak.data?.total ?? 0,
          berkasBelumLengkap: belumLengkap,
          berkasDiperiksa: barisMenunggu.length,
        })
      } catch {
        // Gagal memuat rincian tidak boleh menjatuhkan seluruh dashboard.
      } finally {
        if (mounted) setLoadingPendaftar(false)
      }
    }

    fetchPendaftar()
    return () => {
      mounted = false
    }
  }, [])

  const perluPerhatian = data
    ? [
        {
          label: "Esai Ujian Menunggu Nilai",
          value: data.ujianPerluDinilai,
          suffix: "sesi",
          hint: `${data.jumlahMapel} mapel aktif terdaftar`,
          href: "/dashboard/ujian",
          tone: "warning" as const,
          icon: Award,
        },
        {
          label: "Tugas Perlu Dinilai",
          value: data.tugasPerluDinilai,
          suffix: "pengumpulan",
          hint: "Di seluruh kelas",
          href: "/dashboard/tugas",
          tone: "info" as const,
          icon: FileCheck2,
        },
        {
          label: "Tagihan Belum Bayar",
          value: data.tagihanBelumBayar,
          suffix: "tagihan",
          hint: "Belum bayar / terlambat",
          href: "/dashboard/tagihan",
          tone: "danger" as const,
          icon: CreditCard,
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Dashboard Admin"
        subtitle="Ringkasan data sekolah: data master, penilaian, dan pendaftaran dalam satu tampilan."
        icon={ShieldCheck}
      />

      {error ? (
        <EmptyState
          variant="error"
          icon={AlertCircle}
          title="Gagal Memuat Ringkuman"
          description={error}
        />
      ) : (
        <>
          {/* KPI utama */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <StatCard
              label="Total Santri Aktif"
              value={data ? `${data.jumlahSantri} Santri` : "—"}
              icon={GraduationCap}
              tone="gold"
              loading={loading}
              href={loading ? undefined : "/dashboard/siswa"}
            />
            <StatCard
              label="Total Guru"
              value={data ? `${data.jumlahGuru} Ustadz/ah` : "—"}
              icon={Users2}
              tone="slate"
              loading={loading}
              href={loading ? undefined : "/dashboard/guru"}
            />
            <StatCard
              label="Pendaftar Menunggu"
              value={data ? `${data.pendaftarMenunggu} calon` : "—"}
              icon={FileCheck2}
              tone={data && data.pendaftarMenunggu > 0 ? "warning" : "success"}
              loading={loading}
              href={loading ? undefined : "/dashboard/verifikasi-pendaftaran"}
              hint={data?.pendaftarMenunggu ? "Perlu verifikasi berkas" : "Semua berkas beres"}
            />
            <StatCard
              label="Total Kelas"
              value={data ? `${data.jumlahKelas} rombel` : "—"}
              icon={Layers}
              tone="info"
              loading={loading}
              href={loading ? undefined : "/dashboard/kelas"}
            />
          </div>

          {/* Rincian status pendaftar */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  Rincian Status Pendaftar
                </CardTitle>
                <CardDescription>
                  Jumlah calon siswa per status dan kelengkapan berkasnya
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href="/dashboard/verifikasi-pendaftaran">
                  Kelola
                  <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingPendaftar ? (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : pendaftar ? (
                <>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {(
                      [
                        {
                          status: "MENUNGGU_PEMBAYARAN",
                          label: "Menunggu Pembayaran",
                          value: pendaftar.menungguPembayaran,
                        },
                        {
                          status: "MENUNGGU_VERIFIKASI",
                          label: "Menunggu Verifikasi",
                          value: pendaftar.menungguVerifikasi,
                        },
                        {
                          status: "DITERIMA",
                          label: "Diterima",
                          value: pendaftar.diterima,
                        },
                        {
                          status: "DITOLAK",
                          label: "Ditolak",
                          value: pendaftar.ditolak,
                        },
                      ] as const
                    ).map((item) => (
                      <Link
                        key={item.status}
                        href="/dashboard/verifikasi-pendaftaran"
                        className="group rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-yellow-300 hover:bg-yellow-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
                      >
                        <StatusBadge status={item.status} size="sm" />
                        <p className="mt-2 text-2xl font-bold leading-none text-slate-900">
                          {item.value}
                        </p>
                        <p className="mt-1.5 text-xs leading-snug text-slate-500">
                          {item.label}
                        </p>
                      </Link>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:flex-row sm:items-center">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-white text-amber-600">
                      <FileCheck2 className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">
                        Berkas belum lengkap: {pendaftar.berkasBelumLengkap} pendaftar
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                        Dihitung dari {pendaftar.berkasDiperiksa} pendaftar yang sedang
                        menunggu (KK, akta lahir, atau pas foto belum lengkap).
                      </p>
                    </div>
                    <Button asChild size="sm" className="shrink-0">
                      <Link href="/dashboard/verifikasi-pendaftaran">
                        Periksa Berkas
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  Rincian pendaftar tidak dapat dimuat.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Perlu perhatian */}
          {perluPerhatian.length > 0 && (
            <section aria-labelledby="perlu-perhatian-judul">
              <h2
                id="perlu-perhatian-judul"
                className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500"
              >
                <Sparkles className="h-4 w-4 text-yellow-500" aria-hidden="true" />
                Perlu Perhatian
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                {perluPerhatian.map((item) => (
                  <StatCard
                    key={item.label}
                    label={item.label}
                    value={`${item.value} ${item.suffix}`}
                    icon={item.icon}
                    tone={item.tone}
                    loading={loading}
                    href={loading ? undefined : item.href}
                    hint={item.hint}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Ujian terbaru */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  Ujian Terbaru
                </CardTitle>
                <CardDescription>
                  Monitoring aktivitas penilaian guru di seluruh kelas
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href="/dashboard/ujian">
                  Kelola Ujian
                  <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100">
              {data && data.daftarUjian.length > 0 ? (
                data.daftarUjian.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="soft-gold" size="sm">
                          {item.mapel}
                        </Badge>
                        <span className="text-xs text-slate-500">{item.kelas}</span>
                      </div>
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {item.judul}
                      </p>
                    </div>
                    <StatusBadge
                      status={item.status as "DRAFT" | "AKTIF" | "SELESAI" | "PUBLISHED"}
                    />
                  </div>
                ))
              ) : (
                <EmptyState
                  className="mt-1 border-slate-200 bg-slate-50/50 py-8"
                  icon={Award}
                  title="Belum ada ujian"
                  description="Ujian yang dibuat guru akan tampil di sini untuk dipantau."
                  actionLabel="Ke halaman ujian"
                  actionHref="/dashboard/ujian"
                />
              )}
            </CardContent>
          </Card>

          {/* Aksi cepat */}
          <Card>
            <CardHeader>
              <CardTitle>Aksi Cepat</CardTitle>
              <CardDescription>Menu yang paling sering dibuka setiap hari.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {QUICK_ACTIONS.map((action) => (
                <Button
                  key={action.href}
                  asChild
                  variant={action.primary ? "default" : "outline"}
                  className="h-auto min-h-[60px] justify-start gap-3 py-3 text-left"
                >
                  <Link href={action.href} className="flex w-full items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        action.primary
                          ? "bg-white/20 text-white"
                          : "bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      <action.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {action.title}
                      </span>
                      <span
                        className={`block truncate text-[11px] font-normal ${
                          action.primary ? "text-white/80" : "text-slate-500"
                        }`}
                      >
                        {action.description}
                      </span>
                    </span>
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
