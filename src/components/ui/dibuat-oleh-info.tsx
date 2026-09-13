"use client"

// DibuatOlehInfo
// Info read-only "Dibuat oleh: {nama}" — pembuat diambil dari akun yang login,
// tidak bisa diisi manual (form tetap mencatat user.id di server).

import { UserRound } from "lucide-react"

export function DibuatOlehInfo({
  nama,
  className = "",
}: {
  nama: string
  className?: string
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50 px-3 py-2.5 text-sm ${className}`}
    >
      <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="text-slate-500">Dibuat oleh:</span>
      <span className="font-semibold text-slate-700">{nama}</span>
    </div>
  )
}