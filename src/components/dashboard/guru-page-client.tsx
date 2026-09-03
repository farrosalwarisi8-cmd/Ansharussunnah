"use client"



import * as React from "react"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import {
  createAkunGuru,
  getDaftarGuru,
  nonaktifkanAkunGuru,
  aktifkanKembaliAkunGuru,
  setGuruAdmin,
  updateAkunGuru,
} from "@/actions/guru"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import dynamic from "next/dynamic"
const Dialog = dynamic(() => import("@/components/ui/dialog").then(m => m.Dialog), { ssr: false })
const DialogContent = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogContent), { ssr: false })
const DialogHeader = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogHeader), { ssr: false })
const DialogTitle = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogTitle), { ssr: false })
const DialogFooter = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogFooter), { ssr: false })
const ConfirmDialog = dynamic(() => import("@/components/ui/confirm-dialog").then(m => m.ConfirmDialog), { ssr: false })
import { Plus, ShieldCheck, Loader2, Pencil, AlertTriangle, Users } from "lucide-react"

export default function KelolaGuruPage() {
  const { toast } = useToast()

  interface DataGuru {
    id: string
    userId: string
    nama: string
    email: string
    nip: string | null
    jabatan: string | null
    noHp: string | null
    aktif: boolean
    isAdmin: boolean
    mustChangePassword: boolean
    createdAt: string | Date
    waliKelas: string[]
    jumlahMengajar: number
  }

  const [guruList, setGuruList] = React.useState<DataGuru[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const fetchGuru = React.useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await getDaftarGuru()
      if (result.success && result.data) {
        setGuruList(result.data as DataGuru[])
      } else {
        setLoadError(result.message || "Gagal memuat daftar guru")
      }
    } catch {
      setLoadError("Gagal memuat daftar guru")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchGuru()
  }, [fetchGuru])

  // Modal Tambah Guru
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [nama, setNama] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [nip, setNip] = React.useState("")
  const [jabatan, setJabatan] = React.useState("")
  const [noHp, setNoHp] = React.useState("")
  const [isAdminInput, setIsAdminInput] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  // Modal Edit Guru
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [editGuru, setEditGuru] = React.useState<typeof guruList[0] | null>(null)
  const [editNama, setEditNama] = React.useState("")
  const [editNip, setEditNip] = React.useState("")
  const [editJabatan, setEditJabatan] = React.useState("")
  const [editNoHp, setEditNoHp] = React.useState("")
  const [editing, setEditing] = React.useState(false)

  // Confirm Action Dialog
  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean
    guru: typeof guruList[0] | null
    type: "TOGGLE_ACTIVE" | "TOGGLE_ADMIN"
  }>({
    open: false,
    guru: null,
    type: "TOGGLE_ACTIVE",
  })

  const handleAddGuru = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nama.trim() || !email.trim()) return

    setSubmitting(true)
    try {
      const result = await createAkunGuru({
        nama,
        email,
        nip: nip || undefined,
        jabatan: jabatan || undefined,
        noHp: noHp || undefined,
        isAdmin: isAdminInput,
      })

      if (!result.success) {
        toast({ variant: "destructive", title: "Gagal Membuat Akun", description: result.message })
        return
      }

      await fetchGuru()

      toast({
        title: "Akun Guru Berhasil Dibuat! 🎉",
        description: `Akun untuk ${nama} telah terdaftar. Kredensial dikirim ke email.`,
      })
      setIsAddOpen(false)
      setNama("")
      setEmail("")
      setNip("")
      setJabatan("")
      setNoHp("")
    } catch {
      toast({ variant: "destructive", title: "Gagal Membuat Akun", description: "Terjadi kesalahan saat membuat akun guru." })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditGuru = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editGuru) return
    setEditing(true)
    try {
      const result = await updateAkunGuru(editGuru.userId, {
        nama: editNama || undefined,
        nip: editNip || undefined,
        jabatan: editJabatan || undefined,
        noHp: editNoHp || undefined,
      })

      if (result.success) {
        setGuruList((prev) =>
          prev.map((g) =>
            g.userId === editGuru.userId
              ? { ...g, nama: editNama || g.nama, nip: editNip || g.nip, jabatan: editJabatan || g.jabatan, noHp: editNoHp || g.noHp }
              : g
          )
        )
        toast({ title: "Profil Guru Diperbarui! ✅", description: result.message })
        setIsEditOpen(false)
        setEditGuru(null)
      } else {
        toast({ variant: "destructive", title: "Gagal Memperbarui", description: result.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal Memperbarui", description: "Terjadi kesalahan saat memperbarui profil." })
    } finally {
      setEditing(false)
    }
  }

  const handleExecuteConfirm = async () => {
    if (!confirmDialog.guru) return
    const g = confirmDialog.guru

    try {
      if (confirmDialog.type === "TOGGLE_ACTIVE") {
        if (g.aktif) {
          await nonaktifkanAkunGuru(g.userId)
        } else {
          await aktifkanKembaliAkunGuru(g.userId)
        }
        setGuruList((prev) =>
          prev.map((item) =>
            item.id === g.id ? { ...item, aktif: !item.aktif } : item
          )
        )
        toast({
          title: g.aktif ? "Akun Dinonaktifkan" : "Akun Berhasil Diaktifkan",
          description: `Status akun ${g.nama} telah diperbarui.`,
        })
      } else {
        await setGuruAdmin(g.userId, !g.isAdmin)
        setGuruList((prev) =>
          prev.map((item) =>
            item.id === g.id ? { ...item, isAdmin: !item.isAdmin } : item
          )
        )
        toast({
          title: g.isAdmin ? "Hak Akses Admin Dicabut" : "Diberikan Hak Akses Admin",
          description: `Hak admin untuk ${g.nama} telah diperbarui.`,
        })
      }
    } catch {
      toast({ variant: "destructive", title: "Aksi Gagal", description: "Terjadi kesalahan saat memperbarui status akun." })
    } finally {
      setConfirmDialog({ open: false, guru: null, type: "TOGGLE_ACTIVE" })
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <DashboardHeader
        title="Kelola Tenaga Pendidik &amp; Guru"
        subtitle="Manajemen akun asatidz, penetapan peran admin akademik, dan hak akses sistem."
        action={
          <Button
            onClick={() => setIsAddOpen(true)}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-md min-h-[44px]"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Tambah Guru Baru
          </Button>
        }
      />

      {/* Teachers Table / Card List */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Daftar Asatidz Terdaftar ({guruList.length} Guru)
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-7 w-7 animate-spin text-yellow-500" />
              <span className="ml-3 text-sm text-slate-500">Memuat daftar guru...</span>
            </div>
          ) : loadError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Gagal Memuat Data"
              description={loadError}
              actionLabel="Coba Lagi"
              onAction={fetchGuru}
            />
          ) : guruList.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Belum Ada Guru"
              description="Belum ada tenaga pendidik yang terdaftar. Klik 'Tambah Guru Baru' untuk memulai."
            />
          ) : (
            <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-600">
                <tr>
                  <th className="p-4 pl-6">Nama &amp; NIP</th>
                  <th className="p-4">Email &amp; No. HP</th>
                  <th className="p-4">Jabatan</th>
                  <th className="p-4">Hak Akses</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {guruList.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/80">
                    <td className="p-4 pl-6">
                      <div className="font-bold text-slate-800">{g.nama}</div>
                      <div className="text-xs text-slate-400 font-mono">NIP: {g.nip}</div>
                    </td>
                    <td className="p-4 text-xs text-slate-600">
                      <div>{g.email}</div>
                      <div className="text-slate-400">{g.noHp}</div>
                    </td>
                    <td className="p-4 text-xs font-semibold text-slate-700">{g.jabatan}</td>
                    <td className="p-4">
                      {g.isAdmin ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-700 bg-yellow-100 px-2.5 py-0.5 rounded-full">
                          <ShieldCheck className="h-3 w-3" />
                          Guru Admin
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 font-medium">Guru Biasa</span>
                      )}
                    </td>
                    <td className="p-4">
                      <StatusBadge status={g.aktif ? "AKTIF" : "NONAKTIF"} />
                    </td>
                    <td className="p-4 pr-6 text-right space-x-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditGuru(g)
                          setEditNama(g.nama)
                          setEditNip(g.nip || "")
                          setEditJabatan(g.jabatan || "")
                          setEditNoHp(g.noHp || "")
                          setIsEditOpen(true)
                        }}
                        className="rounded-xl text-xs font-semibold"
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setConfirmDialog({
                            open: true,
                            guru: g,
                            type: "TOGGLE_ADMIN",
                          })
                        }
                        className="rounded-xl text-xs font-semibold"
                      >
                        {g.isAdmin ? "Hapus Admin" : "Jadikan Admin"}
                      </Button>
                      <Button
                        size="sm"
                        variant={g.aktif ? "destructive" : "default"}
                        onClick={() =>
                          setConfirmDialog({
                            open: true,
                            guru: g,
                            type: "TOGGLE_ACTIVE",
                          })
                        }
                        className="rounded-xl text-xs font-semibold"
                      >
                        {g.aktif ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden p-4 space-y-3">
            {guruList.map((g) => (
              <div key={g.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{g.nama}</div>
                    <div className="text-xs text-slate-500">{g.jabatan}</div>
                  </div>
                  <StatusBadge status={g.aktif ? "AKTIF" : "NONAKTIF"} size="sm" />
                </div>

                <div className="text-xs text-slate-600 space-y-1 bg-white p-3 rounded-xl border border-slate-100">
                  <div>Email: <strong>{g.email}</strong></div>
                  <div>No. HP: {g.noHp}</div>
                  <div>Peran: <strong>{g.isAdmin ? "Guru Admin" : "Guru Standar"}</strong></div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditGuru(g)
                      setEditNama(g.nama)
                      setEditNip(g.nip || "")
                      setEditJabatan(g.jabatan || "")
                      setEditNoHp(g.noHp || "")
                      setIsEditOpen(true)
                    }}
                    className="flex-1 rounded-xl text-xs min-h-[40px]"
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit Profil
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setConfirmDialog({
                        open: true,
                        guru: g,
                        type: "TOGGLE_ADMIN",
                      })
                    }
                    className="flex-1 rounded-xl text-xs min-h-[40px]"
                  >
                    {g.isAdmin ? "Hapus Admin" : "Set Admin"}
                  </Button>
                  <Button
                    size="sm"
                    variant={g.aktif ? "destructive" : "default"}
                    onClick={() =>
                      setConfirmDialog({
                        open: true,
                        guru: g,
                        type: "TOGGLE_ACTIVE",
                      })
                    }
                    className="flex-1 rounded-xl text-xs min-h-[40px]"
                  >
                    {g.aktif ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Tambah Guru */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">
              Tambah Akun Tenaga Pendidik / Guru
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Password default &quot;Guru123!&quot; akan dibuat otomatis dan guru diwajibkan menggantinya saat login pertama.
            </p>
          </DialogHeader>

          <form onSubmit={handleAddGuru} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Nama Lengkap &amp; Gelar *</label>
              <Input
                placeholder="Contoh: Ustadz Muhammad Yusuf, Lc."
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="h-11 rounded-xl text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Alamat Email Resmi *</label>
              <Input
                type="email"
                placeholder="yusuf@ansharussunnah.sch.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">NIP (Nomor Induk Pegawai)</label>
                <Input
                  placeholder="19900101..."
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">No. WhatsApp / HP</label>
                <Input
                  placeholder="081234567..."
                  value={noHp}
                  onChange={(e) => setNoHp(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Jabatan / Tugas Mengajar</label>
              <Input
                placeholder="Contoh: Guru Bahasa Arab & Wali Kelas 7"
                value={jabatan}
                onChange={(e) => setJabatan(e.target.value)}
                className="h-11 rounded-xl text-sm"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isAdminCheck"
                checked={isAdminInput}
                onChange={(e) => setIsAdminInput(e.target.checked)}
                className="h-4 w-4 rounded text-yellow-500 focus:ring-yellow-500"
              />
              <label htmlFor="isAdminCheck" className="text-xs font-semibold text-slate-700">
                Berikan Hak Akses Admin (Dapat mengelola kelas, guru, dan kenaikan kelas)
              </label>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl min-h-[40px]">
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[40px]"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                Buat Akun Guru
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Edit Guru */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditGuru(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">
              Edit Profil Guru
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Perbarui data profil {editGuru?.nama}
            </p>
          </DialogHeader>

          <form onSubmit={handleEditGuru} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Nama Lengkap &amp; Gelar</label>
              <Input
                value={editNama}
                onChange={(e) => setEditNama(e.target.value)}
                className="h-11 rounded-xl text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">NIP</label>
                <Input
                  value={editNip}
                  onChange={(e) => setEditNip(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">No. HP</label>
                <Input
                  value={editNoHp}
                  onChange={(e) => setEditNoHp(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Jabatan</label>
              <Input
                value={editJabatan}
                onChange={(e) => setEditJabatan(e.target.value)}
                className="h-11 rounded-xl text-sm"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => { setIsEditOpen(false); setEditGuru(null) }} className="rounded-xl min-h-[40px]">
                Batal
              </Button>
              <Button
                type="submit"
                disabled={editing}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[40px]"
              >
                {editing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Pencil className="h-4 w-4 mr-1.5" />}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      {confirmDialog.guru && (
        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
          title={
            confirmDialog.type === "TOGGLE_ACTIVE"
              ? `${confirmDialog.guru.aktif ? "Nonaktifkan" : "Aktifkan"} Akun Guru?`
              : `${confirmDialog.guru.isAdmin ? "Cabut Hak Admin" : "Jadikan Guru Admin"}?`
          }
          description={
            confirmDialog.type === "TOGGLE_ACTIVE"
              ? `Apakah Anda yakin ingin ${confirmDialog.guru.aktif ? "menonaktifkan" : "mengaktifkan"} akun ${confirmDialog.guru.nama}?`
              : `Apakah Anda yakin ingin mengubah hak akses administratif untuk ${confirmDialog.guru.nama}?`
          }
          confirmText="Lanjutkan"
          variant={confirmDialog.type === "TOGGLE_ACTIVE" && confirmDialog.guru.aktif ? "destructive" : "default"}
          onConfirm={handleExecuteConfirm}
        />
      )}
    </div>
  )
}
