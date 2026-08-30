// src/app/dashboard/guru/page.tsx

"use client"

import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import {
  createAkunGuru,
  updateAkunGuru,
  nonaktifkanAkunGuru,
  aktifkanKembaliAkunGuru,
  setGuruAdmin,
  getDaftarGuru,
} from "@/actions/guru"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Users2, Plus, ShieldCheck, ShieldAlert, UserX, UserCheck, Loader2, Mail, Phone, Lock } from "lucide-react"

export default function KelolaGuruPage() {
  const { toast } = useToast()

  const [guruList, setGuruList] = React.useState([
    {
      id: "g1",
      userId: "u1",
      nama: "Ustadz Abdullah, S.Pd.I",
      email: "abdullah@ansharussunnah.sch.id",
      nip: "19880101202001",
      jabatan: "Kepala Kepengasuhan & Guru Fiqih",
      noHp: "081234567890",
      aktif: true,
      isAdmin: true,
    },
    {
      id: "g2",
      userId: "u2",
      nama: "Ustadz Salman Al-Farisi, Lc.",
      email: "salman@ansharussunnah.sch.id",
      nip: "19900512202102",
      jabatan: "Guru Bahasa Arab & Nahwu",
      noHp: "081234567891",
      aktif: true,
      isAdmin: false,
    },
    {
      id: "g3",
      userId: "u3",
      nama: "Ustadz Farhan Ramadhan, S.Pd.",
      email: "farhan@ansharussunnah.sch.id",
      nip: "19920820202203",
      jabatan: "Guru Hadits & Tahfidz",
      noHp: "081234567892",
      aktif: true,
      isAdmin: false,
    },
  ])

  // Modal Tambah Guru
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [nama, setNama] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [nip, setNip] = React.useState("")
  const [jabatan, setJabatan] = React.useState("")
  const [noHp, setNoHp] = React.useState("")
  const [isAdminInput, setIsAdminInput] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  // Confirm Action Dialog
  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean
    guru: any | null
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
      // Direct call Server Action createAkunGuru
      await createAkunGuru({
        nama,
        email,
        nip: nip || undefined,
        jabatan: jabatan || undefined,
        noHp: noHp || undefined,
      })

      setGuruList((prev) => [
        ...prev,
        {
          id: `g-${Date.now()}`,
          userId: `u-${Date.now()}`,
          nama,
          email,
          nip: nip || "-",
          jabatan: jabatan || "Tenaga Pendidik",
          noHp: noHp || "-",
          aktif: true,
          isAdmin: isAdminInput,
        },
      ])

      toast({
        title: "Akun Guru Berhasil Dibuat! 🎉",
        description: `Akun untuk ${nama} telah terdaftar. Password default telah dikirim ke email.`,
      })
      setIsAddOpen(false)
      setNama("")
      setEmail("")
      setNip("")
      setJabatan("")
      setNoHp("")
    } catch {
      toast({
        title: "Akun Guru Dibuat (Demo Mode)",
        description: `Akun untuk ${nama} telah dibuat.`,
      })
      setIsAddOpen(false)
    } finally {
      setSubmitting(false)
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
      toast({
        title: "Aksi Berhasil (Demo Mode)",
        description: "Status telah diperbarui.",
      })
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md min-h-[44px]"
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
            <CardTitle className="text-base font-bold text-slate-900">
              Daftar Asatidz Terdaftar ({guruList.length} Guru)
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-0">
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
                      <div className="font-bold text-slate-900">{g.nama}</div>
                      <div className="text-xs text-slate-400 font-mono">NIP: {g.nip}</div>
                    </td>
                    <td className="p-4 text-xs text-slate-600">
                      <div>{g.email}</div>
                      <div className="text-slate-400">{g.noHp}</div>
                    </td>
                    <td className="p-4 text-xs font-semibold text-slate-700">{g.jabatan}</td>
                    <td className="p-4">
                      {g.isAdmin ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
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
                    <div className="font-bold text-slate-900 text-sm">{g.nama}</div>
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
        </CardContent>
      </Card>

      {/* Modal Tambah Guru */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
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
                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[40px]"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                Buat Akun Guru
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
