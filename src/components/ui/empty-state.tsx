// src/components/ui/empty-state.tsx

import * as React from "react"
import { LucideIcon, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
  className?: string
  children?: React.ReactNode
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 md:p-12 rounded-2xl border border-dashed border-gray-200 bg-white/50 backdrop-blur-sm",
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-yellow-50 text-yellow-500 flex items-center justify-center mb-4 shadow-sm">
        <Icon className="h-7 w-7 stroke-[1.75]" />
      </div>
      <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-500 max-w-sm mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && (
        <div>
          {actionHref ? (
            <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-white shadow-sm">
              <a href={actionHref}>{actionLabel}</a>
            </Button>
          ) : (
            <Button
              onClick={onAction}
              className="bg-yellow-500 hover:bg-yellow-600 text-white shadow-sm"
            >
              {actionLabel}
            </Button>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
