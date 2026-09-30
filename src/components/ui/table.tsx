// src/components/ui/table.tsx

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Table design system.
 * - Desktop: header sticky, zebra halus, hover, padding nyaman.
 * - Mobile: dibungkus `.table-scroll` sehingga bisa di-scroll horizontal tanpa
 *   membuat halaman luapan (overflow yang tidak disengaja).
 * - Untuk mobile, halaman sebaiknya memakai `DataCardList` (lihat bawah) atau
 *   menyembunyikan kolom sekunder lewat `className="hidden md:table-cell"`.
 */
type TableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  /** Kelas untuk wrapper luar tabel (default: `w-full`). */
  containerClassName?: string
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, ...props }, ref) => (
  <div className={cn("w-full", containerClassName)}>
    <div className="table-scroll rounded-xl border border-slate-200 bg-white shadow-card">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("[&_tr]:border-b [&_tr]:border-slate-200 bg-slate-50", className)}
    {...props}
  />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0 divide-y divide-slate-100", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-slate-200 bg-slate-50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-slate-100 transition-colors even:bg-slate-50/40 hover:bg-yellow-50/50 data-[state=selected]:bg-yellow-50",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    scope="col"
    className={cn(
      "h-11 whitespace-nowrap px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-500 [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-4 py-3 align-middle text-slate-700 [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

/**
 * DataCardList — padanan tabel untuk layar kecil.
 *amd children: `{ items, renderItem, keyOf }` dirender sebagai kartu.
 */
export function DataCardList<T>({
  items,
  renderItem,
  keyOf,
  className,
}: {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  keyOf: (item: T, index: number) => React.Key
  className?: string
}) {
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item, i) => (
        <li
          key={keyOf(item, i)}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-card"
        >
          {renderItem(item, i)}
        </li>
      ))}
    </ul>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
