// src/components/ui/alert.tsx

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Alert design system.
 * Status selalu/icon + teks + warna (bukan warna saja) supaya terbaca oleh
 * pengguna dengan gangguan penglihatan warna.
 */
const alertVariants = cva(
  "flex gap-3 rounded-xl border p-4 text-sm [&>svg]:h-5 [&>svg]:w-5 [&>svg]:shrink-0 [&>svg]:translate-y-0.5",
  {
    variants: {
      variant: {
        info: "border-blue-200 bg-blue-50 text-blue-900 [&>svg]:text-blue-600",
        success:
          "border-green-200 bg-green-50 text-green-900 [&>svg]:text-green-600",
        warning:
          "border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-600",
        danger:
          "border-rose-200 bg-rose-50 text-rose-900 [&>svg]:text-rose-600",
        neutral: "border-slate-200 bg-slate-50 text-slate-700 [&>svg]:text-slate-500",
      },
    },
    defaultVariants: { variant: "info" },
  }
)

const ICON_BY_VARIANT: Record<
  NonNullable<VariantProps<typeof alertVariants>["variant"]>,
  LucideIcon
> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  neutral: Info,
}

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string
  icon?: LucideIcon
  onDismiss?: () => void
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    { className, variant, title, icon, onDismiss, children, ...props },
    ref
  ) => {
    const Icon = icon ?? ICON_BY_VARIANT[variant ?? "info"]
    return (
      <div
        ref={ref}
        role={variant === "danger" ? "alert" : "status"}
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        <Icon aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          {title && <p className="font-semibold leading-tight">{title}</p>}
          {children && (
            <div className="leading-relaxed [&_a]:font-medium [&_a]:underline">
              {children}
            </div>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Tutup peringatan"
            className="-mr-1 -mt-1 h-8 w-8 shrink-0 rounded-lg text-current opacity-60 transition-opacity hover:bg-black/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          >
            <X className="mx-auto h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    )
  }
)
Alert.displayName = "Alert"

export { Alert, alertVariants }
