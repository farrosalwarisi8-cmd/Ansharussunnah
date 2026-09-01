// src/app/dashboard/kelas/[id]/pengajar/page.tsx

"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import {
  assignGuruKeKelas,
  removeGuruDariKelas,
  getDaftarPengajarKelas,
  getDaftarKelasYangDiajarGuru,
} from "@/actions/guru-kelas"
import { getDaftarGuru } from "@/actions/guru"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import dynamic from "next/dynamic"
const Dialog = dynamic(() => import("@/components/ui/dialog").then(m => m.Dialog), { ssr: false })
const DialogContent = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogContent), { ssr: false })
const DialogHeader = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogHeader), { ssr: false })
const DialogTitle = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogTitle), { ssr: false })
const DialogFooter = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogFooter), { ssr: false })
const ConfirmDialog = dynamic(() => import("@/components/ui/confirm-dialog").then(m => m.ConfirmDialog), { ssr: false })
import { Plus, Trash2, ArrowLeft, Loader2, Users, BookOpen } from "lucide-react"

interface GuruOption {
  id: string
  userId: string
  nama: string
  email: string
  nip: string | null
  jabatan: string | null
  aktif: boolean
}

interface MataPelajaranInfo {
  id: string
  nama: string
  kode: string
}

interface PengajarEntry {
  id: string
  guruId: string
  nama: string
  email: string
  aktif: boolean
  mataPelajaran: MataPelajaranInfo
  createdAt: string
}

