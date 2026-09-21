// src/lib/validations/tugas.ts

import { z } from "zod"

export const createTugasSchema = z.object({
  judul: z.string().min(3, "Judul tugas minimal 3 karakter").max(200),
  deskripsi: z.string().min(10, "Deskripsi minimal 10 karakter"),
  mataPelajaran: z.string().min(2, "Mata pelajaran wajib diisi"),
  kelasId: z.string().min(1, "Kelas wajib dipilih"),
  targetGender: z.enum(["LAKI_LAKI", "PEREMPUAN"]).optional().nullable(),
  periodeAjaranId: z.string().min(1, "Periode ajaran wajib dipilih"),
  deadline: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Format deadline tidak valid",
    })
    .optional(),
  lampiranUrl: z.string().optional(),
  // Tugas offline: dikerjakan di luar aplikasi, nilai diinput manual guru.
  inputManual: z.boolean().optional(),
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

// Input nilai manual untuk tugas offline: guru mengetik nilai langsung untuk
// tiap siswa yang mengerjakan di luar aplikasi. Rekaman PengumpulanTugas
// dibuat berstatus DINILAI sehingga ter-agregasi di rapor seperti biasa.
export const inputNilaiTugasManualSchema = z.object({
  tugasId: z.string().min(1, "ID tugas wajib diisi"),
  penilaian: z
    .array(
      z.object({
        siswaId: z.string().min(1, "ID siswa wajib diisi"),
        nilai: z
          .number()
          .min(0, "Nilai tidak boleh negatif")
          .max(100, "Nilai maksimal 100"),
        feedback: z.string().max(1000).optional(),
      })
    )
    .min(1, "Minimal 1 siswa yang dinilai")
    .max(200, "Terlalu banyak siswa dalam satu input nilai"),
})

export type InputNilaiTugasManualValues = z.infer<typeof inputNilaiTugasManualSchema>

export const rekapTugasSchema = z.object({
  tugasId: z.string().min(1),
})

export type RekapTugasValues = z.infer<typeof rekapTugasSchema>