// src/lib/guru-kelas-gender.ts
// Aturan pencocokan jenis kelamin antara guru dengan kelas.
// Dipakai konsisten oleh:
//  - Penugasan otomatis guru baru (auto-assign) di actions/guru.ts
//  - Validasi assignGuruKeKelas & pemilihan wali kelas di actions/guru-kelas.ts
//  - Filter opsi wali kelas / pengajar di komponen dashboard

import type { JenisKelamin } from "@prisma/client"

/**
 * Apakah seorang guru "cocok" mengajar/walikelas di sebuah kelas berdasarkan
 * jenis kelamin.
 *
 * Aturan:
 * - Kelas Campuran (jenisKelamin null) menerima guru dengan gender apa pun.
 * - Guru yang belum diisi gender (null) dianggap fleksibel → cocok untuk semua kelas
 *   (kompatibilitas dengan data lama).
 * - Kelas khusus Ikhwan (LAKI_LAKI) hanya cocok untuk guru LAKI_LAKI.
 * - Kelas khusus Akhwat (PEREMPUAN) hanya cocok untuk guru PEREMPUAN.
 */
export function guruCocokKelas(
  guruJenisKelamin: JenisKelamin | null | undefined,
  kelasJenisKelamin: JenisKelamin | null | undefined
): boolean {
  if (!kelasJenisKelamin) return true
  if (!guruJenisKelamin) return true
  return guruJenisKelamin === kelasJenisKelamin
}

/**
 * Apakah seorang siswa "cocok" masuk ke sebuah kelas berdasarkan jenis kelamin.
 *
 * Aturan:
 * - Kelas Campuran (jenisKelamin null) menerima siswa dengan gender apa pun.
 * - Kelas khusus Ikhwan (LAKI_LAKI) hanya untuk siswa LAKI_LAKI.
 * - Kelas khusus Akhwat (PEREMPUAN) hanya untuk siswa PEREMPUAN.
 *
 * Dipakai di pendaftaran, verifikasi, pembuatan siswa manual, dan kenaikan kelas agar
 * gender menjadi pembeda yang konsisten di seluruh alur penempatan siswa.
 */
export function siswaCocokKelas(
  siswaJenisKelamin: JenisKelamin | null | undefined,
  kelasJenisKelamin: JenisKelamin | null | undefined
): boolean {
  if (!kelasJenisKelamin) return true
  if (!siswaJenisKelamin) return true
  return siswaJenisKelamin === kelasJenisKelamin
}