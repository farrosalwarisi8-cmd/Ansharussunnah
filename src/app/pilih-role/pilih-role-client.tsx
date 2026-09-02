// src/app/pilih-role/pilih-role-client.tsx
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Role } from "@prisma/client"
import {
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
      <div className="flex items-center gap-3 text-white">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
        <span className="text-sm">Memuat data akun...</span>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md relative z-10 space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-2xl overflow-hidden relative shadow-lg shadow-yellow-800/50 mb-4">
          <Image src="/ansharussunnah-logo.webp" alt="Logo" fill sizes="56px" className="object-cover" priority />
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Pilih Akun <span className="text-amber-400">✦</span>
        </h1>
        <p className="text-sm text-slate-400">
          Email Anda terdaftar untuk beberapa role. Pilih akun yang ingin digunakan:
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs text-center">
          ⚠️ {error}
        </div>
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
                <div className={`w-12 h-12 rounded-xl ${meta.color} flex items-center justify-center shrink-0 shadow-lg`}>
                  {isSelecting ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Icon className="h-6 w-6 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base text-white group-hover:text-yellow-300 transition-colors">
                    {meta.label}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{meta.description}</div>
                  {role.isAdmin && role.role === Role.GURU && (
                    <div className="text-[10px] font-bold text-yellow-400 bg-yellow-900/50 px-2 py-0.5 rounded inline-block mt-1">
                      Admin
                    </div>
                  )}
                </div>
                <div className="text-slate-600 group-hover:text-yellow-400 transition-colors text-lg font-bold">
                  →
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="text-center pt-2">
        <form action={logout}>
          <button
            type="submit"
            className="text-xs text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1.5 mx-auto"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Keluar & Login Ulang</span>
          </button>
        </form>
      </div>
    </div>
  )
}
