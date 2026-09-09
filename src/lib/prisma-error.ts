// src/lib/prisma-error.ts
// Helper bersama untuk menerjemahkan error Prisma (atau error umum) menjadi
// pesan Bahasa Indonesia yang aman ditampilkan ke pengguna. Detail teknis
// (stack trace dll.) tetap di-log ke server, yang dikirim ke frontend hanya
// pesan yang sudah diterjemahkan.

import { Prisma } from "@prisma/client"

// Error khusus untuk pesan yang MEMANG layak ditampilkan ke pengguna
// (misal: hasil validasi bisnis seperti "NISN sudah terdaftar", "Kelas penuh").
// Error ini lolos apa adanya lewat toUserFriendlyError.
export class AppError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AppError"
  }
}

// Peta field DB → label Bahasa Indonesia yang ramah
const FIELD_LABEL: Record<string, string> = {
  email: "Email",
  username: "Username",
  nisn: "NISN",
  nis: "NIS",
  nip: "NIP",
  nomor_pendaftaran: "Nomor Pendaftaran",
  nama: "Nama",
  user_id: "Akun Pengguna",
  no_hp: "Nomor HP",
  pendaftaran_id: "Status Pendaftaran",
}

// Tentukan pesan ramah untuk P2002 (unique constraint violation)
function pesanP2002(meta: Prisma.PrismaClientKnownRequestError["meta"]): string {
  const rawTarget = meta?.target as string[] | string | undefined
  const targets = Array.isArray(rawTarget) ? rawTarget : rawTarget ? [rawTarget] : []

  const labels = targets
    .map((t) => FIELD_LABEL[t.toLowerCase()] || t)
    .filter(Boolean)

  if (labels.length === 0) {
    return "Data yang sama sudah terdaftar dalam sistem."
  }

  if (labels.length === 1) {
    return `${labels[0]} sudah terdaftar. Mohon gunakan ${labels[0].toLowerCase()} yang berbeda.`
  }

  return `${labels.join(" dan ")} sudah terdaftar. Mohon gunakan kombinasi yang berbeda.`
}

// Padanan dari code Prisma → pesan generik ber-Bahasa Indonesia
type PenerjemahKode = (meta?: Prisma.PrismaClientKnownRequestError["meta"]) => string
const CODE_PESAN: Record<string, PenerjemahKode> = {
  P2000: () => "Nilai yang dikirim tidak sesuai dengan tipe data yang diharapkan.",
  P2001: () => "Data yang diminta tidak ditemukan.",
  P2002: (meta) => pesanP2002(meta),
  P2003: (meta) => {
    const fkField = (meta as { target?: string } | undefined)?.target
    return fkField
      ? `Data terkait (${FIELD_LABEL[fkField.toLowerCase()] || fkField}) tidak ditemukan atau tidak valid.`
      : "Data terkait tidak ditemukan atau tidak valid."
  },
  P2004: () => "Data gagal tervalidasi terhadap constraint di database.",
  P2011: () => "Masih ada data wajib yang belum terisi.",
  P2012: () => "Masih ada data wajib yang belum terisi.",
  P2014: () => "Data memiliki relasi yang bentrok dengan data lain.",
  P2023: () => "ID yang dikirim tidak valid.",
  P2024: () =>
    "Layanan database sedang digunakan banyak pengguna. Silakan coba lagi beberapa saat.",
  P2025: () => "Record terkait tidak ditemukan sehingga operasi tidak dapat diselesaikan.",
  P2028: () => "Transaksi tidak dapat diselesaikan karena ada permintaan lain yang berjalan.",
  P2034: () =>
    "Terjadi konflik saat menulis data bersamaan dari beberapa pengguna. Silakan coba lagi.",
}

// Penerjemah utama: menerima error apa pun dan mengembalikan pesan aman untuk UI.
// - AppError → pesan bisnis yang memang layak ditampilkan
// - Prisma KnownRequestError (P2002 dsb.) → diterjemahkan ke Bahasa Indonesia
// - Error Prisma lain (validation/init/rust panic/unknown) → pesan generik
// - Error biasa yang TIDAK dikenali → fallbackPesan (jangan expose detail teknis)
export function toUserFriendlyError(
  error: unknown,
  fallbackPesan = "Terjadi kesalahan. Silakan coba lagi atau hubungi admin."
): string {
  if (error instanceof AppError) {
    return error.message
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const pesan = CODE_PESAN[error.code]
    if (pesan) {
      try {
        return pesan(error.meta)
      } catch {
        return fallbackPesan
      }
    }
    // Error Prisma dengan kode yang belum dipetakan: jangan expose detail teknis
    return fallbackPesan
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return "Ada data yang tidak valid atau tidak lengkap. Periksa kembali isian Anda."
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "Gagal terhubung ke database. Silakan coba lagi atau hubungi admin."
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return "Terjadi gangguan tidak terduga pada pengolahan data. Silakan coba lagi atau hubungi admin."
  }

  // PrismaClientUnknownRequestError & error Prisma lainnya
  if (
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    (typeof error === "object" && error !== null && "clientVersion" in error)
  ) {
    return "Terjadi kesalahan pada server database. Silakan coba lagi atau hubungi admin."
  }

  // Error biasa yang tidak dikenali → pesan generik (bukan detail teknis)
  return fallbackPesan
}