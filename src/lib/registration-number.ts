// src/lib/registration-number.ts

import prisma from "@/lib/prisma"

/**
 * Generate nomor pendaftaran unik
 * Format: REG-{TAHUN}-{5 digit sequential}
 * Contoh: REG-2026-00001
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

  const nomorPendaftaran = `${prefix}${nextNumber.toString().padStart(5, "0")}`

  return nomorPendaftaran
}