// src/lib/guru-auth.ts

import prisma from "@/lib/prisma"
import { requireGuru, isAcademicAdminRole } from "@/lib/auth"
import { AppError } from "@/lib/prisma-error"

/**
 * Memverifikasi apakah user yang sedang login berhak mengelola kelas tertentu.
 *
 * - SUPER_ADMIN / ADMIN_AKADEMIK: punya akses penuh ke seluruh kelas (admin akademik).
 * - Role.GURU: berhak mengelola kelas bila dia wali kelas di kelas tersebut ATAU
 *   terdaftar mengajar mata pelajaran (bisa berapa pun) di kelas tersebut. Guru dapat
 *   memilih kelas mana pun dari dropdown; validasi mapel dilakukan via pengecekan
 *   GuruKelas saat mapel tertentu dipilih.
 */
/**
 * Sebuah referensi mapel bisa berupa nama ATAU ID (CUID Prisma).
 * Call site `createUjian`/`createTugas`/`createMateri` mengirim nama,
 * sedangkan semua aksi edit/delete/publish/grade mengirim `mataPelajaranId`.
 * Helper ini menormalkan kedua bentuk jadi filter `mataPelajaran` yang benar
 * untuk query Prisma (nama ATAU id).
 */
function normalizeMapelFilter(mataPelajaran: string):
  | { nama: string }
  | { id: string }
  | undefined {
  if (!mataPelajaran) return undefined
  // CUID Prisma: diawali "c" lalu 24 karakter alfanumerik lowercase
  if (/^c[a-z0-9]{24}$/.test(mataPelajaran)) {
    return { id: mataPelajaran }
  }
  return { nama: mataPelajaran }
}

export async function verifyGuruAksesKelas(
  kelasId: string,
  mataPelajaran?: string
) {
  const user = await requireGuru()

  const mapelFilter = normalizeMapelFilter(mataPelajaran ?? "")

  // Admin akademik / super admin bebas mengelola semua kelas
  if (isAcademicAdminRole(user.role) || user.isAdmin) {
    if (!user.guru) {
      throw new AppError("Forbidden: Profil guru tidak ditemukan")
    }

    // Admin dapat memakai mapel yang terdaftar di master mapel meskipun belum
    // memiliki baris penugasan GuruKelas.
    if (mapelFilter) {
      const mapel = await prisma.mataPelajaran.findFirst({
        where: { ...mapelFilter, aktif: true },
      })
      if (!mapel) {
        throw new AppError(
          `Mata pelajaran "${mataPelajaran}" tidak ditemukan`
        )
      }
    }

    return { user, guru: user.guru, roleInKelas: "ADMIN" as const }
  }

  if (!user.guru) {
    throw new AppError("Forbidden: Profil guru tidak ditemukan")
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
      ...(mapelFilter ? { mataPelajaran: mapelFilter } : {}),
    },
  })

  if (!pengajar) {
    throw new AppError(
      "Forbidden: Anda tidak memiliki wewenang mengajar/mengelola kelas ini"
    )
  }

  return { user, guru: user.guru, roleInKelas: "PENGAJAR" as const }
}

/**
 * Mengembalikan daftar mata pelajaran yang tersedia untuk dipilih guru di sebuah kelas.
 * - Admin akademik / super admin: semua mapel aktif (tanpa perlu penugasan GuruKelas).
 * - Role.GURU: hanya mapel yang diajarkannya di kelas tersebut (dari GuruKelas).
 */
