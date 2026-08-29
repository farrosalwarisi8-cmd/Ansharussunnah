// src/lib/validations/guru.ts

import { z } from "zod"

// ============================================
// CRUD AKUN GURU
// ============================================

export const createAkunGuruSchema = z.object({
  nama: z.string().min(2, "Nama guru minimal 2 karakter").max(100),
  email: z.string().email("Format email tidak valid"),
  nip: z.string().max(30, "NIP maksimal 30 karakter").optional(),
  jabatan: z.string().max(100, "Jabatan maksimal 100 karakter").optional(),
  noHp: z.string().max(20, "Nomor HP maksimal 20 karakter").optional(),
})

export type CreateAkunGuruValues = z.infer<typeof createAkunGuruSchema>

export const updateAkunGuruSchema = z.object({
  nama: z.string().min(2, "Nama guru minimal 2 karakter").max(100).optional(),
  nip: z.string().max(30, "NIP maksimal 30 karakter").optional().nullable(),
  jabatan: z.string().max(100, "Jabatan maksimal 100 karakter").optional().nullable(),
  noHp: z.string().max(20, "Nomor HP maksimal 20 karakter").optional().nullable(),
})

export type UpdateAkunGuruValues = z.infer<typeof updateAkunGuruSchema>

// ============================================
// CRUD PENUGASAN GURU KE KELAS
// ============================================

export const assignGuruKeKelasSchema = z.object({
  guruId: z.string().min(1, "Guru wajib dipilih"),
  kelasId: z.string().min(1, "Kelas wajib dipilih"),
  mataPelajaran: z.string().min(2, "Mata pelajaran wajib diisi").max(100),
})

export type AssignGuruKeKelasValues = z.infer<typeof assignGuruKeKelasSchema>
