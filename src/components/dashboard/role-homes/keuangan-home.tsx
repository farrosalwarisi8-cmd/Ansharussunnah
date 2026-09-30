// src/components/dashboard/role-homes/keuangan-home.tsx

"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarClock,
  DollarSign,
  Eye,
  Receipt,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { StatCard } from "@/components/ui/stat-card"
import { GroupedBarChart, type BarChartDatum } from "@/components/ui/bar-chart"
import { DashboardHeader } from "../dashboard-header"
import { getRangkumanKeuanganHome, type RangkumanKeuangan } from "@/actions/dashboard"
import { getLaporanKeuangan, getRekapTunggakanSpp } from "@/actions/akuntansi"
import type { ActionResponse } from "@/types"

function formatRupiah(nilai: number): string {
  return `Rp ${nilai.toLocaleString("id-ID")}`
}

/** Format ringkas untuk sumbu grafik (mis. "Rp 12,5 jt"). */
function formatRupiahRingkas(nilai: number): string {
  if (Math.abs(nilai) < 1000) return `Rp ${nilai.toLocaleString("id-ID")}`
  return `Rp ${new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(nilai)}`
}

type LaporanBulanan = {
  ringkasan: { totalPemasukan: number; totalPengeluaran: number }
}

type RekapTunggakanBulanan = {
  ringkasan: {
    totalNominalTunggakanMurni: number
    totalSisaDibayarSebagian: number
  }
}

interface DataGrafik {
  kas: BarChartDatum[]
  tunggakan: BarChartDatum[]
}

/** 6 bulan terakhir (termasuk bulan berjalan), paling kiri = paling lama. */
function daftarBulanTerkini(): { label: string; bulan: number; tahun: number }[] {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat("id-ID", { month: "short" })
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      label: formatter.format(d),
      bulan: d.getMonth() + 1,
      tahun: d.getFullYear(),
    }
  })
}

const ACTION_CARDS = [
  {
    title: "Kelola Transaksi & Generate SPP",
    description:
      "Catat pemasukan, buat tagihan bulanan, dan pantau arus kas operasional sekolah.",
    href: "/dashboard/keuangan",
    icon: Banknote,
    tone: "border-yellow-200 bg-gradient-to-br from-yellow-50 to-white hover:border-yellow-300",
    cta: "Buka Keuangan",
  },
  {
    title: "Verifikasi Pendaftaran Baru",
    description:
      "Periksa berkas pendaftar, atur biaya PPDB, dan aktifkan akun wali setelah disetujui.",
    href: "/dashboard/verifikasi-pendaftaran",
    icon: Eye,
    tone: "border-slate-200 bg-white hover:border-slate-300",
    cta: "Buka Verifikasi",
  },
] as const

