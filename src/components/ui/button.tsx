// src/components/ui/button.tsx

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Button design system.
 * - Gold = aksi utama (satu per layar), slate/ghost = aksi sekunder.
 * - Ukuran `default`/`lg` memakai tinggi 44–48px agar ramah sentuh di mobile.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        // Aksi utama — identitas Gold Anshorussunnah
        default:
          "bg-primary text-primary-foreground shadow-gold-soft hover:bg-primary-dark hover:shadow-gold active:translate-y-px",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:translate-y-px",
        outline:
          "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-yellow-300 hover:bg-yellow-50 hover:text-yellow-800 active:translate-y-px",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-slate-200/70 active:translate-y-px",
        soft: "bg-primary-soft text-yellow-900 hover:bg-yellow-200/70 active:translate-y-px",
        success: "bg-success text-success-foreground shadow-sm hover:bg-success/90",
        warning: "bg-warning text-warning-foreground shadow-sm hover:bg-warning/90",
        info: "bg-info text-info-foreground shadow-sm hover:bg-info/90",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        link: "text-primary-dark underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-9 rounded-lg px-3 text-xs [&_svg]:h-4 [&_svg]:w-4",
        sm: "h-10 rounded-lg px-3.5 text-sm [&_svg]:h-4 [&_svg]:w-4",
        default: "h-11 px-4 [&_svg]:h-4 [&_svg]:w-4",
        lg: "h-12 rounded-xl px-6 text-[15px] [&_svg]:h-5 [&_svg]:w-5",
        xl: "h-[52px] rounded-xl px-7 text-base [&_svg]:h-5 [&_svg]:w-5",
        icon: "h-11 w-11 [&_svg]:h-5 [&_svg]:w-5",
        "icon-sm": "h-9 w-9 rounded-lg [&_svg]:h-4 [&_svg]:w-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    // `type` sengaja TIDAK dipaksa: halaman yang memakai <Button> di dalam
    // <form> tanpa type eksplisit tetap berperilaku seperti sebelumnya.
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
