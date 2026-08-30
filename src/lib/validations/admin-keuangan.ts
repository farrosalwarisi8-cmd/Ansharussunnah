// src/lib/validations/admin-keuangan.ts

import { z } from "zod"

// ============================================
// CRUD AKUN ADMIN KEUANGAN
// ============================================

export const createAkunAdminKeuanganSchema = z.object({
  nama: z.string().min(2, "Nama admin keuangan minimal 2 karakter").max(100),
  email: z.string().email("Format email tidak valid"),
  noHp: z.string().max(20, "Nomor HP maksimal 20 karakter").optional(),
})

export type CreateAkunAdminKeuanganValues = z.infer<typeof createAkunAdminKeuanganSchema>

export const updateAkunAdminKeuanganSchema = z.object({
  nama: z.string().min(2, "Nama admin keuangan minimal 2 karakter").max(100).optional(),
  noHp: z.string().max(20, "Nomor HP maksimal 20 karakter").optional().nullable(),
})

export type UpdateAkunAdminKeuanganValues = z.infer<typeof updateAkunAdminKeuanganSchema>