export function KeuanganDashboardHome() {
  const [data, setData] = React.useState<RangkumanKeuangan | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [grafik, setGrafik] = React.useState<DataGrafik | null>(null)
  const [grafikLoading, setGrafikLoading] = React.useState(true)
  const [grafikError, setGrafikError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    async function fetchData() {
      try {
        const result = await getRangkumanKeuanganHome()
        if (!mounted) return
        if (result.success && result.data) {
          setData(result.data)
        } else {
          setError(result.message || "Gagal memuat rangkuman keuangan")
        }
      } catch {
        if (mounted) setError("Gagal memuat rangkuman keuangan")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchData()
    return () => {
      mounted = false
    }
  }, [])

  // Grafik arus kas & tunggakan — 6 bulan terakhir, diambil sekali saat
  // halaman dibuka. Semua pemanggilan hanya-read dan berjalan paralel.
  React.useEffect(() => {
    let mounted = true

    async function fetchGrafik() {
      const bulan = daftarBulanTerkini()
      const hasil = await Promise.allSettled(
        bulan.map(async (b) => {
          const mulai = new Date(b.tahun, b.bulan - 1, 1)
          const selesai = new Date(b.tahun, b.bulan, 0)
          const [laporan, tunggakan] = await Promise.all([
            getLaporanKeuangan({
              tanggalMulai: mulai.toISOString(),
              tanggalSelesai: selesai.toISOString(),
            }) as Promise<ActionResponse<LaporanBulanan>>,
            getRekapTunggakanSpp(undefined, b.bulan, b.tahun) as Promise<
              ActionResponse<RekapTunggakanBulanan>
            >,
          ])
          return { b, laporan, tunggakan }
        })
      )

      if (!mounted) return

      const gagal = hasil.some(
        (h) => h.status === "rejected" ||
          (h.status === "fulfilled" &&
            (!h.value.laporan.success || !h.value.tunggakan.success))
      )

      if (gagal) {
        setGrafikError("Grafik tidak dapat dimuat. Ringkasan angka di atas tetap akurat.")
        setGrafikLoading(false)
        return
      }

      const kas: BarChartDatum[] = []
      const tunggakan: BarChartDatum[] = []

      hasil.forEach((h) => {
        if (h.status !== "fulfilled") return
        const { b, laporan, tunggakan: rekap } = h.value
        kas.push({
          label: b.label,
          values: [
            Number(laporan.data?.ringkasan.totalPemasukan || 0),
            Number(laporan.data?.ringkasan.totalPengeluaran || 0),
          ],
        })
        const ringkasan = rekap.data?.ringkasan
        tunggakan.push({
          label: b.label,
          values: [
            Number(ringkasan?.totalNominalTunggakanMurni || 0) +
              Number(ringkasan?.totalSisaDibayarSebagian || 0),
          ],
        })
      })

      setGrafik({ kas, tunggakan })
      setGrafikLoading(false)
    }

    fetchGrafik()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Ringkasan Keuangan"
        subtitle="Pantau penerimaan SPP, tunggakan, dan verifikasi bukti pembayaran dalam satu layar."
        icon={Wallet}
      />

      {error ? (
        <AlertState message={error} />
      ) : (
        <>
          {/* Ringkasan angka */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <StatCard
              label="Penerimaan SPP Bulan Ini"
              value={data ? formatRupiah(data.penerimaanBulanIni) : "—"}
              icon={DollarSign}
              tone="gold"
              loading={loading}
              href={loading ? undefined : "/dashboard/keuangan"}
              hint={
                data
                  ? `${data.santriSudahBayar} dari ${data.santriDitagihBulanIni} Santri`
                  : undefined
              }
            />
            <StatCard
              label="Total Tunggakan"
              value={data ? formatRupiah(data.totalTunggakan) : "—"}
              icon={CalendarClock}
              tone={data && data.totalTunggakan > 0 ? "danger" : "success"}
              loading={loading}
              href={loading ? undefined : "/dashboard/tagihan"}
              hint={data ? `${data.santriMenunggak} Santri tertunda` : undefined}
            />
            <StatCard
              label="Verifikasi Bukti"
              value={data ? `${data.pembayaranPending} pembayaran` : "—"}
              icon={BadgeCheck}
              tone={data && data.pembayaranPending > 0 ? "warning" : "success"}
              loading={loading}
              hint={data?.pembayaranPending ? "Menunggu review kasir" : "Tidak ada antrean review"}
            />
            <StatCard
              label="Saldo Kas Operasional"
              value={data ? formatRupiah(data.saldoKas) : "—"}
              icon={Wallet}
              tone="slate"
              loading={loading}
              hint="Aktif per hari ini"
            />
          </div>

          {/* Grafik arus kas & tunggakan */}
          <Card>
            <CardHeader>
              <CardTitle>Grafik Keuangan</CardTitle>
              <CardDescription>
                Tren pemasukan, pengeluaran, dan tunggakan SPP selama 6 bulan
                terakhir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {grafikLoading ? (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="space-y-3">
                      <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                      <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : grafikError ? (
                <EmptyState
                  variant="error"
                  icon={AlertCircle}
                  title="Grafik Gagal Dimuat"
                  description={grafikError}
                />
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-800">
                      Pemasukan &amp; Pengeluaran
                    </p>
                    <GroupedBarChart
                      ariaLabel="Grafik pemasukan dan pengeluaran per bulan selama 6 bulan terakhir"
                      data={grafik?.kas ?? []}
                      series={[
                        { name: "Pemasukan", colorClass: "bg-yellow-500" },
                        { name: "Pengeluaran", colorClass: "bg-rose-400" },
                      ]}
                      formatValue={formatRupiahRingkas}
                      emptyText="Belum ada transaksi pada periode ini."
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-800">
                      Tunggakan SPP
                    </p>
                    <GroupedBarChart
                      ariaLabel="Grafik total tunggakan SPP per bulan selama 6 bulan terakhir"
                      data={grafik?.tunggakan ?? []}
                      series={[{ name: "Tunggakan", colorClass: "bg-amber-500" }]}
                      formatValue={formatRupiah}
                      emptyText="Tidak ada tunggakan pada periode ini."
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Aksi utama */}
          <Card>
            <CardHeader>
              <CardTitle>Aksi Cepat</CardTitle>
              <CardDescription>
                Alur yang paling sering dipakai Admin Keuangan setiap hari.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ACTION_CARDS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex flex-col gap-3 rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-5 ${item.tone}`}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-yellow-200 bg-white text-yellow-700 shadow-sm">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                      {item.description}
                    </span>
                  </span>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-700">
                    {item.cta}
                    <ArrowRight
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Catatan perhitungan angka */}
          {!loading && data && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  Catatan Pembayaran
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <li className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
                    Bukti pembayaran yang diunggah wali diverifikasi di halaman keuangan sebelum
                    ditandai lunas.
                  </li>
                  <li className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    Tunggakan dihitung dari tagihan berstatus belum lunas pada periode aktif.
                  </li>
                </ul>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/dashboard/daftar-siswa">
                    Lihat Daftar Siswa
                    <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function AlertState({ message }: { message: string }) {
  return (
    <EmptyState
      variant="error"
      icon={AlertCircle}
      title="Gagal Memuat Ringkasan"
      description={message}
    />
  )
}
