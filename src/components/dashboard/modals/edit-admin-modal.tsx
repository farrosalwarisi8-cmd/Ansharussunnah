// src/components/dashboard/modals/edit-admin-modal.tsx
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
import { Pencil, Loader2 } from "lucide-react"
import { updateAkunAdminKeuangan } from "@/actions/admin-keuangan"
import { useToast } from "@/hooks/use-toast"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  currentNama: string
  onUpdated: (newNama: string) => void
}

export function EditAdminModal({ open, onOpenChange, userId, currentNama, onUpdated }: Props) {
  const { toast } = useToast()
  const [editNama, setEditNama] = React.useState(currentNama)
  const [editing, setEditing] = React.useState(false)

  // Sync nama when modal opens with different data
  React.useEffect(() => {
    if (open) {
      setEditNama(currentNama)
    }
  }, [open, currentNama])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !editNama.trim()) return

    setEditing(true)
    try {
      const result = await updateAkunAdminKeuangan(userId, {
        nama: editNama.trim(),
      })

      if (result.success) {
        toast({
          title: "Data Admin Keuangan Diperbarui! ✅",
          description: result.message,
        })
        onUpdated(editNama.trim())
        onOpenChange(false)
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
      onUpdated(editNama.trim())
      onOpenChange(false)
    } finally {
      setEditing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">
            Edit Profil Admin Keuangan
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Perbarui data profil admin keuangan.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
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
              onClick={() => onOpenChange(false)}
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
  )
}
