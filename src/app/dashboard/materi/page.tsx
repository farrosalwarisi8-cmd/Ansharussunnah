// src/app/dashboard/materi/page.tsx

"use client"

import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { createMateri, getDaftarMateriSiswa, getDaftarMateriAnak, getDaftarMateriGuru, updateMateri, deleteMateri } from "@/actions/materi"
import { useToast } from "@/hooks/use-toast"
import { Role } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Plus, ExternalLink, Loader2, Pencil, Trash2 } from "lucide-react"
import { getDaftarKelasYangDiajarGuru } from "@/actions/guru-kelas"

type MateriItem = {
  id: string
  judul: string
  deskripsi?: string | null
  mataPelajaran: string
  urlFile?: string | null
  urlLink?: string | null
  signedUrl?: string | null
  periode?: string
  diunggahOleh?: string
  createdAt?: string | Date
}

type KelasItem = {
  kelasId: string
  namaKelas: string
  jenjang: string
  mataPelajaranId: string
  jumlahSiswa: number
}

export default function MateriPage() {
  const { user } = useDashboard()

  const isTeacher = user.role === Role.GURU || user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_AKADEMIK
  const isParent = user.role === Role.ORANG_TUA

  return <MateriPageContent isTeacher={isTeacher} isParent={isParent} />
}

