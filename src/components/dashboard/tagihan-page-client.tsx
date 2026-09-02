"use client"



import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { getTagihanSppSiswa, submitBuktiPembayaranSpp } from "@/actions/akuntansi"
import { useToast } from "@/hooks/use-toast"
import { Role } from "@prisma/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import dynamic from "next/dynamic"
const Dialog = dynamic(() => import("@/components/ui/dialog").then(m => m.Dialog), { ssr: false })
const DialogContent = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogContent), { ssr: false })
const DialogHeader = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogHeader), { ssr: false })
const DialogTitle = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogTitle), { ssr: false })
const DialogFooter = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogFooter), { ssr: false })
import { Upload, Clock, CheckCircle2, Building2, Copy, Loader2, ShieldX } from "lucide-react"

type TagihanItem = {
  id: string
  bulan: number
  tahun: number
  nominal: number
  status: string
  labelStatus: string
  jatuhTempo: string | Date
  totalTerbayar: number
  sisaTunggakan: number
  pembayaranTerkini?: {
    id: string
    nominalDibayar: number
    tanggalBayar: string | Date
    metodeBayar: string
    statusPembayaran: string
    alasanPenolakan?: string | null
    catatan?: string | null
    konfirmator?: string | null
    buktiUrl?: string | null
  } | null
  riwayatPembayaran?: Array<{
    nominalDibayar: number
    tanggalBayar: string | Date
    metodeBayar: string
    konfirmator?: string | null
  }>
}

const BULAN_NAMES = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

export default function TagihanPage() {
  const { user } = useDashboard()
  const { toast } = useToast()
  const router = useRouter()

  // KEPUTUSAN PRODUK: Siswa TIDAK BOLEH melihat data akuntansi/tagihan SPP
  if (user.role === Role.SISWA) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <ShieldX className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Akses Ditolak</h1>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          Halaman ini hanya dapat diakses oleh orang tua/wali santri dan admin keuangan.
          Data tagihan SPP bukan ranah akses siswa.
        </p>
        <Button
          onClick={() => router.push("/dashboard")}
          className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[44px]"
        >
          Kembali ke Beranda
        </Button>
      </div>
    )
  }

  return <TagihanContent />
}

