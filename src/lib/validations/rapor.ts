// src/lib/validations/rapor.ts

import { z } from "zod"

// ============================================
// PERIODE AJARAN
// ============================================

// Base object tanpa refine agar method .partial() dapat dipanggil
const periodeAjaranBaseSchema = z.object({
  nama: z.string().min(3, "Nama periode minimal 3 karakter").max(100),
  tahunAjaran: z
    .string()
    .regex(/^\d{4}\/\d{4}$/, "Format tahun ajaran harus YYYY/YYYY (contoh: 2025/2026)"),
  semester: z.enum(["GANJIL", "GENAP"]),
  tanggalMulai: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Format tanggal mulai tidak valid",
  }),
  tanggalSelesai: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Format tanggal selesai tidak valid",
  }),
  aktif: z.boolean().default(false),
})

export const createPeriodeAjaranSchema = periodeAjaranBaseSchema.refine(
  (data) => new Date(data.tanggalSelesai) > new Date(data.tanggalMulai),
  {
    message: "Tanggal selesai harus lebih akhir dari tanggal mulai",
    path: ["tanggalSelesai"],
  }
)

export type CreatePeriodeAjaranValues = z.infer<typeof createPeriodeAjaranSchema>

// updatePeriodeAjaranSchema diturunkan dari base schema
export const updatePeriodeAjaranSchema = periodeAjaranBaseSchema.partial()

export type UpdatePeriodeAjaranValues = z.infer<typeof updatePeriodeAjaranSchema>

// ============================================
// RAPOR & CATATAN
// ============================================

export const generateRaporSchema = z.object({
  siswaId: z.string().min(1, "Siswa wajib dipilih"),
  periodeAjaranId: z.string().min(1, "Periode ajaran wajib dipilih"),
})

export type GenerateRaporValues = z.infer<typeof generateRaporSchema>

export const rekapKelasSchema = z.object({
  kelasId: z.string().min(1, "Kelas wajib dipilih"),
  periodeAjaranId: z.string().min(1, "Periode ajaran wajib dipilih"),
})

export type RekapKelasValues = z.infer<typeof rekapKelasSchema>

export const createCatatanRaporSchema = z.object({
  siswaId: z.string().min(1),
  periodeAjaranId: z.string().min(1),
  catatan: z.string().min(1, "Catatan tidak boleh kosong").max(2000),
  ranking: z
    .number()
    .int()
    .min(1, "Ranking minimal 1")
    .max(100, "Ranking maksimal 100")
    .optional(),
})

export type CreateCatatanRaporValues = z.infer<typeof createCatatanRaporSchema>

export const updateCatatanRaporSchema = z.object({
  catatanId: z.string().min(1),
  catatan: z.string().min(1).max(2000).optional(),
  ranking: z.number().int().min(1).max(100).optional(),
})

export type UpdateCatatanRaporValues = z.infer<typeof updateCatatanRaporSchema>