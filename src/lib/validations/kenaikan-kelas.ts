// src/lib/validations/kenaikan-kelas.ts

import { z } from "zod"

export const siswaPromosiItemSchema = z.object({
  siswaId: z.string().min(1, "ID siswa wajib diisi"),
  kelasBaruId: z.string().min(1, "Kelas tujuan wajib dipilih"),
})

export const promosiSiswaMassalSchema = z.object({
  periodeAjaranId: z.string().min(1, "Periode ajaran wajib dipilih"),
  mapping: z
    .array(siswaPromosiItemSchema)
    .min(1, "Minimal ada 1 siswa yang akan dipromosikan")
    .max(200, "Maksimal 200 siswa per sekali promosi"),
})

export type PromosiSiswaMassalValues = z.infer<typeof promosiSiswaMassalSchema>