function TagihanContent() {
  const { user, selectedChild } = useDashboard()
  const { toast } = useToast()

  const isParent = user.role === Role.ORANG_TUA
  const [tagihanList, setTagihanList] = React.useState<TagihanItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [selectedTagihan, setSelectedTagihan] = React.useState<TagihanItem | null>(null)

  // Upload Form State
  const [bankPengirim, setBankPengirim] = React.useState("BSI (Bank Syariah Indonesia)")
  const [namaPengirim, setNamaPengirim] = React.useState("")
  const [jumlahTransfer, setJumlahTransfer] = React.useState("")
  const [buktiUrl, setBuktiUrl] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  // Fetch tagihan data
  const fetchTagihan = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Determine siswaId based on role
      let siswaId: string | undefined
      if (isParent && selectedChild) {
        siswaId = selectedChild.id
      } else if (user.kelas?.id) {
        // For ADMIN_KEUANGAN or GURU (wali kelas), use the selectedChild if available
        siswaId = selectedChild?.id
      }

      if (!siswaId) {
        setTagihanList([])
        setLoading(false)
        return
      }

      const result = await getTagihanSppSiswa(siswaId)
      if (result.success && result.data) {
        setTagihanList(result.data as TagihanItem[])
      } else {
        setError(result.message || "Gagal memuat data tagihan")
      }
    } catch {
      setError("Gagal memuat data tagihan")
    } finally {
      setLoading(false)
    }
  }, [isParent, selectedChild, user.kelas?.id])

  React.useEffect(() => {
    fetchTagihan()
  }, [fetchTagihan])

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

    if (!selectedTagihan) {
      toast({ variant: "destructive", title: "Tagihan tidak dipilih!" })
      return
    }
    const selectedTagihanId = selectedTagihan.id

    setSubmitting(true)
    try {
      await submitBuktiPembayaranSpp({
        tagihanId: selectedTagihanId,
        nominalDibayar: parseFloat(jumlahTransfer) || selectedTagihan.nominal,
        metodeBayar: bankPengirim || "Transfer Bank",
        urlBukti: buktiUrl,
        namaBukti: buktiUrl.split('/').pop() || 'bukti-transfer',
        catatan: `Transfer via ${bankPengirim} a.n ${namaPengirim}`,
      })

      toast({
        title: "Bukti Transfer Terkirim! 💳",
        description: "Admin keuangan akan memverifikasi pembayaran Anda dalam 1x24 jam.",
      })
      setSelectedTagihan(null)
      // Refetch data after successful submission
      fetchTagihan()
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal Mengirim",
        description: "Terjadi kesalahan saat mengirim bukti pembayaran.",
      })
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
      <Card className="rounded-3xl border-yellow-500/20 bg-gradient-to-r from-yellow-800 to-teal-950 text-white p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-yellow-300">
              <Building2 className="h-4 w-4" />
              <span>Rekening Resmi Pesantren Ansharussunnah</span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono tracking-wider text-white">
              7700 8899 0011
            </div>
            <p className="text-xs text-yellow-200/80">
              Bank Syariah Indonesia (BSI) • a.n Yayasan Ansharussunnah
            </p>
          </div>

          <Button
            type="button"
            onClick={() => copyToClipboard("770088990011")}
            className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl h-11 px-5 text-xs shrink-0 min-h-[44px]"
          >
            <Copy className="h-4 w-4 mr-1.5" />
            Salin No. Rekening
          </Button>
        </div>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
          <span className="ml-3 text-sm text-slate-500">Memuat data tagihan...</span>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState title="Gagal Memuat Data" description={error} />
      )}

      {/* Empty State */}
      {!loading && !error && tagihanList.length === 0 && (
        <EmptyState
          title="Belum Ada Tagihan"
          description="Belum ada tagihan SPP yang tercatat untuk saat ini."
        />
      )}

      {/* Tagihan Cards / Table */}
      {!loading && !error && tagihanList.length > 0 && (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-800">
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
                    <span className="font-extrabold text-slate-800 text-base">
                      SPP {BULAN_NAMES[tag.bulan] || tag.bulan} {tag.tahun}
                    </span>
                    <StatusBadge status={tag.status as "BELUM_BAYAR" | "TERLAMBAT" | "MENUNGGU_VERIFIKASI" | "DIBAYAR_SEBAGIAN" | "SUDAH_BAYAR" | "DIBATALKAN"} />
                  </div>
                  <div className="text-xs text-slate-500">{tag.labelStatus}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Jatuh Tempo: {new Date(tag.jatuhTempo).toLocaleDateString("id-ID")}</span>
                  </div>
                  {tag.totalTerbayar > 0 && (
                    <div className="text-xs text-yellow-500">
                      Total terbayar: Rp {tag.totalTerbayar.toLocaleString("id-ID")} | Sisa: Rp {tag.sisaTunggakan.toLocaleString("id-ID")}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] text-slate-400 block">Nominal Tagihan</span>
                    <span className="font-black text-lg text-yellow-700">
                      Rp {tag.nominal.toLocaleString("id-ID")}
                    </span>
                  </div>

                  {(tag.status === "BELUM_BAYAR" || tag.status === "TERLAMBAT") && (
                    <Button
                      onClick={() => {
                        setSelectedTagihan(tag)
                        setJumlahTransfer(String(tag.nominal))
                      }}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[44px] text-xs px-5 shadow-sm"
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

                  {(tag.status === "SUDAH_BAYAR" || tag.status === "LUNAS") && (
                    <span className="text-xs text-yellow-600 bg-yellow-50 px-3 py-2 rounded-xl font-bold border border-yellow-200 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Lunas
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Modal Upload Bukti Transfer */}
      {selectedTagihan && (
        <Dialog open={!!selectedTagihan} onOpenChange={() => setSelectedTagihan(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-800">
                Konfirmasi Pembayaran: SPP {BULAN_NAMES[selectedTagihan.bulan] || selectedTagihan.bulan} {selectedTagihan.tahun}
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Kirimkan rincian transfer dan foto/dokumen struk bukti transfer Anda
              </p>
            </DialogHeader>

            <form onSubmit={handleUploadBukti} className="space-y-4 py-2">
              <div className="p-3.5 rounded-xl bg-yellow-50 border border-yellow-200 flex justify-between items-center text-xs font-bold text-yellow-900">
                <span>Total yang Harus Ditransfer:</span>
                <span className="text-base text-yellow-700">
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
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[40px]"
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
