// src/lib/registration-number.ts

import prisma from "@/lib/prisma"

/**
 * Generate nomor pendaftaran unik
 * Format: REG-{TAHUN}-{5 digit sequential}
 * Contoh: REG-2024-00001
 */
export async function generateNomorPendaftaran(): Promise<string> {
  const tahun = new Date().getFullYear()
  const prefix = `REG-${tahun}-`

  // Cari nomor pendaftaran terakhir untuk tahun ini
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

  if (lastPendaftaran) {
    const lastNumberStr = lastPendaftaran.nomorPendaftaran.replace(prefix, "")
    nextNumber = parseInt(lastNumberStr, 10) + 1
  }

  const nomorPendaftaran = `${prefix}${nextNumber.toString().padStart(5, "0")}`

  return nomorPendaftaran
}