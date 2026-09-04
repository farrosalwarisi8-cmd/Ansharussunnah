// src/actions/siswa-manual.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuruAdmin } from "@/lib/auth"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { generateSecurePassword } from "@/lib/password"
import { siswaManualSchema, type SiswaManualFormValues } from "@/lib/validations/siswa-manual"
import type { ActionResponse } from "@/types"
import { Prisma, Role } from "@prisma/client"
import { revalidatePath } from "next/cache"

// ========================================================
// 1. CREATE SISWA MANUAL
// ========================================================

type CreateSiswaManualResult = {
  siswaUserId: string
  passwordSiswa: string
  passwordOrangTua?: string
  orangTuaBaruDibuat?: boolean
}

/**
 * Membuat akun siswa langsung oleh admin (tanpa alur pendaftaran publik).
 * Pola sama dengan createAkunGuru: generate password, tampilkan sekali, mustChangePassword.
 */
export async function createSiswaManual(
  payload: SiswaManualFormValues
): Promise<ActionResponse<CreateSiswaManualResult>> {
  try {
    await requireGuruAdmin()

    // Validasi payload
    const validated = siswaManualSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data siswa tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const data = validated.data
    const supabaseAdmin = createSupabaseAdmin()

    // Generate email siswa jika tidak diisi
    const cleanNama = data.namaLengkap
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, ".")
    const emailSiswa = data.emailSiswa || `${cleanNama}@sekolah.internal`

    const emailOrtu = data.emailOrangTua.toLowerCase().trim()

    // Cek duplikasi email siswa untuk role yang sama
    const existingSiswa = await prisma.user.findFirst({ where: { email: emailSiswa, role: Role.SISWA } })
    if (existingSiswa) {
      return { success: false, message: "Email siswa sudah terdaftar dalam sistem" }
    }

    // Cek duplikasi email orang tua untuk role yang sama
    const existingOrtu = await prisma.user.findFirst({ where: { email: emailOrtu, role: Role.ORANG_TUA } })

    // Generate atau pakai password manual
    const passwordSiswa = data.passwordManual || generateSecurePassword(14)
    const passwordOrangTua = generateSecurePassword(14)

    const newlyCreatedAuthIds: string[] = []

    // --- Buat Supabase Auth Orang Tua (jika belum ada) ---
    let authOrtuId: string
    let ortuAlreadyExisted = false

    if (existingOrtu) {
      // Orang tua sudah punya akun, gunakan authId yang ada
      authOrtuId = existingOrtu.authId
      ortuAlreadyExisted = true
    } else {
      // Buat akun auth orang tua baru
      const { data: authOrtuData, error: authOrtuError } =
        await supabaseAdmin.auth.admin.createUser({
          email: emailOrtu,
          password: passwordOrangTua,
          email_confirm: true,
          user_metadata: {
            nama: data.namaOrangTua,
            role: Role.ORANG_TUA,
          },
        })

      if (authOrtuError) {
        // Handle case: email sudah terdaftar di Supabase Auth
        if (authOrtuError.message.includes("already been registered")) {
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({
            perPage: 1000,
          })
          const matched = existingUsers.users.find((u) => u.email === emailOrtu)
          if (!matched) {
            return { success: false, message: "Gagal memetakan akun auth orang tua yang sudah ada" }
          }
          authOrtuId = matched.id
          ortuAlreadyExisted = true
        } else {
          console.error("Supabase auth error (orang tua):", authOrtuError)
          return { success: false, message: `Gagal membuat akun auth orang tua: ${authOrtuError.message}` }
        }
      } else {
        authOrtuId = authOrtuData.user!.id
        newlyCreatedAuthIds.push(authOrtuId)
      }
    }

    // --- Buat Supabase Auth Siswa ---
    let authSiswaId: string
    const { data: authSiswaData, error: authSiswaError } =
      await supabaseAdmin.auth.admin.createUser({
        email: emailSiswa,
        password: passwordSiswa,
        email_confirm: true,
        user_metadata: {
          nama: data.namaLengkap,
          role: Role.SISWA,
        },
      })

    if (authSiswaError) {
      if (authSiswaError.message.includes("already been registered")) {
        // Email ini sudah punya akun Supabase Auth (dari role lain).
        // REUSE authId supaya identitas login tetap sama.
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({
          perPage: 1000,
        })
        const matched = existingUsers.users.find((u) => u.email === emailSiswa)
        if (!matched) {
          // Cleanup auth orang tua baru yang sudah dibuat sebelumnya
          for (const authId of newlyCreatedAuthIds) {
            await supabaseAdmin.auth.admin.deleteUser(authId)
          }
          return { success: false, message: "Gagal memetakan akun auth siswa yang sudah ada" }
        }
        authSiswaId = matched.id
      } else {
        // Cleanup auth yang baru dibuat
        for (const authId of newlyCreatedAuthIds) {
          await supabaseAdmin.auth.admin.deleteUser(authId)
        }
        console.error("Supabase auth error (siswa):", authSiswaError)
        return { success: false, message: `Gagal membuat akun auth siswa: ${authSiswaError.message}` }
      }
    } else {
      authSiswaId = authSiswaData.user!.id
      newlyCreatedAuthIds.push(authSiswaId)
    }

    // --- Prisma Transaction ---
    let prismaSiswaUserId: string | undefined
    try {
      await prisma.$transaction(
        async (tx) => {
        // Cek atau buat User orang tua (support multi-role: same authId, different role)
        let userOrtu = await tx.user.findFirst({
          where: { authId: authOrtuId, role: Role.ORANG_TUA },
        })

        if (!userOrtu) {
          // Fallback: cek by email (handle case where authId berbeda tapi email sama)
          userOrtu = await tx.user.findFirst({
            where: { email: emailOrtu, role: Role.ORANG_TUA },
          })
          if (userOrtu) {
            await tx.user.update({
              where: { id: userOrtu.id },
              data: { authId: authOrtuId },
            })
          }
        }

        if (!userOrtu) {
          try {
            userOrtu = await tx.user.create({
              data: {
                email: emailOrtu,
                nama: data.namaOrangTua,
                role: Role.ORANG_TUA,
                authId: authOrtuId,
                mustChangePassword: true,
                orangTua: {
                  create: {
                    noHp: data.noHpOrangTua,
                    alamat: data.alamatOrangTua || data.alamatSiswa,
                  },
                },
              },
            })
          } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
              // Race condition: admin lain (misal menambah kakak-adik dengan orang tua
              // yang sama) berhasil membuat user ini duluan. Ambil yang sudah ada.
              userOrtu = await tx.user.findFirstOrThrow({ where: { email: emailOrtu } })
            } else {
              throw err
            }
          }
        }

        const orangTuaRecord = await tx.orangTua.findUnique({
          where: { userId: userOrtu.id },
        })

        // Buat User + Siswa (cek duplikasi by authId+role lalu by email)
        let userSiswa = await tx.user.findFirst({
          where: { authId: authSiswaId, role: Role.SISWA },
        })

        if (!userSiswa) {
          userSiswa = await tx.user.findFirst({
            where: { email: emailSiswa, role: Role.SISWA },
          })
          if (userSiswa) {
            await tx.user.update({
              where: { id: userSiswa.id },
              data: { authId: authSiswaId },
            })
          }
        }

        if (!userSiswa) {
          try {
            userSiswa = await tx.user.create({
              data: {
                email: emailSiswa,
                nama: data.namaLengkap,
                role: Role.SISWA,
                authId: authSiswaId,
                mustChangePassword: true,
                siswa: {
                  create: {
                    nisn: data.nisn || null,
                    nis: data.nis || null,
                    agama: data.agama || null,
                    tempatLahir: data.tempatLahir,
                    tanggalLahir: new Date(data.tanggalLahir),
                    jenisKelamin: data.jenisKelamin,
                    alamat: data.alamatSiswa,
                    noHpSiswa: data.noHpSiswa || null,
                    namaAyahKandung: data.namaAyahKandung || null,
                    statusAyahKandung: data.statusAyahKandung || null,
                    nikAyah: data.nikAyah || null,
                    namaIbuKandung: data.namaIbuKandung || null,
                    statusIbuKandung: data.statusIbuKandung || null,
                    nikIbu: data.nikIbu || null,
                    statusWali: data.statusWali || null,
                    namaWali: data.namaWali || null,
                    kewarganegaraan: data.kewarganegaraan || "WNI",
                    kitas: data.kitas || null,
                    asalNegara: data.asalNegara || null,
                    kelasId: data.kelasId,
                    // pendaftaranId sengaja tidak diisi (siswa manual)
                  },
                },
              },
            })
          } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
              // Race condition: admin lain berhasil membuat user siswa ini duluan.
              // Ambil yang sudah ada, jangan gagal.
              userSiswa = await tx.user.findFirstOrThrow({ where: { email: emailSiswa } })
            } else {
              throw err
            }
          }
        }

        prismaSiswaUserId = userSiswa.id

        const siswaRecord = await tx.siswa.findUnique({
          where: { userId: userSiswa.id },
        })

        // Buat relasi ParentStudent
        if (orangTuaRecord && siswaRecord) {
          // Cek apakah relasi sudah ada (untuk case orang tua sudah ada)
          const existingRelation = await tx.parentStudent.findUnique({
            where: {
              orangTuaId_siswaId: {
                orangTuaId: orangTuaRecord.id,
                siswaId: siswaRecord.id,
              },
            },
          })

          if (!existingRelation) {
            await tx.parentStudent.create({
              data: {
                orangTuaId: orangTuaRecord.id,
                siswaId: siswaRecord.id,
                hubungan: "Orang Tua",
              },
            })
          }
        }
        },
        { timeout: 15000, maxWait: 5000 }
      )
    } catch (txError) {
      console.error("Prisma transaction error, rolling back Supabase Users...", txError)
      // Cleanup auth yang baru dibuat
      for (const authId of newlyCreatedAuthIds) {
        await supabaseAdmin.auth.admin.deleteUser(authId)
      }
      throw txError
    }

    revalidatePath("/dashboard/siswa")
    if (!prismaSiswaUserId) {
      return {
        success: false,
        message: "Gagal membuat akun siswa: ID siswa tidak ditemukan setelah transaksi selesai.",
      }
    }
    return {
      success: true,
      message: `Akun siswa "${data.namaLengkap}" berhasil dibuat.`,
      data: {
        siswaUserId: prismaSiswaUserId,
        passwordSiswa,
        passwordOrangTua: ortuAlreadyExisted ? undefined : passwordOrangTua,
        orangTuaBaruDibuat: !ortuAlreadyExisted,
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal membuat akun siswa",
    }
  }
}

