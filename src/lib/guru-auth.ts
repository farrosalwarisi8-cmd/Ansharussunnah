// src/lib/guru-auth.ts

import prisma from "@/lib/prisma"
import { requireGuru, isAcademicAdminRole } from "@/lib/auth"
import { Role } from "@prisma/client"

/**
 * Memverifikasi apakah user yang sedang login berhak mengelola kelas tertentu.
 *
 * - SUPER_ADMIN / ADMIN_AKADEMIK: punya akses penuh ke seluruh kelas (admin akademik).
 * - Role.GURU: berhak mengelola kelas bila dia wali kelas di kelas tersebut ATAU
 *   terdaftar mengajar mata pelajaran (bisa berapa pun) di kelas tersebut. Guru dapat
 *   memilih kelas mana pun dari dropdown; validasi mapel dilakukan via pengecekan
 *   GuruKelas saat mapel tertentu dipilih.
 */
export async function verifyGuruAksesKelas(
  kelasId: string,
  mataPelajaran?: string
) {
  const user = await requireGuru()

  // Admin akademik / super admin bebas mengelola semua kelas
  if (isAcademicAdminRole(user.role)) {
    if (!user.guru) {
      throw new Error("Forbidden: Profil guru tidak ditemukan")
    }

    // Bila mapel diberikan, pastikan mapelnya valid & ada di kelas tsb
    if (mataPelajaran) {
      const mapelDiKelas = await prisma.guruKelas.findFirst({
        where: { kelasId, mataPelajaran: { nama: mataPelajaran } },
      })
      if (!mapelDiKelas) {
        throw new Error(
          `Mata pelajaran "${mataPelajaran}" tidak terdaftar di kelas ini`
        )
      }
    }

    return { user, guru: user.guru, roleInKelas: "ADMIN" as const }
  }

  if (!user.guru) {
    throw new Error("Forbidden: Profil guru tidak ditemukan")
  }

  const guruId = user.guru.id

  // Untuk Role.GURU: validasi wali kelas / pengajar
  const kelas = await prisma.kelas.findFirst({
    where: {
      id: kelasId,
      waliKelasId: guruId,
    },
  })

  if (kelas) {
    return { user, guru: user.guru, roleInKelas: "WALI_KELAS" as const }
  }

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

/**
 * Mengembalikan daftar mata pelajaran yang tersedia untuk dipilih guru di sebuah kelas.
 * - Admin akademik / super admin: semua mapel yang pernah/sedang diajarkan di kelas tersebut.
 * - Role.GURU: hanya mapel yang diajarkannya di kelas tersebut (dari GuruKelas).
 */
export async function getMapelTersediaUntukKelas(
  kelasId: string,
  sesuaikanPerGuru = true
): Promise<{ id: string; nama: string }[]> {
  const user = await requireGuru()

  if (isAcademicAdminRole(user.role)) {
    const mapels = await prisma.mataPelajaran.findMany({
      where: { guruKelas: { some: { kelasId } } },
      select: { id: true, nama: true },
      orderBy: { nama: "asc" },
    })
    return mapels
  }

  if (sesuaikanPerGuru) {
    const mapels = await prisma.mataPelajaran.findMany({
      where: { guruKelas: { some: { kelasId, guruId: user.guru?.id } } },
      select: { id: true, nama: true },
      orderBy: { nama: "asc" },
    })
    return mapels
  }

  const mapels = await prisma.mataPelajaran.findMany({
    where: { guruKelas: { some: { kelasId } } },
    select: { id: true, nama: true },
    orderBy: { nama: "asc" },
  })
  return mapels
}