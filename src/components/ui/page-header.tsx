// src/components/ui/page-header.tsx

"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Crumb {
  label: string
  href?: string
}

/**
 * PageHeader — kepala halaman seragam untuk semua halaman dashboard & publik.
 * Berisi breadcrumb, judul, deskripsi singkat, dan area aksi (kanan).
 * Styling tidak diubah oleh halaman pemakai — cukup lewat prop.
 */
export interface PageHeaderProps {
  title: string
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  icon?: LucideIcon
  breadcrumbs?: Crumb[]
  actions?: React.ReactNode
  meta?: React.ReactNode
  className?: string
  stickyActionsOnMobile?: boolean
}

export function PageHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  breadcrumbs,
  actions,
  meta,
  className,
  stickyActionsOnMobile = false,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
              {breadcrumbs.map((crumb, i) => (
                <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                  {i > 0 && (
                    <ChevronRight
                      className="h-3.5 w-3.5 shrink-0 text-slate-300"
                      aria-hidden="true"
                    />
                  )}
                  {crumb.href && i < breadcrumbs.length - 1 ? (
                    <Link href={crumb.href} className="breadcrumb-link">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className="font-medium text-slate-700"
                      aria-current={i === breadcrumbs.length - 1 ? "page" : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="flex items-start gap-3">
          {Icon && (
            <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-yellow-200 bg-yellow-50 text-yellow-700 shadow-sm sm:inline-flex">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-yellow-700">
                {eyebrow}
              </div>
            )}
            <h1 className="text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-2xl lg:text-[28px]">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
                {description}
              </p>
            )}
            {meta && <div className="mt-2">{meta}</div>}
          </div>
        </div>
      </div>

      {actions && (
        <div
          className={cn(
            "flex shrink-0 flex-wrap items-center gap-2",
            stickyActionsOnMobile &&
              "sticky bottom-[76px] z-20 -mx-4 w-[calc(100%+2rem)] rounded-t-2xl border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:static sm:mx-0 sm:w-auto sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
          )}
        >
          {actions}
        </div>
      )}
    </header>
  )
}
