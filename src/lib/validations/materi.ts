// src/lib/validations/materi.ts

import { z } from "zod"

export const createMateriSchema = z.object({
  judul: z.string().min(3, "Judul materi minimal 3 karakter").max(200),
  deskripsi: z.string().max(2000, "Deskripsi maksimal 2000 karakter").optional(),
  mataPelajaran: z.string().min(2, "Mata pelajaran wajib diisi").max(100),
  kelasId: z.string().min(1, "Kelas wajib dipilih"),
  periodeAjaranId: z.string().min(1, "Periode ajaran wajib dipilih"),
  urlFile: z.string().optional(),
  urlLink: z.string().url("Format URL tidak valid").optional(),
}).refine(
  (data) => data.urlFile || data.urlLink,
  {
    message: "Minimal satu dari file atau link wajib diisi",
    path: ["urlFile"],
  }
)

export type CreateMateriValues = z.infer<typeof createMateriSchema>

export const updateMateriSchema = z.object({
  judul: z.string().min(3, "Judul materi minimal 3 karakter").max(200).optional(),
  deskripsi: z.string().max(2000, "Deskripsi maksimal 2000 karakter").optional(),
  mataPelajaran: z.string().min(2, "Mata pelajaran wajib diisi").max(100).optional(),
  kelasId: z.string().min(1, "Kelas wajib dipilih").optional(),
  periodeAjaranId: z.string().min(1, "Periode ajaran wajib dipilih").optional(),
  urlFile: z.string().optional(),
  urlLink: z.string().url("Format URL tidak valid").optional(),
})

export type UpdateMateriValues = z.infer<typeof updateMateriSchema>
