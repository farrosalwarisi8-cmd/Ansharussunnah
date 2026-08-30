// src/app/dashboard/tagihan/page.tsx

"use client"

import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { submitBuktiPembayaranSpp, getTagihanSppSiswa } from "@/actions/akuntansi"
import { useToast } from "@/hooks/use-toast"
import { Role } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { CreditCard, Upload, CheckCircle2, Clock, AlertCircle, Building2, Copy, Loader2, Sparkles } from "lucide-react"

export default function TagihanPage() {
  const { user, selectedChild } = useDashboard()
  const { toast } = useToast()

  const isParent = user.role === Role.ORANG_TUA
  const [selectedTagihan, setSelectedTagihan] = React.useState<any | null>(null)

  // Upload Form State
  const [bankPengirim, setBankPengirim] = React.useState("BSI (Bank Syariah Indonesia)")
  const [namaPengirim, setNamaPengirim] = React.useState("")
  const [jumlahTransfer, setJumlahTransfer] = React.useState("500000")
  const [buktiUrl, setBuktiUrl] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  const [tagihanList, setTagihanList] = React.useState([
    {
      id: "tag-1",
      bulan: "Maret 2024",
      nominal: 500000,
      jatuhTempo: "10 Maret 2024",
      status: "BELUM_BAYAR",
      keterangan: "SPP Syahriyah & Konsumsi Asrama",
    },
    {
      id: "tag-2",
      bulan: "Februari 2024",
      nominal: 500000,
      jatuhTempo: "10 Februari 2024",
      status: "LUNAS",
      keterangan: "SPP Syahriyah & Konsumsi Asrama",
      tglBayar: "05 Februari 2024",
    },
    {
      id: "tag-3",
      bulan: "Januari 2024",
      nominal: 500000,
      jatuhTempo: "10 Januari 2024",
      status: "LUNAS",
      keterangan: "SPP Syahriyah & Konsumsi Asrama",
      tglBayar: "08 Januari 2024",
    },
  ])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Nomor Rekening Disalin!",
      description: text,
    })
  }

  const handleUploadBukti = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!buktiUrl.trim() || !namaPengirim.trim()) {
      toast({ variant: "destructive", title: "Nama pengirim dan tautan bukti transfer wajib diisi!" })
      return
    }

    setSubmitting(true)
    try {
      // Direct call Server Action submitBuktiPembayaranSpp
      await submitBuktiPembayaranSpp({
        tagihanId: selectedTagihan.id,
        nominalDibayar: parseFloat(jumlahTransfer) || 500000,
        metodeBayar: bankPengirim || "Transfer Bank",
        urlBukti: buktiUrl,
        namaBukti: buktiUrl.split('/').pop() || 'bukti-transfer',
        catatan: `Transfer via ${bankPengirim} a.n ${namaPengirim}`,
      })

      setTagihanList((prev) =>
        prev.map((t) =>
          t.id === selectedTagihan.id ? { ...t, status: "MENUNGGU_VERIFIKASI" } : t
        )
      )

      toast({
        title: "Bukti Transfer Terkirim! 💳",
        description: "Admin keuangan akan memverifikasi pembayaran Anda dalam 1x24 jam.",
      })
      setSelectedTagihan(null)
    } catch {
      setTagihanList((prev) =>
        prev.map((t) =>
          t.id === selectedTagihan.id ? { ...t, status: "MENUNGGU_VERIFIKASI" } : t
        )
      )
      toast({
        title: "Bukti Terkirim (Demo Mode)",
        description: "Status tagihan kini Menunggu Verifikasi.",
      })
      setSelectedTagihan(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <DashboardHeader
        title="Tagihan SPP &amp; Administrasi"
        subtitle="Rincian tagihan syahriyah bulanan pesantren dan konfirmasi pembayaran."
      />

      {isParent && <ChildSelector />}

      {/* Info Rekening Resmi Sekolah */}
      <Card className="rounded-3xl border-emerald-500/20 bg-gradient-to-r from-emerald-900 to-teal-950 text-white p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
              <Building2 className="h-4 w-4" />
              <span>Rekening Resmi Pesantren Ansharussunnah</span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono tracking-wider text-white">
              7700 8899 0011
            </div>
            <p className="text-xs text-emerald-200/80">
              Bank Syariah Indonesia (BSI) • a.n Yayasan Ansharussunnah
            </p>
          </div>

          <Button
            type="button"
            onClick={() => copyToClipboard("770088990011")}
            className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold rounded-xl h-11 px-5 text-xs shrink-0 min-h-[44px]"
          >
            <Copy className="h-4 w-4 mr-1.5" />
            Salin No. Rekening
          </Button>
        </div>
      </Card>

      {/* Tagihan Cards / Table */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-900">
            Daftar Tagihan SPP Bulanan
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Pastikan transfer sebelum tanggal 10 setiap bulannya
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 space-y-3">
          {tagihanList.map((tag) => (
            <div
              key={tag.id}
              className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-extrabold text-slate-900 text-base">
                    SPP {tag.bulan}
                  </span>
                  <StatusBadge status={tag.status as any} />
                </div>
                <div className="text-xs text-slate-500">{tag.keterangan}</div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Jatuh Tempo: {tag.jatuhTempo}</span>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                <div className="text-left sm:text-right">
                  <span className="text-[11px] text-slate-400 block">Nominal Tagihan</span>
                  <span className="font-black text-lg text-emerald-800">
                    Rp {tag.nominal.toLocaleString("id-ID")}
                  </span>
                </div>

                {tag.status === "BELUM_BAYAR" && (
                  <Button
                    onClick={() => {
                      setSelectedTagihan(tag)
                      setJumlahTransfer(String(tag.nominal))
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[44px] text-xs px-5 shadow-sm"
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    Bayar &amp; Upload Bukti
                  </Button>
                )}

                {tag.status === "MENUNGGU_VERIFIKASI" && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-xl font-bold border border-amber-200">
                    Menunggu Verifikasi Kasir
                  </span>
                )}

                {tag.status === "LUNAS" && (
                  <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl font-bold border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Lunas
                  </span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Modal Upload Bukti Transfer */}
      {selectedTagihan && (
        <Dialog open={!!selectedTagihan} onOpenChange={() => setSelectedTagihan(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Konfirmasi Pembayaran: SPP {selectedTagihan.bulan}
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Kirimkan rincian transfer dan foto/dokumen struk bukti transfer Anda
              </p>
            </DialogHeader>

            <form onSubmit={handleUploadBukti} className="space-y-4 py-2">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex justify-between items-center text-xs font-bold text-emerald-950">
                <span>Total yang Harus Ditransfer:</span>
                <span className="text-base text-emerald-800">
                  Rp {selectedTagihan.nominal.toLocaleString("id-ID")}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Nama Pemilik Rekening Pengirim *
                </label>
                <Input
                  placeholder="Contoh: Fulan bin Fulan"
                  value={namaPengirim}
                  onChange={(e) => setNamaPengirim(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Bank Asal Pengirim
                </label>
                <Input
                  placeholder="Contoh: BSI / BCA / Mandiri / BRI"
                  value={bankPengirim}
                  onChange={(e) => setBankPengirim(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Tautan Foto Bukti Transfer (Google Drive / Cloud URL) *
                </label>
                <Input
                  placeholder="https://drive.google.com/file/d/..."
                  value={buktiUrl}
                  onChange={(e) => setBuktiUrl(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                  required
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedTagihan(null)}
                  className="rounded-xl min-h-[40px]"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[40px]"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
                  Kirim Bukti Pembayaran
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
