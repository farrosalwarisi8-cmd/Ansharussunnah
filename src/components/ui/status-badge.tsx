// src/components/ui/status-badge.tsx

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { CheckCircle2, Clock, AlertCircle, FileText, Ban } from "lucide-react"

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors",
  {
    variants: {
      status: {
        // Success (Hijau)
        HADIR: "bg-yellow-50 text-yellow-600 border border-yellow-200/80",
        DITERIMA: "bg-yellow-50 text-yellow-600 border border-yellow-200/80",
        SUDAH_BAYAR: "bg-yellow-50 text-yellow-600 border border-yellow-200/80",
        DIKONFIRMASI: "bg-yellow-50 text-yellow-600 border border-yellow-200/80",
        SELESAI: "bg-yellow-50 text-yellow-600 border border-yellow-200/80",
        TEPAT_WAKTU: "bg-yellow-50 text-yellow-600 border border-yellow-200/80",
        AKTIF: "bg-yellow-50 text-yellow-600 border border-yellow-200/80",
        LUNAS: "bg-yellow-50 text-yellow-600 border border-yellow-200/80",

        // Warning (Kuning/Amber)
        IZIN: "bg-amber-50 text-amber-700 border border-amber-200/80",
        MENUNGGU_VERIFIKASI: "bg-amber-50 text-amber-700 border border-amber-200/80",
        MENUNGGU_PEMBAYARAN: "bg-amber-50 text-amber-700 border border-amber-200/80",
        PENDING: "bg-amber-50 text-amber-700 border border-amber-200/80",
        DIBAYAR_SEBAGIAN: "bg-amber-50 text-amber-700 border border-amber-200/80",

        // Info (Biru/Indigo)
        SAKIT: "bg-sky-50 text-sky-700 border border-sky-200/80",
        SEDANG_MENGERJAKAN: "bg-blue-50 text-blue-700 border border-blue-200/80",
        DRAFT: "bg-slate-100 text-slate-700 border border-slate-200",
        PUBLISHED: "bg-indigo-50 text-indigo-700 border border-indigo-200/80",
        DINILAI: "bg-teal-50 text-teal-700 border border-teal-200/80",

        // Destructive (Merah)
        ALPHA: "bg-rose-50 text-rose-700 border border-rose-200/80",
        DITOLAK: "bg-rose-50 text-rose-700 border border-rose-200/80",
        BELUM_BAYAR: "bg-rose-50 text-rose-700 border border-rose-200/80",
        TERLAMBAT: "bg-rose-50 text-rose-700 border border-rose-200/80",
        DIBATALKAN: "bg-rose-50 text-rose-700 border border-rose-200/80",

        // Neutral / Muted (Abu-abu)
        BELUM_DIKUMPULKAN: "bg-gray-100 text-gray-700 border border-gray-200",
        NONAKTIF: "bg-gray-100 text-gray-600 border border-gray-200",
      },
      size: {
        sm: "text-[11px] px-2 py-0.5",
        md: "text-xs px-2.5 py-0.5",
        lg: "text-sm px-3 py-1",
      },
    },
    defaultVariants: {
      status: "PENDING",
      size: "md",
    },
  }
)

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

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  status: StatusType
  customLabel?: string
  showIcon?: boolean
}

export function StatusBadge({
  status,
  size,
  customLabel,
  showIcon = true,
  className,
  ...props
}: StatusBadgeProps) {
  const getIcon = () => {
    if (!showIcon) return null
    switch (status) {
      case "HADIR":
      case "DITERIMA":
      case "SUDAH_BAYAR":
      case "DIKONFIRMASI":
      case "SELESAI":
      case "TEPAT_WAKTU":
      case "AKTIF":
      case "LUNAS":
        return <CheckCircle2 className="h-3 w-3 shrink-0" />
      case "IZIN":
      case "MENUNGGU_VERIFIKASI":
      case "MENUNGGU_PEMBAYARAN":
      case "PENDING":
      case "DIBAYAR_SEBAGIAN":
        return <Clock className="h-3 w-3 shrink-0" />
      case "SAKIT":
      case "SEDANG_MENGERJAKAN":
      case "DRAFT":
      case "PUBLISHED":
      case "DINILAI":
        return <FileText className="h-3 w-3 shrink-0" />
      case "ALPHA":
      case "DITOLAK":
      case "BELUM_BAYAR":
      case "TERLAMBAT":
        return <AlertCircle className="h-3 w-3 shrink-0" />
      case "DIBATALKAN":
      case "NONAKTIF":
        return <Ban className="h-3 w-3 shrink-0" />
      default:
        return null
    }
  }

  return (
    <span
      className={cn(statusBadgeVariants({ status, size }), className)}
      {...props}
    >
      {getIcon()}
      {customLabel || statusLabels[status] || status}
    </span>
  )
}
