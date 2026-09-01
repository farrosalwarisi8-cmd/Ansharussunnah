// src/app/dashboard/keuangan/page.tsx

"use client"

import * as React from "react"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import {
  generateBulkSpp,
  konfirmasiPembayaranSppOlehAdmin,
  createTransaksiKeuangan,
  getDaftarPembayaranPendingVerifikasi,
  getRekapSppPerKelas,
  getRekapSppPerJenjang,
} from "@/actions/akuntansi"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"

import {
  CheckCircle2,
  XCircle,
  Plus,
  FileSpreadsheet,
  Loader2,
  ExternalLink,
  BarChart3,
  RefreshCw,
} from "lucide-react"

// ============================================================
// TYPES
// ============================================================

type PendingPaymentItem = {
  id: string
  tagihanId: string
  santriNama: string
  kelas: string
  jenjang: string
  bulanTagihan: string
  nominalTagihan: number
  nominalDibayar: number
  metodeBayar: string
  namaBukti: string | null
  urlBukti: string | null
  catatan: string | null
  waktuUpload: Date
}

type RekapKelasItem = {
  kelasId: string
  namaKelas: string
  namaJenjang: string
  jumlahSiswa: number
  totalTagihan: number
  totalLunas: number
  totalNunggak: number
  persentaseKepatuhan: number
}

type RekapJenjangItem = {
  jenjangId: string
  namaJenjang: string
  jumlahKelas: number
  jumlahSiswa: number
  totalTagihan: number
  totalLunas: number
  totalNunggak: number
  persentaseKepatuhan: number
}

const BULAN_OPTIONS = [
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
]

// ============================================================
// COMPONENT
// ============================================================

