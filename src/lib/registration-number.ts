// src/lib/registration-number.ts

import prisma from "@/lib/prisma"
import { randomInt } from "crypto"

// Alfabet tanpa karakter ambigu (tidak ada 0/O, 1/I/L)
const SUFFIX_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function randomSuffix(length: number): string {
  let suffix = ""
  for (let i = 0; i < length; i++) {
    suffix += SUFFIX_ALPHABET[randomInt(0, SUFFIX_ALPHABET.length)]
  }
  return suffix
}

/**
 * Generate nomor pendaftaran unik & sulit ditebak.
 * Format: REG-{TAHUN}-{5 digit sequential}-{4 karakter acak}
 * Contoh: REG-2026-00042-T7K2
 *
 * `-{4 karakter acak}` membuat nomor tidak bisa ditebak/di-enumerasi oleh
 * penyerang sehingga nomor pendaftaran berfungsi sebagai kredensial untuk
 * alur publik (cek status & upload bukti transfer).
 */
export async function generateNomorPendaftaran(): Promise<string> {
  const tahun = new Date().getFullYear()
  const prefix = `REG-${tahun}-`

  // Cari nomor pendaftaran terakhir untuk tahun ini saja
  const lastPendaftaran = await prisma.pendaftaran.findFirst({
    where: {
      nomorPendaftaran: {
        startsWith: prefix,
      },
    },
    orderBy: {
      nomorPendaftaran: "desc",
    },
    select: {
      nomorPendaftaran: true,
    },
  })

  let nextNumber = 1

  if (lastPendaftaran?.nomorPendaftaran) {
    // Pastikan benar-benar diawali prefix tahun berjalan
    if (lastPendaftaran.nomorPendaftaran.startsWith(prefix)) {
      const lastNumberStr = lastPendaftaran.nomorPendaftaran.slice(prefix.length)
      const parsed = parseInt(lastNumberStr, 10)

      // Jika parse gagal (NaN) atau bukan angka valid, mulai dari 1
      if (!Number.isNaN(parsed) && parsed >= 0) {
        nextNumber = parsed + 1
      }
    }
    // Jika prefix tidak cocok (misal data tahun lama), biarkan nextNumber = 1
  }

  const nomorPendaftaran = `${prefix}${nextNumber
    .toString()
    .padStart(5, "0")}-${randomSuffix(4)}`

  return nomorPendaftaran
}