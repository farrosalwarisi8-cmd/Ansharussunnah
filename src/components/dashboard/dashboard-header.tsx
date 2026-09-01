// src/components/dashboard/dashboard-header.tsx

"use client"

import * as React from "react"
import { useDashboard } from "./dashboard-context"

import { Calendar } from "lucide-react"

interface DashboardHeaderProps {
  title?: string
  subtitle?: string
  action?: React.ReactNode
}

function DashboardHeaderInner({
  title,
  subtitle,
  action,
}: DashboardHeaderProps) {
  const { user } = useDashboard()

  const formattedDate = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date())

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200/80">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formattedDate}</span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-600 font-medium">T.A 2024/2025 Semester Genap</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
          {title || `Ahlan wa Sahlan, ${user.nama.split(" ")[0]}!`}
        </h1>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-1">
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <div className="flex items-center gap-3 shrink-0">
          {action}
        </div>
      )}
    </div>
  )
}

export const DashboardHeader = React.memo(DashboardHeaderInner)
