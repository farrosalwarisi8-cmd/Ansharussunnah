// src/lib/pagination.ts
//
// Helper pagination server-side yang dipakai bersama oleh action daftar.
// Tujuannya: pengguna TIDAK bisa meminta seluruh tabel sekaligus (payload &
// query mahal), dan batas page size ditegakkan di server, bukan hanya di UI.

export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export interface PaginationInput {
  page?: number
  pageSize?: number
}

export interface Pagination {
  page: number
  pageSize: number
  skip: number
  take: number
}

/**
 * Normalisasi input pagination: page minimal 1, pageSize dibatasi 1..max.
 * Nilai NaN/negatif/desimal dirapikan agar query tidak pernah menerima angka
 * aneh dari klien.
 */
export function normalizePagination(
  input?: PaginationInput,
  opts?: { defaultPageSize?: number; maxPageSize?: number },
): Pagination {
  const def = opts?.defaultPageSize ?? DEFAULT_PAGE_SIZE
  const max = opts?.maxPageSize ?? MAX_PAGE_SIZE

  const rawPage = Number(input?.page ?? 1)
  const rawSize = Number(input?.pageSize ?? def)

  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1
  const pageSize = Number.isFinite(rawSize)
    ? Math.min(max, Math.max(1, Math.floor(rawSize)))
    : def

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function paginatedResult<T>(
  items: T[],
  total: number,
  p: Pagination,
): Paginated<T> {
  return {
    items,
    total,
    page: p.page,
    pageSize: p.pageSize,
    totalPages: Math.max(1, Math.ceil(total / p.pageSize)),
  }
}
