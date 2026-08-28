// src/lib/validations/akuntansi.ts

import { z } from "zod"

export const generateBulkSppSchema = z.object({
  bulan: z.number().int().min(1, "Bulan minimal 1 (Januari)").max(12, "Bulan maksimal 12 (Desember)"),
  tahun: z.number().int().min(2024, "Tahun minimal 2024").max(2100),
  kelasId: z.string().optional(), // Opsional: jika diisi, hanya untuk 1 kelas. Jika kosong, untuk semua siswa aktif.
})

export type GenerateBulkSppValues = z.infer<typeof generateBulkSppSchema>

export const submitBuktiSppSchema = z.object({
  tagihanId: z.string().min(1, "Tagihan wajib dipilih"),
  nominalDibayar: z.number().positive("Nominal pembayaran harus lebih dari 0"),
  metodeBayar: z.string().min(2, "Metode pembayaran wajib diisi"),
  urlBukti: z.string().min(1, "Bukti transfer wajib diupload"),
  namaBukti: z.string().min(1, "Nama berkas bukti wajib diisi"),
  catatan: z.string().max(255).optional(),
})

export type SubmitBuktiSppValues = z.infer<typeof submitBuktiSppSchema>

export const konfirmasiPembayaranSppSchema = z.object({
  tagihanId: z.string().min(1),
  nominalDibayar: z.number().positive(),
  metodeBayar: z.string().min(2),
  urlBukti: z.string().optional(),
  namaBukti: z.string().optional(),
  catatan: z.string().optional(),
})

export type KonfirmasiPembayaranSppValues = z.infer<typeof konfirmasiPembayaranSppSchema>

export const createTransaksiKeuanganSchema = z.object({
  kategoriId: z.string().min(1, "Kategori transaksi wajib dipilih"),
  nominal: z.number().positive("Nominal transaksi harus lebih dari 0"),
  deskripsi: z.string().min(5, "Deskripsi minimal 5 karakter").max(500),
  tanggal: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Format tanggal tidak valid",
  }),
  urlBukti: z.string().optional(),
  namaBukti: z.string().optional(),
})

export type CreateTransaksiKeuanganValues = z.infer<typeof createTransaksiKeuanganSchema>

export const cancelTransaksiSchema = z.object({
  transaksiId: z.string().min(1),
  alasanPembatalan: z.string().min(5, "Alasan pembatalan minimal 5 karakter").max(255),
})

export type CancelTransaksiValues = z.infer<typeof cancelTransaksiSchema>

export const cancelTagihanSchema = z.object({
  tagihanId: z.string().min(1),
  alasanPembatalan: z.string().min(5, "Alasan pembatalan minimal 5 karakter").max(255),
})

export type CancelTagihanValues = z.infer<typeof cancelTagihanSchema>

export const queryLaporanKeuanganSchema = z.object({
  tanggalMulai: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Tanggal mulai tidak valid",
  }),
  tanggalSelesai: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Tanggal selesai tidak valid",
  }),
})

export type QueryLaporanKeuanganValues = z.infer<typeof queryLaporanKeuanganSchema>