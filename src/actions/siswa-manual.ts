// src/actions/siswa-manual.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuruAdmin } from "@/lib/auth"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { generateSecurePassword } from "@/lib/password"
import {
  siswaManualSchema,
  type SiswaManualFormValues,
  updateAkunSiswaSchema,
  type UpdateAkunSiswaValues,
  tambahOrangTuaSchema,
  type TambahOrangTuaValues,
  updateDataSiswaSchema,
  type UpdateDataSiswaValues,
} from "@/lib/validations/siswa-manual"
import { siswaCocokKelas } from "@/lib/guru-kelas-gender"
import { deriveUniqueUsername } from "@/lib/username"
import { toUserFriendlyError } from "@/lib/prisma-error"
import { sendEmail, buildPemberitahuanRoleBaruEmail } from "@/lib/email"
import { runAfterResponse } from "@/lib/after-response"
import { normalizePagination, paginatedResult, type Paginated } from "@/lib/pagination"
import type { ActionResponse } from "@/types"
import { Prisma, Role, StatusPendaftaran } from "@prisma/client"
import { revalidatePath } from "next/cache"

// ========================================================
// 1. CREATE SISWA MANUAL
// ========================================================

type CreateSiswaManualResult = {
  siswaUserId: string
  passwordSiswa?: string
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

    // ✅ Cek duplikasi NISN / NIS dengan siswa yang SUDAH ADA ATAU pendaftaran
    // aktif lain. Kolom nisn & nis di model Siswa @unique — dicek proaktif agar
    // tidak crash dengan pesan error mentah P2002 di layar admin.
    // NISN & NIS adalah identitas penting: satu nilai hanya boleh milik SATU siswa.
    if (data.nisn) {
      const [nisnSiswa, nisnPendaftaran] = await Promise.all([
        prisma.siswa.findUnique({
          where: { nisn: data.nisn },
          select: { id: true, user: { select: { nama: true } } },
        }),
        prisma.pendaftaran.findFirst({
          where: {
            nisn: data.nisn,
            status: {
              in: [
                StatusPendaftaran.MENUNGGU_PEMBAYARAN,
                StatusPendaftaran.MENUNGGU_VERIFIKASI,
              ],
            },
          },
          select: { nomorPendaftaran: true, namaLengkap: true },
        }),
      ])
      if (nisnSiswa) {
        return {
          success: false,
          message: `NISN "${data.nisn}" sudah terdaftar atas nama ${nisnSiswa.user.nama}. Mohon periksa kembali input Anda.`,
        }
      }
      if (nisnPendaftaran) {
        return {
          success: false,
          message: `NISN "${data.nisn}" sudah digunakan pada pendaftaran lain (Nomor: ${nisnPendaftaran.nomorPendaftaran}, atas nama ${nisnPendaftaran.namaLengkap}). Satu NISN hanya boleh untuk satu calon siswa.`,
        }
      }
    }

    if (data.nis) {
      const nisDipakai = await prisma.siswa.findUnique({
        where: { nis: data.nis },
        select: { user: { select: { nama: true } } },
      })
      if (nisDipakai) {
        return {
          success: false,
          message: `NIS "${data.nis}" sudah terdaftar atas nama ${nisDipakai.user.nama}. Mohon periksa kembali input Anda.`,
        }
      }
    }

    // Generate atau pakai password manual
    const passwordSiswa = data.passwordManual || generateSecurePassword(14)
    // Password ortu hanya digenerate bila akun ortu benar-benar BARU dibuat.
    // Jika email ortu sudah punya akun (reuse authId), password lama tetap
    // dipakai — tidak ada password ortu baru.
    let passwordOrangTua: string | undefined

    const newlyCreatedAuthIds: string[] = []

    // --- Buat Supabase Auth Orang Tua (jika belum ada) ---
    let authOrtuId: string
    let ortuAlreadyExisted = false
    let ortuRecordBaruDibuat = false

    if (existingOrtu) {
      // Orang tua sudah punya akun, gunakan authId yang ada
      authOrtuId = existingOrtu.authId
      ortuAlreadyExisted = true
    } else {
      // Buat akun auth orang tua baru
      passwordOrangTua = generateSecurePassword(14)
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
          // Akun reuse: password ortu "baru" yang digenerate tidak dipakai
          // kemana-mana (createUser gagal, akun lama tidak diubah).
          passwordOrangTua = undefined
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
    let siswaAkunSudahAda = false
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
        // Password TIDAK diubah/digenerate ulang — akun lama tetap dipakai,
        // jadi tidak ada password baru yang perlu ditampilkan/dikirim.
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
        siswaAkunSudahAda = true
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
                nama: data.namaOrangTua,
                role: Role.ORANG_TUA,
                authId: authOrtuId,
                // Akun reuse (email sudah punya akun di role lain): tidak ada
                // password baru → jangan paksa ganti password.
                ...(ortuAlreadyExisted
                  ? { mustChangePassword: false }
                  : { mustChangePassword: true }),
                orangTua: {
                  create: {
                    noHp: data.noHpOrangTua,
                    alamat: data.alamatOrangTua || data.alamatSiswa,
                  },
                },
              },
            })
            if (ortuAlreadyExisted) {
              // Record ORANG_TUA ini BARU dibuat dari akun yang email-nya sudah
              // punya akun lain (reuse authId) → peran ORANG_TUA baru ditambahkan.
              ortuRecordBaruDibuat = true
            }
          }
        }

        const orangTuaRecord = await tx.orangTua.findUnique({
          where: { userId: userOrtu.id, deleted_at: null },
        })

        // Buat User + Siswa (cek duplikasi by authId+role lalu by email)
        let userSiswa = await tx.user.findFirst({
          where: { authId: authSiswaId, role: Role.SISWA },
        })

        if (!userSiswa) {
          const existingByEmail = await tx.user.findFirst({
            where: { email: emailSiswa, role: Role.SISWA },
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
                nama: data.namaLengkap,
                role: Role.SISWA,
                authId: authSiswaId,
                // Akun reuse (ada user lain email-nya sama): tidak ada password
                // baru → jangan paksa ganti password.
                ...(siswaAkunSudahAda
                  ? { mustChangePassword: false }
                  : { mustChangePassword: true }),
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
          where: { userId: userSiswa.id, deleted_at: null },
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

    // Verifikasi ulang SETELAH commit: row `siswas` HARUS ada untuk user ini.
    // User role SISWA tanpa row siswa = data setengah yang merusak seluruh
    // alur (dashboard wali, akademik, absensi). Bila gagal, auth user yang
    // baru dibuat dibersihkan agar tidak ada akun yatim — dan kita TIDAK
    // mengembalikan success:true.
    const siswaTerverifikasi = await prisma.siswa.findUnique({
      where: { userId: prismaSiswaUserId },
      select: { id: true },
    })
    if (!siswaTerverifikasi) {
      console.error(
        `[createSiswaManual] KONSISTENSI GAGAL: user ${prismaSiswaUserId} tanpa row siswas — membersihkan auth user`,
      )
      for (const authId of newlyCreatedAuthIds) {
        await supabaseAdmin.auth.admin.deleteUser(authId)
      }
      return {
        success: false,
        message:
          "Gagal membuat data siswa secara lengkap. Perubahan dibatalkan dan akun auth dibersihkan. Silakan coba lagi.",
      }
    }

    // Pemberitahuan role baru (TANPA password) jika peran dibuat dari email
    // yang SUDAH punya akun lain (reuse authId). Password tidak pernah dikirim
    // untuk skenario reuse — user memakai password lama.
    // Dikirim LANGSUNG ke provider lewat runAfterResponse: tidak memblokir
    // response, tapi runtime tetap menahan instance sampai pengiriman selesai.
    if (ortuAlreadyExisted && ortuRecordBaruDibuat) {
      runAfterResponse(async () => {
        try {
          const hasilEmail = await sendEmail({
            to: emailOrtu,
            subject: "Akun Orang Tua Baru Ditambahkan — Ansharussunnah",
            html: buildPemberitahuanRoleBaruEmail({
              nama: data.namaOrangTua,
              email: emailOrtu,
              roleBaru: "Orang Tua",
            }),
          })
          if (!hasilEmail.success) {
            console.error("Email pemberitahuan role orang tua gagal dikirim:", hasilEmail.error)
          }
        } catch (err) {
          console.error("Gagal mengirim email pemberitahuan role orang tua:", err)
        }
      })
    }

    if (siswaAkunSudahAda) {
      runAfterResponse(async () => {
        try {
          const hasilEmail = await sendEmail({
            to: emailSiswa,
            subject: "Akun Siswa Baru Ditambahkan — Ansharussunnah",
            html: buildPemberitahuanRoleBaruEmail({
              nama: data.namaLengkap,
              email: emailSiswa,
              roleBaru: "Siswa",
            }),
          })
          if (!hasilEmail.success) {
            console.error("Email pemberitahuan role siswa gagal dikirim:", hasilEmail.error)
          }
        } catch (err) {
          console.error("Gagal mengirim email pemberitahuan role siswa:", err)
        }
      })
    }

    return {
      success: true,
      message: `Akun siswa "${data.namaLengkap}" berhasil dibuat.`,
      data: {
        siswaUserId: prismaSiswaUserId,
        // Jangan tampilkan password yang TIDAK pernah diterapkan ke auth (reuse).
        passwordSiswa: siswaAkunSudahAda ? undefined : passwordSiswa,
        passwordOrangTua: ortuAlreadyExisted ? undefined : passwordOrangTua,
        orangTuaBaruDibuat: !ortuAlreadyExisted,
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal membuat akun siswa secara manual. Silakan coba lagi atau hubungi admin."),
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
      where: { id: siswaUserId, deleted_at: null },
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
      message: toUserFriendlyError(error, "Gagal mereset password siswa"),
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
      where: { id: orangTuaUserId, deleted_at: null },
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
      message: toUserFriendlyError(error, "Gagal mereset password orang tua"),
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
  kelasId: string | null
  kelasNama: string | null
  jenjangNama: string | null
  aktif: boolean
  createdAt: Date
  /** false = row siswa tanpa User terkait (data tidak lengkap, perlu repair). */
  dataLengkap: boolean
  orangTua: Array<{
    id: string
    userId: string
    nama: string
    email: string
    noHp: string | null
  }>
}

/**
 * Metadata diagnostics — HANYA untuk role admin yang sudah lolos
 * requireGuruAdmin(). Tidak berisi data sensitif, hanya agregat count.
 */
type SiswaListDiagnostics = {
  /** User role SISWA yang tidak punya row siswas (orphan). */
  orphanUserSiswaCount: number
  /** Pendaftaran DITERIMA yang tidak punya row siswas. */
  diterimaTanpaSiswaCount: number
}

/**
 * Mengambil daftar siswa (termasuk yang dibuat manual) beserta info kelas dan orang tua.
 *
 * Sumber data utama: tabel `siswas` dengan filter `deleted_at: null` (soft-deleted
 * tidak tampil di daftar aktif tetapi tetap bisa diaudit via repair tooling).
 *
 * Row siswa tanpa User TIDAK membuat seluruh request gagal — item tetap
 * dikembalikan dengan nama fallback + flag dataLengkap=false agar admin
 * bisa melihat dan memperbaikinya (lihat src/actions/reconcile-siswa.ts).
 */
export async function getDaftarSiswaManual(options?: {
  page?: number
  pageSize?: number
  search?: string
  kelasNama?: string
  jenisKelamin?: "LAKI_LAKI" | "PEREMPUAN"
  /** Hanya tampilkan siswa yang belum punya relasi orang tua (butuh tautan). */
  tanpaOrangTua?: boolean
}): Promise<
  ActionResponse<Paginated<SiswaManualListItem> & { diagnostics?: SiswaListDiagnostics }>
> {
  try {
    await requireGuruAdmin()

    const pagination = normalizePagination(options)
    const search = options?.search?.trim()
    const kelasNama = options?.kelasNama?.trim()

    console.log(
      `[student-list] request page=${pagination.page} pageSize=${pagination.pageSize} search=${search || "-"} kelas=${kelasNama || "ALL"}`,
    )

    // Filter dikerjakan di server supaya pagination tetap benar: memfilter
    // hanya pada baris yang sudah di-fetch akan menghasilkan hasil yang salah.
    const where: Prisma.SiswaWhereInput = { deleted_at: null }
    if (options?.jenisKelamin) {
      where.jenisKelamin = options.jenisKelamin
    }
    // Filter kelas HANYA diterapkan bila nilai bukan "ALL"/kosong — memfilter
    // dengan string kosong menghasilkan kelas.nama = "" yang tidak pernah
    // cocok dan membuat daftar tampak kosong padahal data ada.
    if (kelasNama && kelasNama !== "ALL") {
      where.kelas = { nama: kelasNama }
    }
    if (search) {
      where.OR = [
        { user: { nama: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { username: { contains: search, mode: "insensitive" } } },
        { nisn: { contains: search, mode: "insensitive" } },
        { nis: { contains: search, mode: "insensitive" } },
      ]
    }
    // Filter "belum punya ortu" — dikerjakan di server agar `total` &
    // pagination tetap konsisten dengan baris yang ditampilkan.
    if (options?.tanpaOrangTua) {
      where.orangTua = { none: {} }
    }

    // total HARUS berasal dari where yang sama dengan findMany.
    const total = await prisma.siswa.count({ where })

    // Koreksi page di luar total halaman → halaman terakhir (response konsisten).
    const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize))
    const page = Math.min(pagination.page, totalPages)
    const skip = (page - 1) * pagination.pageSize

    const [siswaList, orphanUserSiswaCount, diterimaTanpaSiswaCount] =
      await Promise.all([
        prisma.siswa.findMany({
          where,
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
                id: true,
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
          orderBy: [{ user: { createdAt: "desc" } }, { id: "desc" }],
          skip,
          take: pagination.take,
        }),
        // Diagnostics orphan — agregat count saja, tanpa data sensitif.
        prisma.user.count({ where: { role: Role.SISWA, siswa: null } }),
        prisma.pendaftaran.count({
          where: {
            status: StatusPendaftaran.DITERIMA,
            deleted_at: null,
            siswa: null,
          },
        }),
      ])

    if (total === 0) {
      console.log("[student-list] empty total=0")
    } else {
      console.log(`[student-list] success total=${total} page=${page}`)
    }

    const formatted: SiswaManualListItem[] = siswaList.map((s) => {
      if (!s.user) {
        // Row siswa tanpa user tidak boleh membuat seluruh request gagal.
        console.warn(`[student-list] orphan: siswa ${s.id} tanpa user`)
        return {
          id: s.id,
          userId: s.userId,
          nama: "(Data siswa tidak lengkap)",
          email: "-",
          username: null,
          nisn: s.nisn,
          nis: s.nis,
          jenisKelamin: s.jenisKelamin,
          kelasId: s.kelas?.id || null,
          kelasNama: s.kelas?.nama || null,
          jenjangNama: s.kelas?.jenjang?.nama || null,
          aktif: false,
          createdAt: s.createdAt,
          dataLengkap: false,
          orangTua: [],
        }
      }
      return {
        id: s.id,
        userId: s.user.id,
        nama: s.user.nama,
        email: s.user.email,
        username: s.user.username,
        nisn: s.nisn,
        nis: s.nis,
        jenisKelamin: s.jenisKelamin,
        kelasId: s.kelas?.id || null,
        kelasNama: s.kelas?.nama || null,
        jenjangNama: s.kelas?.jenjang?.nama || null,
        aktif: s.user.aktif,
        createdAt: s.user.createdAt,
        dataLengkap: true,
        orangTua: s.orangTua.map((ps) => ({
          id: ps.orangTua.id,
          userId: ps.orangTua.user.id,
          nama: ps.orangTua.user.nama,
          email: ps.orangTua.user.email,
          noHp: ps.orangTua.noHp,
        })),
      }
    })

    return {
      success: true,
      message: "Daftar siswa berhasil dimuat",
      data: {
        ...paginatedResult(formatted, total, {
          page,
          pageSize: pagination.pageSize,
          skip,
          take: pagination.take,
        }),
        diagnostics: {
          orphanUserSiswaCount,
          diterimaTanpaSiswaCount,
        },
      },
    }
  } catch (error: unknown) {
    console.error("[student-list] failed", error)
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memuat daftar siswa"),
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
 * - password: disinkronkan ke Supabase Auth
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
      where: { id: siswaUserId, deleted_at: null },
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
      mustChangePassword?: boolean
      lastPasswordChange?: Date
    } = {}

    if (newUsername) updateData.username = newUsername
    if (password) {
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
      message: toUserFriendlyError(error, "Gagal memperbarui akun siswa"),
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
        _count: {
          select: {
            siswa: { where: { deleted_at: null } },
          },
        },
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
      message: toUserFriendlyError(error, "Gagal memuat daftar kelas"),
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
      where: { id: siswaUserId, deleted_at: null },
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
      message: toUserFriendlyError(error, "Gagal menghapus siswa"),
    }
  }
}

// ========================================================
// 7. DAFTAR ORANG TUA (UNTUK MENAUTKAN KE SISWA)
// ========================================================

type OrangTuaTautanItem = {
  userId: string
  nama: string
  email: string
  noHp: string | null
  /** Jumlah anak yang sudah tertaut — membantu admin memilih akun yang benar. */
  jumlahAnak: number
}

/**
 * Daftar akun orang tua untuk dipilih saat menautkan siswa yang belum punya
 * relasi orang tua (kasus siswa hasil pemulihan insiden 2026-10-02).
 */
export async function getDaftarOrangTuaUntukTautan(options?: {
  search?: string
}): Promise<ActionResponse<OrangTuaTautanItem[]>> {
  try {
    await requireGuruAdmin()

    const search = options?.search?.trim()
    const where: Prisma.UserWhereInput = { role: Role.ORANG_TUA, deleted_at: null }
    if (search) {
      where.OR = [
        { nama: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ]
    }

    const rows = await prisma.user.findMany({
      where,
      select: {
        id: true,
        nama: true,
        email: true,
        orangTua: {
          select: {
            noHp: true,
            _count: {
              // Hitung hanya anak yang aktif (belum soft-deleted) — relasi
              // `siswa` di OrangTua adalah ParentStudent, jadi filter soft-delete
              // dilakukan lewat relasi siswa-nya.
              select: {
                siswa: { where: { siswa: { deleted_at: null } } },
              },
            },
          },
        },
      },
      orderBy: { nama: "asc" },
      take: 200,
    })

    const formatted: OrangTuaTautanItem[] = rows.map((u) => ({
      userId: u.id,
      nama: u.nama,
      email: u.email,
      noHp: u.orangTua?.noHp ?? null,
      jumlahAnak: u.orangTua?._count.siswa ?? 0,
    }))

    return {
      success: true,
      message: `Daftar orang tua berhasil dimuat (${formatted.length} akun)`,
      data: formatted,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memuat daftar orang tua"),
    }
  }
}

// ========================================================
// 8. TAUTKAN ORANG TUA KE SISWA
// ========================================================

type TautkanOrangTuaResult = {
  siswaUserId: string
  orangTuaUserId: string
  /** true bila relasi sudah ada sebelumnya (idempotent, tidak diduplikasi). */
  sudahTertaut: boolean
}

/**
 * Menautkan akun orang tua ke siswa lewat relasi `parent_students`.
 *
 * Dipakai admin untuk melengkapi siswa yang relasi orang tuanya hilang saat
 * insiden wipe 2026-10-02. ATURAN:
 *   - Hanya INSERT relasi — tidak ada data yang diubah/dihapus.
 *   - Idempotent: pasangan yang sudah ada tidak dibuat ulang.
 *   - Row `orang_tuas` dibuat bila profil orang tua belum ada (insert saja).
 */
export async function tautkanOrangTuaSiswa(
  siswaUserId: string,
  orangTuaUserId: string,
): Promise<ActionResponse<TautkanOrangTuaResult>> {
  try {
    await requireGuruAdmin()

    if (!siswaUserId || !orangTuaUserId) {
      return { success: false, message: "Pilih siswa dan orang tua yang akan ditautkan" }
    }
    if (siswaUserId === orangTuaUserId) {
      return { success: false, message: "Siswa dan orang tua tidak boleh akun yang sama" }
    }

    const siswaUser = await prisma.user.findFirst({
      where: { id: siswaUserId, role: Role.SISWA, deleted_at: null },
      include: { siswa: true },
    })
    if (!siswaUser) {
      return { success: false, message: "Akun siswa tidak ditemukan" }
    }
    if (!siswaUser.siswa || siswaUser.siswa.deleted_at) {
      return { success: false, message: "Data siswa tidak ditemukan" }
    }

    const ortuUser = await prisma.user.findFirst({
      where: { id: orangTuaUserId, role: Role.ORANG_TUA, deleted_at: null },
      include: { orangTua: true },
    })
    if (!ortuUser) {
      return { success: false, message: "Akun orang tua tidak ditemukan" }
    }

    const existing = await prisma.parentStudent.findUnique({
      where: {
        orangTuaId_siswaId: {
          orangTuaId: ortuUser.orangTua?.id ?? "__belum-ada__",
          siswaId: siswaUser.siswa.id,
        },
      },
    })
    if (existing) {
      return {
        success: true,
        message: `Orang tua "${ortuUser.nama}" sudah tertaut dengan siswa "${siswaUser.nama}".`,
        data: {
          siswaUserId,
          orangTuaUserId,
          sudahTertaut: true,
        },
      }
    }

    // Profil orang tua belum ada (akun yatim) → buat row-nya (INSERT saja).
    const orangTuaRecord =
      ortuUser.orangTua ??
      (await prisma.orangTua.create({
        data: { userId: ortuUser.id, createdAt: ortuUser.createdAt },
      }))

    await prisma.parentStudent.create({
      data: {
        orangTuaId: orangTuaRecord.id,
        siswaId: siswaUser.siswa.id,
        hubungan: "Orang Tua",
      },
    })

    revalidatePath("/dashboard/siswa")
    return {
      success: true,
      message: `Orang tua "${ortuUser.nama}" berhasil ditautkan ke siswa "${siswaUser.nama}".`,
      data: { siswaUserId, orangTuaUserId, sudahTertaut: false },
    }
  } catch (error: unknown) {
    console.error("Error tautkan orang tua:", error)
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal menautkan orang tua ke siswa"),
    }
  }
}

// ========================================================
// 9. BUAT AKUN ORANG TUA BARU + TAUTKAN (dari dialog tautan)
// ========================================================

type OrangTuaBaruResult = {
  orangTuaUserId: string
  /** Hanya diisi bila akun auth BARU dibuat — tampilkan sekali ke admin. */
  passwordOrangTua?: string
  /** true bila email sudah punya akun ORANG_TUA (langsung dipakai, tanpa password baru). */
  akunSudahAda: boolean
}

/**
 * Membuat akun orang tua baru SEKALIGUS menautkannya ke siswa — dipanggil dari
 * dialog "Tautkan Orang Tua" bila wali siswa belum punya akun sama sekali
 * (kasus umum pada data hasil pemulihan insiden 2026-10-02).
 *
 * Aturan:
 *   - Tidak PERNAH menimpa data akun yang sudah ada — email yang sudah punya
 *     akun ORANG_TUA hanya ditautkan (akunSudahAda=true, tanpa password baru).
 *   - Hanya INSERT row user/orang_tua/parent_students.
 *   - Auth yang baru dibuat dibersihkan bila transaksi DB gagal (tidak ada
 *     akun yatim).
 *   - Password tidak dikirim via email — ditampilkan sekali ke admin, konsisten
 *     dengan alur reset password manual.
 */
export async function createOrangTuaBaruDanTautkan(
  siswaUserId: string,
  payload: TambahOrangTuaValues,
): Promise<ActionResponse<OrangTuaBaruResult>> {
  try {
    await requireGuruAdmin()

    if (!siswaUserId) {
      return { success: false, message: "Pilih siswa yang akan ditautkan" }
    }

    const validated = tambahOrangTuaSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data orang tua tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }
    const data = validated.data

    const siswaUser = await prisma.user.findFirst({
      where: { id: siswaUserId, role: Role.SISWA, deleted_at: null },
      include: { siswa: true },
    })
    if (!siswaUser) {
      return { success: false, message: "Akun siswa tidak ditemukan" }
    }
    if (!siswaUser.siswa || siswaUser.siswa.deleted_at) {
      return { success: false, message: "Data siswa tidak ditemukan" }
    }
    const siswaRowId = siswaUser.siswa.id

    const emailOrtu = data.email.toLowerCase().trim()

    // --- Jalur A: email sudah punya akun ORANG_TUA → tautkan saja ---
    const existingOrtu = await prisma.user.findFirst({
      where: { email: emailOrtu, role: Role.ORANG_TUA, deleted_at: null },
      include: { orangTua: true },
    })
    if (existingOrtu) {
      const orangTuaRecord =
        existingOrtu.orangTua ??
        (await prisma.orangTua.create({
          data: {
            userId: existingOrtu.id,
            noHp: data.noHp || null,
            alamat: data.alamat || null,
            createdAt: existingOrtu.createdAt,
          },
        }))

      const existingLink = await prisma.parentStudent.findUnique({
        where: {
          orangTuaId_siswaId: {
            orangTuaId: orangTuaRecord.id,
            siswaId: siswaUser.siswa.id,
          },
        },
      })
      if (existingLink) {
        return {
          success: true,
          message: `Akun orang tua "${existingOrtu.nama}" sudah tertaut dengan siswa "${siswaUser.nama}".`,
          data: { orangTuaUserId: existingOrtu.id, akunSudahAda: true },
        }
      }

      await prisma.parentStudent.create({
        data: {
          orangTuaId: orangTuaRecord.id,
          siswaId: siswaUser.siswa.id,
          hubungan: "Orang Tua",
        },
      })
      revalidatePath("/dashboard/siswa")
      return {
        success: true,
        message: `Email sudah punya akun orang tua — "${existingOrtu.nama}" langsung ditautkan ke siswa "${siswaUser.nama}".`,
        data: { orangTuaUserId: existingOrtu.id, akunSudahAda: true },
      }
    }

    // --- Jalur B: buat akun auth orang tua baru ---
    const supabaseAdmin = createSupabaseAdmin()
    const passwordOrangTua = generateSecurePassword(14)
    let authOrtuId: string
    let ortuAlreadyExisted = false
    let authBaruDibuat = false

    const { data: authOrtuData, error: authOrtuError } =
      await supabaseAdmin.auth.admin.createUser({
        email: emailOrtu,
        password: passwordOrangTua,
        email_confirm: true,
        user_metadata: { nama: data.nama, role: Role.ORANG_TUA },
      })

    if (authOrtuError) {
      if (authOrtuError.message.includes("already been registered")) {
        // Email sudah terdaftar di auth untuk role LAIN — reuse authId
        // (pola sama dengan createSiswaManual), tanpa password baru.
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
        console.error("Supabase auth error (orang tua baru):", authOrtuError)
        return { success: false, message: `Gagal membuat akun auth orang tua: ${authOrtuError.message}` }
      }
    } else {
      authOrtuId = authOrtuData.user!.id
      authBaruDibuat = true
    }

    let orangTuaUserId: string | undefined
    try {
      orangTuaUserId = await prisma.$transaction(
        async (tx) => {
          // Cek by authId dulu — mencegah duplikat bila email reuse ternyata
          // sudah punya record ORANG_TUA (race / multi-role).
          let userOrtu = await tx.user.findFirst({
            where: { authId: authOrtuId, role: Role.ORANG_TUA },
            include: { orangTua: true },
          })

          if (!userOrtu) {
            userOrtu = await tx.user.create({
              data: {
                email: emailOrtu,
                username: await deriveUniqueUsername(tx, emailOrtu),
                nama: data.nama,
                role: Role.ORANG_TUA,
                authId: authOrtuId,
                // Akun reuse (auth sudah punya role lain): tidak ada password
                // baru → tidak boleh dipaksa ganti password.
                mustChangePassword: !ortuAlreadyExisted,
                orangTua: {
                  create: {
                    noHp: data.noHp || null,
                    alamat: data.alamat || null,
                  },
                },
              },
              include: { orangTua: true },
            })
          }

          const orangTuaRecord =
            userOrtu.orangTua ??
            (await tx.orangTua.create({
              data: {
                userId: userOrtu.id,
                noHp: data.noHp || null,
                alamat: data.alamat || null,
              },
            }))

          const existingLink = await tx.parentStudent.findUnique({
            where: {
              orangTuaId_siswaId: {
                orangTuaId: orangTuaRecord.id,
                siswaId: siswaRowId,
              },
            },
          })
          if (!existingLink) {
            await tx.parentStudent.create({
              data: {
                orangTuaId: orangTuaRecord.id,
                siswaId: siswaRowId,
                hubungan: "Orang Tua",
              },
            })
          }

          return userOrtu.id
        },
        { timeout: 15000, maxWait: 5000 },
      )
    } catch (txError) {
      console.error("Prisma transaction error (orang tua baru), membersihkan auth...", txError)
      if (authBaruDibuat) {
        // Jangan tinggalkan akun auth yatim bila transaksi gagal.
        try {
          await supabaseAdmin.auth.admin.deleteUser(authOrtuId)
        } catch (cleanupError) {
          console.error("Gagal membersihkan auth orang tua baru:", cleanupError)
        }
      }
      throw txError
    }

    revalidatePath("/dashboard/siswa")
    if (!orangTuaUserId) {
      return {
        success: false,
        message: "Gagal membuat akun orang tua: ID akun tidak ditemukan setelah transaksi.",
      }
    }

    return {
      success: true,
      message: `Akun orang tua "${data.nama}" berhasil dibuat dan ditautkan ke siswa "${siswaUser.nama}".`,
      data: {
        orangTuaUserId,
        // Password hanya untuk akun auth yang benar-benar baru dibuat.
        passwordOrangTua: authBaruDibuat && !ortuAlreadyExisted ? passwordOrangTua : undefined,
        akunSudahAda: ortuAlreadyExisted,
      },
    }
  } catch (error: unknown) {
    console.error("Error buat orang tua baru:", error)
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal membuat akun orang tua. Silakan coba lagi."),
    }
  }
}

