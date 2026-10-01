// src/lib/validations/absensi.ts

import { z } from "zod"

const statusAbsensiEnum = z.enum(["HADIR", "SAKIT", "IZIN", "ALPHA"])

export const inputAbsensiSingleSchema = z.object({
  siswaId: z.string().min(1, "Siswa wajib dipilih"),
  kelasId: z.string().min(1, "Kelas wajib dipilih"),
  periodeAjaranId: z.string().min(1, "Periode ajaran wajib dipilih"),
  mataPelajaranId: z.string().nullable().optional(),
  mataPelajaran: z.string().optional(),
  tanggal: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Format tanggal tidak valid",
  }),
  status: statusAbsensiEnum,
  keterangan: z.string().max(255).optional(),
})

export type InputAbsensiSingleValues = z.infer<typeof inputAbsensiSingleSchema>

export const absensiItemSchema = z.object({
  siswaId: z.string().min(1),
  status: statusAbsensiEnum,
  keterangan: z.string().max(255).optional(),
})

export const inputAbsensiBulkSchema = z.object({
  kelasId: z.string().min(1, "Kelas wajib dipilih"),
  periodeAjaranId: z.string().min(1, "Periode ajaran wajib dipilih"),
  mataPelajaranId: z.string().nullable().optional(),
  mataPelajaran: z.string().optional(),
  tanggal: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Format tanggal tidak valid",
  }),
  absensi: z
    .array(absensiItemSchema)
    .min(1, "Minimal 1 data absensi harus diisi"),
})

export type InputAbsensiBulkValues = z.infer<typeof inputAbsensiBulkSchema>

export const rekapKehadiranSchema = z.object({
  kelasId: z.string().min(1),
  periodeAjaranId: z.string().min(1),
  mataPelajaranId: z.string().nullable().optional(),
  tanggalMulai: z.string().optional(),
  tanggalSelesai: z.string().optional(),
})

export type RekapKehadiranValues = z.infer<typeof rekapKehadiranSchema>

// Siswa melihat riwayatnya SENDIRI — siswaId tidak dipakai dari klien (diambil
// dari sesi), jadi tidak ada di skema ini. Klien hanya mengirim filter + page.
export const riwayatKehadiranSiswaSchema = z.object({
  mataPelajaranId: z.string().nullable().optional(),
  tanggalMulai: z.string().optional(),
  tanggalSelesai: z.string().optional(),
  // Pagination server-side: dibatasi 1..100 agar klien tidak bisa meminta
  // seluruh riwayat sekaligus.
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
})

export type RiwayatKehadiranSiswaValues = z.infer<typeof riwayatKehadiranSiswaSchema>

// Orang tua WAJIB menyebutkan siswa mana yang dibaca (diverifikasi relasinya).
export const riwayatKehadiranAnakSchema = riwayatKehadiranSiswaSchema.extend({
  siswaId: z.string().min(1),
})

export type RiwayatKehadiranAnakValues = z.infer<typeof riwayatKehadiranAnakSchema>