export async function getMapelTersediaUntukKelas(
  kelasId: string,
  sesuaikanPerGuru = true
): Promise<{ id: string; nama: string }[]> {
  const user = await requireGuru()

  if (isAcademicAdminRole(user.role) || user.isAdmin) {
    const mapels = await prisma.mataPelajaran.findMany({
      where: { aktif: true },
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

/**
 * Mengembalikan daftar mataPelajaranId yang boleh diakses guru di sebuah kelas.
 * - Admin akademik / super admin: "ALL" (akses penuh).
 * - Wali kelas: "ALL" (selaras dengan verifyGuruAksesKelas yang memberi hak penuh).
 * - PENGAJAR: hanya mapel yang diajarkannya di kelas tersebut (dari GuruKelas).
 * Dipakai untuk memfilter daftar konten (tugas/materi/ujian) agar konsisten
 * dengan pengecekan akses pada detail/delete yang mensyaratkan mapel.
 */
export async function getMapelIdYangDiajarDiKelas(
  kelasId: string
): Promise<string[] | "ALL"> {
  const user = await requireGuru()

  if (isAcademicAdminRole(user.role) || user.isAdmin) return "ALL"
  if (!user.guru) return []

  const guruId = user.guru.id

  const sebagaiWali = await prisma.kelas.findFirst({
    where: { id: kelasId, waliKelasId: guruId },
    select: { id: true },
  })
  if (sebagaiWali) return "ALL"

  const penugasan = await prisma.guruKelas.findMany({
    where: { guruId, kelasId },
    select: { mataPelajaranId: true },
  })
  return penugasan
    .map((p) => p.mataPelajaranId)
    .filter((x): x is string => !!x)
}

// ============================================================
// HELPER TERPUSAT: VERIFIKASI AKSES KELAS AKADEMIK (BARU)
// ============================================================

/**
 * Jenis akses guru terhadap kelas untuk fitur akademik.
 * Digunakan oleh: Materi, Tugas, Ujian, Absensi, Rapor, Rekap Nilai, dll.
 */
export type AcademicAccess =
  | { status: "authorized"; user: Awaited<ReturnType<typeof requireGuru>>; roleInKelas: "WALI_KELAS" | "PENGAJAR" | "ADMIN"; guruId: string | null }
  | { status: "forbidden"; reason: string }

/**
 * Helper terpusat untuk memverifikasi akses akademik ke kelas.
 * Aturan:
 *   - SUPER_ADMIN dan ADMIN_AKADEMIK memiliki akses penuh ke seluruh kelas aktif
 *     dan seluruh mata pelajaran aktif. Tidak wajib memiliki record `Guru`.
 *   - GURU biasa hanya boleh mengakses kelas jika:
 *       - menjadi wali kelas; atau
 *       - memiliki penugasan pada GuruKelas.
 *   - GURU dengan isAdmin = true mengikuti akses admin akademik.
 *   - Role lain harus ditolak dengan response aman.
 *
 * PENTING: Helper ini DIPAKAI secara konsisten oleh semua fitur akademik.
 * Jangan menduplikasi guard di setiap action/server.
 */
export async function verifyAcademicClassAccess(
  kelasId: string,
  mataPelajaranName?: string | null,
  mataPelajaranId?: string | null
): Promise<AcademicAccess> {
  const user = await requireGuru()

  // Super admin / admin akademik: akses penuh tanpa perlu record Guru
  if (isAcademicAdminRole(user.role) || user.isAdmin) {
    // Validasi mata pelajaran jika ada (bukan wajib tapi jika ada harus valid)
    if (mataPelajaranName) {
      const mapel = await prisma.mataPelajaran.findFirst({
        where: { nama: mataPelajaranName, aktif: true },
        select: { id: true },
      })
      if (!mapel) {
        return { status: "forbidden", reason: "Mata pelajaran tidak ditemukan" }
      }
    }
    if (mataPelajaranId) {
      const mapel = await prisma.mataPelajaran.findUnique({ where: { id: mataPelajaranId } })
      if (!mapel || !mapel.aktif) {
        return { status: "forbidden", reason: "Mata pelajaran tidak ditemukan" }
      }
    }

    // Tentukan peran: wali kelas jika guru punya, else ADMIN
    const guruId = user.guru?.id ?? null
    let roleInKelas: "WALI_KELAS" | "PENGAJAR" | "ADMIN" = "ADMIN"

    if (guruId) {
      const kelas = await prisma.kelas.findFirst({
        where: { id: kelasId, waliKelasId: guruId },
        select: { id: true },
      })
      if (kelas) {
        roleInKelas = "WALI_KELAS"
      } else {
        const guruKelas = await prisma.guruKelas.findFirst({
          where: { guruId, kelasId },
          select: { id: true },
        })
        if (guruKelas) {
          roleInKelas = "PENGAJAR"
        }
      }
    }

    return {
      status: "authorized",
      user,
      roleInKelas,
      guruId,
    }
  }

  // Guru biasa: harus memiliki akses ke kelas melalui GuruKelas atau wali kelas
  if (user.role === "GURU") {
    const guruId = user.guru?.id
    if (!guruId) {
      return { status: "forbidden", reason: "Profil guru tidak ditemukan" }
    }

    // Cek apakah guru memiliki akses ke kelas ini
    const guruKelas = await prisma.guruKelas.findFirst({
      where: { guruId, kelasId },
      include: { mataPelajaran: true },
    })

    // Atau guru adalah wali kelas
    const kelas = await prisma.kelas.findFirst({
      where: { id: kelasId, waliKelasId: guruId },
    })

    const isPengajar = !!guruKelas
    const isWaliKelas = !!kelas

    if (!isPengajar && !isWaliKelas) {
      return { status: "forbidden", reason: "Anda tidak memiliki akses ke kelas ini" }
    }

    // Validasi mata pelajaran jika ada (hanya untuk guru pengajar)
    if ((mataPelajaranName || mataPelajaranId) && isPengajar && guruKelas) {
      const isMapelCorrect =
        (mataPelajaranName && guruKelas.mataPelajaran.nama === mataPelajaranName) ||
        (mataPelajaranId && guruKelas.mataPelajaranId === mataPelajaranId)

      if (!isMapelCorrect) {
        return { status: "forbidden", reason: "Anda tidak memiliki akses ke mata pelajaran ini di kelas ini" }
      }
    }

    // Tentukan peran
    let roleInKelas: "WALI_KELAS" | "PENGAJAR" | "ADMIN" = isWaliKelas ? "WALI_KELAS" : "PENGAJAR"

    return {
      status: "authorized",
      user,
      roleInKelas,
      guruId,
    }
  }

  // Role lain ditolak
  return { status: "forbidden", reason: "Anda tidak memiliki akses ke kelas ini" }
}