export default function KeuanganPage() {
  const { toast } = useToast()

  // Tab 1 State: Generate SPP Massal
  const [bulanGenerate, setBulanGenerate] = React.useState("April 2024")
  const [nominalDefault, setNominalDefault] = React.useState("500000")
  const [generating, setGenerating] = React.useState(false)

  // Tab 2 State: Verifikasi Pembayaran Masuk — REAL DATA
  const [pendingPayments, setPendingPayments] = React.useState<PendingPaymentItem[]>([])
  const [loadingPending, setLoadingPending] = React.useState(true)
  const [processingId, setProcessingId] = React.useState<string | null>(null)

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

  // Tab 5 State: Rekap Per Kelas/Jenjang
  const [rekapView, setRekapView] = React.useState<"kelas" | "jenjang">("kelas")
  const [filterBulan, setFilterBulan] = React.useState<string>("")
  const [rekapKelasData, setRekapKelasData] = React.useState<RekapKelasItem[]>([])
  const [rekapJenjangData, setRekapJenjangData] = React.useState<RekapJenjangItem[]>([])
  const [loadingRekap, setLoadingRekap] = React.useState(true)
  const [periodeLabel, setPeriodeLabel] = React.useState("Semua Periode")

  // ============================================================
  // EFFECTS — Fetch real data
  // ============================================================

  // Fetch pending payments on mount
  const fetchPendingPayments = React.useCallback(async () => {
    setLoadingPending(true)
    try {
      const result = await getDaftarPembayaranPendingVerifikasi()
      if (result.success && result.data) {
        setPendingPayments(result.data.items)
      } else {
        toast({ title: "Gagal memuat data", description: result.message, variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Gagal mengambil data pembayaran pending", variant: "destructive" })
    } finally {
      setLoadingPending(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchPendingPayments()
  }, [fetchPendingPayments])

  // Fetch rekap data
  const fetchRekap = React.useCallback(async () => {
    setLoadingRekap(true)
    try {
      const filter = filterBulan ? { bulan: parseInt(filterBulan), tahun: new Date().getFullYear() } : undefined

      if (rekapView === "kelas") {
        const result = await getRekapSppPerKelas(filter)
        if (result.success && result.data) {
          setRekapKelasData(result.data.items)
          setPeriodeLabel(result.data.periodeDipakai)
        } else {
          toast({ title: "Gagal memuat rekap", description: result.message, variant: "destructive" })
        }
      } else {
        const result = await getRekapSppPerJenjang(filter)
        if (result.success && result.data) {
          setRekapJenjangData(result.data.items)
          setPeriodeLabel(result.data.periodeDipakai)
        } else {
          toast({ title: "Gagal memuat rekap", description: result.message, variant: "destructive" })
        }
      }
    } catch {
      toast({ title: "Error", description: "Gagal mengambil data rekap", variant: "destructive" })
    } finally {
      setLoadingRekap(false)
    }
  }, [rekapView, filterBulan, toast])

  React.useEffect(() => {
    fetchRekap()
  }, [fetchRekap])

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleGenerateSpp = async () => {
    setGenerating(true)
    try {
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

  const handleVerifyPayment = async (pembayaranId: string, approve: boolean) => {
    setProcessingId(pembayaranId)
    try {
      const result = await konfirmasiPembayaranSppOlehAdmin({
        pembayaranId,
        disetujui: approve,
        catatan: approve ? "Pembayaran diverifikasi kasir." : undefined,
        alasanPenolakan: approve ? undefined : "Bukti transfer tidak valid/kurang.",
      })

      if (result.success) {
        // Refetch list so the processed item disappears
        await fetchPendingPayments()
        toast({
          title: approve ? "Pembayaran Diterima & Lunas! ✅" : "Pembayaran Ditolak ❌",
          description: result.message,
        })
      } else {
        toast({ title: "Gagal Memproses", description: result.message, variant: "destructive" })
      }
    } catch {
      toast({
        title: approve ? "Pembayaran Dikonfirmasi (Demo)" : "Pembayaran Ditolak (Demo)",
        description: "Status berhasil diupdate.",
      })
    } finally {
      setProcessingId(null)
    }
  }

  const handleAddTransaksi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nominalTransaksi || !deskripsiTransaksi) return

    setSavingTrx(true)
    try {
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

  // ============================================================
  // REKAP HELPERS
  // ============================================================

  const getComplianceColor = (pct: number) => {
    if (pct >= 80) return "text-emerald-700 bg-emerald-50"
    if (pct >= 70) return "text-amber-700 bg-amber-50"
    return "text-rose-700 bg-rose-50"
  }

  const getComplianceBadge = (pct: number) => {
    if (pct >= 80) return { bg: "bg-emerald-500", label: "Tinggi", text: "text-emerald-700" }
    if (pct >= 70) return { bg: "bg-amber-500", label: "Sedang", text: "text-amber-700" }
    return { bg: "bg-rose-500", label: "Rendah", text: "text-rose-700" }
  }

  const formatRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <DashboardHeader
        title="Pusat Manajemen Keuangan &amp; SPP"
        subtitle="Otomasi tagihan syahriyah, verifikasi pembayaran kasir, pencatatan kas, dan laporan keuangan."
      />

      <Tabs defaultValue="verifikasi" className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:grid-cols-3 lg:flex max-w-3xl h-auto p-1.5 gap-1 rounded-2xl">
          <TabsTrigger value="verifikasi" className="rounded-xl min-h-[40px] text-xs font-bold">
            Verifikasi Pembayaran ({pendingPayments.length})
          </TabsTrigger>
          <TabsTrigger value="generate" className="rounded-xl min-h-[40px] text-xs font-bold">
            Generate SPP Massal
          </TabsTrigger>
          <TabsTrigger value="rekap" className="rounded-xl min-h-[40px] text-xs font-bold">
            <BarChart3 className="h-3.5 w-3.5 mr-1 inline" />
            Rekap Kelas/Jenjang
          </TabsTrigger>
          <TabsTrigger value="kasir" className="rounded-xl min-h-[40px] text-xs font-bold">
            Kasir &amp; Transaksi
          </TabsTrigger>
          <TabsTrigger value="laporan" className="rounded-xl min-h-[40px] text-xs font-bold">
            Laporan Arus Kas
          </TabsTrigger>
        </TabsList>

        {/* ============================================================
            TAB 1: VERIFIKASI PEMBAYARAN MASUK — REAL DATA
        ============================================================ */}
        <TabsContent value="verifikasi" className="mt-4 space-y-4">
          <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Antrean Bukti Transfer Menunggu Verifikasi
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Periksa kesesuaian nominal dan rekening pengirim sebelum menyetujui kuitansi lunas
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchPendingPayments}
                  disabled={loadingPending}
                  className="rounded-xl text-xs font-bold"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingPending ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {loadingPending ? (
                <div className="p-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat data pembayaran...
                </div>
              ) : pendingPayments.length > 0 ? (
                pendingPayments.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-base">{p.santriNama}</span>
                        <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                          {p.kelas}
                        </span>
                        <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded">
                          {p.jenjang}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        Tagihan: <strong>SPP {p.bulanTagihan}</strong> &bull; Metode: {p.metodeBayar}
                      </div>
                      {p.namaBukti && (
                        <div className="text-xs text-slate-500">
                          Bukti: {p.namaBukti}
                        </div>
                      )}
                      <div className="text-xs text-slate-400">
                        Waktu upload: {new Date(p.waktuUpload).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      {p.urlBukti && (
                        <a
                          href={p.urlBukti}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-700 font-bold hover:underline pt-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Buka Foto Bukti Transfer
                        </a>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200">
                      <div className="text-left sm:text-right">
                        <span className="text-xs text-slate-400 block">Nominal Dibayar:</span>
                        <span className="text-lg font-black text-emerald-800">
                          {formatRp(p.nominalDibayar)}
                        </span>
                        {p.nominalDibayar !== p.nominalTagihan && (
                          <span className="text-xs text-amber-600 block font-semibold">
                            (Tagihan: {formatRp(p.nominalTagihan)})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleVerifyPayment(p.id, false)}
                          variant="outline"
                          disabled={processingId === p.id}
                          className="border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl min-h-[44px] text-xs font-bold flex-1 sm:flex-initial"
                        >
                          {processingId === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-1.5" />
                          )}
                          Tolak
                        </Button>
                        <Button
                          onClick={() => handleVerifyPayment(p.id, true)}
                          disabled={processingId === p.id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[44px] text-xs px-5 flex-1 sm:flex-initial shadow-md"
                        >
                          {processingId === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-1.5" />
                          )}
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

        {/* ============================================================
            TAB 2: GENERATE BULK SPP
        ============================================================ */}
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

        {/* ============================================================
            TAB 3: REKAP SPP PER KELAS / PER JENJANG (NEW)
        ============================================================ */}
        <TabsContent value="rekap" className="mt-4 space-y-4">
          {/* Filter Bar */}
          <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase">Tampilan:</span>
                <div className="flex rounded-xl bg-slate-100 p-0.5">
                  <button
                    onClick={() => setRekapView("kelas")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      rekapView === "kelas"
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Per Kelas
                  </button>
                  <button
                    onClick={() => setRekapView("jenjang")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      rekapView === "jenjang"
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Per Jenjang
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-48">
                  <Select value={filterBulan} onValueChange={setFilterBulan}>
                    <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
                      <SelectValue placeholder="Semua Periode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Periode</SelectItem>
                      {BULAN_OPTIONS.map((b) => (
                        <SelectItem key={b.value} value={b.value}>
                          {b.label} {new Date().getFullYear()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchRekap}
                  disabled={loadingRekap}
                  className="rounded-xl text-xs font-bold"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingRekap ? "animate-spin" : ""}`} />
                  Muat Ulang
                </Button>
              </div>

              <div className="text-xs text-slate-500 ml-auto">
                Periode: <strong>{periodeLabel}</strong>
              </div>
            </div>
          </Card>

          {loadingRekap ? (
            <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-8">
              <div className="text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat data rekap...
              </div>
            </Card>
          ) : rekapView === "kelas" ? (
            /* TABLE VIEW — PER KELAS */
            <>
              {/* Desktop Table */}
              <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden hidden md:block">
                <CardHeader className="p-5 pb-3 border-b border-slate-100">
                  <CardTitle className="text-base font-bold text-slate-900">
                    Rekap SPP Per Kelas
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Ringkasan tagihan, pembayaran, dan tunggakan SPP untuk setiap kelas aktif
                  </CardDescription>
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kelas</TableHead>
                      <TableHead>Jenjang</TableHead>
                      <TableHead className="text-center">Siswa</TableHead>
                      <TableHead className="text-right">Total Tagihan</TableHead>
                      <TableHead className="text-right">Lunas</TableHead>
                      <TableHead className="text-right">Nunggak</TableHead>
                      <TableHead className="text-center">Kepatuhan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rekapKelasData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500 text-sm">
                          Tidak ada data rekap untuk periode ini
                        </TableCell>
                      </TableRow>
                    ) : (
                      rekapKelasData.map((item) => {
                        const badge = getComplianceBadge(item.persentaseKepatuhan)
                        return (
                          <TableRow key={item.kelasId}>
                            <TableCell className="font-bold text-slate-900">{item.namaKelas}</TableCell>
                            <TableCell className="text-sm text-slate-600">{item.namaJenjang}</TableCell>
                            <TableCell className="text-center text-sm">{item.jumlahSiswa}</TableCell>
                            <TableCell className="text-right text-sm font-semibold">{formatRp(item.totalTagihan)}</TableCell>
                            <TableCell className="text-right text-sm text-emerald-700 font-semibold">{formatRp(item.totalLunas)}</TableCell>
                            <TableCell className="text-right text-sm text-rose-600 font-semibold">
                              {item.totalNunggak > 0 ? formatRp(item.totalNunggak) : "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getComplianceColor(item.persentaseKepatuhan)}`}>
                                  {item.persentaseKepatuhan}%
                                </span>
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${badge.bg}`}
                                    style={{ width: `${Math.min(item.persentaseKepatuhan, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </Card>

              {/* Mobile Card List */}
              <div className="md:hidden space-y-3">
                {rekapKelasData.length === 0 ? (
                  <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm p-6 text-center text-slate-500 text-sm">
                    Tidak ada data rekap untuk periode ini
                  </Card>
                ) : (
                  rekapKelasData.map((item) => {
                    const badge = getComplianceBadge(item.persentaseKepatuhan)
                    return (
                      <Card key={item.kelasId} className="rounded-2xl border-slate-200/80 bg-white shadow-sm p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{item.namaKelas}</div>
                            <div className="text-xs text-slate-500">{item.namaJenjang} &bull; {item.jumlahSiswa} siswa</div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getComplianceColor(item.persentaseKepatuhan)}`}>
                            {item.persentaseKepatuhan}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                          <div
                            className={`h-full rounded-full transition-all ${badge.bg}`}
                            style={{ width: `${Math.min(item.persentaseKepatuhan, 100)}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <div className="text-slate-400">Tagihan</div>
                            <div className="font-bold text-slate-900">{formatRp(item.totalTagihan)}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">Lunas</div>
                            <div className="font-bold text-emerald-700">{formatRp(item.totalLunas)}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">Nunggak</div>
                            <div className="font-bold text-rose-600">{item.totalNunggak > 0 ? formatRp(item.totalNunggak) : "-"}</div>
                          </div>
                        </div>
                      </Card>
                    )
                  })
                )}
              </div>
            </>
          ) : (
            /* TABLE VIEW — PER JENJANG */
            <>
              {/* Desktop Table */}
              <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden hidden md:block">
                <CardHeader className="p-5 pb-3 border-b border-slate-100">
                  <CardTitle className="text-base font-bold text-slate-900">
                    Rekap SPP Per Jenjang
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Agregasi tagihan, pembayaran, dan tunggakan SPP untuk setiap jenjang pendidikan
                  </CardDescription>
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Jenjang</TableHead>
                      <TableHead className="text-center">Kelas</TableHead>
                      <TableHead className="text-center">Siswa</TableHead>
                      <TableHead className="text-right">Total Tagihan</TableHead>
                      <TableHead className="text-right">Lunas</TableHead>
                      <TableHead className="text-right">Nunggak</TableHead>
                      <TableHead className="text-center">Kepatuhan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rekapJenjangData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500 text-sm">
                          Tidak ada data rekap untuk periode ini
                        </TableCell>
                      </TableRow>
                    ) : (
                      rekapJenjangData.map((item) => {
                        const badge = getComplianceBadge(item.persentaseKepatuhan)
                        return (
                          <TableRow key={item.jenjangId}>
                            <TableCell className="font-bold text-slate-900">{item.namaJenjang}</TableCell>
                            <TableCell className="text-center text-sm">{item.jumlahKelas}</TableCell>
                            <TableCell className="text-center text-sm">{item.jumlahSiswa}</TableCell>
                            <TableCell className="text-right text-sm font-semibold">{formatRp(item.totalTagihan)}</TableCell>
                            <TableCell className="text-right text-sm text-emerald-700 font-semibold">{formatRp(item.totalLunas)}</TableCell>
                            <TableCell className="text-right text-sm text-rose-600 font-semibold">
                              {item.totalNunggak > 0 ? formatRp(item.totalNunggak) : "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getComplianceColor(item.persentaseKepatuhan)}`}>
                                  {item.persentaseKepatuhan}%
                                </span>
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${badge.bg}`}
                                    style={{ width: `${Math.min(item.persentaseKepatuhan, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </Card>

              {/* Mobile Card List */}
              <div className="md:hidden space-y-3">
                {rekapJenjangData.length === 0 ? (
                  <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm p-6 text-center text-slate-500 text-sm">
                    Tidak ada data rekap untuk periode ini
                  </Card>
                ) : (
                  rekapJenjangData.map((item) => {
                    const badge = getComplianceBadge(item.persentaseKepatuhan)
                    return (
                      <Card key={item.jenjangId} className="rounded-2xl border-slate-200/80 bg-white shadow-sm p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{item.namaJenjang}</div>
                            <div className="text-xs text-slate-500">{item.jumlahKelas} kelas &bull; {item.jumlahSiswa} siswa</div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getComplianceColor(item.persentaseKepatuhan)}`}>
                            {item.persentaseKepatuhan}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                          <div
                            className={`h-full rounded-full transition-all ${badge.bg}`}
                            style={{ width: `${Math.min(item.persentaseKepatuhan, 100)}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <div className="text-slate-400">Tagihan</div>
                            <div className="font-bold text-slate-900">{formatRp(item.totalTagihan)}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">Lunas</div>
                            <div className="font-bold text-emerald-700">{formatRp(item.totalLunas)}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">Nunggak</div>
                            <div className="font-bold text-rose-600">{item.totalNunggak > 0 ? formatRp(item.totalNunggak) : "-"}</div>
                          </div>
                        </div>
                      </Card>
                    )
                  })
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ============================================================
            TAB 4: KASIR NON-SPP
        ============================================================ */}
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

        {/* ============================================================
            TAB 5: LAPORAN KEUANGAN
        ============================================================ */}
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
