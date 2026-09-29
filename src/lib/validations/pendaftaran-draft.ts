// src/lib/validations/pendaftaran-draft.ts
//
// Schema draft pendaftaran: field WAJIB boleh masih kosong (draft = data
// parsial), TAPI field yang sudah diisi tetap divalidasi format, panjang,
// dan enum-nya. Jadi draft tidak bisa dipakai menyimpan data sampah/berbahaya,
// sementara pengguna tetap bebas mengisi setengah jalan.
//
// PENTING: ini BUKAN pendaftaranSchema.partial() buta. superRefine kondisional
// (NIK wajib bila ayah masih hidup & WNI, KITAS wajib bila WNA, nama wali
// wajib bila status LAINNYA) tidak boleh aktif di draft — di sana field
// statusnya sendiri boleh belum diisi. Validasi kondisional final tetap
// dijalankan penuh saat finalisasi lewat pendaftaranSchema.
//
// Batas ukuran: payload draft yang sudah ter-serialisasi juga dibatasi di
// server action (DRAFT_MAX_PAYLOAD_BYTES) supaya tabel tidak bisa dijadikan
// tempat menumpuk data sembarangan.

import { z } from "zod"

// Field yang SAMA persis dengan pendaftaranSchema (format + panjang).
const draftFieldSchema = z.object({
  namaLengkap: z
    .string()
    .max(100, "Nama lengkap maksimal 100 karakter")
    .optional()
    .or(z.literal("")),
  tempatLahir: z
    .string()
    .max(100, "Tempat lahir maksimal 100 karakter")
    .optional()
    .or(z.literal("")),
  tanggalLahir: z
    .string()
    .refine((val) => val === "" || !isNaN(Date.parse(val)), "Tanggal lahir tidak valid")
    .optional()
    .or(z.literal("")),
  jenisKelamin: z.enum(["LAKI_LAKI", "PEREMPUAN"]).optional().or(z.literal("")),
  agama: z
    .string()
    .max(30)
    .optional()
    .refine(
      (val) =>
        !val ||
        ["Islam", "Kristen Protestan", "Katolik", "Hindu", "Buddha", "Konghucu"].includes(val),
      "Pilih agama yang valid"
    )
    .or(z.literal("")),
  alamatSiswa: z
    .string()
    .max(500, "Alamat maksimal 500 karakter")
    .optional()
    .or(z.literal("")),
  nisn: z
    .string()
    .max(10)
    .optional()
    .refine((val) => !val || /^\d{10}$/.test(val), "NISN harus 10 digit angka")
    .or(z.literal("")),
  noHpSiswa: z
    .string()
    .max(15)
    .optional()
    .refine(
      (val) => !val || (/^\d{10,15}$/.test(val) && /^[0-9+]+$/.test(val)),
      "No HP siswa harus 10-15 digit angka"
    )
    .or(z.literal("")),

  namaOrangTua: z
    .string()
    .max(100, "Nama orang tua maksimal 100 karakter")
    .optional()
    .or(z.literal("")),
  noHpOrangTua: z
    .string()
    .max(15, "No HP maksimal 15 digit")
    .optional()
    .refine(
      (val) => !val || (/^\d{10,15}$/.test(val) && /^[0-9+]+$/.test(val)),
      "No HP hanya boleh berisi 10-15 digit angka"
    )
    .or(z.literal("")),
  emailOrangTua: z
    .string()
    .max(200)
    .optional()
    .refine((val) => !val || z.string().email().safeParse(val).success, "Format email tidak valid")
    .or(z.literal("")),
  alamatOrangTua: z.string().max(500).optional().or(z.literal("")),

  namaAyahKandung: z.string().max(100).optional().or(z.literal("")),
  statusAyahKandung: z
    .enum(["MASIH_HIDUP", "SUDAH_MENINGGAL", "TIDAK_DIKETAHUI"])
    .optional()
    .or(z.literal("")),
  nikAyah: z
    .string()
    .max(16)
    .optional()
    .refine((val) => !val || /^\d{16}$/.test(val), "NIK Ayah harus 16 digit angka")
    .or(z.literal("")),

  namaIbuKandung: z.string().max(100).optional().or(z.literal("")),
  statusIbuKandung: z
    .enum(["MASIH_HIDUP", "SUDAH_MENINGGAL", "TIDAK_DIKETAHUI"])
    .optional()
    .or(z.literal("")),
  nikIbu: z
    .string()
    .max(16)
    .optional()
    .refine((val) => !val || /^\d{16}$/.test(val), "NIK Ibu harus 16 digit angka")
    .or(z.literal("")),

  statusWali: z
    .enum(["SAMA_DENGAN_AYAH", "SAMA_DENGAN_IBU", "LAINNYA"])
    .optional()
    .or(z.literal("")),
  namaWali: z.string().max(100).optional().or(z.literal("")),

  kewarganegaraan: z.enum(["WNI", "WNA"]).optional().or(z.literal("")),
  kitas: z.string().max(50).optional().or(z.literal("")),
  asalNegara: z
    .string()
    .max(100)
    .optional()
    .refine(
      (val) => !val || /^[a-zA-Z\s-]+$/.test(val),
      "Asal negara hanya boleh berisi huruf, spasi, dan tanda hubung"
    )
    .or(z.literal("")),

  jenjangTujuanId: z.string().max(64).optional().or(z.literal("")),
  kelasTujuanId: z.string().max(64).optional().or(z.literal("")),
})

// TIDAK ada superRefine kondisional di sini — draft sengaja toleran parsial.
export const pendaftaranDraftSchema = draftFieldSchema

export type PendaftaranDraftValues = z.infer<typeof pendaftaranDraftSchema>

// Kunci yang diizinkan di payload draft. Server action memfilter payload ke
// kunci ini saja sebelum validasi supaya field asing/injeksi dibuang.
export const DRAFT_FIELDS = Object.keys(pendaftaranDraftSchema.shape) as Array<
  keyof typeof pendaftaranDraftSchema.shape
>

// Step maksimum = jumlah langkah form (5). Nilai di luar 1..5 dipaksa ke rentang.
export const DRAFT_STEP_MIN = 1
export const DRAFT_STEP_MAX = 5

// Batas ukuran payload JSON draft. Isi form teks biasanya < 10 KB; batas ini
// longgar untuk data rapi tapi menolak payload bermuatan besar (256 KB).
export const DRAFT_MAX_PAYLOAD_BYTES = 256 * 1024
