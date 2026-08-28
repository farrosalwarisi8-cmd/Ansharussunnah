// src/lib/validations/ujian.ts

import { z } from "zod"

// Base object (tanpa refine) supaya bisa di-extend & di-partial
const ujianBaseSchema = z.object({
  judul: z.string().min(3, "Judul ujian minimal 3 karakter").max(150),
  deskripsi: z.string().optional(),
  mataPelajaran: z.string().min(2, "Mata pelajaran wajib diisi"),
  kelasId: z.string().min(1, "Kelas wajib dipilih"),
  periodeAjaranId: z.string().min(1, "Periode ajaran wajib dipilih"),
  waktuMulai: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Format waktu mulai tidak valid",
  }),
  waktuSelesai: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Format waktu selesai tidak valid",
  }),
  durasiMenit: z.number().int().min(5, "Durasi ujian minimal 5 menit").max(360),
})

export const createUjianSchema = ujianBaseSchema.refine(
  (data) => new Date(data.waktuSelesai) > new Date(data.waktuMulai),
  {
    message: "Waktu selesai harus lebih akhir dari waktu mulai",
    path: ["waktuSelesai"],
  }
)

export type CreateUjianValues = z.infer<typeof createUjianSchema>

// updateUjianSchema di-derive dari base object (agar .partial() bisa dipakai)
export const updateUjianSchema = ujianBaseSchema.partial().extend({
  status: z.enum(["DRAFT", "PUBLISHED", "SELESAI"]).optional(),
})

export type UpdateUjianValues = z.infer<typeof updateUjianSchema>

export const opsiSoalSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(2),
  teks: z.string().min(1, "Teks opsi tidak boleh kosong"),
  benar: z.boolean().default(false),
})

export const createSoalSchema = z
  .object({
    ujianId: z.string().min(1),
    nomorSoal: z.number().int().min(1),
    pertanyaan: z.string().min(3, "Pertanyaan minimal 3 karakter"),
    tipe: z.enum(["PILIHAN_GANDA", "ESAI"]),
    bobot: z.number().int().min(1, "Bobot nilai minimal 1").default(1),
    kunciEsai: z.string().optional(),
    opsi: z.array(opsiSoalSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.tipe === "PILIHAN_GANDA") {
        if (!data.opsi || data.opsi.length < 2) return false
        const kunciCount = data.opsi.filter((o) => o.benar).length
        return kunciCount === 1
      }
      return true
    },
    {
      message: "Soal pilihan ganda harus memiliki minimal 2 opsi dan tepat 1 opsi benar",
      path: ["opsi"],
    }
  )

export type CreateSoalValues = z.infer<typeof createSoalSchema>

export const submitJawabanItemSchema = z.object({
  soalId: z.string().min(1),
  opsiDipilihId: z.string().optional(),
  jawabanEsai: z.string().optional(),
})

export const submitPengerjaanUjianSchema = z.object({
  ujianId: z.string().min(1),
  jawaban: z.array(submitJawabanItemSchema),
})

export type SubmitPengerjaanUjianValues = z.infer<typeof submitPengerjaanUjianSchema>

export const nilaiEsaiItemSchema = z.object({
  soalId: z.string().min(1),
  nilaiSoal: z.number().min(0, "Nilai tidak boleh negatif"),
  catatanGuru: z.string().optional(),
})

export const nilaiEsaiSchema = z.object({
  pengerjaanId: z.string().min(1),
  penilaian: z.array(nilaiEsaiItemSchema),
})

export type NilaiEsaiValues = z.infer<typeof nilaiEsaiSchema>