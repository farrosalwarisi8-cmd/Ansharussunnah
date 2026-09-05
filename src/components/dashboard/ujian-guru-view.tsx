"use client"

import * as React from "react"
import { Plus, Clock, FileText, Play, BarChart2, Calendar, Award, Loader2, Pencil, Trash2, BarChart } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import dynamic from "next/dynamic"
const ConfirmDialog = dynamic(() => import("@/components/ui/confirm-dialog").then(m => m.ConfirmDialog), { ssr: false })
import { getDaftarUjianGuru, deleteUjian } from "@/actions/ujian"
import { getDaftarKelasYangDiajarGuru } from "@/actions/guru-kelas"
import { useToast } from "@/hooks/use-toast"

type KelasItem = {
  kelasId: string
  namaKelas: string
  jenjang: string
  mataPelajaranId: string
  jumlahSiswa: number
}

type UjianItem = {
  id: string
  judul: string
  deskripsi?: string | null
  mataPelajaran: string
  durasiMenit: number
  waktuMulai: Date
  waktuSelesai: Date
  totalSoal: number
  guru: string
  statusPengerjaan?: string
  nilai?: number | null
  status?: string
  totalPeserta?: number
  kelasId?: string
}

export function GuruUjianView() {
  const { toast } = useToast()
  const router = useRouter()
  const [kelasList, setKelasList] = React.useState<KelasItem[]>([])
  const [selectedKelasId, setSelectedKelasId] = React.useState<string>("")
  const [loadingKelas, setLoadingKelas] = React.useState(true)
  const [ujianList, setUjianList] = React.useState<UjianItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<UjianItem | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    async function fetchKelas() {
      setLoadingKelas(true)
      try {
        const result = await getDaftarKelasYangDiajarGuru()
        if (result.success && result.data) {
          const data = result.data as KelasItem[]
          setKelasList(data)
          if (data.length > 0) {
            setSelectedKelasId(data[0].kelasId)
          }
        }
      } catch {
        // Silently fail
      } finally {
        setLoadingKelas(false)
      }
    }
    fetchKelas()
  }, [])

  const fetchUjian = React.useCallback(async () => {
    if (!selectedKelasId) return
    setLoading(true)
    setError(null)
    try {
      const result = await getDaftarUjianGuru(selectedKelasId)
      if (result.success && result.data) {
        setUjianList(result.data as UjianItem[])
      } else {
        setError(result.message || "Gagal memuat data ujian")
      }
    } catch {
      setError("Gagal memuat data ujian")
    } finally {
      setLoading(false)
    }
  }, [selectedKelasId])

  React.useEffect(() => {
    fetchUjian()
  }, [fetchUjian])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const result = await deleteUjian(deleteTarget.id)
      if (result.success) {
        toast({
          title: "Ujian Berhasil Dihapus",
          description: `"${deleteTarget.judul}" telah dihapus.`,
        })
        setUjianList((prev) => prev.filter((u) => u.id !== deleteTarget.id))
      } else {
        toast({
          variant: "destructive",
          title: "Gagal Menghapus Ujian",
          description: result.message,
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal Menghapus Ujian",
        description: "Terjadi kesalahan saat menghapus ujian.",
      })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  if (loadingKelas) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        <span className="ml-3 text-sm text-slate-500">Memuat daftar kelas...</span>
      </div>
    )
  }

  if (kelasList.length === 0) {
    return (
      <EmptyState
        title="Belum Ada Kelas"
        description="Anda belum ditugaskan mengajar di kelas manapun."
      />
    )
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pilih Kelas:
            </label>
            <select
              value={selectedKelasId}
              onChange={(e) => {
                setSelectedKelasId(e.target.value)
                setError(null)
              }}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-yellow-500"
            >
              {kelasList.map((k) => (
                <option key={k.kelasId} value={k.kelasId}>
                  {k.namaKelas} — {k.jumlahSiswa} siswa
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {error && <EmptyState title="Gagal Memuat Data" description={error} />}

      {!error && loading && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
          <span className="ml-3 text-sm text-slate-500">Memuat daftar ujian...</span>
        </div>
      )}

      {!error && !loading && ujianList.length === 0 && (
        <EmptyState
          title="Belum Ada Ujian"
          description="Anda belum membuat ujian untuk kelas ini. Klik tombol di atas untuk membuat ujian baru."
        />
      )}

      {!error && !loading && ujianList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {ujianList.map((item) => (
          <Card key={item.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-lg border border-yellow-100">
                  {item.mataPelajaran}
                </span>
                <StatusBadge status={item.status as "DRAFT" | "AKTIF" | "SELESAI" | "PUBLISHED"} />
              </div>
              <CardTitle className="text-base font-bold text-slate-800 leading-snug">
                {item.judul}
              </CardTitle>
            </CardHeader>

            <CardContent className="p-5 pt-0 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs py-3 border-y border-slate-100 text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>{item.durasiMenit} Menit</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span>{item.totalSoal} Butir Soal</span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>Mulai: {new Date(item.waktuMulai).toLocaleDateString("id-ID")} WIB</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Peserta:</span>
                <span className="font-bold text-slate-800">
                  {item.totalPeserta || 0} Santri
                </span>
              </div>

              {/* Actions: Rekap Hasil + Edit + Hapus */}
              <div className="flex items-center gap-2 pt-1">
                <Button asChild variant="outline" size="sm" className="flex-1 rounded-xl min-h-[38px] text-xs font-bold">
                  <Link href={`/dashboard/ujian/${item.id}/rekap`}>
                    <BarChart2 className="h-3.5 w-3.5 mr-1 text-yellow-600" />
                    Rekap Hasil
                  </Link>
                </Button>
                <Button asChild size="sm" className="bg-slate-800 hover:bg-slate-800 text-white rounded-xl min-h-[38px] text-xs font-bold">
                  <Link href={`/dashboard/ujian/${item.id}/preview`}>
                    Preview
                  </Link>
                </Button>
              </div>

              {/* Edit & Delete buttons */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/dashboard/ujian/buat?edit=${item.id}`)}
                  className="flex-1 rounded-xl min-h-[38px] text-xs font-bold text-slate-600 border-slate-200"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDeleteTarget(item)
                    setDeleteDialogOpen(true)
                  }}
                  className="rounded-xl min-h-[38px] text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) setDeleteTarget(null)
        }}
        title="Hapus Ujian?"
        description={`Apakah Anda yakin ingin menghapus ujian "${deleteTarget?.judul}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText={deleting ? "Menghapus..." : "Ya, Hapus"}
        cancelText="Batal"
        variant="destructive"
        isLoading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
