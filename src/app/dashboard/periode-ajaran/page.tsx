// src/app/dashboard/periode-ajaran/page.tsx

"use client"

import * as React from "react"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import {
  getDaftarPeriodeAjaran,
  createPeriodeAjaran,
  updatePeriodeAjaran,
  deletePeriodeAjaran,
} from "@/actions/periode-ajaran"
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
import { Plus, Calendar, Loader2, Pencil, Trash2, CheckCircle2 } from "lucide-react"

interface PeriodeEntry {
  id: string
  nama: string
  tahunAjaran: string
  semester: "GANJIL" | "GENAP"
  tanggalMulai: string
  tanggalSelesai: string
  aktif: boolean
  createdAt: string
}

export default function PeriodeAjaranPage() {
  const { toast } = useToast()

  const [periodeList, setPeriodeList] = React.useState<PeriodeEntry[]>([])
  const [loading, setLoading] = React.useState(true)

  // Modal Tambah Periode
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [nama, setNama] = React.useState("")
  const [tahunAjaran, setTahunAjaran] = React.useState("2025/2026")
  const [semester, setSemester] = React.useState<"GANJIL" | "GENAP">("GANJIL")
  const [tanggalMulai, setTanggalMulai] = React.useState("")
  const [tanggalSelesai, setTanggalSelesai] = React.useState("")
  const [aktif, setAktif] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  // Modal Edit Periode
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [editId, setEditId] = React.useState("")
  const [editNama, setEditNama] = React.useState("")
  const [editTahunAjaran, setEditTahunAjaran] = React.useState("")
  const [editSemester, setEditSemester] = React.useState<"GANJIL" | "GENAP">("GANJIL")
  const [editTanggalMulai, setEditTanggalMulai] = React.useState("")
  const [editTanggalSelesai, setEditTanggalSelesai] = React.useState("")
  const [editAktif, setEditAktif] = React.useState(false)
  const [editing, setEditing] = React.useState(false)

  // Confirm Delete
  const [deleteDialog, setDeleteDialog] = React.useState<{
    open: boolean
    periode: PeriodeEntry | null
  }>({ open: false, periode: null })
  const [deleting, setDeleting] = React.useState(false)

  // Load data on mount
  React.useEffect(() => {
    async function loadData() {
      try {
        const res = await getDaftarPeriodeAjaran()
        if (res.success && Array.isArray(res.data)) {
          setPeriodeList(
            (res.data as PeriodeEntry[]).map((p) => ({
              ...p,
              tanggalMulai: p.tanggalMulai || "",
              tanggalSelesai: p.tanggalSelesai || "",
            }))
          )
        }
      } catch {
        // Demo mode fallback
        setPeriodeList([
          {
            id: "pa-1",
            nama: "Ganjil 2024/2025",
            tahunAjaran: "2024/2025",
            semester: "GANJIL",
            tanggalMulai: "2024-07-15",
            tanggalSelesai: "2024-12-20",
            aktif: false,
            createdAt: "2024-07-01",
          },
          {
            id: "pa-2",
            nama: "Genap 2024/2025",
            tahunAjaran: "2024/2025",
            semester: "GENAP",
            tanggalMulai: "2025-01-06",
            tanggalSelesai: "2025-06-20",
            aktif: true,
            createdAt: "2025-01-01",
          },
        ])
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleAddPeriode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nama.trim() || !tahunAjaran.trim() || !tanggalMulai || !tanggalSelesai)
      return

    setSubmitting(true)
    try {
      const result = await createPeriodeAjaran({
        nama: nama.trim(),
        tahunAjaran: tahunAjaran.trim(),
        semester,
        tanggalMulai,
        tanggalSelesai,
        aktif,
      })

      if (result.success) {
        toast({
          title: "Periode Ajaran Baru Dibuat! 📅",
          description: result.message,
        })
        // Reload
        const res = await getDaftarPeriodeAjaran()
        if (res.success && Array.isArray(res.data)) {
          setPeriodeList(
            (res.data as PeriodeEntry[]).map((p) => ({
              ...p,
              tanggalMulai: p.tanggalMulai || "",
              tanggalSelesai: p.tanggalSelesai || "",
            }))
          )
        }
        setIsAddOpen(false)
        resetAddForm()
      } else {
        toast({
          title: "Gagal Membuat Periode ❌",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Periode Dibuat (Demo Mode)",
        description: `Periode "${nama}" telah dibuat.`,
      })
      setPeriodeList((prev) => [
        {
          id: `pa-${Date.now()}`,
          nama,
          tahunAjaran,
          semester,
          tanggalMulai,
          tanggalSelesai,
          aktif,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ])
      setIsAddOpen(false)
      resetAddForm()
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditPeriode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editId) return

    setEditing(true)
    try {
      const result = await updatePeriodeAjaran(editId, {
        nama: editNama.trim(),
        tahunAjaran: editTahunAjaran.trim(),
        semester: editSemester,
        tanggalMulai: editTanggalMulai || undefined,
        tanggalSelesai: editTanggalSelesai || undefined,
        aktif: editAktif,
      })

      if (result.success) {
        toast({
          title: "Periode Ajaran Diperbarui! ✅",
          description: result.message,
        })
        // Reload
        const res = await getDaftarPeriodeAjaran()
        if (res.success && Array.isArray(res.data)) {
          setPeriodeList(
            (res.data as PeriodeEntry[]).map((p) => ({
              ...p,
              tanggalMulai: p.tanggalMulai || "",
              tanggalSelesai: p.tanggalSelesai || "",
            }))
          )
        }
        setIsEditOpen(false)
      } else {
        toast({
          title: "Gagal Memperbarui ❌",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Periode Diperbarui (Demo Mode)",
        description: `Periode "${editNama}" telah diperbarui.`,
      })
      setPeriodeList((prev) =>
        prev.map((p) =>
          p.id === editId
            ? {
                ...p,
                nama: editNama,
                tahunAjaran: editTahunAjaran,
                semester: editSemester,
                tanggalMulai: editTanggalMulai,
                tanggalSelesai: editTanggalSelesai,
                aktif: editAktif,
              }
            : p
        )
      )
      setIsEditOpen(false)
    } finally {
      setEditing(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.periode) return
    setDeleting(true)

    try {
      const result = await deletePeriodeAjaran(deleteDialog.periode.id)

      if (result.success) {
        toast({
          title: "Periode Dihapus 🗑️",
          description: result.message,
        })
        setPeriodeList((prev) =>
          prev.filter((p) => p.id !== deleteDialog.periode!.id)
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
        title: "Periode Dihapus (Demo Mode)",
        description: "Periode ajaran telah dihapus.",
      })
      setPeriodeList((prev) =>
        prev.filter((p) => p.id !== deleteDialog.periode!.id)
      )
    } finally {
      setDeleting(false)
      setDeleteDialog({ open: false, periode: null })
    }
  }

  const handleToggleAktif = async (periode: PeriodeEntry) => {
    try {
      const result = await updatePeriodeAjaran(periode.id, {
        aktif: !periode.aktif,
      })

      if (result.success) {
        toast({
          title: periode.aktif
            ? "Periode Dinonaktifkan"
            : "Periode Diaktifkan ✅",
          description: `Status periode "${periode.nama}" telah diperbarui.`,
        })
        setPeriodeList((prev) =>
          prev.map((p) => {
            if (p.id === periode.id) return { ...p, aktif: !p.aktif }
            // If activating, deactivate others
            if (!periode.aktif) return { ...p, aktif: false }
            return p
          })
        )
      } else {
        toast({
          title: "Gagal",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Status Diperbarui (Demo Mode)",
        description: `Periode "${periode.nama}" telah ${periode.aktif ? "dinonaktifkan" : "diaktifkan"}.`,
      })
      setPeriodeList((prev) =>
        prev.map((p) => {
          if (p.id === periode.id) return { ...p, aktif: !p.aktif }
          if (!periode.aktif) return { ...p, aktif: false }
          return p
        })
      )
    }
  }

  const openEditModal = (periode: PeriodeEntry) => {
    setEditId(periode.id)
    setEditNama(periode.nama)
    setEditTahunAjaran(periode.tahunAjaran)
    setEditSemester(periode.semester)
    setEditTanggalMulai(
      periode.tanggalMulai
        ? new Date(periode.tanggalMulai).toISOString().split("T")[0]
        : ""
    )
    setEditTanggalSelesai(
      periode.tanggalSelesai
        ? new Date(periode.tanggalSelesai).toISOString().split("T")[0]
        : ""
    )
    setEditAktif(periode.aktif)
    setIsEditOpen(true)
  }

  const resetAddForm = () => {
    setNama("")
    setTahunAjaran("2025/2026")
    setSemester("GANJIL")
    setTanggalMulai("")
    setTanggalSelesai("")
    setAktif(false)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-"
    try {
      return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    } catch {
      return dateStr
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
        title="Kelola Periode Ajaran"
        subtitle="Manajemen tahun ajaran dan semester aktif. Satu periode bisa diaktifkan pada satu waktu."
        action={
          <Button
            onClick={() => setIsAddOpen(true)}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-md min-h-[44px]"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Tambah Periode Ajaran
          </Button>
        }
      />

      {/* Periode List */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Daftar Periode Ajaran ({periodeList.length} Periode)
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {periodeList.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">
                Belum ada periode ajaran yang terdaftar.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Klik &quot;Tambah Periode Ajaran&quot; untuk membuat tahun ajaran
                baru.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-600">
                    <tr>
                      <th className="p-4 pl-6">Nama Periode</th>
                      <th className="p-4">Tahun Ajaran</th>
                      <th className="p-4">Semester</th>
                      <th className="p-4">Tanggal Mulai</th>
                      <th className="p-4">Tanggal Selesai</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 pr-6 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {periodeList.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="p-4 pl-6">
                          <div className="font-bold text-slate-800">
                            {p.nama}
                          </div>
                        </td>
                        <td className="p-4 text-sm font-semibold text-slate-700">
                          {p.tahunAjaran}
                        </td>
                        <td className="p-4">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                              p.semester === "GANJIL"
                                ? "bg-indigo-100 text-indigo-800"
                                : "bg-yellow-100 text-teal-800"
                            }`}
                          >
                            {p.semester === "GANJIL" ? "Ganjil" : "Genap"}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-600">
                          {formatDate(p.tanggalMulai)}
                        </td>
                        <td className="p-4 text-xs text-slate-600">
                          {formatDate(p.tanggalSelesai)}
                        </td>
                        <td className="p-4">
                          <StatusBadge
                            status={p.aktif ? "AKTIF" : "NONAKTIF"}
                          />
                        </td>
                        <td className="p-4 pr-6 text-right space-x-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleAktif(p)}
                            className={`rounded-xl text-xs font-semibold ${
                              p.aktif
                                ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                                : "border-yellow-200 text-yellow-600 hover:bg-yellow-50"
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            {p.aktif ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(p)}
                            className="rounded-xl text-xs font-semibold"
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              setDeleteDialog({ open: true, periode: p })
                            }
                            className="rounded-xl text-xs font-semibold"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden p-4 space-y-3">
                {periodeList.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-800 text-sm">
                          {p.nama}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {p.tahunAjaran} • Semester{" "}
                          {p.semester === "GANJIL" ? "Ganjil" : "Genap"}
                        </div>
                      </div>
                      <StatusBadge
                        status={p.aktif ? "AKTIF" : "NONAKTIF"}
                        size="sm"
                      />
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 bg-white p-3 rounded-xl border border-slate-100">
                      <div>
                        Mulai: <strong>{formatDate(p.tanggalMulai)}</strong>
                      </div>
                      <div>
                        Selesai:{" "}
                        <strong>{formatDate(p.tanggalSelesai)}</strong>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleAktif(p)}
                        className={`flex-1 rounded-xl text-xs min-h-[40px] ${
                          p.aktif
                            ? "border-amber-200 text-amber-700"
                            : "border-yellow-200 text-yellow-600"
                        }`}
                      >
                        {p.aktif ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(p)}
                        className="flex-1 rounded-xl text-xs min-h-[40px]"
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setDeleteDialog({ open: true, periode: p })
                        }
                        className="rounded-xl text-xs min-h-[40px] px-3"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Tambah Periode Ajaran */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">
              Tambah Periode Ajaran Baru
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Buat tahun ajaran dan semester baru untuk sistem akademik.
            </p>
          </DialogHeader>

          <form onSubmit={handleAddPeriode} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Nama Periode *
              </label>
              <Input
                placeholder="Contoh: Ganjil 2025/2026"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="h-11 rounded-xl text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Tahun Ajaran *
                </label>
                <Input
                  placeholder="2025/2026"
                  value={tahunAjaran}
                  onChange={(e) => setTahunAjaran(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                  required
                />
                <p className="text-[11px] text-slate-400">
                  Format: YYYY/YYYY
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Semester *
                </label>
                <select
                  value={semester}
                  onChange={(e) =>
                    setSemester(e.target.value as "GANJIL" | "GENAP")
                  }
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="GANJIL">Ganjil (1)</option>
                  <option value="GENAP">Genap (2)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Tanggal Mulai *
                </label>
                <Input
                  type="date"
                  value={tanggalMulai}
                  onChange={(e) => setTanggalMulai(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Tanggal Selesai *
                </label>
                <Input
                  type="date"
                  value={tanggalSelesai}
                  onChange={(e) => setTanggalSelesai(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="aktifCheck"
                checked={aktif}
                onChange={(e) => setAktif(e.target.checked)}
                className="h-4 w-4 rounded text-yellow-500 focus:ring-yellow-500"
              />
              <label
                htmlFor="aktifCheck"
                className="text-xs font-semibold text-slate-700"
              >
                Aktifkan periode ini (periode aktif lainnya akan dinonaktifkan
                otomatis)
              </label>
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
                disabled={submitting}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[40px]"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Plus className="h-4 w-4 mr-1.5" />
                )}
                Simpan Periode
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Edit Periode Ajaran */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">
              Edit Periode Ajaran
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Perbarui data periode ajaran yang sudah ada.
            </p>
          </DialogHeader>

          <form onSubmit={handleEditPeriode} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Nama Periode *
              </label>
              <Input
                placeholder="Contoh: Ganjil 2025/2026"
                value={editNama}
                onChange={(e) => setEditNama(e.target.value)}
                className="h-11 rounded-xl text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Tahun Ajaran *
                </label>
                <Input
                  placeholder="2025/2026"
                  value={editTahunAjaran}
                  onChange={(e) => setEditTahunAjaran(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Semester *
                </label>
                <select
                  value={editSemester}
                  onChange={(e) =>
                    setEditSemester(e.target.value as "GANJIL" | "GENAP")
                  }
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="GANJIL">Ganjil (1)</option>
                  <option value="GENAP">Genap (2)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Tanggal Mulai
                </label>
                <Input
                  type="date"
                  value={editTanggalMulai}
                  onChange={(e) => setEditTanggalMulai(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Tanggal Selesai
                </label>
                <Input
                  type="date"
                  value={editTanggalSelesai}
                  onChange={(e) => setEditTanggalSelesai(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="editAktifCheck"
                checked={editAktif}
                onChange={(e) => setEditAktif(e.target.checked)}
                className="h-4 w-4 rounded text-yellow-500 focus:ring-yellow-500"
              />
              <label
                htmlFor="editAktifCheck"
                className="text-xs font-semibold text-slate-700"
              >
                Aktifkan periode ini
              </label>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="rounded-xl min-h-[40px]"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={editing}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[40px]"
              >
                {editing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Pencil className="h-4 w-4 mr-1.5" />
                )}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      {deleteDialog.periode && (
        <ConfirmDialog
          open={deleteDialog.open}
          onOpenChange={(open) =>
            setDeleteDialog((prev) => ({ ...prev, open }))
          }
          title="Hapus Periode Ajaran?"
          description={`Apakah Anda yakin ingin menghapus periode "${deleteDialog.periode.nama}"? Periode yang masih memiliki data ujian, tugas, absensi, atau rapor tidak dapat dihapus.`}
          confirmText="Ya, Hapus"
          variant="destructive"
          isLoading={deleting}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  )
}
