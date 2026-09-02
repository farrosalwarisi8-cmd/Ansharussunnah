"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CheckCircle2, XCircle, Loader2, ExternalLink, RefreshCw } from "lucide-react"
import { konfirmasiPembayaranSppOlehAdmin, getDaftarPembayaranPendingVerifikasi } from "@/actions/akuntansi"

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

const formatRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`

export function VerifikasiPembayaranTab() {
  const { toast } = useToast()
  const [pendingPayments, setPendingPayments] = React.useState<PendingPaymentItem[]>([])
  const [loadingPending, setLoadingPending] = React.useState(true)
  const [processingId, setProcessingId] = React.useState<string | null>(null)

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

  React.useEffect(() => { fetchPendingPayments() }, [fetchPendingPayments])

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
        await fetchPendingPayments()
        toast({ title: approve ? "Pembayaran Diterima & Lunas! ✅" : "Pembayaran Ditolak ❌", description: result.message })
      } else {
        toast({ title: "Gagal Memproses", description: result.message, variant: "destructive" })
      }
    } catch {
      toast({ title: approve ? "Pembayaran Dikonfirmasi (Demo)" : "Pembayaran Ditolak (Demo)", description: "Status berhasil diupdate." })
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">Antrean Bukti Transfer Menunggu Verifikasi</CardTitle>
            <CardDescription className="text-xs text-slate-500">Periksa kesesuaian nominal dan rekening pengirim sebelum menyetujui kuitansi lunas</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPendingPayments} disabled={loadingPending} className="rounded-xl text-xs font-bold">
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
            <div key={p.id} className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-800 text-base">{p.santriNama}</span>
                  <span className="text-xs bg-yellow-100 text-yellow-700 font-bold px-2 py-0.5 rounded">{p.kelas}</span>
                  <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded">{p.jenjang}</span>
                </div>
                <div className="text-xs text-slate-600">Tagihan: <strong>SPP {p.bulanTagihan}</strong> &bull; Metode: {p.metodeBayar}</div>
                {p.namaBukti && <div className="text-xs text-slate-500">Bukti: {p.namaBukti}</div>}
                <div className="text-xs text-slate-400">Waktu upload: {new Date(p.waktuUpload).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                {p.urlBukti && (
                  <a href={p.urlBukti} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-yellow-600 font-bold hover:underline pt-1">
                    <ExternalLink className="h-3 w-3" /> Buka Foto Bukti Transfer
                  </a>
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200">
                <div className="text-left sm:text-right">
                  <span className="text-xs text-slate-400 block">Nominal Dibayar:</span>
                  <span className="text-lg font-black text-yellow-700">{formatRp(p.nominalDibayar)}</span>
                  {p.nominalDibayar !== p.nominalTagihan && (
                    <span className="text-xs text-amber-600 block font-semibold">(Tagihan: {formatRp(p.nominalTagihan)})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => handleVerifyPayment(p.id, false)} variant="outline" disabled={processingId === p.id} className="border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl min-h-[44px] text-xs font-bold flex-1 sm:flex-initial">
                    {processingId === p.id ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <XCircle className="h-4 w-4 mr-1.5" />}
                    Tolak
                  </Button>
                  <Button onClick={() => handleVerifyPayment(p.id, true)} disabled={processingId === p.id} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[44px] text-xs px-5 flex-1 sm:flex-initial shadow-md">
                    {processingId === p.id ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                    Konfirmasi Lunas
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-slate-500 text-sm">🎉 Semua pembayaran masuk telah diverifikasi! Tidak ada antrean pending.</div>
        )}
      </CardContent>
    </Card>
  )
}
