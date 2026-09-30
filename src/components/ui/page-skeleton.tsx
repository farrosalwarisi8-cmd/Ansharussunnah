// src/components/ui/page-skeleton.tsx

import * as React from "react"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader } from "./card"
import { Skeleton } from "./skeleton"

/**
 * PageSkeleton — placeholder memuat untuk halaman dashboard.
 * Mengganti spinner full-page lama: layout halaman tetap terlihat sehingga
 * perpindahan konten tidak terasa "melompat" saat data arrives.
 */
export function PageSkeleton({
  label = "Memuat data",
  variant = "cards",
  rows = 4,
  className,
}: {
  label?: string
  variant?: "cards" | "table" | "list"
  rows?: number
  className?: string
}) {
  return (
    <div className={`animate-pulse-soft space-y-6 ${className || ""}`} role="status" aria-busy="true">
      <span className="sr-only">{label}…</span>

      {variant === "table" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-64" />
            </div>
            <Skeleton className="h-11 w-full sm:w-40" />
          </div>
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Skeleton className="h-9 w-full sm:w-56" />
              <Skeleton className="h-9 w-full sm:w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="hidden h-4 w-24 sm:block" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : variant === "list" ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-56" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-3 h-8 w-20" />
                <Skeleton className="mt-3 h-3 w-28" />
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3.5 w-64" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: Math.min(rows, 3) }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

/**
 * InlineLoading — untuk memuat sebagian area (tab, kartu, tabel) tanpa
 * mengganti seluruh isi halaman.
 */
export function InlineLoading({
  label = "Memuat data",
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      className={`flex min-h-[160px] flex-col items-center justify-center gap-2 px-4 py-10 text-center ${
        className || ""
      }`}
      role="status"
      aria-busy="true"
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-slate-500">{label}…</p>
    </div>
  )
}
