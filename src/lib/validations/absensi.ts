// src/lib/validations/absensi.ts

import { z } from "zod"

const statusAbsensiEnum = z.enum(["HADIR", "SAKIT", "IZIN", "ALPHA"])

export const inputAbsensiSingleSchema = z.object({
  siswaId: z.string().min(1, "Siswa wajib dipilih"),
  kelasId: z.string().min(1, "Kelas wajib dipilih"),
  periodeAjaranId: z.string().min(1, "Periode ajaran wajib dipilih"),
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
  tanggal: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Format tanggal tidak valid",
  }),
  absensi: z
    .array(absensiItemSchema)
    .min(1, "Minimal 1 data absensi harus diisi"),
})

export type InputAbsensiBulkValues = z.infer<typeof inputAbsensiBulkSchema>

export const editAbsensiSchema = z.object({
  absensiId: z.string().min(1),
  status: statusAbsensiEnum,
  keterangan: z.string().max(255).optional(),
})

export type EditAbsensiValues = z.infer<typeof editAbsensiSchema>

export const rekapKehadiranSchema = z.object({
  kelasId: z.string().min(1),
  periodeAjaranId: z.string().min(1),
  tanggalMulai: z.string().optional(),
  tanggalSelesai: z.string().optional(),
})

export type RekapKehadiranValues = z.infer<typeof rekapKehadiranSchema>

export const riwayatKehadiranSiswaSchema = z.object({
  siswaId: z.string().min(1),
  tanggalMulai: z.string().optional(),
  tanggalSelesai: z.string().optional(),
})

export type RiwayatKehadiranSiswaValues = z.infer<typeof riwayatKehadiranSiswaSchema>