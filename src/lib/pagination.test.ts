// src/lib/pagination.test.ts

import { describe, it, expect } from "vitest"
import {
  normalizePagination,
  paginatedResult,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "@/lib/pagination"

describe("normalizePagination", () => {
  it("memberi default halaman 1 dan page size default", () => {
    expect(normalizePagination()).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
    })
  })

  it("menghitung skip dari halaman", () => {
    expect(normalizePagination({ page: 3, pageSize: 10 })).toEqual({
      page: 3,
      pageSize: 10,
      skip: 20,
      take: 10,
    })
  })

  it("membatasi page size ke MAX_PAGE_SIZE walau klien meminta lebih", () => {
    const p = normalizePagination({ page: 1, pageSize: 100000 })
    expect(p.pageSize).toBe(MAX_PAGE_SIZE)
    expect(p.take).toBe(MAX_PAGE_SIZE)
  })

  it("membulatkan ke bawah page/pageSize desimal dan minimal 1", () => {
    expect(normalizePagination({ page: 2.9, pageSize: 9.9 })).toMatchObject({
      page: 2,
      pageSize: 9,
      skip: 9,
    })
    expect(normalizePagination({ page: 0, pageSize: 0 })).toMatchObject({
      page: 1,
      pageSize: 1,
    })
  })

  it("menangani NaN/Infinity sebagai nilai default", () => {
    expect(normalizePagination({ page: NaN, pageSize: NaN })).toMatchObject({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    })
    expect(normalizePagination({ page: Infinity })).toMatchObject({ page: 1 })
  })

  it("menghormati defaultPageSize/maxPageSize khusus", () => {
    expect(normalizePagination(undefined, { defaultPageSize: 12 })).toMatchObject({
      pageSize: 12,
    })
    expect(
      normalizePagination({ pageSize: 500 }, { maxPageSize: 50 }),
    ).toMatchObject({ pageSize: 50 })
  })
})

describe("paginatedResult", () => {
  const p = { page: 2, pageSize: 10, skip: 10, take: 10 }

  it("membentuk amplop pagination yang benar", () => {
    const res = paginatedResult(["a", "b"], 25, p)
    expect(res).toEqual({
      items: ["a", "b"],
      total: 25,
      page: 2,
      pageSize: 10,
      totalPages: 3,
    })
  })

  it("memberi minimal 1 totalPages saat kosong", () => {
    expect(paginatedResult([], 0, p).totalPages).toBe(1)
  })

  it("membulatkan totalPages ke atas", () => {
    expect(paginatedResult([], 21, { page: 1, pageSize: 10, skip: 0, take: 10 }).totalPages).toBe(3)
  })
})
