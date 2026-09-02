"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, RefreshCw } from "lucide-react"
import { getLaporanKeuangan, getRekapTunggakanSpp } from "@/actions/akuntansi"
import { StatusBadge, type StatusType } from "@/components/ui/status-badge"
import dynamic from "next/dynamic"
const Dialog = dynamic(() => import("@/components/ui/dialog").then(m => m.Dialog), { ssr: false })
const DialogContent = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogContent), { ssr: false })
const DialogHeader = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogHeader), { ssr: false })
const DialogTitle = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogTitle), { ssr: false })
const DialogFooter = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogFooter), { ssr: false })
import { Input } from "@/components/ui/input"

const BULAN_OPTIONS = [
  { value: "1", label: "Januari" }, { value: "2", label: "Februari" }, { value: "3", label: "Maret" },
  { value: "4", label: "April" }, { value: "5", label: "Mei" }, { value: "6", label: "Juni" },
  { value: "7", label: "Juli" }, { value: "8", label: "Agustus" }, { value: "9", label: "September" },
  { value: "10", label: "Oktober" }, { value: "11", label: "November" }, { value: "12", label: "Desember" },
]

export function LaporanTab() {
  const { toast } = useToast()
  const [laporanData, setLaporanData] = React.useState<{
    ringkasan: { pemasukanSpp: number; sppMenungguVerifikasi: number; pemasukanLain: number; totalPemasukan: number; totalPengeluaran: number; saldoBersih: number }
    transaksi: Array<{ id: string; kategori: string; tipe: string; nominal: number; deskripsi: string; tanggal: string | Date }>
  } | null>(null)
  const [loadingLaporan, setLoadingLaporan] = React.useState(true)
  const [laporanBulan, setLaporanBulan] = React.useState(new Date().getMonth() + 1)
  const [laporanTahun, setLaporanTahun] = React.useState(new Date().getFullYear())
  const [tunggakanData, setTunggakanData] = React.useState<{
    ringkasan: { totalTunggakanMurni: number; totalNominalTunggakanMurni: number; totalDibayarSebagian: number; totalSisaDibayarSebagian: number; totalMenungguVerifikasi: number }
    tunggakanMurni: Array<{ tagihanId: string; namaSiswa: string; kelas: string; periode: string; nominal: number; sisaTunggakan: number; status: string }>
    dibayarSebagian: Array<{ tagihanId: string; namaSiswa: string; kelas: string; periode: string; nominal: number; sisaTunggakan: number; status: string }>
  } | null>(null)
  const [loadingTunggakan, setLoadingTunggakan] = React.useState(false)

  // Cancel states
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false)
  const [cancelTargetId, setCancelTargetId] = React.useState("")
  const [cancelAlasan, setCancelAlasan] = React.useState("")
  const [cancelling, setCancelling] = React.useState(false)

  const fetchLaporan = React.useCallback(async () => {
    setLoadingLaporan(true)
    try {
      const startDate = new Date(laporanTahun, laporanBulan - 1, 1)
      const endDate = new Date(laporanTahun, laporanBulan, 0)
      const result = await getLaporanKeuangan({ tanggalMulai: startDate.toISOString(), tanggalSelesai: endDate.toISOString() })
      if (result.success && result.data) {
        setLaporanData(result.data as typeof laporanData)
      }
    } catch { /* silent */ } finally { setLoadingLaporan(false) }
  }, [laporanBulan, laporanTahun])

  const fetchTunggakan = React.useCallback(async () => {
    setLoadingTunggakan(true)
    try {
      const result = await getRekapTunggakanSpp(undefined, laporanBulan, laporanTahun)
      if (result.success && result.data) { setTunggakanData(result.data as typeof tunggakanData) }
    } catch { /* silent */ } finally { setLoadingTunggakan(false) }
  }, [laporanBulan, laporanTahun])

  React.useEffect(() => { fetchLaporan(); fetchTunggakan() }, [fetchLaporan, fetchTunggakan])

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Periode:</label>
          <select value={String(laporanBulan)} onChange={(e) => setLaporanBulan(parseInt(e.target.value))} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold">
            {BULAN_OPTIONS.map((b) => (<option key={b.value} value={b.value}>{b.label}</option>))}
          </select>
          <select value={String(laporanTahun)} onChange={(e) => setLaporanTahun(parseInt(e.target.value))} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold">
            {[2024, 2025, 2026].map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
          <Button variant="outline" size="sm" onClick={() => { fetchLaporan(); fetchTunggakan() }} className="rounded-xl min-h-[40px]">
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
        </div>
      </Card>

      {loadingLaporan && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
          <span className="ml-3 text-sm text-slate-500">Memuat laporan keuangan...</span>
        </div>
      )}

      {!loadingLaporan && laporanData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-2xl border-slate-200/80 bg-white p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Pemasukan</span>
            <div className="text-2xl font-black text-yellow-600 mt-2">Rp {laporanData.ringkasan.totalPemasukan.toLocaleString("id-ID")}</div>
            <span className="text-xs text-slate-500 mt-0.5 block font-medium">SPP: Rp {laporanData.ringkasan.pemasukanSpp.toLocaleString("id-ID")} + Lain: Rp {laporanData.ringkasan.pemasukanLain.toLocaleString("id-ID")}</span>
            {laporanData.ringkasan.sppMenungguVerifikasi > 0 && (<span className="text-xs text-amber-600 mt-0.5 block font-medium">⚠️ Rp {laporanData.ringkasan.sppMenungguVerifikasi.toLocaleString("id-ID")} menunggu verifikasi</span>)}
          </Card>
          <Card className="rounded-2xl border-slate-200/80 bg-white p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Pengeluaran</span>
            <div className="text-2xl font-black text-rose-600 mt-2">Rp {laporanData.ringkasan.totalPengeluaran.toLocaleString("id-ID")}</div>
          </Card>
          <Card className="rounded-2xl border-slate-200/80 bg-white p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase">Saldo Bersih</span>
            <div className={`text-2xl font-black mt-2 ${laporanData.ringkasan.saldoBersih >= 0 ? 'text-slate-800' : 'text-rose-700'}`}>Rp {laporanData.ringkasan.saldoBersih.toLocaleString("id-ID")}</div>
            <span className={`text-xs mt-0.5 block font-medium ${laporanData.ringkasan.saldoBersih >= 0 ? 'text-yellow-500' : 'text-rose-600'}`}>{laporanData.ringkasan.saldoBersih >= 0 ? 'Kondisi Kas Sehat' : 'Perlu Perhatian'}</span>
          </Card>
        </div>
      )}

      {!loadingLaporan && laporanData && laporanData.transaksi.length > 0 && (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-800">Rincian Transaksi Non-SPP</CardTitle>
          </CardHeader>
          <CardContent className="p-5 divide-y divide-slate-100">
            {laporanData.transaksi.map((trx) => (
              <div key={trx.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{trx.kategori}</span>
                  <div className="font-bold text-slate-800 text-sm">{trx.deskripsi}</div>
                  <div className="text-xs text-slate-400">{new Date(trx.tanggal).toLocaleDateString("id-ID")}</div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-base font-black ${trx.tipe === "PEMASUKAN" ? "text-yellow-600" : "text-rose-600"}`}>{trx.tipe === "PEMASUKAN" ? "+" : "-"} Rp {trx.nominal.toLocaleString("id-ID")}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tunggakanData && (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-800">Rekap Tunggakan SPP</CardTitle>
            <CardDescription className="text-xs text-slate-500">Daftar siswa yang belum membayar atau membayar sebagian</CardDescription>
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
                <span className="text-xl font-black text-yellow-600">{tunggakanData.ringkasan.totalTunggakanMurni + tunggakanData.ringkasan.totalDibayarSebagian}</span>
              </div>
            </div>
            {tunggakanData.tunggakanMurni.length > 0 && (
              <div className="divide-y divide-slate-100">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 mt-4">Belum Bayar / Terlambat</h4>
                {tunggakanData.tunggakanMurni.map((t) => (
                  <div key={t.tagihanId} className="py-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-800 text-sm">{t.namaSiswa}</div>
                      <div className="text-xs text-slate-500">{t.kelas} • Periode: {t.periode}</div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <div className="text-sm font-bold text-rose-700">Rp {t.sisaTunggakan.toLocaleString("id-ID")}</div>
                        <StatusBadge status={t.status as StatusType} size="sm" />
                      </div>
                      <Button size="sm" variant="outline" onClick={() => { setCancelTargetId(t.tagihanId); setCancelAlasan(""); setCancelDialogOpen(true) }} className="rounded-lg text-xs text-rose-600 border-rose-200 hover:bg-rose-50 min-h-[32px] px-2" aria-label="Batalkan tagihan">
                        <span className="sr-only">Batalkan</span> ×
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tunggakanData.tunggakanMurni.length === 0 && tunggakanData.dibayarSebagian.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-sm">Tidak ada tunggakan SPP untuk periode ini. 🎉</div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={cancelDialogOpen} onOpenChange={(open) => { setCancelDialogOpen(open); if (!open) { setCancelTargetId(""); setCancelAlasan("") } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-base font-bold text-slate-800">Batalkan Tagihan SPP?</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-slate-700">Alasan Pembatalan *</label>
            <Input value={cancelAlasan} onChange={(e) => setCancelAlasan(e.target.value)} placeholder="Jelaskan alasan..." className="h-11 rounded-xl text-sm" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} className="rounded-xl min-h-[40px]">Batal</Button>
            <Button disabled={cancelling || cancelAlasan.length < 5} variant="destructive" className="rounded-xl min-h-[40px]">Ya, Batalkan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