// ========================================================
// 10. LENGKAPI / EDIT DATA SISWA (gender, kelas, NISN, NIS)
// ========================================================

type UpdateDataSiswaResult = {
  siswaUserId: string
}

/**
 * Admin melengkapi data riwayat siswa: jenis kelamin, kelas, NISN, NIS.
 *
 * Dibutuhkan untuk data hasil pemulihan insiden 2026-10-02 (gender/kelas/NISN
 * hilang → NULL). Sifatnya HANYA UPDATE satu row `siswas` — tidak ada row
 * lain yang disentuh, tidak ada delete. Field yang tidak dikirim tidak diubah.
 */
export async function updateDataSiswaManual(
  siswaUserId: string,
  payload: UpdateDataSiswaValues,
): Promise<ActionResponse<UpdateDataSiswaResult>> {
  try {
    await requireGuruAdmin()

    if (!siswaUserId) {
      return { success: false, message: "ID siswa tidak valid" }
    }

    const validated = updateDataSiswaSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data siswa tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }
    const data = validated.data

    const siswaUser = await prisma.user.findFirst({
      where: { id: siswaUserId, role: Role.SISWA, deleted_at: null },
      include: { siswa: true },
    })
    if (!siswaUser) {
      return { success: false, message: "Akun siswa tidak ditemukan" }
    }
    if (!siswaUser.siswa || siswaUser.siswa.deleted_at) {
      return { success: false, message: "Data siswa tidak ditemukan" }
    }
    const siswaRow = siswaUser.siswa

    // Field yang tidak dikirim dikirim TIDAK DIUBAH (update parsial aman);
    // string kosong = sengaja dikosongkan admin.
    const jenisKelamin = data.jenisKelamin
    const kelasId =
      data.kelasId !== undefined ? data.kelasId.trim() || null : siswaRow.kelasId
    const nisn = data.nisn !== undefined ? data.nisn.trim() || null : siswaRow.nisn
    const nis = data.nis !== undefined ? data.nis.trim() || null : siswaRow.nis

    // ✅ Kecocokan gender dengan kelas tujuan (paritas createSiswaManual)
    if (kelasId) {
      const kelas = await prisma.kelas.findUnique({
        where: { id: kelasId },
        select: { id: true, nama: true, jenisKelamin: true },
      })
      if (!kelas) {
        return { success: false, message: "Kelas tujuan tidak ditemukan" }
      }
      if (!siswaCocokKelas(jenisKelamin, kelas.jenisKelamin)) {
        const labelKelas = kelas.jenisKelamin === "LAKI_LAKI" ? "Ikhwan" : "Akhwat"
        return {
          success: false,
          message: `Kelas "${kelas.nama}" adalah kelas khusus ${labelKelas} dan tidak cocok untuk siswa yang berjenis kelamin ${jenisKelamin === "LAKI_LAKI" ? "laki-laki" : "perempuan"}.`,
        }
      }
    }

    // ✅ Unik NISN / NIS — dicek proaktif agar error P2002 tidak bocor ke layar.
    if (nisn && nisn !== siswaRow.nisn) {
      const [nisnSiswa, nisnPendaftaran] = await Promise.all([
        prisma.siswa.findUnique({
          where: { nisn },
          select: { id: true, user: { select: { nama: true } } },
        }),
        prisma.pendaftaran.findFirst({
          where: {
            nisn,
            status: {
              in: [
                StatusPendaftaran.MENUNGGU_PEMBAYARAN,
                StatusPendaftaran.MENUNGGU_VERIFIKASI,
              ],
            },
          },
          select: { nomorPendaftaran: true, namaLengkap: true },
        }),
      ])
      if (nisnSiswa && nisnSiswa.id !== siswaRow.id) {
        return {
          success: false,
          message: `NISN "${nisn}" sudah terdaftar atas nama ${nisnSiswa.user.nama}.`,
        }
      }
      if (nisnPendaftaran) {
        return {
          success: false,
          message: `NISN "${nisn}" sudah dipakai pendaftaran lain (Nomor: ${nisnPendaftaran.nomorPendaftaran}, atas nama ${nisnPendaftaran.namaLengkap}).`,
        }
      }
    }
    if (nis && nis !== siswaRow.nis) {
      const nisDipakai = await prisma.siswa.findUnique({
        where: { nis },
        select: { id: true, user: { select: { nama: true } } },
      })
      if (nisDipakai && nisDipakai.id !== siswaRow.id) {
        return {
          success: false,
          message: `NIS "${nis}" sudah terdaftar atas nama ${nisDipakai.user.nama}.`,
        }
      }
    }

    await prisma.siswa.update({
      where: { id: siswaRow.id },
      data: { jenisKelamin, kelasId, nisn, nis },
    })

    revalidatePath("/dashboard/siswa")
    return {
      success: true,
      message: `Data siswa "${siswaUser.nama}" berhasil diperbarui.`,
      data: { siswaUserId },
    }
  } catch (error: unknown) {
    console.error("Error update data siswa:", error)
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memperbarui data siswa"),
    }
  }
}
