// src/components/dashboard/dashboard-header.tsx

"use client"

import * as React from "react"
import { useDashboard } from "./dashboard-context"
import { CalendarDays, type LucideIcon } from "lucide-react"
import { PageHeader, type Crumb } from "@/components/ui/page-header"

interface DashboardHeaderProps {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  /** Ikon kecil di sebelah judul — bantu pengguna mengenali halaman. */
  icon?: LucideIcon
  /** Tambahan di bawah deskripsi (badge, filter ringkas, dsb). */
  meta?: React.ReactNode
  breadcrumbs?: Crumb[]
  /** Aksi utama yang menempel di bawah pada layar kecil. */
  stickyActionsOnMobile?: boolean
  className?: string
}

/**
 * Kepala halaman seragam untuk semua halaman dashboard.
 * dibungkus `PageHeader` supaya judul, deskripsi, dan area aksi punya styling
 * yang sama di seluruh halaman (tidak ada lagi header yang dibuat manual).
 */
function DashboardHeaderInner({
  title,
  subtitle,
  action,
  icon,
  meta,
  breadcrumbs,
  stickyActionsOnMobile,
  className,
}: DashboardHeaderProps) {
  const { user } = useDashboard()

  const formattedDate = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date())

  return (
    <PageHeader
      title={title || `Ahlan wa Sahlan, ${user.nama.split(" ")[0]}!`}
      description={subtitle}
      icon={icon}
      breadcrumbs={breadcrumbs}
      actions={action}
      meta={
        meta ?? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span className="capitalize">{formattedDate}</span>
          </p>
        )
      }
      stickyActionsOnMobile={stickyActionsOnMobile}
      className={className}
    />
  )
}

export const DashboardHeader = React.memo(DashboardHeaderInner)
