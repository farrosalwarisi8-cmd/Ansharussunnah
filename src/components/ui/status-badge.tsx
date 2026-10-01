// src/components/ui/status-badge.tsx

import * as React from "react"
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  CircleDot,
  Clock,
  FileText,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * StatusBadge — satu-satunya tempat pemetaan status domain → warna + ikon.
 * Warna memakai palet status (success/warning/info/danger/slate) sehingga
 * "sukses" selalu hijau, "menunggu" amber, dan "gagal/ditolak" merah.
 * Warna tidak pernah berdiri sendiri: ikon + label teks selalu ikut.
 */
const statusLabels: Record<string, string> = {
  HADIR: "Hadir",
  DITERIMA: "Diterima",
  SUDAH_BAYAR: "Sudah Bayar",
  DIKONFIRMASI: "Dikonfirmasi",
  SELESAI: "Selesai",
  TEPAT_WAKTU: "Tepat Waktu",
  AKTIF: "Aktif",
  LUNAS: "Lunas",
  IZIN: "Izin",
  MENUNGGU_VERIFIKASI: "Menunggu Verifikasi",
  MENUNGGU_PEMBAYARAN: "Menunggu Pembayaran",
  SEDANG_DIPROSES: "Sedang Diproses",
  PENDING: "Pending",
  DIBAYAR_SEBAGIAN: "Sebagian",
  SAKIT: "Sakit",
  SEDANG_MENGERJAKAN: "Sedang Mengerjakan",
  DRAFT: "Draft",
  PUBLISHED: "Dipublikasikan",
  DINILAI: "Sudah Dinilai",
  ALPHA: "Alpa",
  DITOLAK: "Ditolak",
  BELUM_BAYAR: "Belum Bayar",
  TERLAMBAT: "Terlambat",
  DIBATALKAN: "Dibatalkan",
  BELUM_DIKUMPULKAN: "Belum Dikumpulkan",
  NONAKTIF: "Nonaktif",
}

export type StatusType =
  | "HADIR"
  | "DITERIMA"
  | "SUDAH_BAYAR"
  | "DIKONFIRMASI"
  | "SELESAI"
  | "TEPAT_WAKTU"
  | "AKTIF"
  | "LUNAS"
  | "IZIN"
  | "MENUNGGU_VERIFIKASI"
  | "MENUNGGU_PEMBAYARAN"
  | "SEDANG_DIPROSES"
  | "PENDING"
  | "DIBAYAR_SEBAGIAN"
  | "SAKIT"
  | "SEDANG_MENGERJAKAN"
  | "DRAFT"
  | "PUBLISHED"
  | "DINILAI"
  | "ALPHA"
  | "DITOLAK"
  | "BELUM_BAYAR"
  | "TERLAMBAT"
  | "DIBATALKAN"
  | "BELUM_DIKUMPULKAN"
  | "NONAKTIF"

type Tone = "success" | "warning" | "info" | "gold" | "danger" | "slate"

/** Pemetaan status → nada warna + ikon. */
const STATUS_TONE: Record<StatusType, { tone: Tone; icon: LucideIcon }> = {
  // Sukses
  HADIR: { tone: "success", icon: CheckCircle2 },
  DITERIMA: { tone: "success", icon: CheckCircle2 },
  SUDAH_BAYAR: { tone: "success", icon: CheckCircle2 },
  DIKONFIRMASI: { tone: "success", icon: CheckCircle2 },
  SELESAI: { tone: "success", icon: CheckCircle2 },
  TEPAT_WAKTU: { tone: "success", icon: CheckCircle2 },
  LUNAS: { tone: "success", icon: CheckCircle2 },
  DINILAI: { tone: "success", icon: CheckCircle2 },
  AKTIF: { tone: "gold", icon: CircleDot },

  // Menunggu / perlu tindakan
  IZIN: { tone: "warning", icon: Clock },
  MENUNGGU_VERIFIKASI: { tone: "warning", icon: Clock },
  MENUNGGU_PEMBAYARAN: { tone: "warning", icon: Clock },
  SEDANG_DIPROSES: { tone: "info", icon: Clock },
  PENDING: { tone: "warning", icon: Clock },
  DIBAYAR_SEBAGIAN: { tone: "warning", icon: Clock },

  // Informasi
  SAKIT: { tone: "info", icon: FileText },
  SEDANG_MENGERJAKAN: { tone: "info", icon: Clock },
  DRAFT: { tone: "slate", icon: FileText },
  PUBLISHED: { tone: "info", icon: FileText },

  // Gagal / batal
  ALPHA: { tone: "danger", icon: AlertCircle },
  DITOLAK: { tone: "danger", icon: AlertCircle },
  BELUM_BAYAR: { tone: "danger", icon: AlertCircle },
  TERLAMBAT: { tone: "danger", icon: AlertCircle },
  DIBATALKAN: { tone: "slate", icon: Ban },

  // Netral
  BELUM_DIKUMPULKAN: { tone: "slate", icon: FileText },
  NONAKTIF: { tone: "slate", icon: Ban },
}

const TONE_CLASS: Record<Tone, string> = {
  success: "border-green-200 bg-green-50 text-green-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  gold: "border-yellow-200 bg-yellow-50 text-yellow-800",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
}

const SIZE_CLASS = {
  sm: "px-2 py-0.5 text-[11px] gap-1 [&_svg]:h-3 [&_svg]:w-3",
  md: "px-2.5 py-0.5 text-xs gap-1.5 [&_svg]:h-3 [&_svg]:w-3",
  lg: "px-3 py-1 text-sm gap-1.5 [&_svg]:h-4 [&_svg]:w-4",
} as const

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusType
  customLabel?: string
  showIcon?: boolean
  size?: keyof typeof SIZE_CLASS
}

export function StatusBadge({
  status,
  size = "md",
  customLabel,
  showIcon = true,
  className,
  ...props
}: StatusBadgeProps) {
  const config = STATUS_TONE[status] ?? { tone: "slate" as Tone, icon: FileText }
  const Icon = config.icon

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold tracking-wide transition-colors",
        TONE_CLASS[config.tone],
        SIZE_CLASS[size] ?? SIZE_CLASS.md,
        className
      )}
      {...props}
    >
      {showIcon && <Icon className="shrink-0" aria-hidden="true" />}
      {customLabel || statusLabels[status] || status}
    </span>
  )
}
