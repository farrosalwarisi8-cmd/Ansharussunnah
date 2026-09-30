// src/components/ui/bar-chart.tsx
//
// Grafik batang murni CSS (tanpa library chart tambahan) untuk dashboard
// keuangan. Sederhana, ringan, responsif, dan bisa dibaca screen reader
// lewat ringkasan teks tersembunyi (sr-only).

"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface BarChartSeries {
  name: string
  /** Kelas warna Tailwind untuk batang, mis. "bg-yellow-500". */
  colorClass: string
}

export interface BarChartDatum {
  label: string
  /** Nilai per seri, urutannya sama dengan `series`. */
  values: number[]
}

interface BarChartProps {
  data: BarChartDatum[]
  series: BarChartSeries[]
  ariaLabel: string
  formatValue?: (value: number) => string
  /** Tinggi area batang, default 160px. */
  height?: number
  emptyText?: string
}

const DEFAULT_FORMAT = (v: number) => v.toLocaleString("id-ID")

export function GroupedBarChart({
  data,
  series,
  ariaLabel,
  formatValue = DEFAULT_FORMAT,
  height = 160,
  emptyText = "Belum ada data untuk ditampilkan.",
}: BarChartProps) {
  const max = React.useMemo(() => {
    const highest = Math.max(
      0,
      ...data.flatMap((d) => d.values.map((v) => (Number.isFinite(v) ? v : 0)))
    )
    // Bulatkan ke atas agar sumbu terbaca (hindari maksimum 0).
    if (highest <= 0) return 1
    const magnitude = 10 ** Math.floor(Math.log10(highest))
    return Math.ceil(highest / magnitude) * magnitude
  }, [data])

  const isEmpty = data.length === 0 || max <= 1

  if (isEmpty) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center text-sm text-slate-500"
        style={{ minHeight: height }}
      >
        {emptyText}
      </div>
    )
  }

  const summary = data
    .map(
      (d) =>
        `${d.label}: ${d.values
          .map((v, i) => `${series[i]?.name ?? `seri ${i + 1}`} ${formatValue(v)}`)
          .join(", ")}`
    )
    .join("; ")

  return (
    <div>
      <div className="relative" style={{ height }}>
        {/* Garis bantu horizontal */}
        <div
          className="pointer-events-none absolute inset-0 flex flex-col justify-between"
          aria-hidden="true"
        >
          {[0, 1, 2, 3].map((line) => (
            <div key={line} className="border-t border-dashed border-slate-200" />
          ))}
        </div>

        <div className="relative flex h-full items-end gap-1.5 sm:gap-3">
          {data.map((datum) => (
            <div
              key={datum.label}
              className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
            >
              <div className="flex h-full items-end justify-center gap-1">
                {datum.values.map((value, i) => {
                  const safe = Number.isFinite(value) ? Math.max(0, value) : 0
                  const pct = Math.max(safe > 0 ? 4 : 0, (safe / max) * 100)
                  return (
                    <div
                      key={`${datum.label}-${series[i]?.name ?? i}`}
                      className={cn(
                        "w-full max-w-[26px] rounded-t-md transition-all duration-300",
                        series[i]?.colorClass ?? "bg-slate-300",
                        safe === 0 && "opacity-40"
                      )}
                      style={{ height: `${pct}%` }}
                      title={`${datum.label} — ${series[i]?.name}: ${formatValue(safe)}`}
                    />
                  )
                })}
              </div>
              <span className="truncate text-center text-[11px] font-medium text-slate-500">
                {datum.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {series.map((s) => (
          <span
            key={s.name}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600"
          >
            <span
              className={cn("h-2.5 w-2.5 rounded-sm", s.colorClass)}
              aria-hidden="true"
            />
            {s.name}
          </span>
        ))}
      </div>

      {/* Ringkasan untuk screen reader / teks polos */}
      <p className="sr-only" aria-label={ariaLabel}>
        {ariaLabel}. {summary}
      </p>
    </div>
  )
}
