// src/components/ui/empty-state.tsx

import * as React from "react"
import { Inbox, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
  secondaryAction?: React.ReactNode
  /** `filter` memberi judul/deskripsi berbeda agar hasil filter kosong terbaca jelas. */
  variant?: "default" | "filter" | "error" | "permission"
  className?: string
  children?: React.ReactNode
}

const COPY = {
  filter: {
    icon: Inbox,
    titleSuffix: "Tidak ada hasil",
  },
  error: {
    icon: Inbox,
    titleSuffix: "Gagal memuat data",
  },
  permission: {
    icon: Inbox,
    titleSuffix: "Akses dibatasi",
  },
  default: {
    icon: Inbox,
    titleSuffix: "",
  },
} as const

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  secondaryAction,
  variant = "default",
  className,
  children,
}: EmptyStateProps) {
  const fallbackIcon = COPY[variant].icon
  const Icon = icon ?? fallbackIcon
  const isError = variant === "error"

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed bg-white/70 px-6 py-10 text-center sm:py-14",
        isError ? "border-rose-200 bg-rose-50/40" : "border-slate-200",
        className
      )}
    >
      <div
        className={cn(
          "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm",
          isError
            ? "border-rose-200 bg-white text-rose-600"
            : "border-yellow-200 bg-yellow-50 text-yellow-600"
        )}
        aria-hidden="true"
      >
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-base font-semibold leading-tight text-slate-900 sm:text-lg">
        {title}
      </h3>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      )}
      {(actionLabel || secondaryAction) && (
        <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row">
          {actionLabel &&
            (actionHref ? (
              <Button asChild>
                <a href={actionHref}>{actionLabel}</a>
              </Button>
            ) : (
              <Button onClick={onAction}>{actionLabel}</Button>
            ))}
          {secondaryAction}
        </div>
      )}
      {children}
    </div>
  )
}
