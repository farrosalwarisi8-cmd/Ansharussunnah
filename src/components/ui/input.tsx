// src/components/ui/input.tsx

import * as React from "react"
import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // text-base di mobile mencegah auto-zoom iOS saat fokus (font <16px),
          // lalu kembali text-sm di layar >=640px agar padat di desktop.
          "flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-base sm:text-sm text-slate-800 shadow-sm transition-colors ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 hover:border-slate-300 focus-visible:outline-none focus-visible:border-yellow-400 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }