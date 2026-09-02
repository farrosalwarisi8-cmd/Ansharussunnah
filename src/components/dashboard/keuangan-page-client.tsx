"use client"

import dynamic from "next/dynamic"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { BarChart3 } from "lucide-react"

// Dynamic import memecah bundle per tab. SSR aktif agar konten langsung tampil.
const VerifikasiPembayaranTab = dynamic(
  () => import("@/components/dashboard/keuangan-verifikasi-tab").then((m) => m.VerifikasiPembayaranTab)
)
const GenerateSppTab = dynamic(
  () => import("@/components/dashboard/keuangan-generate-tab").then((m) => m.GenerateSppTab)
)
const RekapTab = dynamic(
  () => import("@/components/dashboard/keuangan-rekap-tab").then((m) => m.RekapTab)
)
const KasirTab = dynamic(
  () => import("@/components/dashboard/keuangan-kasir-tab").then((m) => m.KasirTab)
)
const LaporanTab = dynamic(
  () => import("@/components/dashboard/keuangan-laporan-tab").then((m) => m.LaporanTab)
)

export default function KeuanganPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <DashboardHeader
        title="Pusat Manajemen Keuangan &amp; SPP"
        subtitle="Otomasi tagihan syahriyah, verifikasi pembayaran kasir, pencatatan kas, dan laporan keuangan."
      />

      <Tabs defaultValue="verifikasi" className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:grid-cols-3 lg:flex max-w-3xl h-auto p-1.5 gap-1 rounded-2xl">
          <TabsTrigger value="verifikasi" className="rounded-xl min-h-[40px] text-xs font-bold">Verifikasi Pembayaran</TabsTrigger>
          <TabsTrigger value="generate" className="rounded-xl min-h-[40px] text-xs font-bold">Generate SPP Massal</TabsTrigger>
          <TabsTrigger value="rekap" className="rounded-xl min-h-[40px] text-xs font-bold">
            <BarChart3 className="h-3.5 w-3.5 mr-1 inline" /> Rekap Kelas/Jenjang
          </TabsTrigger>
          <TabsTrigger value="kasir" className="rounded-xl min-h-[40px] text-xs font-bold">Kasir &amp; Transaksi</TabsTrigger>
          <TabsTrigger value="laporan" className="rounded-xl min-h-[40px] text-xs font-bold">Laporan Arus Kas</TabsTrigger>
        </TabsList>

        <TabsContent value="verifikasi" className="mt-4 space-y-4">
          <VerifikasiPembayaranTab />
        </TabsContent>

        <TabsContent value="generate" className="mt-4">
          <GenerateSppTab />
        </TabsContent>

        <TabsContent value="rekap" className="mt-4 space-y-4">
          <RekapTab />
        </TabsContent>

        <TabsContent value="kasir" className="mt-4 space-y-6">
          <KasirTab />
        </TabsContent>

        <TabsContent value="laporan" className="mt-4 space-y-6">
          <LaporanTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
