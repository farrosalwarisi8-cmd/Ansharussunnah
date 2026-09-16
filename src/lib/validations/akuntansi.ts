// src/lib/validations/akuntansi.ts

import { z } from "zod"

export const generateBulkSppSchema = z.object({
  bulan: z.number().int().min(1, "Bulan minimal 1 (Januari)").max(12, "Bulan maksimal 12 (Desember)"),
  tahun: z.number().int().min(2024, "Tahun minimal 2024").max(2100),
  kelasId: z.string().optional(), // Opsional: jika diisi, hanya untuk 1 kelas. Jika kosong, untuk semua siswa aktif.
  jenjangId: z.string().optional(), // Opsional: jika diisi, hanya untuk 1 jenjang tertentu.
  // Opsional: tarif default yang dipakai bila siswa tidak punya sppKhusus
  // dan jenjang kelasnya belum punya tarifSppBulanan.
  nominalDefault: z.number().positive("Tarif default harus lebih dari 0").optional(),
})

export type GenerateBulkSppValues = z.infer<typeof generateBulkSppSchema>

// Generate tagihan SPP khusus (potongan/beasiswa) per siswa terpilih.
// items berisi pasangan (siswaId, nominal) agar nominal tiap siswa bisa berbeda.
export const generateSppKhususSchema = z.object({
  bulan: z.number().int().min(1, "Bulan minimal 1 (Januari)").max(12, "Bulan maksimal 12 (Desember)"),
  tahun: z.number().int().min(2024, "Tahun minimal 2024").max(2100, "Tahun maksimal 2100"),
  items: z
    .array(
      z.object({
        siswaId: z.string().min(1, "ID siswa wajib diisi"),
        nominal: z
          .number()
          .positive("Nominal tagihan harus lebih dari 0"),
      })
    )
    .min(1, "Pilih minimal 1 siswa"),
  // Jika true, nominal potongan disimpan ke kolom sppKhusus siswa sehingga
  // generate SPP massal berikutnya otomatis memakai nominal ini (berkelanjutan).
  simpanSebagaiSppKhusus: z.boolean().default(false),
  // Jika true, kirim email pemberitahuan tagihan ke email siswa & orang tua/wali.
  kirimEmail: z.boolean().default(false),
})

export type GenerateSppKhususValues = z.infer<typeof generateSppKhususSchema>

// Set tarif SPP per jenjang oleh admin keuangan (nilai 0 = hapus tarif).
export const updateTarifSppJenjangSchema = z.object({
  jenjangId: z.string().min(1, "Jenjang wajib dipilih"),
  tarifSppBulanan: z.number().min(0, "Tarif harus lebih dari atau sama dengan 0"),
})

export type UpdateTarifSppJenjangValues = z.infer<typeof updateTarifSppJenjangSchema>

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

// PENTEST FIX #1: Schema untuk action konfirmasi dua-tahap oleh admin keuangan
export const konfirmasiPembayaranAdminSchema = z
  .object({
    pembayaranId: z.string().min(1, "ID pembayaran wajib diisi"),
    disetujui: z.boolean({ required_error: "Keputusan persetujuan wajib diisi" }),
    catatan: z.string().max(500, "Catatan maksimal 500 karakter").optional(),
    alasanPenolakan: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      // Jika ditolak, alasan penolakan wajib diisi (minimal 5 karakter)
      if (!data.disetujui && (!data.alasanPenolakan || data.alasanPenolakan.trim().length < 5)) {
        return false
      }
      return true
    },
    {
      message: "Alasan penolakan wajib diisi (minimal 5 karakter) jika pembayaran ditolak",
      path: ["alasanPenolakan"],
    }
  )

export type KonfirmasiPembayaranAdminValues = z.infer<typeof konfirmasiPembayaranAdminSchema>

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

export const rekapSppFilterSchema = z.object({
  periodeAjaranId: z.string().min(1).optional(),
  bulan: z.number().int().min(1).max(12).optional(),
  tahun: z.number().int().min(2024).max(2100).optional(),
})

export type RekapSppFilterValues = z.infer<typeof rekapSppFilterSchema>