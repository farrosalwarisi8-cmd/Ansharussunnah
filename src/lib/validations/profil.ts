// src/lib/validations/profil.ts

import { z } from "zod"

/**
 * Schema untuk update biodata akun mandiri (profil):
 * - username: alias login yang tersimpan di DB
 * - email: email login, disinkronkan ke Supabase Auth
 * Kolom yang dikosongkan dianggap tidak berubah.
 */
export const updateProfilSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter")
    .max(50, "Username maksimal 50 karakter")
    .regex(
      /^[a-z0-9._-]+$/,
      "Username hanya boleh berisi huruf kecil, angka, titik, strip, dan underscore"
    )
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("Format email tidak valid")
    .optional()
    .or(z.literal("")),
})

export type UpdateProfilValues = z.infer<typeof updateProfilSchema>