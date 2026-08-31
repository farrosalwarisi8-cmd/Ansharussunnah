// src/app/dashboard/kelola-akun-keuangan/page.tsx

"use client"

import * as React from "react"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import {
  createAkunAdminKeuangan,
  nonaktifkanAkunAdminKeuangan,
  aktifkanKembaliAkunAdminKeuangan,
  updateAkunAdminKeuangan,
  getDaftarAdminKeuangan,
} from "@/actions/admin-keuangan"
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
import { Plus, DollarSign, Loader2, Pencil } from "lucide-react"

interface AdminKeuanganEntry {
  id: string
  nama: string
  email: string
  aktif: boolean
  mustChangePassword: boolean
  createdAt: string
}

export default function KelolaAkunKeuanganPage() {
  const { toast } = useToast()

  const [adminList, setAdminList] = React.useState<AdminKeuanganEntry[]>([])
  const [loading, setLoading] = React.useState(true)

  // Modal Tambah Admin Keuangan
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [nama, setNama] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [noHp, setNoHp] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  // Modal Edit Admin Keuangan
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [editUserId, setEditUserId] = React.useState("")
  const [editNama, setEditNama] = React.useState("")
  const [editing, setEditing] = React.useState(false)

  // Confirm Action Dialog
  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean
    admin: AdminKeuanganEntry | null
    type: "TOGGLE_ACTIVE"
  }>({
    open: false,
    admin: null,
    type: "TOGGLE_ACTIVE",
  })
  const [executing, setExecuting] = React.useState(false)

  // Load data on mount
  React.useEffect(() => {
    async function loadData() {
      try {
        const res = await getDaftarAdminKeuangan()
        if (res.success && Array.isArray(res.data)) {
          setAdminList(res.data as AdminKeuanganEntry[])
        }
      } catch {
        // Demo mode fallback
        setAdminList([
          {
            id: "ak-1",
            nama: "Ustadzah Khadijah, S.E.",
            email: "khadijah@ansharussunnah.sch.id",
            aktif: true,
            mustChangePassword: false,
            createdAt: "2024-07-15",
          },
          {
            id: "ak-2",
            nama: "Ustadzah Halimah, S.Ak.",
            email: "halimah@ansharussunnah.sch.id",
            aktif: true,
            mustChangePassword: true,
            createdAt: "2024-09-01",
          },
        ])
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nama.trim() || !email.trim()) return

    setSubmitting(true)
    try {
      const result = await createAkunAdminKeuangan({
        nama: nama.trim(),
        email: email.trim(),
        noHp: noHp.trim() || undefined,
      })

      if (result.success) {
        toast({
          title: "Akun Admin Keuangan Dibuat! 💰",
          description: result.message,
        })
        // Reload
        const res = await getDaftarAdminKeuangan()
        if (res.success && Array.isArray(res.data)) {
          setAdminList(res.data as AdminKeuanganEntry[])
        }
        setIsAddOpen(false)
        setNama("")
        setEmail("")
        setNoHp("")
      } else {
        toast({
          title: "Gagal Membuat Akun ❌",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Akun Dibuat (Demo Mode)",
        description: `Akun untuk ${nama} telah dibuat.`,
      })
      setAdminList((prev) => [
        ...prev,
        {
          id: `ak-${Date.now()}`,
          nama,
          email,
          aktif: true,
          mustChangePassword: true,
          createdAt: new Date().toISOString(),
        },
      ])
      setIsAddOpen(false)
      setNama("")
      setEmail("")
      setNoHp("")
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUserId || !editNama.trim()) return

    setEditing(true)
    try {
      const result = await updateAkunAdminKeuangan(editUserId, {
        nama: editNama.trim(),
      })

      if (result.success) {
        toast({
          title: "Data Admin Keuangan Diperbarui! ✅",
          description: result.message,
        })
        setAdminList((prev) =>
          prev.map((a) =>
            a.id === editUserId ? { ...a, nama: editNama.trim() } : a
          )
        )
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
        title: "Data Diperbarui (Demo Mode)",
        description: `Data ${editNama} telah diperbarui.`,
      })
      setAdminList((prev) =>
        prev.map((a) =>
          a.id === editUserId ? { ...a, nama: editNama.trim() } : a
        )
      )
      setIsEditOpen(false)
    } finally {
      setEditing(false)
    }
  }

  const handleExecuteConfirm = async () => {
    if (!confirmDialog.admin) return
    const a = confirmDialog.admin
    setExecuting(true)

    try {
      if (a.aktif) {
        const result = await nonaktifkanAkunAdminKeuangan(a.id)
        if (result.success) {
          toast({
            title: "Akun Dinonaktifkan",
            description: `Akun admin keuangan "${a.nama}" telah dinonaktifkan.`,
          })
          setAdminList((prev) =>
            prev.map((item) =>
              item.id === a.id ? { ...item, aktif: false } : item
            )
          )
        } else {
          toast({
            title: "Gagal",
            description: result.message,
            variant: "destructive",
          })
        }
      } else {
        const result = await aktifkanKembaliAkunAdminKeuangan(a.id)
        if (result.success) {
          toast({
            title: "Akun Diaktifkan Kembali",
            description: `Akun admin keuangan "${a.nama}" telah diaktifkan kembali.`,
          })
          setAdminList((prev) =>
            prev.map((item) =>
              item.id === a.id ? { ...item, aktif: true } : item
            )
          )
        } else {
          toast({
            title: "Gagal",
            description: result.message,
            variant: "destructive",
          })
        }
      }
    } catch {
      toast({
        title: a.aktif
          ? "Akun Dinonaktifkan (Demo)"
          : "Akun Diaktifkan (Demo)",
        description: "Status akun telah diperbarui.",
      })
      setAdminList((prev) =>
        prev.map((item) =>
          item.id === a.id ? { ...item, aktif: !item.aktif } : item
        )
      )
    } finally {
      setExecuting(false)
      setConfirmDialog({ open: false, admin: null, type: "TOGGLE_ACTIVE" })
    }
  }

  const openEditModal = (admin: AdminKeuanganEntry) => {
    setEditUserId(admin.id)
    setEditNama(admin.nama)
    setIsEditOpen(true)
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <DashboardHeader
        title="Kelola Akun Admin Keuangan"
        subtitle="Manajemen akun kasir/admin keuangan yang mengelola SPP, verifikasi pembayaran, dan pencatatan keuangan."
        action={
          <Button
            onClick={() => setIsAddOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md min-h-[44px]"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Tambah Admin Keuangan Baru
          </Button>
        }
      />

      {/* Admin Keuangan Table / Card List */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Daftar Admin Keuangan ({adminList.length} Akun)
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {adminList.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">
                Belum ada akun admin keuangan yang terdaftar.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Klik &quot;Tambah Admin Keuangan Baru&quot; untuk membuat akun
                kasir.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-600">
                    <tr>
                      <th className="p-4 pl-6">Nama</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Keterangan</th>
                      <th className="p-4 pr-6 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adminList.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/80">
                        <td className="p-4 pl-6">
                          <div className="font-bold text-slate-900">
                            {a.nama}
                          </div>
                        </td>
                        <td className="p-4 text-xs text-slate-600">
                          {a.email}
                        </td>
                        <td className="p-4">
                          <StatusBadge
                            status={a.aktif ? "AKTIF" : "NONAKTIF"}
                          />
                        </td>
                        <td className="p-4 text-xs text-slate-500">
                          {a.mustChangePassword ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              Belum Ganti Password
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              Akun Normal
                            </span>
                          )}
                        </td>
                        <td className="p-4 pr-6 text-right space-x-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(a)}
                            className="rounded-xl text-xs font-semibold"
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant={a.aktif ? "destructive" : "default"}
                            onClick={() =>
                              setConfirmDialog({
                                open: true,
                                admin: a,
                                type: "TOGGLE_ACTIVE",
                              })
                            }
                            className="rounded-xl text-xs font-semibold"
                          >
                            {a.aktif ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden p-4 space-y-3">
                {adminList.map((a) => (
                  <div
                    key={a.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          {a.nama}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Admin Keuangan
                        </div>
                      </div>
                      <StatusBadge
                        status={a.aktif ? "AKTIF" : "NONAKTIF"}
                        size="sm"
                      />
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 bg-white p-3 rounded-xl border border-slate-100">
                      <div>
                        Email: <strong>{a.email}</strong>
                      </div>
                      {a.mustChangePassword && (
                        <div className="text-amber-700 font-semibold">
                          ⚠️ Belum ganti password
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(a)}
                        className="flex-1 rounded-xl text-xs min-h-[40px]"
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit Profil
                      </Button>
                      <Button
                        size="sm"
                        variant={a.aktif ? "destructive" : "default"}
                        onClick={() =>
                          setConfirmDialog({
                            open: true,
                            admin: a,
                            type: "TOGGLE_ACTIVE",
                          })
                        }
                        className="flex-1 rounded-xl text-xs min-h-[40px]"
                      >
                        {a.aktif ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Tambah Admin Keuangan */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Tambah Akun Admin Keuangan Baru
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Password default aman akan dibuat otomatis dan dikirim ke email
              admin keuangan. Ia wajib mengganti password saat login pertama.
            </p>
          </DialogHeader>

          <form onSubmit={handleAddAdmin} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Nama Lengkap *
              </label>
              <Input
                placeholder="Contoh: Ustadzah Khadijah, S.E."
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="h-11 rounded-xl text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Alamat Email Resmi *
              </label>
              <Input
                type="email"
                placeholder="khadijah@ansharussunnah.sch.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                No. WhatsApp / HP (Opsional)
              </label>
              <Input
                placeholder="081234567..."
                value={noHp}
                onChange={(e) => setNoHp(e.target.value)}
                className="h-11 rounded-xl text-sm"
              />
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
              ⚠️ Password default sepanjang 14 karakter akan dibuat
              otomatis dan dikirim via email. Admin keuangan wajib mengganti
              password saat pertama kali login.
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[40px]"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Plus className="h-4 w-4 mr-1.5" />
                )}
                Buat Akun Admin Keuangan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Edit Admin Keuangan */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Edit Profil Admin Keuangan
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Perbarui data profil admin keuangan.
            </p>
          </DialogHeader>

          <form onSubmit={handleEditAdmin} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Nama Lengkap *
              </label>
              <Input
                placeholder="Nama admin keuangan"
                value={editNama}
                onChange={(e) => setEditNama(e.target.value)}
                className="h-11 rounded-xl text-sm"
                required
              />
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[40px]"
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
      {confirmDialog.admin && (
        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) =>
            setConfirmDialog((prev) => ({ ...prev, open }))
          }
          title={
            confirmDialog.admin.aktif
              ? "Nonaktifkan Akun Admin Keuangan?"
              : "Aktifkan Kembali Akun?"
          }
          description={
            confirmDialog.admin.aktif
              ? `Apakah Anda yakin ingin menonaktifkan akun ${confirmDialog.admin.nama}? Admin ini tidak akan bisa login ke sistem sampai diaktifkan kembali.`
              : `Apakah Anda yakin ingin mengaktifkan kembali akun ${confirmDialog.admin.nama}? Admin ini akan bisa login kembali ke sistem.`
          }
          confirmText="Lanjutkan"
          variant={confirmDialog.admin.aktif ? "destructive" : "default"}
          isLoading={executing}
          onConfirm={handleExecuteConfirm}
        />
      )}
    </div>
  )
}
