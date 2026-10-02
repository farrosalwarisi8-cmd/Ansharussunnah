// src/lib/konfirmasi-kontak-wali.ts
//
// Konstanta & tipe bersama untuk konfirmasi kontak wali.
//
// SENGaja diletakkan di sini, BUKAN di src/actions/konfirmasi-kontak-wali.ts:
// file dengan directive "use server" hanya boleh mengekspor fungsi async.
// Mengekspor array (METODE_KONFIRMASI) dari file tersebut membuat Next.js
// melempar 'A "use server" file can only export async functions, found object'
// saat server bundle memuat modulnya — yang membuat halaman
// /dashboard/verifikasi-pendaftaran selalu masuk error boundary.
//
// File ini TANPA "use server" sehingga aman diimpor baik oleh Server Action
// maupun client component.

export const METODE_KONFIRMASI = [
  "WHATSAPP",
  "TELEPON",
  "LANGSUNG",
] as const;

export type MetodeKonfirmasi = (typeof METODE_KONFIRMASI)[number];
