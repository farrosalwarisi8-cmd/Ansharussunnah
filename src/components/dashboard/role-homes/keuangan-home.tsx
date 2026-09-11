"use client"

import * as React from "react"
import Link from "next/link"
import { DollarSign, Eye, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { getRangkumanKeuanganHome, type RangkumanKeuangan } from "@/actions/dashboard"

function formatRupiah(nilai: number): string {
  return `Rp ${nilai.toLocaleString("id-ID")}`
}

export function KeuanganDashboardHome() {
  const [data, setData] = React.useState<RangkumanKeuangan | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        <span className="ml-3 text-sm text-slate-500">Memuat rangkuman keuangan...</span>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Penerimaan SPP Bulan Ini</span>
            <div className="text-xl sm:text-2xl font-extrabold text-yellow-600 mt-2">
              {formatRupiah(data.penerimaanBulanIni)}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              {data.santriSudahBayar} dari {data.santriDitagihBulanIni} Santri
            </span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Tunggakan</span>
            <div className="text-xl sm:text-2xl font-extrabold text-rose-600 mt-2">
              {formatRupiah(data.totalTunggakan)}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              {data.santriMenunggak} Santri tertunda
            </span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verifikasi Bukti</span>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-2">
              {data.pembayaranPending} Pembayaran
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Menunggu review kasir</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo Kas Operasional</span>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-2">
              {formatRupiah(data.saldoKas)}
            </div>
            <span className="text-xs text-yellow-500 mt-1 block font-medium">Aktif per hari ini</span>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[44px]">
          <Link href="/dashboard/keuangan">
            <DollarSign className="h-4 w-4 mr-1.5" />
            Kelola Transaksi &amp; Generate SPP
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-xl min-h-[44px]">
          <Link href="/dashboard/verifikasi-pendaftaran">
            <Eye className="h-4 w-4 mr-1.5" />
            Verifikasi Pendaftaran Baru
          </Link>
        </Button>
      </div>
    </div>
  )
}