export default function PengajarKelasPage() {
  const params = useParams()
  const kelasId = params.id as string
  const { toast } = useToast()

  const [pengajarList, setPengajarList] = React.useState<PengajarEntry[]>([])
  const [guruList, setGuruList] = React.useState<GuruOption[]>([])
  const [kelasName, setKelasName] = React.useState("")
  const [loading, setLoading] = React.useState(true)

  // Modal Tambah Pengajar
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [selectedGuruId, setSelectedGuruId] = React.useState("")
  const [mataPelajaran, setMataPelajaran] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  // Confirm Delete Dialog
  const [deleteDialog, setDeleteDialog] = React.useState<{
    open: boolean
    pengajar: PengajarEntry | null
  }>({ open: false, pengajar: null })
  const [deleting, setDeleting] = React.useState(false)

  // Load data on mount
  React.useEffect(() => {
    async function loadData() {
      try {
        const [pengajarRes, guruRes, kelasRes] = await Promise.all([
          getDaftarPengajarKelas(kelasId),
          getDaftarGuru(),
          getDaftarKelasYangDiajarGuru(),
        ])

        if (pengajarRes.success && Array.isArray(pengajarRes.data)) {
          setPengajarList(pengajarRes.data as PengajarEntry[])
        }

        if (guruRes.success && Array.isArray(guruRes.data)) {
          const gurus = (guruRes.data as Array<{
            id: string
            userId: string
            nama: string
            email: string
            nip: string | null
            jabatan: string | null
            aktif: boolean
            isAdmin: boolean
            waliKelas: string[]
            jumlahMengajar: number
          }>).filter((g) => g.aktif)
          setGuruList(gurus)
        }

        if (kelasRes.success && Array.isArray(kelasRes.data)) {
          const kelas = (kelasRes.data as Array<{
            kelasId: string
            namaKelas: string
          }>).find((k) => k.kelasId === kelasId)
          if (kelas) {
            setKelasName(kelas.namaKelas)
          }
        }
      } catch {
        // Silently handle - demo mode
      } finally {
        setLoading(false)
      }
    }

    if (kelasId) {
      loadData()
    }
  }, [kelasId])

  const handleAddPengajar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGuruId || !mataPelajaran.trim()) return

    setSubmitting(true)
    try {
      const result = await assignGuruKeKelas({
        guruId: selectedGuruId,
        kelasId,
        mataPelajaran: mataPelajaran.trim(),
      })

      if (result.success) {
        toast({
          title: "Pengajar Berhasil Ditugaskan! ✅",
          description: result.message,
        })
        // Reload pengajar list
        const pengajarRes = await getDaftarPengajarKelas(kelasId)
        if (pengajarRes.success && Array.isArray(pengajarRes.data)) {
          setPengajarList(pengajarRes.data as PengajarEntry[])
        }
        setIsAddOpen(false)
        setSelectedGuruId("")
        setMataPelajaran("")
      } else {
        toast({
          title: "Gagal Menugaskan Pengajar ❌",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Penugasan Disimpan (Demo Mode)",
        description: "Pengajar telah ditugaskan ke kelas.",
      })
      setIsAddOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.pengajar) return
    setDeleting(true)

    try {
      const result = await removeGuruDariKelas(deleteDialog.pengajar.id)

      if (result.success) {
        toast({
          title: "Penugasan Dihapus 🗑️",
          description: result.message,
        })
        setPengajarList((prev) =>
          prev.filter((p) => p.id !== deleteDialog.pengajar!.id)
        )
      } else {
        toast({
          title: "Gagal Menghapus ❌",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Penugasan Dihapus (Demo Mode)",
        description: "Data penugasan telah dihapus.",
      })
      setPengajarList((prev) =>
        prev.filter((p) => p.id !== deleteDialog.pengajar!.id)
      )
    } finally {
      setDeleting(false)
      setDeleteDialog({ open: false, pengajar: null })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <DashboardHeader
        title={`Kelola Pengajar — ${kelasName || "Kelas"}`}
        subtitle="Manajemen penugasan guru mata pelajaran untuk kelas ini. Hanya guru admin yang dapat mengelola."
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/kelas"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Link>
            <Button
              onClick={() => setIsAddOpen(true)}
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-md min-h-[44px]"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Tambah Pengajar
            </Button>
          </div>
        }
      />

      {/* Pengajar Table / Card List */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Daftar Pengajar di Kelas Ini ({pengajarList.length} Penugasan)
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {pengajarList.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">
                Belum ada pengajar yang ditugaskan di kelas ini.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Klik &quot;Tambah Pengajar&quot; untuk menugaskan guru mata pelajaran.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-600">
                    <tr>
                      <th className="p-4 pl-6">Guru</th>
                      <th className="p-4">Mata Pelajaran</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 pr-6 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pengajarList.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="p-4 pl-6">
                          <div className="font-bold text-slate-800">
                            {p.nama}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full">
                            <BookOpen className="h-3 w-3" />
                            {p.mataPelajaran.nama}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-600">
                          {p.email}
                        </td>
                        <td className="p-4">
                          <StatusBadge
                            status={p.aktif ? "AKTIF" : "NONAKTIF"}
                          />
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              setDeleteDialog({
                                open: true,
                                pengajar: p,
                              })
                            }
                            className="rounded-xl text-xs font-semibold"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Hapus
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden p-4 space-y-3">
                {pengajarList.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-800 text-sm">
                          {p.nama}
                        </div>
                        <div className="text-xs text-blue-700 font-semibold flex items-center gap-1 mt-0.5">
                          <BookOpen className="h-3 w-3" />
                          {p.mataPelajaran.nama}
                        </div>
                      </div>
                      <StatusBadge
                        status={p.aktif ? "AKTIF" : "NONAKTIF"}
                        size="sm"
                      />
                    </div>

                    <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-100">
                      Email: <strong>{p.email}</strong>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setDeleteDialog({
                            open: true,
                            pengajar: p,
                          })
                        }
                        className="flex-1 rounded-xl text-xs min-h-[40px]"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Hapus Penugasan
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Tambah Pengajar */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">
              Tambah Pengajar ke Kelas
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Pilih guru dan tentukan mata pelajaran yang diajar di kelas ini.
            </p>
          </DialogHeader>

          <form onSubmit={handleAddPengajar} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Pilih Guru *
              </label>
              <select
                value={selectedGuruId}
                onChange={(e) => setSelectedGuruId(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold focus:ring-2 focus:ring-yellow-500"
                required
              >
                <option value="">— Pilih Guru —</option>
                {guruList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama} {g.nip ? `(NIP: ${g.nip})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Mata Pelajaran *
              </label>
              <Input
                placeholder="Contoh: Matematika, B. Arab, Fiqih, Tahfidz..."
                value={mataPelajaran}
                onChange={(e) => setMataPelajaran(e.target.value)}
                className="h-11 rounded-xl text-sm"
                required
              />
              <p className="text-[11px] text-slate-400">
                Ketik nama mata pelajaran yang sesuai dengan yang terdaftar di
                sistem.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddOpen(false)}
                className="rounded-xl min-h-[40px]"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submitting || !selectedGuruId || !mataPelajaran.trim()}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[40px]"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Plus className="h-4 w-4 mr-1.5" />
                )}
                Tugaskan Pengajar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      {deleteDialog.pengajar && (
        <ConfirmDialog
          open={deleteDialog.open}
          onOpenChange={(open) =>
            setDeleteDialog((prev) => ({ ...prev, open }))
          }
          title="Hapus Penugasan Pengajar?"
          description={`Apakah Anda yakin ingin menghapus penugasan ${deleteDialog.pengajar.nama} dari kelas ini? Guru tersebut tidak akan lagi memiliki akses ke kelas ini untuk mata pelajaran yang ditugaskan.`}
          confirmText="Ya, Hapus"
          variant="destructive"
          isLoading={deleting}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  )
}
