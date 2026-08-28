// src/lib/validations/tugas.ts

import { z } from "zod"

export const createTugasSchema = z.object({
  judul: z.string().min(3, "Judul tugas minimal 3 karakter").max(200),
  deskripsi: z.string().min(10, "Deskripsi minimal 10 karakter"),
  mataPelajaran: z.string().min(2, "Mata pelajaran wajib diisi"),
  kelasId: z.string().min(1, "Kelas wajib dipilih"),
  periodeAjaranId: z.string().min(1, "Periode ajaran wajib dipilih"),
  deadline: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Format deadline tidak valid",
  }),
  lampiranUrl: z.string().optional(),
})

export type CreateTugasValues = z.infer<typeof createTugasSchema>

export const updateTugasSchema = createTugasSchema.partial()

export type UpdateTugasValues = z.infer<typeof updateTugasSchema>

export const submitTugasSchema = z.object({
  tugasId: z.string().min(1, "ID tugas wajib diisi"),
  urlFile: z.string().min(1, "File jawaban wajib diupload"),
  namaFile: z.string().min(1, "Nama file wajib diisi"),
  ukuranFile: z.number().int().min(1, "Ukuran file tidak valid"),
})

export type SubmitTugasValues = z.infer<typeof submitTugasSchema>

export const nilaiTugasSchema = z.object({
  pengumpulanId: z.string().min(1),
  nilai: z
    .number()
    .min(0, "Nilai tidak boleh negatif")
    .max(100, "Nilai maksimal 100"),
  feedback: z.string().max(1000).optional(),
})

export type NilaiTugasValues = z.infer<typeof nilaiTugasSchema>

export const rekapTugasSchema = z.object({
  tugasId: z.string().min(1),
})

export type RekapTugasValues = z.infer<typeof rekapTugasSchema>