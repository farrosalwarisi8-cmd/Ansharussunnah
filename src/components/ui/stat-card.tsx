// src/components/ui/stat-card.tsx

import * as React from "react"
import Link from "next/link"
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "./skeleton"

export type StatTone = "gold" | "slate" | "success" | "warning" | "danger" | "info"

const TONE_STYLES: Record<
  StatTone,
  { icon: string; value: string; accent: string }
> = {
  gold: {
    icon: "bg-yellow-50 text-yellow-700 border-yellow-200",
    value: "text-slate-900",
    accent: "bg-yellow-500",
  },
  slate: {
    icon: "bg-slate-100 text-slate-600 border-slate-200",
    value: "text-slate-900",
    accent: "bg-slate-400",
  },
  success: {
    icon: "bg-green-50 text-green-700 border-green-200",
    value: "text-green-700",
    accent: "bg-green-500",
  },
  warning: {
    icon: "bg-amber-50 text-amber-700 border-amber-200",
    value: "text-amber-700",
    accent: "bg-amber-500",
  },
  danger: {
    icon: "bg-rose-50 text-rose-700 border-rose-200",
    value: "text-rose-700",
    accent: "bg-rose-500",
  },
  info: {
    icon: "bg-blue-50 text-blue-700 border-blue-200",
    value: "text-blue-700",
    accent: "bg-blue-500",
  },
}

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  hint?: React.ReactNode
  tone?: StatTone
  loading?: boolean
  trend?: { value: number; label?: string } | null
  href?: string
  footer?: React.ReactNode
}

/**
 * StatCard — kartu angka ringkasan. Nilai contingencia `tabular` supaya angka
 * sejajar dan mudah dibandingkan antar kartu.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "gold",
  loading = false,
  trend,
  href,
  footer,
  className,
  ...props
}: StatCardProps) {
  const styles = TONE_STYLES[tone]
  const TrendIcon =
    trend == null ? Minus : trend.value > 0 ? ArrowUpRight : trend.value < 0 ? ArrowDownRight : Minus

  const body = (
    <>
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-[3px] rounded-t-2xl opacity-80",
          styles.accent
        )}
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-3">
        <p className="stat-label">{label}</p>
        {Icon && (
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
              styles.icon
            )}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-8 w-28" />
      ) : (
        <p
          className={cn(
            "tabular mt-2 text-2xl font-bold leading-none tracking-tight sm:text-[28px]",
            styles.value
          )}
        >
          {value}
        </p>
      )}

      {(hint || trend) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {trend != null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold",
                trend.value > 0
                  ? "bg-green-50 text-green-700"
                  : trend.value < 0
                    ? "bg-rose-50 text-rose-700"
                    : "bg-slate-100 text-slate-600"
              )}
            >
              <TrendIcon className="h-3 w-3" aria-hidden="true" />
              {trend.value > 0 ? "+" : ""}
              {trend.value}
            </span>
          )}
          {hint && <span className="text-slate-500">{hint}</span>}
        </div>
      )}

      {footer && <div className="mt-3 border-t border-slate-100 pt-3">{footer}</div>}
    </>
  )

  const base = cn(
    "surface-card relative block overflow-hidden p-5",
    href && "surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    className
  )

  if (href) {
    // Tautan internal memakai next/link supaya navigasi tetap client-side.
    if (href.startsWith("/")) {
      return (
        <Link href={href} className={base} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
          {body}
        </Link>
      )
    }
    return (
      <a href={href} className={base} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {body}
      </a>
    )
  }

  return (
    <div className={base} {...props}>
      {body}
    </div>
  )
}
