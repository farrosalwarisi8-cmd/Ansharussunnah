"use client"

import Link from "next/link"
import { DollarSign, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function KeuanganDashboardHome() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Penerimaan SPP Bulan Ini</span>
            <div className="text-xl sm:text-2xl font-extrabold text-yellow-600 mt-2">Rp 48.500.000</div>
            <span className="text-xs text-slate-500 mt-1 block">97 dari 120 Santri</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Tunggakan</span>
            <div className="text-xl sm:text-2xl font-extrabold text-rose-600 mt-2">Rp 11.500.000</div>
            <span className="text-xs text-slate-500 mt-1 block">23 Santri tertunda</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verifikasi Bukti</span>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-2">5 Pembayaran</div>
            <span className="text-xs text-slate-500 mt-1 block">Menunggu review kasir</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo Kas Operasional</span>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-2">Rp 142.800.000</div>
            <span className="text-xs text-yellow-500 mt-1 block font-medium">+8.2% bulan lalu</span>
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
