// src/lib/status-berkas.ts
//
// SATU sumber kebenaran untuk status kelengkapan berkas pendaftaran.
//
// Dipakai bersama oleh: API cek-pendaftaran, halaman cek-pendaftaran, halaman
// upload dokumen, panel verifikasi admin, dan dashboard wali. Sebelum helper
// ini ada, tiap titik menghitung statusnya sendiri dari field mentah —
// cara hitungnya bisa melenceng satu sama lain dan status yang ditampilkan
// berbeda antar halaman. Semua sekarang membaca DARI SINI.
//
// Sumber datanya field Pendaftaran sebelum approval:
//   dokKartuKeluarga / dokAkteLahir / dokFoto / dokLainnya
// dan field Siswa setelah approval (bentuknya sama).
//
// Helper menangani: null, string kosong, dan array kosong → dianggap TIDAK ada.
// Helper TIDAK PERNAH mengembalikan path file — hanya boolean/angka — karena
// hasilnya dipakai juga di endpoint publik.

export type StatusBerkas = {
  kartuKeluarga: boolean
  akteLahir: boolean
  foto: boolean
  // Jumlah dokumen tambahan (bukan path-nya).
  lainnya: number
  // 0–3: berapa berkas utama (KK/akta/foto) yang sudah tersedia.
  jumlahLengkap: number
}

/** String dianggap "ada" bila non-null, bukan string kosong, dan bukan whitespace. */
function adaPath(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0
}

/**
 * Hitung status berkas dari field mentah (null-safe).
 * Aman dipanggil dengan record Pendaftaran/Siswa parsial maupun null.
 */
export function hitungStatusBerkas(dokumen: {
  dokKartuKeluarga?: string | null
  dokAkteLahir?: string | null
  dokFoto?: string | null
  dokLainnya?: string[] | null
} | null | undefined): StatusBerkas {
  const kartuKeluarga = adaPath(dokumen?.dokKartuKeluarga)
  const akteLahir = adaPath(dokumen?.dokAkteLahir)
  const foto = adaPath(dokumen?.dokFoto)
  const lainnya = Array.isArray(dokumen?.dokLainnya)
    ? dokumen.dokLainnya.filter((p) => adaPath(p)).length
    : 0

  return {
    kartuKeluarga,
    akteLahir,
    foto,
    lainnya,
    jumlahLengkap: [kartuKeluarga, akteLahir, foto].filter(Boolean).length,
  }
}

/** Label tampilan berkas utama — dipakai UI supaya penamaan konsisten antar halaman. */
export const LABEL_BERKAS_UTAMA = {
  kartuKeluarga: "Kartu Keluarga (KK)",
  akteLahir: "Akta Kelahiran",
  foto: "Pas Foto 3x4",
} as const
