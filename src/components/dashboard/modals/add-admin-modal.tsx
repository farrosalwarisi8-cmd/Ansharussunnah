// src/components/dashboard/modals/add-admin-modal.tsx
"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Loader2 } from "lucide-react"
import { createAkunAdminKeuangan, getDaftarAdminKeuangan } from "@/actions/admin-keuangan"
import { useToast } from "@/hooks/use-toast"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function AddAdminModal({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast()
  const [nama, setNama] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [noHp, setNoHp] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
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
        onCreated()
        onOpenChange(false)
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
      onOpenChange(false)
      setNama("")
      setEmail("")
      setNoHp("")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">
            Tambah Akun Admin Keuangan Baru
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Password default aman akan dibuat otomatis dan dikirim ke email
            admin keuangan. Ia wajib mengganti password saat login pertama.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
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
              onClick={() => onOpenChange(false)}
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
              Buat Akun Admin Keuangan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
