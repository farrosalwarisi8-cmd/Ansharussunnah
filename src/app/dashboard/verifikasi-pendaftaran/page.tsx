// src/app/dashboard/verifikasi-pendaftaran/page.tsx

"use client"

import * as React from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { getPendaftaranList, getPendaftaranDetail, verifikasiPendaftaran } from "@/actions/verifikasi"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CheckCircle2, XCircle, ExternalLink, Loader2, Search, RefreshCw, FileX, ArrowUpDown } from "lucide-react"
import type { PendaftaranWithRelations } from "@/types"

// Helper: Format label from enum value
function formatStatusOrangTua(val?: string | null): string {
  if (!val) return "-"
  const map: Record<string, string> = {
    MASIH_HIDUP: "Masih Hidup",
    SUDAH_MENINGGAL: "Sudah Meninggal",
    TIDAK_DIKETAHUI: "Tidak Diketahui",
  }
  return map[val] || val
}

function formatStatusWali(val?: string | null): string {
  if (!val) return "-"
  const map: Record<string, string> = {
    SAMA_DENGAN_AYAH: "Sama dengan Ayah",
    SAMA_DENGAN_IBU: "Sama dengan Ibu",
    LAINNYA: "Lainnya",
  }
  return map[val] || val
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

type PendaftaranDetail = PendaftaranWithRelations;

type DetailData = {
  pendaftaran: PendaftaranWithRelations
  signedUrls: {
    kartuKeluarga?: string | null
    akteLahir?: string | null
    foto?: string | null
    buktiTransfer: Array<{ id: string; url: string | null }>
  }
}

const STATUS_FILTERS = [
  { value: "ALL", label: "Semua" },
  { value: "MENUNGGU_VERIFIKASI", label: "Menunggu Verifikasi" },
  { value: "DITERIMA", label: "Diterima" },
  { value: "DITOLAK", label: "Ditolak" },
] as const;

export default function VerifikasiPendaftaranPage() {
  const { toast } = useToast()

  // List state
  const [pendaftaranList, setPendaftaranList] = React.useState<PendaftaranDetail[]>([])
  const [loading, setLoading] = React.useState(true)
  const [totalItems, setTotalItems] = React.useState(0)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)

  // Filter & search
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL")
  const [sortBy, setSortBy] = React.useState<"newest" | "oldest">("newest")

  // Detail modal
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [detailData, setDetailData] = React.useState<DetailData | null>(null)
  const [loadingDetail, setLoadingDetail] = React.useState(false)

  // Action states
  const [alasanPenolakan, setAlasanPenolakan] = React.useState("Berkas Akta Kelahiran dan foto bukti transfer buram/tidak terbaca.")
  const [isRejectDialogOpen, setIsRejectDialogOpen] = React.useState(false)
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = React.useState(false)
  const [processing, setProcessing] = React.useState(false)

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1);
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch list
  const fetchList = React.useCallback(async () => {
    setLoading(true)
    try {
      const statusParam = statusFilter === "ALL" ? undefined : statusFilter as "MENUNGGU_VERIFIKASI" | "DITERIMA" | "DITOLAK"
      const result = await getPendaftaranList({
        status: statusParam,
        search: debouncedSearch || undefined,
        page: currentPage,
        limit: 10,
        sortBy,
      })
      if (result.success && result.data) {
        setPendaftaranList(result.data.items)
        setTotalItems(result.data.total)
        setTotalPages(result.data.totalPages)
      } else {
        toast({ title: "Gagal memuat data", description: result.message, variant: "destructive" as never })
      }
    } catch {
      toast({ title: "Error", description: "Gagal menghubungi server", variant: "destructive" as never })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, debouncedSearch, currentPage, sortBy, toast])

  React.useEffect(() => {
    fetchList()
  }, [fetchList])

  // Fetch detail when clicking "Periksa Berkas"
  const handleOpenDetail = async (id: string) => {
    setSelectedId(id)
    setLoadingDetail(true)
    setDetailData(null)
    try {
      const result = await getPendaftaranDetail(id)
      if (result.success && result.data) {
        setDetailData(result.data)
      } else {
        toast({ title: "Gagal memuat detail", description: result.message, variant: "destructive" as never })
        setSelectedId(null)
      }
    } catch {
      toast({ title: "Error", description: "Gagal menghubungi server", variant: "destructive" as never })
      setSelectedId(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleCloseDetail = () => {
    setSelectedId(null)
    setDetailData(null)
  }

  // Approve
  const handleApprove = async () => {
    if (!detailData) return
    setProcessing(true)
    try {
      const result = await verifikasiPendaftaran({
        pendaftaranId: detailData.pendaftaran.id,
        status: "DITERIMA",
      })
      if (result.success) {
        toast({ title: "Pendaftaran Disetujui!", description: result.message })
      } else {
        toast({ title: "Gagal", description: result.message, variant: "destructive" as never })
      }
      handleCloseDetail()
      setIsApproveConfirmOpen(false)
      fetchList()
    } catch {
      toast({ title: "Error", description: "Gagal memproses verifikasi", variant: "destructive" as never })
    } finally {
      setProcessing(false)
    }
  }

  // Reject
  const handleReject = async () => {
    if (!detailData) return
    setProcessing(true)
    try {
      const result = await verifikasiPendaftaran({
        pendaftaranId: detailData.pendaftaran.id,
        status: "DITOLAK",
        alasanPenolakan,
      })
      if (result.success) {
        toast({ title: "Pendaftaran Ditolak", description: result.message })
      } else {
        toast({ title: "Gagal", description: result.message, variant: "destructive" as never })
      }
      handleCloseDetail()
      setIsRejectDialogOpen(false)
      fetchList()
    } catch {
      toast({ title: "Error", description: "Gagal memproses verifikasi", variant: "destructive" as never })
    } finally {
      setProcessing(false)
    }
  }

  const pendaftar = detailData?.pendaftaran
  const signedUrls = detailData?.signedUrls

  // DetailRow helper
  const DetailRow = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <span className="text-slate-400">{label}: </span>
      <strong className="text-slate-800">{value || "-"}</strong>
    </div>
  )

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <DashboardHeader
        title="Verifikasi Penerimaan Santri Baru (PSB)"
        subtitle="Review berkas pendaftaran, bukti transfer biaya formulir, dan terbitkan status penerimaan santri."
      />

      {/* Filter Bar */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari nama atau nomor registrasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortBy(sortBy === "newest" ? "oldest" : "newest")}
                className="rounded-xl gap-1.5"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {sortBy === "newest" ? "Terbaru" : "Terlama"}
              </Button>
              <Button variant="outline" size="sm" onClick={fetchList} className="rounded-xl">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Muat Ulang
              </Button>
            </div>
            <div className="text-xs font-bold text-slate-600">
              Total: <strong>{totalItems}</strong> pendaftar
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => { setStatusFilter(f.value); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Pendaftar List / Table */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-800">
            Antrean Calon Santri
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-sm text-slate-500">Memuat data pendaftaran...</span>
            </div>
          )}
          {!loading && pendaftaranList.length === 0 && (
            <div className="py-12">
              <EmptyState
                icon={FileX}
                title="Tidak ada data pendaftaran"
                description={search ? "Tidak ditemukan hasil pencarian. Coba kata kunci lain." : "Belum ada pendaftaran yang masuk."}
              />
            </div>
          )}
          {!loading && pendaftaranList.length > 0 && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-600">
                    <tr>
                      <th className="p-4 pl-6">No. Pendaftaran</th>
                      <th className="p-4">Nama Calon Santri</th>
                      <th className="p-4">Jenjang Tujuan</th>
                      <th className="p-4">Orang Tua / Wali</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 pr-6 text-right">Aksi Verifikasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendaftaranList.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="p-4 pl-6 font-mono font-bold text-yellow-700 text-xs">
                          {p.nomorPendaftaran}
                          <div className="text-[10px] text-slate-400 font-sans font-normal">{formatDate(p.createdAt)}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-800">{p.namaLengkap}</div>
                          <div className="text-xs text-slate-400 font-mono">NISN: {p.nisn || "-"}</div>
                        </td>
                        <td className="p-4 text-xs font-semibold text-slate-700">
                          {p.jenjangTujuan.nama}
                          {p.kelasTujuan && <span className="text-slate-400 font-normal"> / {p.kelasTujuan.nama}</span>}
                        </td>
                        <td className="p-4 text-xs text-slate-600">
                          <div className="font-bold text-slate-800">{p.namaOrangTua}</div>
                          <div className="text-slate-400">{p.noHpOrangTua}</div>
                        </td>
                        <td className="p-4">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <Button
                            size="sm"
                            onClick={() => handleOpenDetail(p.id)}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl min-h-[36px] text-xs font-bold"
                          >
                            Periksa Berkas
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden p-4 space-y-3">
                {pendaftaranList.map((p) => (
                  <div key={p.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-yellow-700 block">
                          {p.nomorPendaftaran}
                        </span>
                        <div className="font-bold text-slate-800 text-sm mt-0.5">{p.namaLengkap}</div>
                      </div>
                      <StatusBadge status={p.status} size="sm" />
                    </div>
                    <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                      <div>Jenjang: <strong>{p.jenjangTujuan.nama}</strong></div>
                      <div>Orang Tua: <strong>{p.namaOrangTua}</strong> ({p.noHpOrangTua})</div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleOpenDetail(p.id)}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl min-h-[40px] text-xs font-bold"
                    >
                      Periksa Berkas
                    </Button>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((c) => Math.max(1, c - 1))}
                    disabled={currentPage === 1}
                    className="rounded-xl text-xs"
                  >
                    Sebelumnya
                  </Button>
                  <span className="text-xs text-slate-500">
                    Halaman {currentPage} dari {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((c) => Math.min(totalPages, c + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-xl text-xs"
                  >
                    Selanjutnya
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Review Berkas & Verifikasi */}
      <Dialog open={!!selectedId} onOpenChange={(open) => !open && handleCloseDetail()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {loadingDetail && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-sm text-slate-500">Memuat detail berkas...</span>
            </div>
          )}

          {!loadingDetail && pendaftar && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-slate-800">
                  Detail Berkas: {pendaftar.namaLengkap}
                </DialogTitle>
                <p className="text-xs text-slate-500 font-mono">
                  {pendaftar.nomorPendaftaran} • {pendaftar.jenjangTujuan.nama}
                  {pendaftar.kelasTujuan && (" • " + pendaftar.kelasTujuan.nama)}
                </p>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs sm:text-sm">
                {/* ---- DATA CALON SISWA ---- */}
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-2">
                  <h4 className="font-bold text-blue-900 uppercase text-xs">Data Calon Siswa</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                    <DetailRow label="Nama Lengkap" value={pendaftar.namaLengkap} />
                    <DetailRow label="Jenis Kelamin" value={pendaftar.jenisKelamin === "LAKI_LAKI" ? "Laki-laki" : "Perempuan"} />
                    <DetailRow label="Tempat Lahir" value={pendaftar.tempatLahir} />
                    <DetailRow label="Tanggal Lahir" value={pendaftar.tanggalLahir ? formatDate(pendaftar.tanggalLahir) : null} />
                    <DetailRow label="NISN" value={pendaftar.nisn} />
                    <DetailRow label="Agama" value={pendaftar.agama} />
                    <DetailRow label="No. HP Siswa" value={pendaftar.noHpSiswa} />
                    <div className="col-span-2">
                      <DetailRow label="Alamat" value={pendaftar.alamatSiswa} />
                    </div>
                  </div>
                </div>

                {/* ---- DATA KONTAK ORANG TUA ---- */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-800 uppercase text-xs">Data Kontak Orang Tua</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                    <DetailRow label="Nama" value={pendaftar.namaOrangTua} />
                    <DetailRow label="No. HP / WA" value={pendaftar.noHpOrangTua} />
                    <div className="col-span-2">
                      <DetailRow label="Email" value={pendaftar.emailOrangTua} />
                    </div>
                    {pendaftar.alamatOrangTua && (
                      <div className="col-span-2">
                        <DetailRow label="Alamat" value={pendaftar.alamatOrangTua} />
                      </div>
                    )}
                  </div>
                </div>

                {/* ---- DATA AYAH KANDUNG ---- */}
                {(pendaftar.namaAyahKandung || pendaftar.statusAyahKandung) && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                    <h4 className="font-bold text-amber-900 uppercase text-xs">Data Ayah Kandung</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                      <DetailRow label="Nama" value={pendaftar.namaAyahKandung} />
                      <DetailRow label="Status" value={formatStatusOrangTua(pendaftar.statusAyahKandung)} />
                      {pendaftar.statusAyahKandung === "MASIH_HIDUP" && pendaftar.nikAyah && (
                        <DetailRow label="NIK" value={pendaftar.nikAyah} />
                      )}
                    </div>
                  </div>
                )}

                {/* ---- DATA IBU KANDUNG ---- */}
                {(pendaftar.namaIbuKandung || pendaftar.statusIbuKandung) && (
                  <div className="p-4 rounded-2xl bg-pink-50 border border-pink-200 space-y-2">
                    <h4 className="font-bold text-pink-900 uppercase text-xs">Data Ibu Kandung</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                      <DetailRow label="Nama" value={pendaftar.namaIbuKandung} />
                      <DetailRow label="Status" value={formatStatusOrangTua(pendaftar.statusIbuKandung)} />
                      {pendaftar.statusIbuKandung === "MASIH_HIDUP" && pendaftar.nikIbu && (
                        <DetailRow label="NIK" value={pendaftar.nikIbu} />
                      )}
                    </div>
                  </div>
                )}

                {/* ---- DATA WALI ---- */}
                {pendaftar.statusWali && (
                  <div className="p-4 rounded-2xl bg-violet-50 border border-violet-200 space-y-2">
                    <h4 className="font-bold text-violet-900 uppercase text-xs">Data Wali</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                      <DetailRow label="Status" value={formatStatusWali(pendaftar.statusWali)} />
                      {pendaftar.statusWali === "LAINNYA" && pendaftar.namaWali && (
                        <DetailRow label="Nama Wali" value={pendaftar.namaWali} />
                      )}
                    </div>
                  </div>
                )}

                {/* ---- KEWARGANEGARAAN ---- */}
                {pendaftar.kewarganegaraan && pendaftar.kewarganegaraan !== "WNI" && (
                  <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 space-y-2">
                    <h4 className="font-bold text-teal-900 uppercase text-xs">Kewarganegaraan</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                      <DetailRow label="Kewarganegaraan" value={pendaftar.kewarganegaraan} />
                      {pendaftar.kitas && (
                        <DetailRow label="No. KITAS" value={pendaftar.kitas} />
                      )}
                      {pendaftar.asalNegara && (
                        <DetailRow label="Asal Negara" value={pendaftar.asalNegara} />
                      )}
                    </div>
                  </div>
                )}

                {/* ---- DOKUMEN TERLAMPIR ---- */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 uppercase text-xs">Dokumen Terlampir:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {signedUrls?.buktiTransfer?.map((bt) => (
                      <a
                        key={bt.id}
                        href={bt.url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 font-bold flex items-center justify-between hover:bg-yellow-100 transition-colors"
                      >
                        <span>Foto Bukti Transfer</span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ))}
                    {signedUrls?.kartuKeluarga && (
                      <a
                        href={signedUrls.kartuKeluarga}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold flex items-center justify-between hover:bg-slate-100 transition-colors"
                      >
                        <span>Dokumen Kartu Keluarga</span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    {signedUrls?.akteLahir && (
                      <a
                        href={signedUrls.akteLahir}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold flex items-center justify-between hover:bg-slate-100 transition-colors"
                      >
                        <span>Akta Kelahiran</span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    {signedUrls?.foto && (
                      <a
                        href={signedUrls.foto}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold flex items-center justify-between hover:bg-slate-100 transition-colors"
                      >
                        <span>Pas Foto</span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-100">
                <Button type="button" variant="destructive" onClick={() => setIsRejectDialogOpen(true)} className="rounded-xl min-h-[44px] text-xs font-bold">
                  <XCircle className="h-4 w-4 mr-1.5" />
                  Tolak Pendaftaran
                </Button>
                <Button type="button" onClick={() => setIsApproveConfirmOpen(true)} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[44px] text-xs px-6">
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Terima Santri &amp; Terbitkan Akun
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Tolak Pendaftaran */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-700">
              Tolak Berkas Pendaftaran
            </DialogTitle>
            <p className="text-xs text-slate-500">Tuliskan alasan penolakan secara jelas agar orang tua calon santri dapat memperbaiki berkas</p>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <label className="text-xs font-semibold text-slate-700">Alasan Penolakan:</label>
            <Input value={alasanPenolakan} onChange={(e) => setAlasanPenolakan(e.target.value)} className="h-11 rounded-xl text-sm" required />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)} className="rounded-xl min-h-[40px]">Batal</Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing} className="rounded-xl min-h-[40px] font-bold">
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Konfirmasi Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Approve Santri */}
      <ConfirmDialog
        open={isApproveConfirmOpen}
        onOpenChange={setIsApproveConfirmOpen}
        title="Terima Calon Santri Baru?"
        description={"Apakah Anda yakin ingin menyetujui pendaftaran " + (pendaftar?.namaLengkap || "") + "? Akun login santri dan orang tua akan otomatis di-generate oleh sistem."}
        confirmText="Ya, Terima Santri"
        variant="default"
        isLoading={processing}
        onConfirm={handleApprove}
      />
    </div>
  )
}