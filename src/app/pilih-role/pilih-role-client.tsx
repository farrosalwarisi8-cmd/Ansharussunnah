// src/app/pilih-role/pilih-role-client.tsx
"use client"

import * as React from "react"
import { Alert } from "@/components/ui/alert"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Role } from "@/lib/roles"
import {
  ArrowRight,
  GraduationCap,
  Users2,
  Shield,
  Wallet,
  Loader2,
  LogOut,
} from "lucide-react"
import { logout } from "@/actions/auth"

interface UserRole {
  id: string
  nama: string
  email: string
  role: Role
  isAdmin: boolean
}

const ROLE_META: Record<
  Role,
  { label: string; description: string; icon: React.ElementType; tone: string }
> = {
  [Role.SUPER_ADMIN]: {
    label: "Super Admin",
    description: "Akses penuh ke seluruh sistem",
    icon: Shield,
    tone: "border-violet-200 bg-violet-50 text-violet-700",
  },
  [Role.ADMIN_AKADEMIK]: {
    label: "Admin Akademik",
    description: "Tata Usaha, Pendaftaran, Jadwal",
    icon: Shield,
    tone: "border-blue-200 bg-blue-50 text-blue-700",
  },
  [Role.ADMIN_KEUANGAN]: {
    label: "Admin Keuangan",
    description: "Kasir, SPP, Akuntansi",
    icon: Wallet,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  [Role.GURU]: {
    label: "Guru",
    description: "Pengajar & Manajemen Kelas",
    icon: GraduationCap,
    tone: "border-yellow-200 bg-yellow-50 text-yellow-700",
  },
  [Role.SISWA]: {
    label: "Santri",
    description: "Portal Pembelajaran Santri",
    icon: Users2,
    tone: "border-sky-200 bg-sky-50 text-sky-700",
  },
  [Role.ORANG_TUA]: {
    label: "Wali Santri",
    description: "Monitoring Anak & Pembayaran",
    icon: Users2,
    tone: "border-rose-200 bg-rose-50 text-rose-700",
  },
}

export default function PilihRoleClient() {
  const router = useRouter()
  const [roles, setRoles] = React.useState<UserRole[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selecting, setSelecting] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchRoles() {
      try {
        const res = await fetch("/api/pilih-role")
        const data = await res.json()
        if (data.roles && data.roles.length > 0) {
          setRoles(data.roles)
        } else {
          // Fallback: redirect to dashboard
          router.replace("/dashboard")
        }
      } catch {
        setError("Gagal memuat data role")
      } finally {
        setLoading(false)
      }
    }
    fetchRoles()
  }, [router])

  const handleSelectRole = async (role: UserRole) => {
    setSelecting(role.id)
    try {
      const res = await fetch("/api/pilih-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: role.id, role: role.role }),
      })
      const data = await res.json()
      if (data.success) {
        router.push("/dashboard")
        router.refresh()
      } else {
        setError(data.message || "Gagal memilih role")
        setSelecting(null)
      }
    } catch {
      setError("Terjadi kesalahan")
      setSelecting(null)
    }
  }

  if (loading) {
    return (
      <div
        className="flex flex-col items-center gap-3 text-white"
        role="status"
        aria-busy="true"
      >
        <Loader2 className="h-7 w-7 animate-spin text-yellow-400" aria-hidden="true" />
        <span className="text-sm text-slate-300">Memuat data akun…</span>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md relative z-10 space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-2xl overflow-hidden relative shadow-lg shadow-yellow-800/50 mb-4">
          <Image src="/anshorussunnah-logo.webp" alt="Logo" fill sizes="56px" className="object-cover" priority />
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Pilih Akun <span className="text-amber-400">✦</span>
        </h1>
        <p className="text-sm text-slate-400">
          Email Anda terdaftar untuk beberapa role. Pilih akun yang ingin digunakan:
        </p>
      </div>

      {error && (
        <Alert variant="danger" className="border-rose-800/70 bg-rose-950/70 text-rose-200">
          {error}
        </Alert>
      )}

      <div className="space-y-3">
        {roles.map((role) => {
          const meta = ROLE_META[role.role]
          const Icon = meta.icon
          const isSelecting = selecting === role.id

          return (
            <Card
              key={`${role.id}-${role.role}`}
              className="border-slate-700 bg-slate-800/90 backdrop-blur-xl shadow-xl text-white rounded-2xl overflow-hidden hover:border-yellow-500/50 transition-all cursor-pointer group"
              onClick={() => !selecting && handleSelectRole(role)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${meta.tone}`}
                  aria-hidden="true"
                >
                  {isSelecting ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Icon className="h-6 w-6" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base text-white group-hover:text-yellow-300 transition-colors">
                    {meta.label}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{meta.description}</div>
                  {role.isAdmin && role.role === Role.GURU && (
                    <Badge
                      variant="soft-gold"
                      size="sm"
                      className="mt-1 border-yellow-400/40 bg-yellow-400/15 text-yellow-200"
                    >
                      Admin
                    </Badge>
                  )}
                </div>
                <ArrowRight
                  className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-yellow-400"
                  aria-hidden="true"
                />
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="text-center pt-2">
        <form action={logout}>
          <button
            type="submit"
            className="mx-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-xs text-slate-400 transition-colors hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Keluar &amp; Login Ulang</span>
          </button>
        </form>
      </div>
    </div>
  )
}