// ========================================================
// 2. RESET PASSWORD SISWA
// ========================================================

type ResetPasswordResult = {
  newPassword: string
}

/**
 * Generate password baru untuk siswa, tampilkan sekali ke admin.
 * Tidak ada email — murni ditampilkan di layar admin.
 */
export async function resetPasswordSiswaManual(
  siswaUserId: string
): Promise<ActionResponse<ResetPasswordResult>> {
  try {
    await requireGuruAdmin()

    const user = await prisma.user.findUnique({
      where: { id: siswaUserId },
      include: { siswa: true },
    })

    if (!user || user.role !== "SISWA") {
      return { success: false, message: "Akun siswa tidak ditemukan" }
    }

    if (!user.siswa) {
      return { success: false, message: "Data siswa tidak ditemukan" }
    }

    const newPassword = generateSecurePassword(14)

    // Update password di Supabase Auth
    const supabaseAdmin = createSupabaseAdmin()
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      user.authId,
      { password: newPassword }
    )

    if (authError) {
      console.error("Supabase auth reset password error:", authError)
      return { success: false, message: `Gagal mereset password: ${authError.message}` }
    }

    // Set mustChangePassword: true
    await prisma.user.update({
      where: { id: siswaUserId },
      data: { mustChangePassword: true },
    })

    revalidatePath("/dashboard/siswa")
    return {
      success: true,
      message: `Password siswa "${user.nama}" berhasil direset.`,
      data: { newPassword },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal mereset password siswa",
    }
  }
}

// ========================================================
// 3. RESET PASSWORD ORANG TUA
// ========================================================

/**
 * Generate password baru untuk akun orang tua, tampilkan sekali ke admin.
 */
export async function resetPasswordOrangTuaManual(
  orangTuaUserId: string
): Promise<ActionResponse<ResetPasswordResult>> {
  try {
    await requireGuruAdmin()

    const user = await prisma.user.findUnique({
      where: { id: orangTuaUserId },
      include: { orangTua: true },
    })

    if (!user || user.role !== "ORANG_TUA") {
      return { success: false, message: "Akun orang tua tidak ditemukan" }
    }

    if (!user.orangTua) {
      return { success: false, message: "Data orang tua tidak ditemukan" }
    }

    const newPassword = generateSecurePassword(14)

    // Update password di Supabase Auth
    const supabaseAdmin = createSupabaseAdmin()
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      user.authId,
      { password: newPassword }
    )

    if (authError) {
      console.error("Supabase auth reset password error:", authError)
      return { success: false, message: `Gagal mereset password: ${authError.message}` }
    }

    // Set mustChangePassword: true
    await prisma.user.update({
      where: { id: orangTuaUserId },
      data: { mustChangePassword: true },
    })

    revalidatePath("/dashboard/siswa")
    return {
      success: true,
      message: `Password orang tua "${user.nama}" berhasil direset.`,
      data: { newPassword },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal mereset password orang tua",
    }
  }
}

