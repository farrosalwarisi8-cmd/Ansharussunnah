// src/components/ui/textarea.tsx

import * as React from "react"
import { cn } from "@/lib/utils"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // text-base di mobile mencegah auto-zoom iOS saat fokus (font <16px).
          "flex min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base sm:text-sm leading-relaxed text-slate-800 shadow-sm transition-colors ring-offset-background placeholder:text-slate-400 hover:border-slate-300 focus-visible:outline-none focus-visible:border-yellow-400 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }