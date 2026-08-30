// src/lib/guru-auth.ts

import prisma from "@/lib/prisma"
import { requireGuru } from "@/lib/auth"

/**
 * Memverifikasi apakah Guru yang sedang login berhak mengelola kelas tertentu.
 * Guru berhak jika:
 * 1. Menjabat sebagai Wali Kelas di kelas tersebut, ATAU
 * 2. Terdaftar mengajar mata pelajaran tertentu di kelas tersebut (tabel `GuruKelas`).
 */
export async function verifyGuruAksesKelas(
  kelasId: string,
  mataPelajaran?: string
) {
  const user = await requireGuru()

  if (!user.guru) {
    throw new Error("Forbidden: Profil guru tidak ditemukan")
  }

  const guruId = user.guru.id

  // Cek apakah wali kelas
  const kelas = await prisma.kelas.findFirst({
    where: {
      id: kelasId,
      waliKelasId: guruId,
    },
  })

  if (kelas) {
    return { user, guru: user.guru, roleInKelas: "WALI_KELAS" as const }
  }

  // Jika bukan wali kelas, cek apakah terdaftar mengajar di kelas ini
  const pengajar = await prisma.guruKelas.findFirst({
    where: {
      guruId,
      kelasId,
      ...(mataPelajaran ? { mataPelajaran: { nama: mataPelajaran } } : {}),
    },
  })

  if (!pengajar) {
    throw new Error(
      "Forbidden: Anda tidak memiliki wewenang mengajar/mengelola kelas ini"
    )
  }

  return { user, guru: user.guru, roleInKelas: "PENGAJAR" as const }
}