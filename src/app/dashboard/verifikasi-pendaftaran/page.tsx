// src/app/dashboard/verifikasi-pendaftaran/page.tsx

"use client"

import * as React from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { verifikasiPendaftaran } from "@/actions/verifikasi"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CheckCircle2, XCircle, ExternalLink, Loader2, Search } from "lucide-react"

export default function VerifikasiPendaftaranPage() {
  const { toast } = useToast()

  const [search, setSearch] = React.useState("")
  const [selectedPendaftar, setSelectedPendaftar] = React.useState<{
    id: string
    nomorPendaftaran: string
    namaLengkap: string
    jenjangTujuan: string
    namaOrtu: string
    noHpOrtu: string
    emailOrtu: string
    buktiTransferUrl?: string
    dokumenKK?: string
    dokumenAkta?: string
    status: string
  } | null>(null)
  const [alasanPenolakan, setAlasanPenolakan] = React.useState("Berkas Akta Kelahiran dan foto bukti transfer buram/tidak terbaca.")
  const [isRejectDialogOpen, setIsRejectDialogOpen] = React.useState(false)
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = React.useState(false)
  const [processing, setProcessing] = React.useState(false)

  const [pendaftaranList, setPendaftaranList] = React.useState([
    {
      id: "reg-1",
      nomorPendaftaran: "REG-2024-00128",
      namaLengkap: "Ibrahim Khalid Al-Ayyubi",
      jenisKelamin: "LAKI_LAKI",
      nisn: "0098765432",
      jenjangTujuan: "Madrasah Tsanawiyyah (MTs)",
      namaOrtu: "Khalid bin Walid",
      noHpOrtu: "081234567800",
      emailOrtu: "khalid@example.com",
      status: "MENUNGGU_VERIFIKASI",
      buktiTransferUrl: "https://drive.google.com/file/d/example-transfer-reg.jpg",
      dokumenKK: "https://drive.google.com/file/d/example-kk.pdf",
      dokumenAkta: "https://drive.google.com/file/d/example-akta.pdf",
      tanggalDaftar: "02 Maret 2024",
    },
    {
      id: "reg-2",
      nomorPendaftaran: "REG-2024-00129",
      namaLengkap: "Maryam Shalihah",
      jenisKelamin: "PEREMPUAN",
      nisn: "0098765433",
      jenjangTujuan: "Madrasah Tsanawiyyah (MTs)",
      namaOrtu: "Imran bin Ya'qub",
      noHpOrtu: "081234567801",
      emailOrtu: "imran@example.com",
      status: "MENUNGGU_VERIFIKASI",
      buktiTransferUrl: "https://drive.google.com/file/d/example-transfer-maryam.jpg",
      dokumenKK: "https://drive.google.com/file/d/example-kk-2.pdf",
      dokumenAkta: "https://drive.google.com/file/d/example-akta-2.pdf",
      tanggalDaftar: "03 Maret 2024",
    },
    {
      id: "reg-3",
      nomorPendaftaran: "REG-2024-00125",
      namaLengkap: "Yusuf Al-Banna",
      jenisKelamin: "LAKI_LAKI",
      nisn: "0098765420",
      jenjangTujuan: "Madrasah Aliyah (MA)",
      namaOrtu: "Hasan Al-Banna",
      noHpOrtu: "081234567802",
      emailOrtu: "hasan@example.com",
      status: "DITERIMA",
      tanggalDaftar: "25 Februari 2024",
    },
  ])

  const handleApprove = async () => {
    if (!selectedPendaftar) return
    setProcessing(true)

    try {
      // Direct call Server Action verifikasiPendaftaran
      await verifikasiPendaftaran({
        pendaftaranId: selectedPendaftar.id,
        status: "DITERIMA",
      })

      setPendaftaranList((prev) =>
        prev.map((p) =>
          p.id === selectedPendaftar.id ? { ...p, status: "DITERIMA" } : p
        )
      )

      toast({
        title: "Pendaftaran Disetujui! 🎓",
        description: `Calon santri ${selectedPendaftar.namaLengkap} resmi diterima. Akun santri dan orang tua berhasil di-generate.`,
      })
      setSelectedPendaftar(null)
    } catch {
      setPendaftaranList((prev) =>
        prev.map((p) =>
          p.id === selectedPendaftar.id ? { ...p, status: "DITERIMA" } : p
        )
      )
      toast({
        title: "Pendaftaran Disetujui (Demo)",
        description: `Santri ${selectedPendaftar.namaLengkap} diterima.`,
      })
      setSelectedPendaftar(null)
    } finally {
      setProcessing(false)
      setIsApproveConfirmOpen(false)
    }
  }

  const handleReject = async () => {
    if (!selectedPendaftar) return
    setProcessing(true)

    try {
      // Direct call Server Action verifikasiPendaftaran
      await verifikasiPendaftaran({
        pendaftaranId: selectedPendaftar.id,
        status: "DITOLAK",
        alasanPenolakan,
      })

      setPendaftaranList((prev) =>
        prev.map((p) =>
          p.id === selectedPendaftar.id
            ? { ...p, status: "DITOLAK", alasanPenolakan }
            : p
        )
      )

      toast({
        title: "Pendaftaran Ditolak",
        description: `Pendaftar ${selectedPendaftar.namaLengkap} telah diberitahukan alasan penolakan.`,
      })
      setSelectedPendaftar(null)
    } catch {
      setPendaftaranList((prev) =>
        prev.map((p) =>
          p.id === selectedPendaftar.id ? { ...p, status: "DITOLAK" } : p
        )
      )
      toast({
        title: "Pendaftaran Ditolak (Demo)",
        description: "Status telah diupdate.",
      })
      setSelectedPendaftar(null)
    } finally {
      setProcessing(false)
      setIsRejectDialogOpen(false)
    }
  }

  const filteredList = pendaftaranList.filter(
    (p) =>
      p.namaLengkap.toLowerCase().includes(search.toLowerCase()) ||
      p.nomorPendaftaran.toLowerCase().includes(search.toLowerCase())
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

          <div className="text-xs font-bold text-slate-600">
            Total Pendaftar: <strong>{pendaftaranList.length} Santri</strong>
          </div>
        </div>
      </Card>

      {/* Pendaftar List / Table */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-900">
            Antrean Calon Santri
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {/* Desktop Table View */}
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
                {filteredList.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="p-4 pl-6 font-mono font-bold text-emerald-800 text-xs">
                      {p.nomorPendaftaran}
                      <div className="text-[10px] text-slate-400 font-sans font-normal">{p.tanggalDaftar}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{p.namaLengkap}</div>
                      <div className="text-xs text-slate-400 font-mono">NISN: {p.nisn}</div>
                    </td>
                    <td className="p-4 text-xs font-semibold text-slate-700">{p.jenjangTujuan}</td>
                    <td className="p-4 text-xs text-slate-600">
                      <div className="font-bold text-slate-800">{p.namaOrtu}</div>
                      <div className="text-slate-400">{p.noHpOrtu}</div>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={p.status as "MENUNGGU_VERIFIKASI" | "DITERIMA" | "DITOLAK"} />
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <Button
                        size="sm"
                        onClick={() => setSelectedPendaftar(p)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl min-h-[36px] text-xs font-bold"
                      >
                        Periksa Berkas &amp; Verifikasi
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden p-4 space-y-3">
            {filteredList.map((p) => (
              <div key={p.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-emerald-800 block">
                      {p.nomorPendaftaran}
                    </span>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">{p.namaLengkap}</div>
                  </div>
                  <StatusBadge status={p.status as "MENUNGGU_VERIFIKASI" | "DITERIMA" | "DITOLAK"} size="sm" />
                </div>

                <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                  <div>Jenjang: <strong>{p.jenjangTujuan}</strong></div>
                  <div>Orang Tua: <strong>{p.namaOrtu}</strong> ({p.noHpOrtu})</div>
                </div>

                <Button
                  size="sm"
                  onClick={() => setSelectedPendaftar(p)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl min-h-[40px] text-xs font-bold"
                >
                  Periksa Berkas &amp; Verifikasi
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal Review Berkas & Verifikasi */}
      {selectedPendaftar && (
        <Dialog open={!!selectedPendaftar} onOpenChange={() => setSelectedPendaftar(null)}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Detail Berkas: {selectedPendaftar.namaLengkap}
              </DialogTitle>
              <p className="text-xs text-slate-500 font-mono">
                {selectedPendaftar.nomorPendaftaran} • {selectedPendaftar.jenjangTujuan}
              </p>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs sm:text-sm">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 uppercase text-xs">Data Orang Tua / Wali:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div>Nama: <strong>{selectedPendaftar.namaOrtu}</strong></div>
                  <div>No. HP / WA: <strong>{selectedPendaftar.noHpOrtu}</strong></div>
                  <div className="col-span-2">Email: <strong>{selectedPendaftar.emailOrtu}</strong></div>
                </div>
              </div>

              {/* Document Attachment Links */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 uppercase text-xs">Dokumen Terlampir:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    href={selectedPendaftar.buktiTransferUrl || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold flex items-center justify-between hover:bg-emerald-100 transition-colors"
                  >
                    <span>Foto Bukti Transfer</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <a
                    href={selectedPendaftar.dokumenKK || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold flex items-center justify-between hover:bg-slate-100 transition-colors"
                  >
                    <span>Dokumen Kartu Keluarga</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <a
                    href={selectedPendaftar.dokumenAkta || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold flex items-center justify-between hover:bg-slate-100 transition-colors"
                  >
                    <span>Akta Kelahiran</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setIsRejectDialogOpen(true)}
                className="rounded-xl min-h-[44px] text-xs font-bold"
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                Tolak Pendaftaran
              </Button>
              <Button
                type="button"
                onClick={() => setIsApproveConfirmOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[44px] text-xs px-6"
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Terima Santri &amp; Terbitkan Akun
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog Tolak Pendaftaran */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-700">
              Tolak Berkas Pendaftaran
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Tuliskan alasan penolakan secara jelas agar orang tua calon santri dapat memperbaiki berkas
            </p>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <label className="text-xs font-semibold text-slate-700">Alasan Penolakan:</label>
            <Input
              value={alasanPenolakan}
              onChange={(e) => setAlasanPenolakan(e.target.value)}
              className="h-11 rounded-xl text-sm"
              required
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)} className="rounded-xl min-h-[40px]">
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing}
              className="rounded-xl min-h-[40px] font-bold"
            >
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
        description={`Apakah Anda yakin ingin menyetujui pendaftaran ${selectedPendaftar?.namaLengkap}? Akun login santri dan orang tua akan otomatis di-generate oleh sistem.`}
        confirmText="Ya, Terima Santri"
        variant="default"
        isLoading={processing}
        onConfirm={handleApprove}
      />
    </div>
  )
}
