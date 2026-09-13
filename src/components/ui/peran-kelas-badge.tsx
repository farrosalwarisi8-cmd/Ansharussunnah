// src/components/ui/peran-kelas-badge.tsx

"use client"

import { Crown, BookOpen, ShieldCheck } from "lucide-react"
import { labelPeranKelas, type PeranKelas } from "@/lib/kelas-peran"

const styleMap: Record<NonNullable<PeranKelas>, string> = {
  ADMIN: "text-slate-700 bg-slate-100 border-slate-200",
  WALI_KELAS: "text-yellow-800 bg-yellow-50 border-yellow-300",
  PENGAJAR: "text-sky-800 bg-sky-50 border-sky-300",
  WALI_KELAS_PENGAJAR: "text-violet-800 bg-violet-50 border-violet-300",
}

function PeranIcon({ peran }: { peran: NonNullable<PeranKelas> }) {
  if (peran === "WALI_KELAS" || peran === "WALI_KELAS_PENGAJAR") {
    return <Crown className="h-3 w-3" />
  }
  if (peran === "PENGAJAR") {
    return <BookOpen className="h-3 w-3" />
  }
  return <ShieldCheck className="h-3 w-3" />
}

/**
 * Badge peran guru di sebuah kelas:
 * 👑 kuning = Wali Kelas, 📘 biru = Guru Mapel, ungu = keduanya, abu = Admin.
 */
export function PeranKelasBadge({
  peran,
  className = "",
}: {
  peran?: PeranKelas | null
  className?: string
}) {
  if (!peran) return null
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${styleMap[peran]} ${className}`}
    >
      <PeranIcon peran={peran} />
      {labelPeranKelas(peran)}
    </span>
  )
}

/** Legenda kecil untuk menjelaskan arti badge peran kelas. */
export function PeranKelasLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500">
      <span className="font-semibold uppercase tracking-wider text-slate-400">
        Legenda:
      </span>
      <PeranKelasBadge peran="WALI_KELAS" />
      <PeranKelasBadge peran="PENGAJAR" />
      <PeranKelasBadge peran="WALI_KELAS_PENGAJAR" />
    </div>
  )
}