// src/components/ui/access-denied.tsx
//
// State "Akses Ditolak" yang seragam untuk semua role.
// Dipakai di dua kondisi:
//   1. Halaman yang dicek di client (mis. hanya untuk Admin Keuangan).
//   2. Banner di beranda saat server memblokir route (guard di dashboard
//      layout) — aturan permission TIDAK berubah, hanya tampilannya dirancang.

import * as React from "react"
import { ArrowLeft, ShieldX } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"

interface AccessDeniedProps {
  title?: string
  description: React.ReactNode
  actionHref?: string
  actionLabel?: string
}

/** Block penuh: dipakai ketika halaman yang diminta memang tidak boleh dibuka. */
export function AccessDenied({
  title = "Akses Ditolak",
  description,
  actionHref = "/dashboard",
  actionLabel = "Kembali ke Beranda",
}: AccessDeniedProps) {
  return (
    <EmptyState
      variant="permission"
      icon={ShieldX}
      title={title}
      description={description}
      actionHref={actionHref}
      actionLabel={actionLabel}
    />
  )
}

/**
 * Banner ringkas: dipakai di beranda setelah server mengalihkan pengguna dari
 * route yang tidak berhak. Konten beranda tetap tampil di bawahnya.
 */
export function AccessDeniedBanner({
  description = "Halaman yang Anda minta tidak tersedia untuk peran Anda. Silakan pilih menu lain dari navigasi.",
}: {
  description?: React.ReactNode
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-white text-amber-600">
        <ShieldX className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-amber-900">Akses ditolak</p>
        <p className="mt-0.5 text-sm leading-relaxed text-amber-800">{description}</p>
      </div>
      <a
        href="/dashboard"
        className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Ke Beranda
      </a>
    </div>
  )
}
