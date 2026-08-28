// src/lib/validations/pendaftaran.ts

import { z } from "zod"

export const pendaftaranSchema = z.object({
  // Data Calon Siswa
  namaLengkap: z
    .string()
    .min(3, "Nama lengkap minimal 3 karakter")
    .max(100, "Nama lengkap maksimal 100 karakter"),
  tempatLahir: z
    .string()
    .min(2, "Tempat lahir minimal 2 karakter"),
  tanggalLahir: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), "Tanggal lahir tidak valid"),
  jenisKelamin: z.enum(["LAKI_LAKI", "PEREMPUAN"], {
    errorMap: () => ({ message: "Pilih jenis kelamin" }),
  }),
  alamatSiswa: z
    .string()
    .min(10, "Alamat minimal 10 karakter"),
  nisn: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^\d{10}$/.test(val),
      "NISN harus 10 digit angka"
    ),

  // Data Orang Tua
  namaOrangTua: z
    .string()
    .min(3, "Nama orang tua minimal 3 karakter"),
  noHpOrangTua: z
    .string()
    .min(10, "No HP minimal 10 digit")
    .max(15, "No HP maksimal 15 digit")
    .regex(/^[0-9+]+$/, "No HP hanya boleh berisi angka"),
  emailOrangTua: z
    .string()
    .email("Format email tidak valid"),
  alamatOrangTua: z
    .string()
    .optional(),

  // Tujuan
  jenjangTujuanId: z
    .string()
    .min(1, "Pilih jenjang tujuan"),
  kelasTujuanId: z
    .string()
    .optional(),
})

export type PendaftaranFormValues = z.infer<typeof pendaftaranSchema>

export const uploadBuktiTransferSchema = z.object({
  nomorPendaftaran: z.string().min(1, "Nomor pendaftaran wajib diisi"),
})

export const verifikasiPendaftaranSchema = z.object({
  pendaftaranId: z.string().min(1),
  status: z.enum(["DITERIMA", "DITOLAK"]),
  catatanAdmin: z.string().optional(),
  alasanPenolakan: z.string().optional(),
})

export type VerifikasiPendaftaranValues = z.infer<typeof verifikasiPendaftaranSchema>