"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { Plus, Clock, Loader2, Trash2, Pencil } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"
const ConfirmDialog = dynamic(() => import("@/components/ui/confirm-dialog").then(m => m.ConfirmDialog), { ssr: false })
const Dialog = dynamic(() => import("@/components/ui/dialog").then(m => m.Dialog), { ssr: false })
const DialogContent = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogContent), { ssr: false })
const DialogHeader = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogHeader), { ssr: false })
const DialogTitle = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogTitle), { ssr: false })
const DialogFooter = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogFooter), { ssr: false })
import { getDaftarTugasGuru, deleteTugas, updateTugas } from "@/actions/tugas"
import { getDaftarKelasYangDiajarGuru } from "@/actions/guru-kelas"

type GuruTugasItem = {
  id: string
  judul: string
  mataPelajaran: string
  deadline: string | Date
  periode: string
  guru: string
  totalPengumpulan: number
  hasLampiran: boolean
}

type KelasItem = {
  kelasId: string
  namaKelas: string
  jenjang: string
  mataPelajaranId: string
  jumlahSiswa: number
}

export function GuruTugasView() {
  const { toast } = useToast()
  const [kelasList, setKelasList] = React.useState<KelasItem[]>([])
  const [selectedKelasId, setSelectedKelasId] = React.useState<string>("")
  const [loadingKelas, setLoadingKelas] = React.useState(true)
  const [tugasList, setTugasList] = React.useState<GuruTugasItem[]>([])
  const [loadingTugas, setLoadingTugas] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<GuruTugasItem | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [editTugas, setEditTugas] = React.useState<GuruTugasItem | null>(null)
  const [editJudul, setEditJudul] = React.useState("")
  const [editDeskripsi, setEditDeskripsi] = React.useState("")
  const [editDeadline, setEditDeadline] = React.useState("")
  const [editing, setEditing] = React.useState(false)

  const handleEditTugas = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTugas) return
    setEditing(true)
    try {
      const result = await updateTugas(editTugas.id, {
        judul: editJudul || undefined,
        deskripsi: editDeskripsi || undefined,
        deadline: editDeadline ? new Date(editDeadline).toISOString() : undefined,
      })
      if (result.success) {
        toast({ title: "Tugas Diperbarui! ✅", description: result.message })
        setIsEditOpen(false)
        setEditTugas(null)
        if (selectedKelasId) {
          const fetchResult = await getDaftarTugasGuru(selectedKelasId)
          if (fetchResult.success && fetchResult.data) {
            setTugasList(fetchResult.data as GuruTugasItem[])
          }
        }
      } else {
        toast({ variant: "destructive", title: "Gagal", description: result.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Terjadi kesalahan server." })
    } finally {
      setEditing(false)
    }
  }

  const handleDeleteTugas = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const result = await deleteTugas(deleteTarget.id)
      if (result.success) {
        toast({ title: "Tugas Dihapus", description: result.message })
        setTugasList((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      } else {
        toast({ variant: "destructive", title: "Gagal Menghapus", description: result.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Terjadi kesalahan server." })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

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

  React.useEffect(() => {
    if (!selectedKelasId) return
    async function fetchTugas() {
      setLoadingTugas(true)
      try {
        const result = await getDaftarTugasGuru(selectedKelasId)
        if (result.success && result.data) {
          setTugasList(result.data as GuruTugasItem[])
        } else {
          setTugasList([])
        }
      } catch {
        setTugasList([])
      } finally {
        setLoadingTugas(false)
      }
    }
    fetchTugas()
  }, [selectedKelasId])

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
              onChange={(e) => setSelectedKelasId(e.target.value)}
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

      {loadingTugas && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
          <span className="ml-3 text-sm text-slate-500">Memuat daftar tugas...</span>
        </div>
      )}

      {!loadingTugas && tugasList.length === 0 && (
        <EmptyState
          title="Belum Ada Tugas"
          description="Belum ada tugas yang dibuat untuk kelas ini."
        />
      )}

      {!loadingTugas && tugasList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {tugasList.map((item) => (
            <Card key={item.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-lg border border-yellow-100">
                    {item.mataPelajaran}
                  </span>
                  {item.hasLampiran && (
                    <span className="text-[10px] font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      Ada Lampiran
                    </span>
                  )}
                </div>
                <CardTitle className="text-base font-bold text-slate-800 leading-snug">
                  {item.judul}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-5 pt-0 space-y-4">
                <div className="text-xs py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Deadline: <strong>{new Date(item.deadline).toLocaleDateString("id-ID")}</strong></span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Pengumpulan:</span>
                  <span className="font-bold text-slate-800">
                    {item.totalPengumpulan} pengumpulan
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button asChild className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-xl min-h-[44px]">
                    <Link href={`/dashboard/tugas/${item.id}`}>
                      Periksa &amp; Beri Nilai
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditTugas(item)
                      setEditJudul(item.judul)
                      setEditDeskripsi("")
                      setEditDeadline(new Date(item.deadline).toISOString().slice(0, 16))
                      setIsEditOpen(true)
                    }}
                    className="rounded-xl min-h-[44px] text-xs font-bold border-slate-200 px-3"
                    aria-label="Edit tugas"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDeleteTarget(item)
                      setDeleteDialogOpen(true)
                    }}
                    className="rounded-xl min-h-[44px] text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 px-3"
                    aria-label="Hapus tugas"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditTugas(null) }}>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-bold text-slate-800">Edit Tugas</DialogTitle>
                      <p className="text-xs text-slate-500">Perbarui data tugas {editTugas?.judul}</p>
                    </DialogHeader>
                    <form onSubmit={handleEditTugas} className="space-y-4 py-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Judul Tugas</label>
                        <Input value={editJudul} onChange={(e) => setEditJudul(e.target.value)} className="h-11 rounded-xl text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Deskripsi</label>
                        <Input value={editDeskripsi} onChange={(e) => setEditDeskripsi(e.target.value)} className="h-11 rounded-xl text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Deadline Baru</label>
                        <Input type="datetime-local" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} className="h-11 rounded-xl text-sm" />
                      </div>
                      <DialogFooter className="gap-2 sm:gap-0 pt-2">
                        <Button type="button" variant="outline" onClick={() => { setIsEditOpen(false); setEditTugas(null) }} className="rounded-xl min-h-[40px]">
                          Batal
                        </Button>
                        <Button type="submit" disabled={editing} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[40px]">
                          {editing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Pencil className="h-4 w-4 mr-1.5" />}
                          Simpan
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <ConfirmDialog
                  open={deleteDialogOpen}
                  onOpenChange={(open) => {
                    setDeleteDialogOpen(open)
                    if (!open) setDeleteTarget(null)
                  }}
                  title="Hapus Tugas?"
                  description={`Apakah Anda yakin ingin menghapus tugas "${deleteTarget?.judul}"? Tugas yang sudah memiliki pengumpulan tidak dapat dihapus.`}
                  confirmText={deleting ? "Menghapus..." : "Ya, Hapus"}
                  cancelText="Batal"
                  variant="destructive"
                  isLoading={deleting}
                  onConfirm={handleDeleteTugas}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