// ========================================================
// 4. GET DAFTAR SISWA MANUAL
// ========================================================

type SiswaManualListItem = {
  id: string
  userId: string
  nama: string
  email: string
  nisn: string | null
  nis: string | null
  kelasNama: string | null
  jenjangNama: string | null
  aktif: boolean
  createdAt: Date
  orangTua: Array<{
    id: string
    userId: string
    nama: string
    email: string
    noHp: string | null
  }>
}

/**
 * Mengambil daftar siswa (termasuk yang dibuat manual) beserta info kelas dan orang tua.
 */
export async function getDaftarSiswaManual(): Promise<ActionResponse<SiswaManualListItem[]>> {
  try {
    await requireGuruAdmin()

    const siswaList = await prisma.siswa.findMany({
      include: {
        user: {
          select: {
            id: true,
            nama: true,
            email: true,
            aktif: true,
            createdAt: true,
          },
        },
        kelas: {
          select: {
            nama: true,
            jenjang: {
              select: { nama: true },
            },
          },
        },
        orangTua: {
          include: {
            orangTua: {
              include: {
                user: {
                  select: {
                    id: true,
                    nama: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { user: { createdAt: "desc" } },
    })

    const formatted: SiswaManualListItem[] = siswaList.map((s) => ({
      id: s.id,
      userId: s.user.id,
      nama: s.user.nama,
      email: s.user.email,
      nisn: s.nisn,
      nis: s.nis,
      kelasNama: s.kelas?.nama || null,
      jenjangNama: s.kelas?.jenjang?.nama || null,
      aktif: s.user.aktif,
      createdAt: s.user.createdAt,
      orangTua: s.orangTua.map((ps) => ({
        id: ps.orangTua.id,
        userId: ps.orangTua.user.id,
        nama: ps.orangTua.user.nama,
        email: ps.orangTua.user.email,
        noHp: ps.orangTua.noHp,
      })),
    }))

    return {
      success: true,
      message: "Daftar siswa berhasil dimuat",
      data: formatted,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat daftar siswa",
    }
  }
}

// ========================================================
// 5. GET KELAS LIST (untuk dropdown)
// ========================================================

type KelasListItem = {
  id: string
  nama: string
  jenjangNama: string
  kapasitas: number
  jumlahSiswa: number
}

/**
 * Mengambil daftar kelas untuk dropdown pemilihan kelas.
 */
export async function getKelasList(): Promise<ActionResponse<KelasListItem[]>> {
  try {
    await requireGuruAdmin()

    const kelasList = await prisma.kelas.findMany({
      where: { aktif: true },
      include: {
        jenjang: { select: { nama: true } },
        _count: { select: { siswa: true } },
      },
      orderBy: [{ jenjang: { urutan: "asc" } }, { nama: "asc" }],
    })

    const formatted: KelasListItem[] = kelasList.map((k) => ({
      id: k.id,
      nama: k.nama,
      jenjangNama: k.jenjang.nama,
      kapasitas: k.kapasitas,
      jumlahSiswa: k._count.siswa,
    }))

    return {
      success: true,
      message: "Daftar kelas berhasil dimuat",
      data: formatted,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat daftar kelas",
    }
  }
}