function MateriPageContent({ isTeacher, isParent }: { isTeacher: boolean; isParent: boolean }) {
  const { user, selectedChild } = useDashboard()
  const { toast } = useToast()

  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [selectedMapelFilter, setSelectedMapelFilter] = React.useState("SEMUA")

  // Form State
  const [judul, setJudul] = React.useState("")
  const [deskripsi, setDeskripsi] = React.useState("")
  const [mapel, setMapel] = React.useState("Fiqih Ibadah")
  const [kelasId, setKelasId] = React.useState("")
  const [fileUrl, setFileUrl] = React.useState("")

  // Guru class list for dropdown
  const [kelasList, setKelasList] = React.useState<KelasItem[]>([])

  // Real data state
  const [materiList, setMateriList] = React.useState<MateriItem[]>([])
  const [fetchingMateri, setFetchingMateri] = React.useState(true)
  const [materiError, setMateriError] = React.useState<string | null>(null)

  // Edit/Delete states
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)
  const [editMateri, setEditMateri] = React.useState<MateriItem | null>(null)
  const [editJudul, setEditJudul] = React.useState("")
  const [editDeskripsi, setEditDeskripsi] = React.useState("")
  const [editMapel, setEditMapel] = React.useState("")
  const [editFileUrl, setEditFileUrl] = React.useState("")
  const [editing, setEditing] = React.useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<MateriItem | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  // Fetch guru's kelas list for dropdown
  React.useEffect(() => {
    if (!isTeacher) return
    async function fetchKelas() {
      try {
        const result = await getDaftarKelasYangDiajarGuru()
        if (result.success && result.data) {
          const data = result.data as KelasItem[]
          setKelasList(data)
          if (data.length > 0 && !kelasId) {
            setKelasId(data[0].kelasId)
          }
        }
      } catch {
        // Silent fail
      }
    }
    fetchKelas()
  }, [isTeacher, kelasId])

  // Fetch materi data
  const fetchMateri = React.useCallback(async () => {
    setFetchingMateri(true)
    setMateriError(null)
    try {
      let result = null
      if (isTeacher) {
        // For guru, use getDaftarMateriGuru with kelasId
        if (kelasList.length > 0 && kelasId) {
          result = await getDaftarMateriGuru(kelasId)
        }
      } else if (isParent && selectedChild) {
        result = await getDaftarMateriAnak(selectedChild.id)
      } else if (!isParent) {
        result = await getDaftarMateriSiswa()
      }

      if (!result) {
        setFetchingMateri(false)
        return
      }

      if (result.success && result.data) {
        setMateriList(result.data as MateriItem[])
      } else {
        setMateriError(result.message || "Gagal memuat daftar materi")
      }
    } catch {
      setMateriError("Gagal memuat daftar materi")
    } finally {
      setFetchingMateri(false)
    }
  }, [isTeacher, isParent, selectedChild, kelasId, kelasList.length])

  React.useEffect(() => {
    fetchMateri()
  }, [fetchMateri])

  const handleUploadMateri = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!judul.trim() || !fileUrl.trim()) {
      toast({ variant: "destructive", title: "Judul materi dan URL dokumen wajib diisi!" })
      return
    }

    setLoading(true)
    try {
      const result = await createMateri({
        judul,
        deskripsi,
        kelasId,
        periodeAjaranId: "periode-aktif",
        mataPelajaran: mapel,
        urlFile: fileUrl,
      })

      if (result.success) {
        toast({
          title: "Materi Berhasil Diterbitkan! 📚",
          description: `Materi "${judul}" kini dapat diakses santri.`,
        })
        setIsAddModalOpen(false)
        setJudul("")
        setDeskripsi("")
        setFileUrl("")
        await fetchMateri()
      } else {
        toast({
          variant: "destructive",
          title: "Gagal Menyimpan",
          description: result.message,
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: "Terjadi kesalahan saat menyimpan materi.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditMateri = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editMateri) return
    setEditing(true)
    try {
      const result = await updateMateri(editMateri.id, {
        judul: editJudul || undefined,
        deskripsi: editDeskripsi || undefined,
        mataPelajaran: editMapel || undefined,
        urlFile: editFileUrl || undefined,
      })

      if (result.success) {
        toast({ title: "Materi Diperbarui! ✅", description: result.message })
        setIsEditModalOpen(false)
        setEditMateri(null)
        await fetchMateri()
      } else {
        toast({ variant: "destructive", title: "Gagal Memperbarui", description: result.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Terjadi kesalahan server." })
    } finally {
      setEditing(false)
    }
  }

  const handleDeleteMateri = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const result = await deleteMateri(deleteTarget.id)
      if (result.success) {
        toast({ title: "Materi Dihapus", description: result.message })
        await fetchMateri()
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

  const mapelOptions = ["SEMUA", "Fiqih Ibadah", "Bahasa Arab", "Hadits Arba'in", "Tahfidz & Tajwid", "Aqidah Akhlak"]

  const filteredMateri = selectedMapelFilter === "SEMUA"
    ? materiList
    : materiList.filter((m) => m.mataPelajaran === selectedMapelFilter)

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={isTeacher ? "Pusat Materi Pembelajaran" : "Materi & Modul Pembelajaran"}
        subtitle="Repositori modul digital, kitab rujukan, rangkuman, dan rekaman audio pelajaran santri."
        action={
          isTeacher ? (
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md min-h-[44px]"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Unggah Materi Baru
            </Button>
          ) : null
        }
      />

      {isParent && <ChildSelector />}

      {/* Class Selector for Guru */}
      {isTeacher && kelasList.length > 1 && (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Pilih Kelas:
              </label>
              <select
                value={kelasId}
                onChange={(e) => setKelasId(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
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
      )}

      {/* Loading State */}
      {fetchingMateri && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="ml-3 text-sm text-slate-500">Memuat materi pembelajaran...</span>
        </div>
      )}

      {/* Error State */}
      {!fetchingMateri && materiError && (
        <EmptyState title="Gagal Memuat Data" description={materiError} />
      )}

      {/* Content */}
      {!fetchingMateri && !materiError && (
        <>
          {/* Filter Tabs by Mata Pelajaran */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {mapelOptions.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMapelFilter(m)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[40px] touch-manipulation ${
                  selectedMapelFilter === m
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Materi Cards Grid */}
          {filteredMateri.length === 0 ? (
            <EmptyState
              title="Belum Ada Materi"
              description="Belum ada materi pembelajaran yang tersedia untuk filter ini."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredMateri.map((mat) => (
                <Card key={mat.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                        {mat.mataPelajaran}
                      </span>
                    </div>
                    <CardTitle className="text-base font-bold text-slate-900 leading-snug">
                      {mat.judul}
                    </CardTitle>
                    {mat.deskripsi && (
                      <CardDescription className="text-xs text-slate-500 line-clamp-2 mt-1">
                        {mat.deskripsi}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-4">
                    <div className="text-xs py-2 border-y border-slate-100 text-slate-500 space-y-1">
                      {mat.diunggahOleh && (
                        <div className="flex items-center justify-between">
                          <span>Pengajar:</span>
                          <span className="font-semibold text-slate-700">{mat.diunggahOleh}</span>
                        </div>
                      )}
                      {mat.periode && (
                        <div className="flex items-center justify-between">
                          <span>Periode:</span>
                          <span className="font-semibold text-slate-700">{mat.periode}</span>
                        </div>
                      )}
                    </div>

                    {(mat.signedUrl || mat.urlFile || mat.urlLink) && (
                      <Button asChild className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl min-h-[44px] text-xs">
                        <a href={mat.signedUrl || mat.urlFile || mat.urlLink || "#"} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-2 text-emerald-400" />
                          Buka &amp; Unduh Materi
                        </a>
                      </Button>
                    )}

                    {/* Guru actions: Edit + Delete */}
                    {isTeacher && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditMateri(mat)
                            setEditJudul(mat.judul)
                            setEditDeskripsi(mat.deskripsi || "")
                            setEditMapel(mat.mataPelajaran)
                            setEditFileUrl(mat.urlFile || mat.urlLink || "")
                            setIsEditModalOpen(true)
                          }}
                          className="flex-1 rounded-xl text-xs font-bold min-h-[38px]"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDeleteTarget(mat)
                            setDeleteDialogOpen(true)
                          }}
                          className="rounded-xl text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 min-h-[38px]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal Upload Materi (Guru) */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Unggah Materi Pembelajaran Baru
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Bagikan modul atau tautan file bahan ajar kepada para santri
            </p>
          </DialogHeader>

          <form onSubmit={handleUploadMateri} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Judul Materi *
              </label>
              <Input
                placeholder="Contoh: Modul Kaidah Bahasa Arab Bab Fi'il"
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                className="h-11 rounded-xl text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Mata Pelajaran
                </label>
                <select
                  value={mapel}
                  onChange={(e) => setMapel(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Fiqih Ibadah">Fiqih Ibadah</option>
                  <option value="Bahasa Arab">Bahasa Arab</option>
                  <option value="Hadits Arba'in">Hadits Arba&apos;in</option>
                  <option value="Tahfidz & Tajwid">Tahfidz &amp; Tajwid</option>
                  <option value="Aqidah Akhlak">Aqidah Akhlak</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Kelas Tujuan
                </label>
                <select
                  value={kelasId}
                  onChange={(e) => setKelasId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  {kelasList.length > 0 ? (
                    kelasList.map((k) => (
                      <option key={k.kelasId} value={k.kelasId}>
                        {k.namaKelas}
                      </option>
                    ))
                  ) : (
                    <option value="7A-IKHWAN">Kelas 7A - Ikhwan</option>
                  )}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Tautan File / Cloud Document Link *
              </label>
              <Input
                placeholder="https://drive.google.com/file/d/..."
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                className="h-11 rounded-xl text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Deskripsi / Ringkasan Materi
              </label>
              <Textarea
                placeholder="Tuliskan gambaran isi materi untuk santri..."
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                className="rounded-xl min-h-[80px] text-sm"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-xl min-h-[40px]"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[40px]"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                Unggah Materi
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Edit Materi */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => { setIsEditModalOpen(open); if (!open) setEditMateri(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Edit Materi Pembelajaran
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditMateri} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Judul Materi</label>
              <Input
                value={editJudul}
                onChange={(e) => setEditJudul(e.target.value)}
                className="h-11 rounded-xl text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Mata Pelajaran</label>
              <select
                value={editMapel}
                onChange={(e) => setEditMapel(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Fiqih Ibadah">Fiqih Ibadah</option>
                <option value="Bahasa Arab">Bahasa Arab</option>
                <option value="Hadits Arba'in">Hadits Arba&apos;in</option>
                <option value="Tahfidz & Tajwid">Tahfidz &amp; Tajwid</option>
                <option value="Aqidah Akhlak">Aqidah Akhlak</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">URL File / Link</label>
              <Input
                value={editFileUrl}
                onChange={(e) => setEditFileUrl(e.target.value)}
                className="h-11 rounded-xl text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Deskripsi</label>
              <Textarea
                value={editDeskripsi}
                onChange={(e) => setEditDeskripsi(e.target.value)}
                className="rounded-xl min-h-[80px] text-sm"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => { setIsEditModalOpen(false); setEditMateri(null) }} className="rounded-xl min-h-[40px]">
                Batal
              </Button>
              <Button type="submit" disabled={editing} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[40px]">
                {editing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Pencil className="h-4 w-4 mr-1.5" />}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteTarget(null) }}
        title="Hapus Materi?"
        description={`Apakah Anda yakin ingin menghapus materi "${deleteTarget?.judul}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText={deleting ? "Menghapus..." : "Ya, Hapus"}
        cancelText="Batal"
        variant="destructive"
        isLoading={deleting}
        onConfirm={handleDeleteMateri}
      />
    </div>
  )
}
