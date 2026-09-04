// src/lib/validations/mapel.ts

import { z } from "zod"

export const mapelSchema = z.object({
  kode: z
    .string()
    .min(1, "Kode mata pelajaran wajib diisi")
    .max(20, "Kode maksimal 20 karakter")
    .toUpperCase(),
  nama: z
    .string()
    .min(1, "Nama mata pelajaran wajib diisi")
    .max(100, "Nama maksimal 100 karakter"),
  kelompok: z
    .string()
    .max(50, "Kelompok maksimal 50 karakter")
    .optional()
    .nullable(),
  jenjangId: z
    .string()
    .min(1, "Jenjang wajib dipilih")
    .optional()
    .nullable(),
  kelasIds: z
    .array(z.string())
    .optional()
    .default([]),
})

export type MapelFormValues = z.input<typeof mapelSchema>
