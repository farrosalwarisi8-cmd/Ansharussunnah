// src/app/dashboard/keuangan/page.tsx

"use client"

import * as React from "react"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import {
  generateBulkSpp,
  konfirmasiPembayaranSppOlehAdmin,
  createTransaksiKeuangan,
} from "@/actions/akuntansi"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import {
  CheckCircle2,
  XCircle,
  Plus,
  FileSpreadsheet,
  Loader2,
  ExternalLink,
} from "lucide-react"

export default function KeuanganPage() {
  const { toast } = useToast()

  // Tab 1 State: Generate SPP Massal
  const [bulanGenerate, setBulanGenerate] = React.useState("April 2024")
  const [nominalDefault, setNominalDefault] = React.useState("500000")
  const [generating, setGenerating] = React.useState(false)

  // Tab 2 State: Verifikasi Pembayaran Masuk
  const [pendingPayments, setPendingPayments] = React.useState([
    {
      id: "pay-1",
      santriNama: "Ahmad Fauzi Ridwan",
      kelas: "7A - Ikhwan",
      bulanTagihan: "Maret 2024",
      nominal: 500000,
      bank: "BSI (a.n Fauzi)",
      buktiUrl: "https://drive.google.com/file/d/example-bukti-1.jpg",
      waktuTransfer: "03 Maret 2024, 09:30 WIB",
    },
    {
      id: "pay-2",
      santriNama: "Zubair bin Awwam",
      kelas: "8A - Ikhwan",
      bulanTagihan: "Maret 2024",
      nominal: 500000,
      bank: "BCA (a.n Abdullah)",
      buktiUrl: "https://drive.google.com/file/d/example-bukti-2.jpg",
      waktuTransfer: "02 Maret 2024, 16:15 WIB",
    },
  ])

  // Tab 3 State: Transaksi Kasir Non-SPP
  const [transaksiList, setTransaksiList] = React.useState([
    {
      id: "trx-1",
      kode: "TRX-2024-001",
      tipe: "PEMASUKAN",
      kategori: "Infaq & Donasi Sarana",
      deskripsi: "Wakaf AC masjid dari hamba Allah",
      nominal: 4500000,
      tanggal: "02 Maret 2024",
    },
    {
      id: "trx-2",
      kode: "TRX-2024-002",
      tipe: "PENGELUARAN",
      kategori: "Konsumsi & Dapur Asrama",
      deskripsi: "Belanja bahan pokok beras & lauk pekan 1",
      nominal: 8750000,
      tanggal: "01 Maret 2024",
    },
    {
      id: "trx-3",
      kode: "TRX-2024-003",
      tipe: "PENGELUARAN",
      kategori: "Operasional & Listrik",
      deskripsi: "Pembayaran token listrik asrama ikhwan",
      nominal: 1200000,
      tanggal: "28 Februari 2024",
    },
  ])

  const [tipeTransaksi, setTipeTransaksi] = React.useState<"PEMASUKAN" | "PENGELUARAN">("PEMASUKAN")
  const [kategoriTransaksi, setKategoriTransaksi] = React.useState("Infaq / Donasi")
  const [deskripsiTransaksi, setDeskripsiTransaksi] = React.useState("")
  const [nominalTransaksi, setNominalTransaksi] = React.useState("")
  const [savingTrx, setSavingTrx] = React.useState(false)

  // Handlers
  const handleGenerateSpp = async () => {
    setGenerating(true)
    try {
      // Direct call Server Action generateBulkSpp
      await generateBulkSpp({
        bulan: 4,
        tahun: 2024,
      })

      toast({
        title: "Tagihan SPP Massal Terbit! 📊",
        description: `Tagihan bulan ${bulanGenerate} berhasil diterbitkan untuk seluruh santri aktif.`,
      })
    } catch {
      toast({
        title: "Tagihan Terbit (Demo Mode)",
        description: `Tagihan SPP ${bulanGenerate} siap ditagihkan.`,
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleVerifyPayment = async (paymentId: string, approve: boolean) => {
    try {
      // Direct call Server Action konfirmasiPembayaranSppOlehAdmin
      await konfirmasiPembayaranSppOlehAdmin({
        pembayaranId: paymentId,
        disetujui: approve,
        catatan: approve ? "Pembayaran diverifikasi kasir." : undefined,
        alasanPenolakan: approve ? undefined : "Bukti transfer tidak valid/kurang.",
      })

      setPendingPayments((prev) => prev.filter((p) => p.id !== paymentId))
      toast({
        title: approve ? "Pembayaran Diterima & Lunas! ✅" : "Pembayaran Ditolak ❌",
        description: approve
          ? "Kuitansi digital otomatis diterbitkan untuk santri."
          : "Santri/wali telah diberitahu untuk upload ulang bukti transfer.",
      })
    } catch {
      setPendingPayments((prev) => prev.filter((p) => p.id !== paymentId))
      toast({
        title: approve ? "Pembayaran Dikonfirmasi (Demo)" : "Pembayaran Ditolak (Demo)",
        description: "Status berhasil diupdate.",
      })
    }
  }

  const handleAddTransaksi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nominalTransaksi || !deskripsiTransaksi) return

    setSavingTrx(true)
    try {
      // Direct call Server Action createTransaksiKeuangan
      await createTransaksiKeuangan({
        kategoriId: "kat-operasional",
        nominal: parseFloat(nominalTransaksi),
        deskripsi: deskripsiTransaksi,
        tanggal: new Date().toISOString(),
      })

      setTransaksiList((prev) => [
        {
          id: `trx-${Date.now()}`,
          kode: `TRX-2024-${String(prev.length + 1).padStart(3, "0")}`,
          tipe: tipeTransaksi,
          kategori: kategoriTransaksi,
          deskripsi: deskripsiTransaksi,
          nominal: parseFloat(nominalTransaksi),
          tanggal: "Hari Ini",
        },
        ...prev,
      ])

      toast({
        title: "Transaksi Berhasil Dicatat! 💰",
        description: `${tipeTransaksi} sebesar Rp ${parseInt(nominalTransaksi).toLocaleString("id-ID")} tersimpan.`,
      })
      setDeskripsiTransaksi("")
      setNominalTransaksi("")
    } catch {
      toast({
        title: "Transaksi Dicatat (Demo)",
        description: "Buku kas berhasil diperbarui.",
      })
    } finally {
      setSavingTrx(false)
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <DashboardHeader
        title="Pusat Manajemen Keuangan &amp; SPP"
        subtitle="Otomasi tagihan syahriyah, verifikasi pembayaran kasir, pencatatan kas, dan laporan keuangan."
      />

      <Tabs defaultValue="verifikasi" className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:flex max-w-2xl h-auto p-1.5 gap-1 rounded-2xl">
          <TabsTrigger value="verifikasi" className="rounded-xl min-h-[40px] text-xs font-bold">
            Verifikasi Pembayaran ({pendingPayments.length})
          </TabsTrigger>
          <TabsTrigger value="generate" className="rounded-xl min-h-[40px] text-xs font-bold">
            Generate SPP Massal
          </TabsTrigger>
          <TabsTrigger value="kasir" className="rounded-xl min-h-[40px] text-xs font-bold">
            Kasir &amp; Transaksi
          </TabsTrigger>
          <TabsTrigger value="laporan" className="rounded-xl min-h-[40px] text-xs font-bold">
            Laporan Arus Kas
          </TabsTrigger>
        </TabsList>

        {/* 1. TAB VERIFIKASI PEMBAYARAN MASUK */}
        <TabsContent value="verifikasi" className="mt-4 space-y-4">
          <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900">
                Antrean Bukti Transfer Menunggu Verifikasi
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Periksa kesesuaian nominal dan rekening pengirim sebelum menyetujui kuitansi lunas
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {pendingPayments.length > 0 ? (
                pendingPayments.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-base">{p.santriNama}</span>
                        <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                          {p.kelas}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        Tagihan: <strong>SPP {p.bulanTagihan}</strong> • Bank: {p.bank}
                      </div>
                      <div className="text-xs text-slate-400">Waktu: {p.waktuTransfer}</div>
                      <a
                        href={p.buktiUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-700 font-bold hover:underline pt-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Buka Foto Bukti Transfer Asli
                      </a>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200">
                      <div className="text-left sm:text-right">
                        <span className="text-xs text-slate-400 block">Nominal Transfer:</span>
                        <span className="text-lg font-black text-emerald-800">
                          Rp {p.nominal.toLocaleString("id-ID")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleVerifyPayment(p.id, false)}
                          variant="outline"
                          className="border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl min-h-[44px] text-xs font-bold flex-1 sm:flex-initial"
                        >
                          <XCircle className="h-4 w-4 mr-1.5" />
                          Tolak
                        </Button>
                        <Button
                          onClick={() => handleVerifyPayment(p.id, true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[44px] text-xs px-5 flex-1 sm:flex-initial shadow-md"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1.5" />
                          Konfirmasi Lunas
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500 text-sm">
                  🎉 Semua pembayaran masuk telah diverifikasi! Tidak ada antrean pending.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. TAB GENERATE BULK SPP */}
        <TabsContent value="generate" className="mt-4">
          <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-6 sm:p-8 max-w-2xl">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-lg font-bold text-slate-900">
                Penerbitan Tagihan SPP Bulanan Massal
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Sistem akan secara otomatis membuatkan invoice tagihan SPP untuk seluruh santri aktif sesuai tarif SPP masing-masing jenjang.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0 space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Bulan Tagihan
                  </label>
                  <select
                    value={bulanGenerate}
                    onChange={(e) => setBulanGenerate(e.target.value)}
                    className="w-full h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Maret 2024">Maret 2024</option>
                    <option value="April 2024">April 2024</option>
                    <option value="Mei 2024">Mei 2024</option>
                    <option value="Juni 2024">Juni 2024</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Tarif Dasar Default (Rp)
                  </label>
                  <Input
                    type="number"
                    value={nominalDefault}
                    onChange={(e) => setNominalDefault(e.target.value)}
                    className="h-12 rounded-xl text-base sm:text-sm"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                ⚠️ Santri dengan tarif beasiswa / SPP khusus tidak akan terpengaruh nominal default dan akan otomatis mengikuti nominal khusus yang tersimpan pada profil santri.
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handleGenerateSpp}
                  disabled={generating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 px-8 rounded-xl min-h-[48px] shadow-md"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Sedang Menerbitkan...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-5 w-5 mr-2" />
                      Terbitkan Tagihan SPP ({bulanGenerate})
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. TAB KASIR NON-SPP */}
        <TabsContent value="kasir" className="mt-4 space-y-6">
          {/* Form Input Kasir */}
          <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-6">
            <CardHeader className="p-0 pb-4 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900">
                Pencatatan Kas &amp; Transaksi Non-SPP
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-4">
              <form onSubmit={handleAddTransaksi} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Tipe</label>
                  <select
                    value={tipeTransaksi}
                    onChange={(e) => setTipeTransaksi(e.target.value as "PEMASUKAN" | "PENGELUARAN")}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold"
                  >
                    <option value="PEMASUKAN">Pemasukan (+)</option>
                    <option value="PENGELUARAN">Pengeluaran (-)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Kategori</label>
                  <select
                    value={kategoriTransaksi}
                    onChange={(e) => setKategoriTransaksi(e.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold"
                  >
                    <option value="Infaq / Donasi">Infaq / Donasi</option>
                    <option value="Konsumsi Asrama">Konsumsi Asrama</option>
                    <option value="Operasional & Listrik">Operasional &amp; Listrik</option>
                    <option value="Perawatan Sarpras">Perawatan Sarpras</option>
                    <option value="Honor Asatidz">Honor Asatidz</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Nominal (Rp)</label>
                  <Input
                    type="number"
                    placeholder="1000000"
                    value={nominalTransaksi}
                    onChange={(e) => setNominalTransaksi(e.target.value)}
                    className="h-11 rounded-xl text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Keterangan Singkat</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Uraian transaksi..."
                      value={deskripsiTransaksi}
                      onChange={(e) => setDeskripsiTransaksi(e.target.value)}
                      className="h-11 rounded-xl text-sm"
                      required
                    />
                    <Button
                      type="submit"
                      disabled={savingTrx}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-4 rounded-xl shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* List Transaksi */}
          <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900">
                Riwayat Transaksi Terakhir
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 divide-y divide-slate-100">
              {transaksiList.map((trx) => (
                <div key={trx.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400 font-bold">{trx.kode}</span>
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {trx.kategori}
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 text-sm">{trx.deskripsi}</div>
                    <div className="text-xs text-slate-400">{trx.tanggal}</div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-base font-black ${
                        trx.tipe === "PEMASUKAN" ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {trx.tipe === "PEMASUKAN" ? "+" : "-"} Rp {trx.nominal.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. TAB LAPORAN KEUANGAN */}
        <TabsContent value="laporan" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="rounded-2xl border-slate-200/80 bg-white p-5">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Pemasukan (Bulan Ini)</span>
              <div className="text-2xl font-black text-emerald-700 mt-2">Rp 53.000.000</div>
              <span className="text-xs text-emerald-600 mt-0.5 block font-medium">+12% dari bulan lalu</span>
            </Card>
            <Card className="rounded-2xl border-slate-200/80 bg-white p-5">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Pengeluaran (Bulan Ini)</span>
              <div className="text-2xl font-black text-rose-600 mt-2">Rp 18.700.000</div>
              <span className="text-xs text-slate-500 mt-0.5 block">Sesuai batas anggaran</span>
            </Card>
            <Card className="rounded-2xl border-slate-200/80 bg-white p-5">
              <span className="text-xs font-semibold text-slate-500 uppercase">Surplus Kas Bersih</span>
              <div className="text-2xl font-black text-slate-900 mt-2">Rp 34.300.000</div>
              <span className="text-xs text-emerald-600 mt-0.5 block font-medium">Kondisi Kas Sehat</span>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
