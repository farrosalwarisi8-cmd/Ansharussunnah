// src/lib/validations/biaya-ppdb.ts

import { z } from "zod"

/**
 * Nominal biaya dalam Rupiah. Desimal diizinkan oleh schema tapi pemakaian
 * nyata selalu bulat; dibatasi 0..100 juta agar typo (mis. 6 digit ekstra)
 * tidak langsung tersimpan sebagai harga resmi.
 */
const nominal = z
  .number({ invalid_type_error: "Nominal harus berupa angka" })
  .min(0, "Nominal tidak boleh negatif")
  .max(100_000_000, "Nominal terlalu besar (maksimal Rp 100.000.000)")

export const updateBiayaJenjangSchema = z.object({
  jenjangId: z.string().min(1, "Jenjang wajib dipilih"),
  biayaPendaftaran: nominal,
  biayaUangGedung: nominal,
  biayaSarpras: nominal,
})

export type UpdateBiayaJenjangValues = z.infer<typeof updateBiayaJenjangSchema>

export const updatePengaturanPPDBSchema = z.object({
  bankNama: z.string().trim().min(2, "Nama bank wajib diisi").max(30, "Nama bank maksimal 30 karakter"),
  bankNoRekening: z
    .string()
    .trim()
    .min(5, "Nomor rekening minimal 5 digit")
    .max(30, "Nomor rekening maksimal 30 karakter")
    .regex(/^[0-9-]+$/, "Nomor rekening hanya boleh berisi angka"),
  bankAtasNama: z.string().trim().min(3, "Atas nama wajib diisi").max(60, "Atas nama maksimal 60 karakter"),
  kontakWa: z
    .string()
    .trim()
    .regex(/^628\d{7,13}$/, "Format WA: 628xxxxxxxxxx (kode negara tanpa tanda +)"),
  namaKontakWa: z.string().trim().min(3, "Nama kontak wajib diisi").max(60, "Nama kontak maksimal 60 karakter"),
})

export type UpdatePengaturanPPDBValues = z.infer<typeof updatePengaturanPPDBSchema>
