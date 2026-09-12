// src/lib/utils.ts

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

/**
 * Format tanggal+jam dalam zona waktu WIB (Asia/Jakarta) secara eksplisit.
 * Dipakai untuk menampilkan waktu ujian/tugas/absen agar tidak bergantung pada
 * zona waktu perangkat pengguna (yang bisa saja bukan WIB) dan tidak tergeser
 * oleh display default Intl. Output misal: "25 Sep 2026, 13.00 WIB".
 */
export function formatDateTimeWIB(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return "-"
  const label = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(d)
  // Intl id-ID memakai jam 24 jam dengan pemisah "." — tambahkan penanda WIB.
  return `${label} WIB`
}