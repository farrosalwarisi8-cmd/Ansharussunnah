// src/actions/siswa-manual.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuruAdmin } from "@/lib/auth"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { generateSecurePassword } from "@/lib/password"
import { encryptSecret, decryptSecret } from "@/lib/crypto"
import { siswaManualSchema, type SiswaManualFormValues, updateAkunSiswaSchema, type UpdateAkunSiswaValues } from "@/lib/validations/siswa-manual"
import { siswaCocokKelas } from "@/lib/guru-kelas-gender"
import { deriveUniqueUsername } from "@/lib/username"
import type { ActionResponse } from "@/types"
import { Role } from "@prisma/client"
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

    // ✅ Validasi kecocokan gender siswa dengan kelas tujuan
    const kelas = await prisma.kelas.findUnique({
      where: { id: data.kelasId },
      select: { id: true, nama: true, jenisKelamin: true },
    })
    if (!kelas) {
      return { success: false, message: "Kelas tujuan tidak ditemukan" }
    }
    if (!siswaCocokKelas(data.jenisKelamin, kelas.jenisKelamin)) {
      const labelKelas = kelas.jenisKelamin === "LAKI_LAKI" ? "Ikhwan" : "Akhwat"
      return {
        success: false,
        message: `Kelas "${kelas.nama}" adalah kelas khusus ${labelKelas} dan tidak cocok untuk siswa yang berjenis kelamin ${data.jenisKelamin === "LAKI_LAKI" ? "laki-laki" : "perempuan"}.`,
      }
    }

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
          // Cek by email khusus role ORANG_TUA
          const existingOrtuByEmail = await tx.user.findFirst({
            where: { email: emailOrtu, role: Role.ORANG_TUA },
          })
          if (existingOrtuByEmail) {
            userOrtu = existingOrtuByEmail
            await tx.user.update({
              where: { id: userOrtu.id },
              data: { authId: authOrtuId },
            })
          } else {
            // Email ada di role lain (misal ADMIN_KEUANGAN) — buat User baru ORANG_TUA
            // Jangan reuse user role lain, buat terpisah
            userOrtu = await tx.user.create({
              data: {
                email: emailOrtu,
                username: await deriveUniqueUsername(tx, emailOrtu),
                passwordPlain: encryptSecret(passwordOrangTua),
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
          const existingByEmail = await tx.user.findFirst({
            where: { email: emailSiswa },
          })
          if (existingByEmail) {
            userSiswa = existingByEmail
            await tx.user.update({
              where: { id: userSiswa.id },
              data: { authId: authSiswaId },
            })
          } else {
            userSiswa = await tx.user.create({
              data: {
                email: emailSiswa,
                username: await deriveUniqueUsername(tx, emailSiswa),
                passwordPlain: encryptSecret(passwordSiswa),
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
      data: { mustChangePassword: true, passwordPlain: encryptSecret(newPassword) },
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
      data: { mustChangePassword: true, passwordPlain: encryptSecret(newPassword) },
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
  username: string | null
  nisn: string | null
  nis: string | null
  jenisKelamin: "LAKI_LAKI" | "PEREMPUAN" | null
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
            username: true,
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
      username: s.user.username,
      nisn: s.nisn,
      nis: s.nis,
      jenisKelamin: s.jenisKelamin,
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

/**
 * Mengambil password siswa SAAT INI secara on-demand (per-siswa).
 * Dipisah dari getDaftarSiswaManual agar password tidak dikirim massal
 * ke klien di setiap pemuatan daftar. Hanya dipanggil saat admin/ guru
 * membuka dialog ubah akun dan membutuhkan password untuk dilihat.
 */
export async function getPasswordSiswaSaatIni(
  siswaUserId: string
): Promise<ActionResponse<{ password: string | null }>> {
  try {
    await requireGuruAdmin()

    if (!siswaUserId) {
      return { success: false, message: "ID siswa tidak valid" }
    }

    const siswaUser = await prisma.user.findUnique({
      where: { id: siswaUserId },
      include: { siswa: { select: { id: true } } },
    })

    if (!siswaUser || !siswaUser.siswa) {
      return { success: false, message: "Akun siswa tidak ditemukan" }
    }

    const password = siswaUser.passwordPlain
      ? decryptSecret(siswaUser.passwordPlain)
      : null

    return { success: true, message: "Password berhasil diambil", data: { password } }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal mengambil password siswa",
    }
  }
}

// ========================================================
// 5. UPDATE AKUN SISWA (username, email, password)
// ========================================================

/**
 * Admin/guru mengubah data akun siswa:
 * - username: disimpan ke DB, dipakai sebagai alias login
 * - email: disinkronkan ke Supabase Auth (email_confirm otomatis)
 * - password: disinkronkan ke Supabase Auth + disimpan plaintext di DB
 */
export async function updateAkunSiswa(
  siswaUserId: string,
  payload: UpdateAkunSiswaValues
): Promise<ActionResponse> {
  try {
    await requireGuruAdmin()

    if (!siswaUserId) {
      return { success: false, message: "ID siswa tidak valid" }
    }

    // Normalisasi: username di-lowercase agar tidak ambigu dengan huruf kapital
    const normalizedPayload =
      payload.username !== undefined
        ? { ...payload, username: payload.username.trim().toLowerCase() }
        : payload

    const validated = updateAkunSiswaSchema.safeParse(normalizedPayload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data akun tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { username, email, password } = validated.data

    const user = await prisma.user.findUnique({
      where: { id: siswaUserId },
      include: { siswa: true },
    })
    if (!user || user.role !== Role.SISWA) {
      return { success: false, message: "Akun siswa tidak ditemukan" }
    }

    const changes: string[] = []

    // Cek duplikasi username (case-insensitive) di SEMUA user (login via username bersifat global)
    const newUsername = username?.trim()
    if (newUsername && (user.username || "") !== newUsername) {
      const duplicateUsername = await prisma.user.findFirst({
        where: {
          username: newUsername,
          id: { not: user.id },
          NOT: { username: null },
        },
      })
      if (duplicateUsername) {
        return { success: false, message: `Username "${newUsername}" sudah dipakai pengguna lain` }
      }
    }

    // Cek duplikasi email di SEMUA user dengan authId BERBEDA.
    // (Email di Supabase Auth wajib unik global; record lain yang ber-authId
    // sama adalah identitas orang yang sama dan boleh memakai email sama.)
    const newEmail = email?.toLowerCase().trim()
    if (newEmail && newEmail !== user.email.toLowerCase()) {
      const duplicateEmail = await prisma.user.findFirst({
        where: {
          email: newEmail,
          id: { not: user.id },
          NOT: { authId: user.authId },
        },
        select: { id: true },
      })
      if (duplicateEmail) {
        return {
          success: false,
          message: `Email "${newEmail}" sudah terdaftar untuk pengguna lain`,
        }
      }
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Catat perubahan (untuk pesan ringkasan)
    if (newUsername && newUsername !== (user.username || "")) changes.push("username")

    // Update email di Supabase Auth (jika berubah)
    if (newEmail && newEmail !== user.email.toLowerCase()) {
      const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(user.authId, {
        email: newEmail,
        email_confirm: true,
      })
      if (emailError) {
        return {
          success: false,
          message: `Gagal mengubah email di sistem login: ${emailError.message}`,
        }
      }

      // Sinkronkan email ke SEMUA record User dengan authId sama
      // (kasus satu orang punya beberapa role) agar email login konsisten.
      await prisma.user.updateMany({
        where: { authId: user.authId },
        data: { email: newEmail },
      })

      changes.push("email")
    }

    // Update password di Supabase Auth (jika diisi)
    if (password) {
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(user.authId, {
        password,
      })
      if (passwordError) {
        return {
          success: false,
          message: `Gagal mengubah password: ${passwordError.message}`,
        }
      }
      changes.push("password")
    }

    // Update di database (mulai dari kolom yang berubah saja)
    // Catatan: email sudah disinkronkan via updateMany di atas.
    const updateData: {
      username?: string
      passwordPlain?: string
      mustChangePassword?: boolean
      lastPasswordChange?: Date
    } = {}

    if (newUsername) updateData.username = newUsername
    if (password) {
      updateData.passwordPlain = encryptSecret(password)
      updateData.mustChangePassword = true
      updateData.lastPasswordChange = new Date()
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      })
    }

    revalidatePath("/dashboard/siswa")
    return {
      success: true,
      message:
        changes.length > 0
          ? `Akun siswa "${user.nama}" berhasil diperbarui (${changes.join(", ")}).`
          : "Tidak ada perubahan pada akun siswa.",
    }
  } catch (error: unknown) {
    console.error("Error updateAkunSiswa:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memperbarui akun siswa",
    }
  }
}

// ========================================================
// 6. GET KELAS LIST (untuk dropdown)
// ========================================================

type KelasListItem = {
  id: string
  nama: string
  jenjangNama: string
  jenisKelamin: "LAKI_LAKI" | "PEREMPUAN" | null
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
      jenisKelamin: k.jenisKelamin,
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

// ========================================================
// 6. HAPUS SISWA PERMANEN (+ HAPUS ORANGTUA OTOMATIS)
// ========================================================

type HapusSiswaResult = {
  siswaDihapus: boolean
  orangTuaDihapus: boolean
  namaSiswa: string
}

/**
 * Menghapus siswa dan akun terkaitnya secara permanen.
 * - Menghapus relasi ParentStudent
 * - Menghapus OrangTua + User jika tidak terkait siswa lain
 * - Menghapus Siswa + User + Supabase Auth
 */
export async function hapusSiswaPermanent(
  siswaUserId: string
): Promise<ActionResponse<HapusSiswaResult>> {
  try {
    await requireGuruAdmin()

    const siswaUser = await prisma.user.findUnique({
      where: { id: siswaUserId },
      include: {
        siswa: {
          include: {
            orangTua: {
              include: {
                orangTua: {
                  include: {
                    siswa: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!siswaUser || siswaUser.role !== Role.SISWA) {
      return { success: false, message: "Akun siswa tidak ditemukan" }
    }

    if (!siswaUser.siswa) {
      return { success: false, message: "Data siswa tidak ditemukan" }
    }

    const namaSiswa = siswaUser.nama
    let orangTuaDihapus = false

    // Cek setiap orang tua yang terkait siswa ini
    for (const ps of siswaUser.siswa.orangTua) {
      const orangTua = ps.orangTua
      const otherSiswaCount = orangTua.siswa.length - 1 // -1 untuk relasi dengan siswa ini

      // Hapus relasi ParentStudent
      await prisma.parentStudent.delete({
        where: {
          orangTuaId_siswaId: {
            orangTuaId: orangTua.id,
            siswaId: siswaUser.siswa.id,
          },
        },
      })

      // Jika orang tua tidak terkait siswa lain, hapus juga
      if (otherSiswaCount <= 0) {
        const orangTuaUser = await prisma.user.findUnique({
          where: { id: orangTua.userId },
        })

        if (orangTuaUser) {
          // Cek apakah authId dipakai role lain (multi-role / email dipakai admin)
          const otherUsersWithAuth = await prisma.user.count({
            where: { authId: orangTuaUser.authId, id: { not: orangTuaUser.id } },
          })

          // Hapus Supabase Auth orang tua hanya jika tidak dipakai role lain
          if (otherUsersWithAuth === 0) {
            const supabaseAdmin = createSupabaseAdmin()
            await supabaseAdmin.auth.admin.deleteUser(orangTuaUser.authId)
          }

          // Hapus User orang tua (cascade ke OrangTua record)
          await prisma.user.delete({ where: { id: orangTuaUser.id } })
          orangTuaDihapus = true
        }
      }
    }

    // Hapus Supabase Auth siswa (hanya jika tidak dipakai role lain)
    const siswaAuthUsers = await prisma.user.count({
      where: { authId: siswaUser.authId, id: { not: siswaUser.id } },
    })

    if (siswaAuthUsers === 0) {
      const supabaseAdmin = createSupabaseAdmin()
      await supabaseAdmin.auth.admin.deleteUser(siswaUser.authId)
    }

    // Hapus User siswa (cascade ke Siswa record)
    await prisma.user.delete({ where: { id: siswaUser.id } })

    revalidatePath("/dashboard/siswa")
    return {
      success: true,
      message: `Siswa "${namaSiswa}" berhasil dihapus secara permanen.`,
      data: {
        siswaDihapus: true,
        orangTuaDihapus,
        namaSiswa,
      },
    }
  } catch (error: unknown) {
    console.error("Error hapus siswa:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menghapus siswa",
    }
  }
}
