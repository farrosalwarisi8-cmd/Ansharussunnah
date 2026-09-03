// src/components/dashboard/ganti-akun-dialog.tsx

"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Role } from "@prisma/client"
import { useDashboard } from "./dashboard-context"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  GraduationCap,
  Users2,
  Shield,
  Wallet,
  Loader2,
  Check,
  RefreshCw,
} from "lucide-react"

interface UserRole {
  id: string
  nama: string
  email: string
  role: Role
  isAdmin: boolean
}

const ROLE_META: Record<Role, { label: string; description: string; icon: React.ElementType; color: string }> = {
  [Role.SUPER_ADMIN]: {
    label: "Super Admin",
    description: "Akses penuh ke seluruh sistem",
    icon: Shield,
    color: "bg-purple-600",
  },
  [Role.ADMIN_AKADEMIK]: {
    label: "Admin Akademik",
    description: "Tata Usaha, Pendaftaran, Jadwal",
    icon: Shield,
    color: "bg-blue-600",
  },
  [Role.ADMIN_KEUANGAN]: {
    label: "Admin Keuangan",
    description: "Kasir, SPP, Akuntansi",
    icon: Wallet,
    color: "bg-emerald-600",
  },
  [Role.GURU]: {
    label: "Guru",
    description: "Pengajar & Manajemen Kelas",
    icon: GraduationCap,
    color: "bg-yellow-600",
  },
  [Role.SISWA]: {
    label: "Santri / Siswa",
    description: "Portal Pembelajaran Siswa",
    icon: Users2,
    color: "bg-cyan-600",
  },
  [Role.ORANG_TUA]: {
    label: "Wali Santri",
    description: "Monitoring Anak & Pembayaran",
    icon: Users2,
    color: "bg-rose-600",
  },
}

export function GantiAkunDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const { user: currentUser } = useDashboard()
  const [roles, setRoles] = React.useState<UserRole[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selecting, setSelecting] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoading(true)
    setError(null)

    async function fetchRoles() {
      try {
        const res = await fetch("/api/pilih-role")
        const data = await res.json()
        if (!cancelled) {
          setRoles(Array.isArray(data.roles) ? data.roles : [])
        }
      } catch {
        if (!cancelled) setError("Gagal memuat data akun")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchRoles()
    return () => {
      cancelled = true
    }
  }, [open])

  const handleSelectRole = async (role: UserRole) => {
    // Role yang sama dengan yang aktif tidak perlu dipilih ulang
    if (role.id === currentUser.id) {
      onOpenChange(false)
      return
    }

    setSelecting(role.id)
    setError(null)
    try {
      const res = await fetch("/api/pilih-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: role.id, role: role.role }),
      })
      const data = await res.json()
      if (data.success) {
        onOpenChange(false)
        router.push("/dashboard")
        router.refresh()
      } else {
        setError(data.message || "Gagal mengganti akun")
        setSelecting(null)
      }
    } catch {
      setError("Terjadi kesalahan")
      setSelecting(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden bg-slate-800 text-white border-slate-700 max-w-sm rounded-3xl w-[calc(100%-1.25rem)]">
        <DialogHeader className="p-5 pr-12 border-b border-slate-700 bg-slate-800">
          <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-amber-400" />
            Ganti Akun
          </DialogTitle>
          <p className="text-xs text-slate-400 mt-1">
            Pilih akun lain yang terdaftar dengan email ini
          </p>
        </DialogHeader>

        <div className="p-4 max-h-[60vh] overflow-y-auto overscroll-contain">
          {error && (
            <div className="mb-3 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              Memuat daftar akun...
            </div>
          ) : roles.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              Tidak ada akun lain yang tersedia
            </div>
          ) : (
            <div className="space-y-2.5">
              {roles.map((role) => {
                const meta = ROLE_META[role.role]
                const Icon = meta.icon
                const isActive = role.id === currentUser.id
                const isSelecting = selecting === role.id

                return (
                  <button
                    key={`${role.id}-${role.role}`}
                    type="button"
                    disabled={!!selecting}
                    onClick={() => handleSelectRole(role)}
                    className={`flex items-center gap-3 w-full p-3 rounded-2xl border text-left transition-all min-h-[56px] active:scale-[0.98] touch-manipulation ${
                      isActive
                        ? "border-yellow-500/60 bg-yellow-900/30 cursor-default"
                        : "border-slate-700 bg-slate-800/60 hover:border-yellow-500/50 hover:bg-slate-700/50 cursor-pointer"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl ${meta.color} flex items-center justify-center shrink-0`}>
                      {isSelecting ? (
                        <Loader2 className="h-5 w-5 text-white animate-spin" />
                      ) : (
                        <Icon className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-white truncate flex items-center gap-1.5">
                        {meta.label}
                        {role.isAdmin && role.role === Role.GURU && (
                          <span className="text-[10px] font-bold text-yellow-400 bg-yellow-900/70 px-1.5 py-0.5 rounded shrink-0">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{role.nama}</div>
                    </div>
                    {isActive && (
                      <div className="flex items-center gap-1 text-xs text-yellow-400 shrink-0">
                        <Check className="h-4 w-4" />
                        <span className="text-[10px]">Aktif</span>
                      </div>
                    )}
                    {!isActive && (
                      <div className="text-slate-500 text-sm shrink-0">→</div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
