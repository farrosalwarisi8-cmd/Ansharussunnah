// src/lib/kelas-peran.ts

export type PeranKelas =
  | "ADMIN"
  | "WALI_KELAS"
  | "PENGAJAR"
  | "WALI_KELAS_PENGAJAR"

/** Label human-readable peran guru di sebuah kelas. */
export function labelPeranKelas(peran?: PeranKelas | null): string {
  switch (peran) {
    case "WALI_KELAS":
      return "Wali Kelas"
    case "PENGAJAR":
      return "Guru Mapel"
    case "WALI_KELAS_PENGAJAR":
      return "Wali Kelas & Guru Mapel"
    case "ADMIN":
      return "Admin"
    default:
      return ""
  }
}

/**
 * Sufiks teks untuk opsi <option> pada <select> native (tidak bisa render badge HTML).
 * ADMIN diabaikan agar tidak berisik saat admin melihat semua kelas.
 */
export function peranOptionSuffix(peran?: PeranKelas | null): string {
  if (!peran || peran === "ADMIN") return ""
  return ` • ${labelPeranKelas(peran)}`
}