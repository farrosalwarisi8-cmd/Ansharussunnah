"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CheckCircle2, XCircle, Plus, Loader2 } from "lucide-react"
import {
  createTransaksiKeuangan,
  batalkanTransaksiKeuangan,
  konfirmasiPembayaranSppManual,
  getKategoriTransaksiList,
  getDaftarTransaksiKeuangan,
} from "@/actions/akuntansi"
import dynamic from "next/dynamic"
const Dialog = dynamic(() => import("@/components/ui/dialog").then(m => m.Dialog), { ssr: false })
const DialogContent = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogContent), { ssr: false })
const DialogHeader = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogHeader), { ssr: false })
const DialogTitle = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogTitle), { ssr: false })
const DialogFooter = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogFooter), { ssr: false })

type KategoriItem = {
  id: string
  nama: string
  tipe: "PEMASUKAN" | "PENGELUARAN"
}

type TransaksiItem = {
  id: string
  tipe: "PEMASUKAN" | "PENGELUARAN"
  kategori: string
  deskripsi: string
  nominal: number
  tanggal: string | Date
  status: string
  alasanPembatalan: string | null
  dibuatOleh: string
}

const formatRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`
const formatTanggal = (t: string | Date) =>
  new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })

export function KasirTab() {
  const { toast } = useToast()

  // Data nyata dari database
  const [kategoriList, setKategoriList] = React.useState<KategoriItem[]>([])
  const [transaksiList, setTransaksiList] = React.useState<TransaksiItem[]>([])
  const [loadingData, setLoadingData] = React.useState(true)

  // Form transaksi
  const [tipeTransaksi, setTipeTransaksi] = React.useState<"PEMASUKAN" | "PENGELUARAN">("PEMASUKAN")
  const [kategoriId, setKategoriId] = React.useState("")
  const [deskripsiTransaksi, setDeskripsiTransaksi] = React.useState("")
  const [nominalTransaksi, setNominalTransaksi] = React.useState("")
  const [savingTrx, setSavingTrx] = React.useState(false)

  // Manual Payment state
  const [manualTagihanId, setManualTagihanId] = React.useState("")
  const [manualNominal, setManualNominal] = React.useState("")
  const [manualMetode, setManualMetode] = React.useState("TUNAI")
  const [manualCatatan, setManualCatatan] = React.useState("")
  const [processingManual, setProcessingManual] = React.useState(false)

  // Cancel state
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false)
  const [cancelTargetId, setCancelTargetId] = React.useState("")
  const [cancelAlasan, setCancelAlasan] = React.useState("")
  const [cancelling, setCancelling] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    setLoadingData(true)
    try {
      const [kategoriRes, trxRes] = await Promise.all([
        getKategoriTransaksiList(),
        getDaftarTransaksiKeuangan(20),
      ])
      if (kategoriRes.success && kategoriRes.data) {
        setKategoriList(kategoriRes.data)
        // Default pilih kategori pertama sesuai tipe yang dipilih
        const k = kategoriRes.data.find((x) => x.tipe === tipeTransaksi) || kategoriRes.data[0]
        if (k) setKategoriId((prev) => prev || k.id)
      } else {
        toast({ variant: "destructive", title: "Gagal memuat kategori", description: kategoriRes.message })
      }
      if (trxRes.success && trxRes.data) {
        setTransaksiList(trxRes.data)
      } else {
        toast({ variant: "destructive", title: "Gagal memuat riwayat", description: trxRes.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal Memuat Data", description: "Terjadi kesalahan saat memuat data kasir." })
    } finally {
      setLoadingData(false)
    }
  }, [tipeTransaksi, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Saat tipe berubah, pindahkan kategori terpilih ke kategori dengan tipe tersebut
  const handleTipeChange = (val: "PEMASUKAN" | "PENGELUARAN") => {
    setTipeTransaksi(val)
    const k = kategoriList.find((x) => x.tipe === val)
    setKategoriId(k?.id || "")
  }

  const kategoriTerpilih = kategoriList.find((k) => k.id === kategoriId)

  const handleAddTransaksi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!kategoriId || !nominalTransaksi || !deskripsiTransaksi.trim()) {
      toast({ variant: "destructive", title: "Data belum lengkap", description: "Pilih kategori, isi nominal, dan keterangan." })
      return
    }
    setSavingTrx(true)
    try {
      const result = await createTransaksiKeuangan({
        kategoriId,
        nominal: parseFloat(nominalTransaksi),
        deskripsi: deskripsiTransaksi,
        tanggal: new Date().toISOString(),
      })
      if (!result.success) {
        toast({ variant: "destructive", title: "Gagal Menyimpan Transaksi", description: result.message })
        return
      }
      toast({ title: "Transaksi Berhasil Dicatat! 💰", description: result.message })
      setDeskripsiTransaksi("")
      setNominalTransaksi("")
      // Muat ulang riwayat dari database
      const trxRes = await getDaftarTransaksiKeuangan(20)
      if (trxRes.success && trxRes.data) setTransaksiList(trxRes.data)
    } catch {
      toast({ variant: "destructive", title: "Gagal Menyimpan", description: "Terjadi kesalahan saat menyimpan transaksi." })
    } finally {
      setSavingTrx(false)
    }
  }

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

  const handleCancelTransaksi = async () => {
    if (!cancelTargetId || cancelAlasan.trim().length < 5) return
    setCancelling(true)
    try {
      const result = await batalkanTransaksiKeuangan({
        transaksiId: cancelTargetId,
        alasanPembatalan: cancelAlasan,
      })
      if (result.success) {
        toast({ title: "Transaksi Dibatalkan", description: result.message })
        setCancelDialogOpen(false)
        setCancelTargetId("")
        setCancelAlasan("")
        const trxRes = await getDaftarTransaksiKeuangan(20)
        if (trxRes.success && trxRes.data) setTransaksiList(trxRes.data)
      } else {
        toast({ variant: "destructive", title: "Gagal Membatalkan", description: result.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal Membatalkan", description: "Terjadi kesalahan saat membatalkan transaksi." })
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Pembayaran Manual */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-6">
        <CardHeader className="p-0 pb-4 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-800">💰 Pembayaran Tunai / Manual (Tanpa Upload Bukti)</CardTitle>
          <CardDescription className="text-xs text-slate-500">Untuk pembayaran yang diterima langsung secara tunai/offline dari santri/orang tua</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          <form onSubmit={handleManualPayment} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Tagihan ID *</label>
              <Input placeholder="ID Tagihan SPP" value={manualTagihanId} onChange={(e) => setManualTagihanId(e.target.value)} className="h-11 rounded-xl text-sm" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Nominal (Rp) *</label>
              <Input type="number" placeholder="500000" value={manualNominal} onChange={(e) => setManualNominal(e.target.value)} className="h-11 rounded-xl text-sm" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Metode</label>
              <select value={manualMetode} onChange={(e) => setManualMetode(e.target.value)} className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold">
                <option value="TUNAI">Tunai</option><option value="TRANSFER">Transfer</option><option value="QRIS">QRIS</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Catatan</label>
                <Input placeholder="Keterangan..." value={manualCatatan} onChange={(e) => setManualCatatan(e.target.value)} className="h-11 rounded-xl text-sm" />
              </div>
              <Button type="submit" disabled={processingManual} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold h-11 px-4 rounded-xl shrink-0">
                {processingManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Form Input Kasir */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-6">
        <CardHeader className="p-0 pb-4 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-800">Pencatatan Kas &amp; Transaksi Non-SPP</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          {loadingData ? (
            <div className="flex items-center justify-center p-4 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Memuat kategori transaksi...
            </div>
          ) : (
            <form onSubmit={handleAddTransaksi} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Tipe</label>
                <select value={tipeTransaksi} onChange={(e) => handleTipeChange(e.target.value as "PEMASUKAN" | "PENGELUARAN")} className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold">
                  <option value="PEMASUKAN">Pemasukan (+)</option><option value="PENGELUARAN">Pengeluaran (-)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Kategori</label>
                <select value={kategoriId} onChange={(e) => setKategoriId(e.target.value)} className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold">
                  {kategoriList.filter((k) => k.tipe === tipeTransaksi).length > 0 ? (
                    kategoriList.filter((k) => k.tipe === tipeTransaksi).map((k) => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))
                  ) : (
                    <option value="">— Belum ada kategori —</option>
                  )}
                </select>
                {kategoriList.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    Belum ada kategori transaksi. Tambahkan via seed atau database.
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Nominal (Rp)</label>
                <Input type="number" placeholder="1000000" value={nominalTransaksi} onChange={(e) => setNominalTransaksi(e.target.value)} className="h-11 rounded-xl text-sm" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Keterangan Singkat</label>
                <div className="flex gap-2">
                  <Input placeholder="Uraian transaksi..." value={deskripsiTransaksi} onChange={(e) => setDeskripsiTransaksi(e.target.value)} className="h-11 rounded-xl text-sm" required />
                  <Button type="submit" disabled={savingTrx || !kategoriTerpilih} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold h-11 px-4 rounded-xl shrink-0"><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* List Transaksi */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-800">Riwayat Transaksi Terakhir</CardTitle>
        </CardHeader>
        <CardContent className="p-5 divide-y divide-slate-100">
          {loadingData ? (
            <div className="flex items-center justify-center py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Memuat riwayat transaksi...
            </div>
          ) : transaksiList.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Belum ada transaksi keuangan yang tercatat.
            </p>
          ) : (
            transaksiList.map((trx) => (
              <div key={trx.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{trx.kategori}</span>
                    {trx.status === "DIBATALKAN" && (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">DIBATALKAN</span>
                    )}
                  </div>
                  <div className="font-bold text-slate-800 text-sm truncate">{trx.deskripsi}</div>
                  <div className="text-xs text-slate-400">{formatTanggal(trx.tanggal)} • oleh {trx.dibuatOleh}</div>
                  {trx.status === "DIBATALKAN" && trx.alasanPembatalan && (
                    <div className="text-xs text-rose-500">Alasan: {trx.alasanPembatalan}</div>
                  )}
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <span className={`text-base font-black ${trx.tipe === "PEMASUKAN" ? "text-yellow-600" : "text-rose-600"}`}>
                    {trx.tipe === "PEMASUKAN" ? "+" : "-"} {formatRp(trx.nominal)}
                  </span>
                  {trx.status !== "DIBATALKAN" && (
                    <Button size="sm" variant="outline" onClick={() => { setCancelTargetId(trx.id); setCancelAlasan(""); setCancelDialogOpen(true) }} className="rounded-lg text-xs text-rose-600 border-rose-200 hover:bg-rose-50 min-h-[32px] px-2" aria-label="Batalkan transaksi">
                      <XCircle className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={(open) => { setCancelDialogOpen(open); if (!open) { setCancelTargetId(""); setCancelAlasan("") } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">Batalkan Transaksi?</DialogTitle>
            <p className="text-xs text-slate-500">Tindakan ini akan menandai transaksi sebagai DIBATALKAN dan tidak dapat dibatalkan kembali.</p>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Alasan Pembatalan * (minimal 5 karakter)</label>
              <Input value={cancelAlasan} onChange={(e) => setCancelAlasan(e.target.value)} placeholder="Jelaskan alasan pembatalan..." className="h-11 rounded-xl text-sm" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setCancelDialogOpen(false); setCancelTargetId(""); setCancelAlasan("") }} className="rounded-xl min-h-[40px]">Batal</Button>
            <Button onClick={handleCancelTransaksi} disabled={cancelling || cancelAlasan.trim().length < 5} variant="destructive" className="rounded-xl min-h-[40px]">
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null} Ya, Batalkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}