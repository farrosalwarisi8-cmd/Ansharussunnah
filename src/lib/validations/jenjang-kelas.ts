// src/lib/validations/jenjang-kelas.ts

import { z } from "zod"

export const jenjangSchema = z.object({
  nama: z
    .string()
    .min(1, "Nama jenjang wajib diisi")
    .max(50, "Nama jenjang maksimal 50 karakter"),
  urutan: z
    .number()
    .int("Urutan harus bilangan bulat")
    .min(1, "Urutan minimal 1"),
  tarifSppBulanan: z
    .number()
    .min(0, "Tarif SPP tidak boleh negatif")
    .optional()
    .nullable(),
})

export type JenjangFormValues = z.infer<typeof jenjangSchema>

export const kelasSchema = z.object({
  nama: z
    .string()
    .min(1, "Nama kelas wajib diisi")
    .max(50, "Nama kelas maksimal 50 karakter"),
  jenjangId: z
    .string()
    .min(1, "Pilih jenjang"),
  waliKelasId: z
    .string()
    .optional(),
  kapasitas: z
    .number()
    .int()
    .min(1, "Kapasitas minimal 1")
    .max(100, "Kapasitas maksimal 100")
    .default(30),
})

export type KelasFormValues = z.infer<typeof kelasSchema>