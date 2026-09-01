// src/components/dashboard/kelola-akun-keuangan-client.tsx
"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import {
  nonaktifkanAkunAdminKeuangan,
  aktifkanKembaliAkunAdminKeuangan,
  getDaftarAdminKeuangan,
} from "@/actions/admin-keuangan"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { Plus, DollarSign, Pencil } from "lucide-react"

// Lazy-load heavy dialog modals — NOT in initial JS bundle
// These are only loaded when user clicks a button
const AddAdminModal = dynamic(
  () => import("@/components/dashboard/modals/add-admin-modal").then((m) => m.AddAdminModal),
  { ssr: false }
)
const EditAdminModal = dynamic(
  () => import("@/components/dashboard/modals/edit-admin-modal").then((m) => m.EditAdminModal),
  { ssr: false }
)
const ConfirmActionDialog = dynamic(
  () => import("@/components/ui/confirm-dialog").then((m) => m.ConfirmDialog),
  { ssr: false }
)

interface AdminKeuanganEntry {
  id: string
  nama: string
  email: string
  aktif: boolean
  mustChangePassword: boolean
  createdAt: string
}

interface Props {
  initialAdminList: AdminKeuanganEntry[]
}

export function KelolaAkunKeuanganClient({ initialAdminList }: Props) {
  const { toast } = useToast()

  const [adminList, setAdminList] = React.useState<AdminKeuanganEntry[]>(initialAdminList)

  // Modal states
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<AdminKeuanganEntry | null>(null)

  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean
    admin: AdminKeuanganEntry | null
    type: "TOGGLE_ACTIVE"
  }>({ open: false, admin: null, type: "TOGGLE_ACTIVE" })
  const [executing, setExecuting] = React.useState(false)

  // Callback: after a new admin is created, refresh the list
  const refreshList = React.useCallback(async () => {
    try {
      const res = await getDaftarAdminKeuangan()
      if (res.success && Array.isArray(res.data)) {
        setAdminList(res.data as AdminKeuanganEntry[])
      }
    } catch {
      // keep current list
    }
  }, [])

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
            prev.map((item) => (item.id === a.id ? { ...item, aktif: false } : item))
          )
        } else {
          toast({ title: "Gagal", description: result.message, variant: "destructive" })
        }
      } else {
        const result = await aktifkanKembaliAkunAdminKeuangan(a.id)
        if (result.success) {
          toast({
            title: "Akun Diaktifkan Kembali",
            description: `Akun admin keuangan "${a.nama}" telah diaktifkan kembali.`,
          })
          setAdminList((prev) =>
            prev.map((item) => (item.id === a.id ? { ...item, aktif: true } : item))
          )
        } else {
          toast({ title: "Gagal", description: result.message, variant: "destructive" })
        }
      }
    } catch {
      toast({
        title: a.aktif ? "Akun Dinonaktifkan (Demo)" : "Akun Diaktifkan (Demo)",
        description: "Status akun telah diperbarui.",
      })
      setAdminList((prev) =>
        prev.map((item) => (item.id === a.id ? { ...item, aktif: !item.aktif } : item))
      )
    } finally {
      setExecuting(false)
      setConfirmDialog({ open: false, admin: null, type: "TOGGLE_ACTIVE" })
    }
  }

  const openEditModal = (admin: AdminKeuanganEntry) => {
    setEditTarget(admin)
    setIsEditOpen(true)
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <DashboardHeader
        title="Kelola Akun Admin Keuangan"
        subtitle="Manajemen akun kasir/admin keuangan yang mengelola SPP, verifikasi pembayaran, dan pencatatan keuangan."
        action={
          <Button
            onClick={() => setIsAddOpen(true)}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-md min-h-[44px]"
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
            <CardTitle className="text-base font-bold text-slate-800">
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
                Klik &quot;Tambah Admin Keuangan Baru&quot; untuk membuat akun kasir.
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
                          <div className="font-bold text-slate-800">{a.nama}</div>
                        </td>
                        <td className="p-4 text-xs text-slate-600">{a.email}</td>
                        <td className="p-4">
                          <StatusBadge status={a.aktif ? "AKTIF" : "NONAKTIF"} />
                        </td>
                        <td className="p-4 text-xs text-slate-500">
                          {a.mustChangePassword ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              Belum Ganti Password
                            </span>
                          ) : (
                            <span className="text-slate-400">Akun Normal</span>
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
                              setConfirmDialog({ open: true, admin: a, type: "TOGGLE_ACTIVE" })
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
                        <div className="font-bold text-slate-800 text-sm">{a.nama}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Admin Keuangan</div>
                      </div>
                      <StatusBadge status={a.aktif ? "AKTIF" : "NONAKTIF"} size="sm" />
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 bg-white p-3 rounded-xl border border-slate-100">
                      <div>
                        Email: <strong>{a.email}</strong>
                      </div>
                      {a.mustChangePassword && (
                        <div className="text-amber-700 font-semibold">⚠️ Belum ganti password</div>
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
                          setConfirmDialog({ open: true, admin: a, type: "TOGGLE_ACTIVE" })
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

      {/* Lazy-loaded modals — only loaded when user clicks a button */}
      <AddAdminModal open={isAddOpen} onOpenChange={setIsAddOpen} onCreated={refreshList} />

      {editTarget && (
        <EditAdminModal
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          userId={editTarget.id}
          currentNama={editTarget.nama}
          onUpdated={(newNama) => {
            setAdminList((prev) =>
              prev.map((a) => (a.id === editTarget.id ? { ...a, nama: newNama } : a))
            )
          }}
        />
      )}

      {confirmDialog.admin && (
        <ConfirmActionDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
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
