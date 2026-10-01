"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"

/**
 * Kontrol pagination daftar yang dipakai bersama.
 *
 * Semua angka (page/total/totalPages) datang dari server — komponen ini hanya
 * menampilkan dan memanggil onPageChange. Tidak ada logika pengambilan data,
 * supaya keputusan server-side tetap menjadi satu-satunya sumber kebenaran.
 */
export function ListPagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  loading = false,
  itemLabel = "data",
  className,
}: {
  page: number
  pageSize: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  loading?: boolean
  itemLabel?: string
  className?: string
}) {
  if (totalPages <= 1) return null

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  return (
    <div className={`flex items-center justify-between gap-3 pt-2 ${className ?? ""}`}>
      <p className="text-xs text-slate-500">
        Menampilkan {from}–{to} dari {total} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
          className="min-h-[40px] rounded-xl text-xs"
        >
          Sebelumnya
        </Button>
        <span className="text-xs text-slate-500">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(page + 1)}
          className="min-h-[40px] rounded-xl text-xs"
        >
          Berikutnya
        </Button>
      </div>
    </div>
  )
}
