// src/lib/validations/external-url.ts
//
// Kebijakan URL eksternal (Pilihan B — allowlist eksplisit).
//
// Bukti pembayaran dari klien hanya boleh berupa:
//   (a) path storage internal `spp/{tagihanId}/...` (diverifikasi
//       keberadaannya di bucket oleh server action), atau
//   (b) URL https ke domain Google Drive yang diizinkan.
//
// Domain arbitrary dari klien DITOLAK. Protokol non-https, kredensial
// tersembunyi (user:pass@host), dan scheme berbahaya (javascript:,
// data:, vbscript:, dll) semuanya DITOLAK. URL yang lolos dikembalikan
// dalam bentuk ternormalisasi (tanpa fragment/userinfo) sebelum
// disimpan ke database.

/** Domain yang diizinkan menerima URL eksternal bukti pembayaran. */
export const EXTERNAL_URL_ALLOWED_HOSTS: readonly string[] = [
  "drive.google.com",
  "docs.google.com",
] as const

export type ExternalUrlResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: string }

/**
 * Validasi URL eksternal terhadap allowlist.
 *
 * Aturan:
 *  - URL harus bisa di-parse
 *  - protocol hanya `https:`
 *  - hostname persis sama atau subdomain dari allowlist
 *  - tidak boleh memuat username/password
 *  - tidak boleh memuat path traversal (`..`)
 *  - mengembalikan URL ternormalisasi (protocol//host/path?query,
 *    tanpa fragment maupun userinfo)
 */
export function validasiUrlEksternal(raw: string): ExternalUrlResult {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { ok: false, reason: "Tautan bukti tidak valid" }
  }

  // Hanya https. Ini otomatis menolak javascript:, data:, vbscript:,
  // file:, ftp:, dan scheme lain yang tidak diawali https.
  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      reason: "Tautan bukti harus menggunakan https://",
    }
  }

  // Hostname harus persis atau subdomain dari allowlist.
  const host = parsed.hostname.toLowerCase()
  const diizinkan = EXTERNAL_URL_ALLOWED_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  )
  if (!diizinkan) {
    return {
      ok: false,
      reason:
        "Domain tautan tidak diizinkan. Gunakan Google Drive " +
        "(drive.google.com / docs.google.com) atau unggah berkas ke storage.",
    }
  }

  // Jangan izinkan kredensial tersembunyi di URL (user:pass@host).
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "Tautan bukti tidak boleh memuat kredensial" }
  }

  // Defense-in-depth: tolak path traversal pada URL eksternal.
  // URL parser menormalisasi ".." otomatis (mis. /a/../b → /b),
  // jadi periksa string mentah sebelum parsing untuk mendeteksi
  // upaya traversal.
  const pathTanpaQuery = raw.split("?")[0].split("#")[0]
  if (pathTanpaQuery.includes("..")) {
    return { ok: false, reason: "Tautan bukti tidak valid" }
  }

  // Normalisasi: buang fragment (#) dan userinfo; simpan hanya
  // protocol + host + pathname + search.
  const normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`
  return { ok: true, normalized }
}

/**
 * Apakah sebuah string adalah URL eksternal (bukan path storage
 * internal)? Dipakai untuk memilih jalur validasi yang benar.
 */
export function isExternalUrlLike(value: string): boolean {
  return /^https?:\/\//i.test(value)
}
