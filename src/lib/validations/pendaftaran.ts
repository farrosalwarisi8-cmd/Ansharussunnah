// src/lib/validations/pendaftaran.ts

import { z } from "zod"

export const pendaftaranSchema = z
  .object({
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
    agama: z
      .string()
      .optional()
      .refine(
        (val) =>
          !val ||
          ["Islam", "Kristen Protestan", "Katolik", "Hindu", "Buddha", "Konghucu"].includes(val),
        "Pilih agama yang valid"
      ),
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
    noHpSiswa: z
      .string()
      .optional()
      .refine(
        (val) => !val || (/^\d{10,15}$/.test(val) && /^[0-9+]+$/.test(val)),
        "No HP siswa harus 10-15 digit angka"
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

    // Data Ayah Kandung
    namaAyahKandung: z.string().optional(),
    statusAyahKandung: z
      .enum(["MASIH_HIDUP", "SUDAH_MENINGGAL", "TIDAK_DIKETAHUI"])
      .optional(),
    nikAyah: z.string().optional(),

    // Data Ibu Kandung
    namaIbuKandung: z.string().optional(),
    statusIbuKandung: z
      .enum(["MASIH_HIDUP", "SUDAH_MENINGGAL", "TIDAK_DIKETAHUI"])
      .optional(),
    nikIbu: z.string().optional(),

    // Data Wali
    statusWali: z
      .enum(["SAMA_DENGAN_AYAH", "SAMA_DENGAN_IBU", "LAINNYA"])
      .optional(),
    namaWali: z.string().optional(),

    // Kewarganegaraan
    kewarganegaraan: z.enum(["WNI", "WNA"]).optional(),
    kitas: z.string().optional(),
    asalNegara: z.string().optional(),

    // Tujuan
    jenjangTujuanId: z
      .string()
      .min(1, "Pilih jenjang tujuan"),
    kelasTujuanId: z
      .string()
      .optional(),
  })
  .superRefine((data, ctx) => {
    const kewarganegaraan = data.kewarganegaraan || "WNI"

    // Validasi NIK Ayah: wajib diisi 16 digit jika status = MASIH_HIDUP dan WNI
    if (data.statusAyahKandung === "MASIH_HIDUP" && kewarganegaraan === "WNI") {
      if (!data.nikAyah) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "NIK Ayah wajib diisi jika ayah masih hidup dan WNI",
          path: ["nikAyah"],
        })
      } else if (!/^\d{16}$/.test(data.nikAyah)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "NIK Ayah harus 16 digit angka",
          path: ["nikAyah"],
        })
      }
    }

    // Validasi NIK Ibu: wajib diisi 16 digit jika status = MASIH_HIDUP dan WNI
    if (data.statusIbuKandung === "MASIH_HIDUP" && kewarganegaraan === "WNI") {
      if (!data.nikIbu) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "NIK Ibu wajib diisi jika ibu masih hidup dan WNI",
          path: ["nikIbu"],
        })
      } else if (!/^\d{16}$/.test(data.nikIbu)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "NIK Ibu harus 16 digit angka",
          path: ["nikIbu"],
        })
      }
    }

    // Validasi Wali: nama wali wajib diisi jika status = LAINNYA
    if (data.statusWali === "LAINNYA") {
      if (!data.namaWali || data.namaWali.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Nama wali wajib diisi minimal 3 karakter jika status wali = Lainnya",
          path: ["namaWali"],
        })
      }
    }

    // Validasi WNA: kitas wajib diisi
    if (kewarganegaraan === "WNA") {
      if (!data.kitas || data.kitas.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "KITAS wajib diisi jika kewarganegaraan WNA",
          path: ["kitas"],
        })
      }

      // asalNegara wajib diisi, hanya huruf, spasi, dan tanda hubung
      if (!data.asalNegara || data.asalNegara.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Asal negara wajib diisi jika kewarganegaraan WNA",
          path: ["asalNegara"],
        })
      } else if (!/^[a-zA-Z\s-]+$/.test(data.asalNegara)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Asal negara hanya boleh berisi huruf, spasi, dan tanda hubung",
          path: ["asalNegara"],
        })
      }
    }
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