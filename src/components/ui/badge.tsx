// src/components/ui/badge.tsx

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Badge design system.
 * Default = solid (rare, untuk status kuat). `soft-*` = tinted background,
 * dipakai di daftar/tabel karena lebih ringan dan tidak competing dengan
 * teks utama. Warna selalu berpasangan dengan teks, tidak warna saja.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-xs font-semibold leading-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/85",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/85",
        success: "border-transparent bg-success text-success-foreground",
        warning: "border-transparent bg-warning text-warning-foreground",
        info: "border-transparent bg-info text-info-foreground",
        outline: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
        muted: "border-transparent bg-slate-100 text-slate-600",

        // Tinted (soft) — default untuk badge status
        "soft-gold":
          "border-yellow-200 bg-yellow-50 text-yellow-800 hover:bg-yellow-100",
        "soft-success":
          "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
        "soft-warning":
          "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
        "soft-danger":
          "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
        "soft-info":
          "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
        "soft-slate":
          "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
      },
      size: {
        sm: "px-2 py-0 text-[11px] leading-4",
        default: "",
        lg: "px-3 py-1 text-[13px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
