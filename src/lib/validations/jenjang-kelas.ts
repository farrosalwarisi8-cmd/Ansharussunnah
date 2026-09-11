// src/lib/validations/jenjang-kelas.ts

import { z } from "zod"
import { JenisKelamin } from "@prisma/client"

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
  // Ikhwan (LAKI_LAKI), Akhwat (PEREMPUAN), atau campuran (null)
  jenisKelamin: z
    .union([z.literal(""), z.nativeEnum(JenisKelamin)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
})

export type KelasFormValues = z.infer<typeof kelasSchema>

/**
 * Validasi pembaruan kelas (semua field opsional).
 * Setara dengan kelasSchema untuk mode edit: jenisKelamin "" dibersihkan
 * menjadi null (campuran), waliKelasId nullish dibersihkan menjadi null.
 */
export const updateKelasSchema = z
  .object({
    nama: z
      .string()
      .min(1, "Nama kelas wajib diisi")
      .max(50, "Nama kelas maksimal 50 karakter")
      .optional(),
    jenjangId: z.string().min(1, "Pilih jenjang").optional(),
    waliKelasId: z
      .string()
      .nullish()
      .transform((v) => v ?? null)
      .optional(),
    kapasitas: z
      .number()
      .int()
      .min(1, "Kapasitas minimal 1")
      .max(100, "Kapasitas maksimal 100")
      .optional(),
    jenisKelamin: z
      .union([z.literal(""), z.nativeEnum(JenisKelamin), z.null()])
      .optional()
      .transform((v) => (v === "" ? null : v)),
    aktif: z.boolean().optional(),
  })
  .strict()

export type UpdateKelasFormValues = z.infer<typeof updateKelasSchema>