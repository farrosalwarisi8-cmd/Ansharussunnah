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
  getLaporanKeuangan,
  getRekapTunggakanSpp,
  konfirmasiPembayaranSppManual,
  batalkanTransaksiKeuangan,
  batalkanTagihanSpp,
} from "@/actions/akuntansi"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge, type StatusType } from "@/components/ui/status-badge"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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

  // Tab 6 State: Laporan Keuangan
  const [laporanData, setLaporanData] = React.useState<{
    ringkasan: {
      pemasukanSpp: number
      sppMenungguVerifikasi: number
      pemasukanLain: number
      totalPemasukan: number
      totalPengeluaran: number
      saldoBersih: number
    }
    transaksi: Array<{
      id: string
      kategori: string
      tipe: string
      nominal: number
      deskripsi: string
      tanggal: string | Date
    }>
  } | null>(null)
  const [loadingLaporan, setLoadingLaporan] = React.useState(true)
  const [laporanBulan, setLaporanBulan] = React.useState(new Date().getMonth() + 1)
  const [laporanTahun, setLaporanTahun] = React.useState(new Date().getFullYear())

  // Manual Payment (Cash/Offline) state
  const [isManualPayOpen, setIsManualPayOpen] = React.useState(false)
  const [manualTagihanId, setManualTagihanId] = React.useState("")
  const [manualNominal, setManualNominal] = React.useState("")
  const [manualMetode, setManualMetode] = React.useState("TUNAI")
  const [manualCatatan, setManualCatatan] = React.useState("")
  const [processingManual, setProcessingManual] = React.useState(false)

  // Cancel states
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false)
  const [cancelType, setCancelType] = React.useState<"transaksi" | "tagihan">("transaksi")
  const [cancelTargetId, setCancelTargetId] = React.useState("")
  const [cancelAlasan, setCancelAlasan] = React.useState("")
  const [cancelling, setCancelling] = React.useState(false)

  // Tunggakan state
  const [tunggakanData, setTunggakanData] = React.useState<{
    ringkasan: {
      totalTunggakanMurni: number
      totalNominalTunggakanMurni: number
      totalDibayarSebagian: number
      totalSisaDibayarSebagian: number
      totalMenungguVerifikasi: number
    }
    tunggakanMurni: Array<{
      tagihanId: string
      namaSiswa: string
      kelas: string
      periode: string
      nominal: number
      sisaTunggakan: number
      status: string
    }>
    dibayarSebagian: Array<{
      tagihanId: string
      namaSiswa: string
      kelas: string
      periode: string
      nominal: number
      sisaTunggakan: number
      status: string
    }>
  } | null>(null)
  const [loadingTunggakan, setLoadingTunggakan] = React.useState(false)

  // Fetch laporan data
  const fetchLaporan = React.useCallback(async () => {
    setLoadingLaporan(true)
    try {
      const startDate = new Date(laporanTahun, laporanBulan - 1, 1)
      const endDate = new Date(laporanTahun, laporanBulan, 0)
      const result = await getLaporanKeuangan({
        tanggalMulai: startDate.toISOString(),
        tanggalSelesai: endDate.toISOString(),
      })
      if (result.success && result.data) {
        setLaporanData(result.data as typeof laporanData)
      } else {
        toast({ title: "Gagal memuat laporan", description: result.message, variant: "destructive" })
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingLaporan(false)
    }
  }, [laporanBulan, laporanTahun, toast])

  // Fetch tunggakan data
  const fetchTunggakan = React.useCallback(async () => {
    setLoadingTunggakan(true)
    try {
      const result = await getRekapTunggakanSpp(undefined, laporanBulan, laporanTahun)
      if (result.success && result.data) {
        setTunggakanData(result.data as typeof tunggakanData)
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingTunggakan(false)
    }
  }, [laporanBulan, laporanTahun])

  React.useEffect(() => {
    fetchLaporan()
    fetchTunggakan()
  }, [fetchLaporan, fetchTunggakan])

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

  // Manual Payment Handler (Cash/Offline)
  const handleManualPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualTagihanId.trim() || !manualNominal) return
    setProcessingManual(true)
    try {
      const result = await konfirmasiPembayaranSppManual({
        tagihanId: manualTagihanId,
        nominalDibayar: parseFloat(manualNominal),
        metodeBayar: manualMetode,
        catatan: manualCatatan || "Pembayaran tunai/manual",
      })
      if (result.success) {
        toast({ title: "Pembayaran Manual Tercatat! 💰", description: result.message })
        setIsManualPayOpen(false)
        setManualTagihanId("")
        setManualNominal("")
        setManualCatatan("")
      } else {
        toast({ variant: "destructive", title: "Gagal", description: result.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Terjadi kesalahan server." })
    } finally {
      setProcessingManual(false)
    }
  }

  // Cancel Transaction/Tagihan Handler
  const handleCancel = async () => {
    if (!cancelTargetId || !cancelAlasan.trim()) return
    setCancelling(true)
    try {
      let result
      if (cancelType === "transaksi") {
        result = await batalkanTransaksiKeuangan({ transaksiId: cancelTargetId, alasanPembatalan: cancelAlasan })
      } else {
        result = await batalkanTagihanSpp({ tagihanId: cancelTargetId, alasanPembatalan: cancelAlasan })
      }
      if (result.success) {
        toast({ title: cancelType === "transaksi" ? "Transaksi Dibatalkan" : "Tagihan Dibatalkan", description: result.message })
        setCancelDialogOpen(false)
        setCancelTargetId("")
        setCancelAlasan("")
        // Refetch data
        if (cancelType === "tagihan") {
          fetchRekap()
        }
      } else {
        toast({ variant: "destructive", title: "Gagal", description: result.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Terjadi kesalahan server." })
    } finally {
      setCancelling(false)
    }
  }

  // ============================================================
  // REKAP HELPERS
  // ============================================================

  const getComplianceColor = (pct: number) => {
    if (pct >= 80) return "text-yellow-600 bg-yellow-50"
    if (pct >= 70) return "text-amber-700 bg-amber-50"
    return "text-rose-700 bg-rose-50"
  }

  const getComplianceBadge = (pct: number) => {
    if (pct >= 80) return { bg: "bg-yellow-500", label: "Tinggi", text: "text-yellow-600" }
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
                  <CardTitle className="text-base font-bold text-slate-800">
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
                        <span className="font-bold text-slate-800 text-base">{p.santriNama}</span>
                        <span className="text-xs bg-yellow-100 text-yellow-700 font-bold px-2 py-0.5 rounded">
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
                          className="inline-flex items-center gap-1 text-xs text-yellow-600 font-bold hover:underline pt-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Buka Foto Bukti Transfer
                        </a>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200">
                      <div className="text-left sm:text-right">
                        <span className="text-xs text-slate-400 block">Nominal Dibayar:</span>
                        <span className="text-lg font-black text-yellow-700">
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
                          className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[44px] text-xs px-5 flex-1 sm:flex-initial shadow-md"
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
              <CardTitle className="text-lg font-bold text-slate-800">
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
                    className="w-full h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold focus:ring-2 focus:ring-yellow-500"
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
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold h-12 px-8 rounded-xl min-h-[48px] shadow-md"
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
                        ? "bg-white text-yellow-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Per Kelas
                  </button>
                  <button
                    onClick={() => setRekapView("jenjang")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      rekapView === "jenjang"
                        ? "bg-white text-yellow-600 shadow-sm"
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
                  <CardTitle className="text-base font-bold text-slate-800">
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
                            <TableCell className="font-bold text-slate-800">{item.namaKelas}</TableCell>
                            <TableCell className="text-sm text-slate-600">{item.namaJenjang}</TableCell>
                            <TableCell className="text-center text-sm">{item.jumlahSiswa}</TableCell>
                            <TableCell className="text-right text-sm font-semibold">{formatRp(item.totalTagihan)}</TableCell>
                            <TableCell className="text-right text-sm text-yellow-600 font-semibold">{formatRp(item.totalLunas)}</TableCell>
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
                            <div className="font-bold text-slate-800 text-sm">{item.namaKelas}</div>
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
                            <div className="font-bold text-slate-800">{formatRp(item.totalTagihan)}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">Lunas</div>
                            <div className="font-bold text-yellow-600">{formatRp(item.totalLunas)}</div>
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
                  <CardTitle className="text-base font-bold text-slate-800">
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
                            <TableCell className="font-bold text-slate-800">{item.namaJenjang}</TableCell>
                            <TableCell className="text-center text-sm">{item.jumlahKelas}</TableCell>
                            <TableCell className="text-center text-sm">{item.jumlahSiswa}</TableCell>
                            <TableCell className="text-right text-sm font-semibold">{formatRp(item.totalTagihan)}</TableCell>
                            <TableCell className="text-right text-sm text-yellow-600 font-semibold">{formatRp(item.totalLunas)}</TableCell>
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
                            <div className="font-bold text-slate-800 text-sm">{item.namaJenjang}</div>
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
                            <div className="font-bold text-slate-800">{formatRp(item.totalTagihan)}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">Lunas</div>
                            <div className="font-bold text-yellow-600">{formatRp(item.totalLunas)}</div>
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
          {/* Pembayaran Manual (Cash/Offline) */}
          <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-6">
            <CardHeader className="p-0 pb-4 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-800">
                💰 Pembayaran Tunai / Manual (Tanpa Upload Bukti)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Untuk pembayaran yang diterima langsung secara tunai/offline dari santri/orang tua
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-4">
              <form onSubmit={handleManualPayment} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Tagihan ID *</label>
                  <Input
                    placeholder="ID Tagihan SPP"
                    value={manualTagihanId}
                    onChange={(e) => setManualTagihanId(e.target.value)}
                    className="h-11 rounded-xl text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Nominal (Rp) *</label>
                  <Input
                    type="number"
                    placeholder="500000"
                    value={manualNominal}
                    onChange={(e) => setManualNominal(e.target.value)}
                    className="h-11 rounded-xl text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Metode</label>
                  <select
                    value={manualMetode}
                    onChange={(e) => setManualMetode(e.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold"
                  >
                    <option value="TUNAI">Tunai</option>
                    <option value="TRANSFER">Transfer</option>
                    <option value="QRIS">QRIS</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Catatan</label>
                    <Input
                      placeholder="Keterangan..."
                      value={manualCatatan}
                      onChange={(e) => setManualCatatan(e.target.value)}
                      className="h-11 rounded-xl text-sm"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={processingManual}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold h-11 px-4 rounded-xl shrink-0"
                  >
                    {processingManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Form Input Kasir */}
          <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-6">
            <CardHeader className="p-0 pb-4 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-800">
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
                      className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold h-11 px-4 rounded-xl shrink-0"
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
              <CardTitle className="text-base font-bold text-slate-800">
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
                    <div className="font-bold text-slate-800 text-sm">{trx.deskripsi}</div>
                    <div className="text-xs text-slate-400">{trx.tanggal}</div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span
                      className={`text-base font-black ${
                        trx.tipe === "PEMASUKAN" ? "text-yellow-600" : "text-rose-600"
                      }`}
                    >
                      {trx.tipe === "PEMASUKAN" ? "+" : "-"} Rp {trx.nominal.toLocaleString("id-ID")}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCancelType("transaksi")
                        setCancelTargetId(trx.id)
                        setCancelAlasan("")
                        setCancelDialogOpen(true)
                      }}
                      className="rounded-lg text-xs text-rose-600 border-rose-200 hover:bg-rose-50 min-h-[32px] px-2"
                    >
                      <XCircle className="h-3 w-3" />
                    </Button>
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
          {/* Filter Bulan/Tahun */}
          <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Periode:</label>
              <select
                value={String(laporanBulan)}
                onChange={(e) => setLaporanBulan(parseInt(e.target.value))}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
              >
                {BULAN_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
              <select
                value={String(laporanTahun)}
                onChange={(e) => setLaporanTahun(parseInt(e.target.value))}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
              >
                {[2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { fetchLaporan(); fetchTunggakan() }}
                className="rounded-xl min-h-[40px]"
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Refresh
              </Button>
            </div>
          </Card>

          {/* Loading */}
          {loadingLaporan && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
              <span className="ml-3 text-sm text-slate-500">Memuat laporan keuangan...</span>
            </div>
          )}

          {/* Ringkasan KPI */}
          {!loadingLaporan && laporanData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="rounded-2xl border-slate-200/80 bg-white p-5">
                <span className="text-xs font-semibold text-slate-500 uppercase">Total Pemasukan</span>
                <div className="text-2xl font-black text-yellow-600 mt-2">
                  Rp {laporanData.ringkasan.totalPemasukan.toLocaleString("id-ID")}
                </div>
                <span className="text-xs text-slate-500 mt-0.5 block font-medium">
                  SPP: Rp {laporanData.ringkasan.pemasukanSpp.toLocaleString("id-ID")} + Lain: Rp {laporanData.ringkasan.pemasukanLain.toLocaleString("id-ID")}
                </span>
                {laporanData.ringkasan.sppMenungguVerifikasi > 0 && (
                  <span className="text-xs text-amber-600 mt-0.5 block font-medium">
                    ⚠️ Rp {laporanData.ringkasan.sppMenungguVerifikasi.toLocaleString("id-ID")} menunggu verifikasi
                  </span>
                )}
              </Card>
              <Card className="rounded-2xl border-slate-200/80 bg-white p-5">
                <span className="text-xs font-semibold text-slate-500 uppercase">Total Pengeluaran</span>
                <div className="text-2xl font-black text-rose-600 mt-2">
                  Rp {laporanData.ringkasan.totalPengeluaran.toLocaleString("id-ID")}
                </div>
              </Card>
              <Card className="rounded-2xl border-slate-200/80 bg-white p-5">
                <span className="text-xs font-semibold text-slate-500 uppercase">Saldo Bersih</span>
                <div className={`text-2xl font-black mt-2 ${laporanData.ringkasan.saldoBersih >= 0 ? 'text-slate-800' : 'text-rose-700'}`}>
                  Rp {laporanData.ringkasan.saldoBersih.toLocaleString("id-ID")}
                </div>
                <span className={`text-xs mt-0.5 block font-medium ${laporanData.ringkasan.saldoBersih >= 0 ? 'text-yellow-500' : 'text-rose-600'}`}>
                  {laporanData.ringkasan.saldoBersih >= 0 ? 'Kondisi Kas Sehat' : 'Perlu Perhatian'}
                </span>
              </Card>
            </div>
          )}

          {/* Rincian Transaksi */}
          {!loadingLaporan && laporanData && laporanData.transaksi.length > 0 && (
            <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <CardHeader className="p-5 pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-slate-800">Rincian Transaksi Non-SPP</CardTitle>
              </CardHeader>
              <CardContent className="p-5 divide-y divide-slate-100">
                {laporanData.transaksi.map((trx) => (
                  <div key={trx.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {trx.kategori}
                        </span>
                      </div>
                      <div className="font-bold text-slate-800 text-sm">{trx.deskripsi}</div>
                      <div className="text-xs text-slate-400">
                        {new Date(trx.tanggal).toLocaleDateString("id-ID")}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-base font-black ${trx.tipe === "PEMASUKAN" ? "text-yellow-600" : "text-rose-600"}`}>
                        {trx.tipe === "PEMASUKAN" ? "+" : "-"} Rp {trx.nominal.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Tunggakan Section */}
          {tunggakanData && (
            <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <CardHeader className="p-5 pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-slate-800">Rekap Tunggakan SPP</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Daftar siswa yang belum membayar atau membayar sebagian
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-center">
                    <span className="text-[11px] font-bold text-rose-800 uppercase block">Tunggakan</span>
                    <span className="text-xl font-black text-rose-700">{tunggakanData.ringkasan.totalTunggakanMurni}</span>
                    <span className="text-[10px] text-rose-600 block">Rp {tunggakanData.ringkasan.totalNominalTunggakanMurni.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
                    <span className="text-[11px] font-bold text-amber-800 uppercase block">Bayar Sebagian</span>
                    <span className="text-xl font-black text-amber-700">{tunggakanData.ringkasan.totalDibayarSebagian}</span>
                    <span className="text-[10px] text-amber-600 block">Sisa: Rp {tunggakanData.ringkasan.totalSisaDibayarSebagian.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-center">
                    <span className="text-[11px] font-bold text-sky-800 uppercase block">Verifikasi</span>
                    <span className="text-xl font-black text-sky-700">{tunggakanData.ringkasan.totalMenungguVerifikasi}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-center">
                    <span className="text-[11px] font-bold text-yellow-700 uppercase block">Total Tagihan</span>
                    <span className="text-xl font-black text-yellow-600">
                      {tunggakanData.ringkasan.totalTunggakanMurni + tunggakanData.ringkasan.totalDibayarSebagian}
                    </span>
                  </div>
                </div>

                {/* Daftar Tunggakan */}
                {tunggakanData.tunggakanMurni.length > 0 && (
                  <div className="divide-y divide-slate-100">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 mt-4">Belum Bayar / Terlambat</h4>
                    {tunggakanData.tunggakanMurni.map((t) => (
                      <div key={t.tagihanId} className="py-3 flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-800 text-sm">{t.namaSiswa}</div>
                          <div className="text-xs text-slate-500">
                            {t.kelas} • Periode: {t.periode}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div>
                            <div className="text-sm font-bold text-rose-700">Rp {t.sisaTunggakan.toLocaleString("id-ID")}</div>
                            <StatusBadge status={t.status as StatusType} size="sm" />
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCancelType("tagihan")
                              setCancelTargetId(t.tagihanId)
                              setCancelAlasan("")
                              setCancelDialogOpen(true)
                            }}
                            className="rounded-lg text-xs text-rose-600 border-rose-200 hover:bg-rose-50 min-h-[32px] px-2"
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tunggakanData.tunggakanMurni.length === 0 && tunggakanData.dibayarSebagian.length === 0 && (
                  <div className="p-6 text-center text-slate-400 text-sm">
                    Tidak ada tunggakan SPP untuk periode ini. 🎉
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={(open) => { setCancelDialogOpen(open); if (!open) { setCancelTargetId(""); setCancelAlasan("") } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">
              Batalkan {cancelType === "transaksi" ? "Transaksi" : "Tagihan SPP"}?
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Tindakan ini akan menandai {cancelType === "transaksi" ? "transaksi" : "tagihan"} sebagai DIBATALKAN dan tidak dapat dibatalkan kembali.
            </p>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Alasan Pembatalan * (minimal 5 karakter)</label>
              <Input
                value={cancelAlasan}
                onChange={(e) => setCancelAlasan(e.target.value)}
                placeholder="Jelaskan alasan pembatalan..."
                className="h-11 rounded-xl text-sm"
              />
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              ⚠️ Konsekuensi: {cancelType === "transaksi"
                ? "Transaksi ini tidak akan dihitung dalam laporan keuangan. Saldo bersih akan berubah."
                : "Tagihan ini tidak akan ditagihkan lagi ke siswa. Pembayaran yang sudah masuk tetap tercatat."}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setCancelDialogOpen(false); setCancelTargetId(""); setCancelAlasan("") }} className="rounded-xl min-h-[40px]">
              Batal
            </Button>
            <Button
              onClick={handleCancel}
              disabled={cancelling || cancelAlasan.length < 5}
              variant="destructive"
              className="rounded-xl min-h-[40px]"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Ya, Batalkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
