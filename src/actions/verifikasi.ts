// src/actions/verifikasi.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuru } from "@/lib/auth"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { getSignedUrl } from "@/lib/storage"
import {
  verifikasiPendaftaranSchema,
  type VerifikasiPendaftaranValues,
} from "@/lib/validations/pendaftaran"
import type { ActionResponse, PendaftaranWithRelations } from "@/types"
import { StatusPendaftaran, StatusVerifikasiBukti, Role } from "@prisma/client"
import { revalidatePath } from "next/cache"

// ========================================================
// 1. GET DATA PENDAFTARAN (DASHBOARD GURU)
// ========================================================

/**
 * Mengambil daftar pendaftaran untuk dashboard admin dengan filter status & search
 */
export async function getPendaftaranList(options?: {
  status?: StatusPendaftaran
  search?: string
  limit?: number
  page?: number
}): Promise<
  ActionResponse<{
    items: PendaftaranWithRelations[]
    total: number
    page: number
    totalPages: number
  }>
> {
  try {
    await requireGuru()

    const page = options?.page || 1
    const limit = options?.limit || 10
    const skip = (page - 1) * limit

    const whereCondition: any = {}

    if (options?.status) {
      whereCondition.status = options.status
    }

    if (options?.search) {
      whereCondition.OR = [
        { nomorPendaftaran: { contains: options.search, mode: "insensitive" } },
        { namaLengkap: { contains: options.search, mode: "insensitive" } },
        { namaOrangTua: { contains: options.search, mode: "insensitive" } },
        { emailOrangTua: { contains: options.search, mode: "insensitive" } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.pendaftaran.findMany({
        where: whereCondition,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          jenjangTujuan: true,
          kelasTujuan: true,
          buktiTransfer: {
            orderBy: { waktuUpload: "desc" },
          },
          diverifikasiOleh: true,
        },
      }),
      prisma.pendaftaran.count({ where: whereCondition }),
    ])

    return {
      success: true,
      message: "Data pendaftaran berhasil diambil",
      data: {
        items: items as PendaftaranWithRelations[],
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal memuat data pendaftaran",
    }
  }
}

/**
 * Mengambil detail satu pendaftaran lengkap dengan Signed URL untuk melihat file private
 */
export async function getPendaftaranDetail(
  pendaftaranId: string
): Promise<
  ActionResponse<{
    pendaftaran: PendaftaranWithRelations
    signedUrls: {
      kartuKeluarga?: string | null
      akteLahir?: string | null
      foto?: string | null
      buktiTransfer: Array<{ id: string; url: string | null }>
    }
  }>
> {
  try {
    await requireGuru()

    const pendaftaran = await prisma.pendaftaran.findUnique({
      where: { id: pendaftaranId },
      include: {
        jenjangTujuan: true,
        kelasTujuan: true,
        buktiTransfer: {
          orderBy: { waktuUpload: "desc" },
        },
        diverifikasiOleh: true,
      },
    })

    if (!pendaftaran) {
      return { success: false, message: "Data pendaftaran tidak ditemukan" }
    }

    // Generate Signed URLs untuk file-file private (berlaku 1 jam)
    const [signedKK, signedAkte, signedFoto, signedBukti] = await Promise.all([
      pendaftaran.dokKartuKeluarga
        ? getSignedUrl("dokumen-pendaftaran", pendaftaran.dokKartuKeluarga)
        : null,
      pendaftaran.dokAkteLahir
        ? getSignedUrl("dokumen-pendaftaran", pendaftaran.dokAkteLahir)
        : null,
      pendaftaran.dokFoto
        ? getSignedUrl("dokumen-pendaftaran", pendaftaran.dokFoto)
        : null,
      Promise.all(
        pendaftaran.buktiTransfer.map(async (bt) => ({
          id: bt.id,
          url: await getSignedUrl("bukti-transfer", bt.urlFile),
        }))
      ),
    ])

    return {
      success: true,
      message: "Detail pendaftaran berhasil diambil",
      data: {
        pendaftaran: pendaftaran as PendaftaranWithRelations,
        signedUrls: {
          kartuKeluarga: signedKK,
          akteLahir: signedAkte,
          foto: signedFoto,
          buktiTransfer: signedBukti,
        },
      },
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal memuat detail pendaftaran",
    }
  }
}

// ========================================================
// 2. SERVER ACTION: VERIFIKASI PENDAFTARAN & AUTO-CREATE USER
// ========================================================

/**
 * Verifikasi Pendaftaran:
 * - Jika DITOLAK: ubah status pendaftaran & bukti transfer menjadi DITOLAK + catat alasan penolakan.
 * - Jika DITERIMA:
 *   1. Buat User Orang Tua di Supabase Auth + Database.
 *   2. Buat User Siswa di Supabase Auth + Database.
 *   3. Buat relasi ParentStudent.
 *   4. Hubungkan Siswa ke Kelas tujuan.
 *   5. Update status pendaftaran menjadi DITERIMA.
 *   Semua dieksekusi dalam satu Prisma Transaction!
 */
export async function verifikasiPendaftaran(
  payload: VerifikasiPendaftaranValues
): Promise<ActionResponse> {
  try {
    const guruUser = await requireGuru()

    const validated = verifikasiPendaftaranSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data verifikasi tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { pendaftaranId, status, catatanAdmin, alasanPenolakan } = validated.data

    const pendaftaran = await prisma.pendaftaran.findUnique({
      where: { id: pendaftaranId },
      include: {
        buktiTransfer: {
          orderBy: { waktuUpload: "desc" },
          take: 1,
        },
      },
    })

    if (!pendaftaran) {
      return { success: false, message: "Data pendaftaran tidak ditemukan" }
    }

    const latestBuktiId = pendaftaran.buktiTransfer[0]?.id

    // ==========================================
    // SKENARIO A: PENDAFTARAN DITOLAK
    // ==========================================
    if (status === "DITOLAK") {
      if (!alasanPenolakan) {
        return {
          success: false,
          message: "Alasan penolakan wajib diisi jika menolak pendaftaran",
        }
      }

      await prisma.$transaction(async (tx) => {
        // Update pendaftaran
        await tx.pendaftaran.update({
          where: { id: pendaftaranId },
          data: {
            status: StatusPendaftaran.DITOLAK,
            catatanAdmin: catatanAdmin || null,
            alasanPenolakan: alasanPenolakan,
            diverifikasiOlehId: guruUser.id,
            waktuVerifikasi: new Date(),
          },
        })

        // Update status bukti transfer jika ada
        if (latestBuktiId) {
          await tx.buktiTransferPendaftaran.update({
            where: { id: latestBuktiId },
            data: {
              status: StatusVerifikasiBukti.DITOLAK,
              catatanVerifikasi: alasanPenolakan,
              diverifikasiOlehId: guruUser.id,
              waktuVerifikasi: new Date(),
            },
          })
        }
      })

      revalidatePath("/dashboard/pendaftaran")
      return {
        success: true,
        message: `Pendaftaran ${pendaftaran.nomorPendaftaran} telah DITOLAK. Calon siswa dapat mengunggah bukti transfer ulang.`,
      }
    }

    // ==========================================
    // SKENARIO B: PENDAFTARAN DITERIMA (APPROVE)
    // ==========================================
    if (status === "DITERIMA") {
      const supabaseAdmin = createSupabaseAdmin()

      // 1. Generate kredensial login otomatis
      // Email orang tua menggunakan email pendaftaran
      const emailOrtu = pendaftaran.emailOrangTua.toLowerCase().trim()
      const defaultPasswordOrtu = `Ortu@${pendaftaran.nomorPendaftaran.replace(/[^a-zA-Z0-9]/g, "")}`

      // Email siswa: jika tidak ada email, buat format internal `siswa.<nomor>@sekolah.internal`
      const cleanNomor = pendaftaran.nomorPendaftaran.toLowerCase().replace(/[^a-z0-9]/g, "")
      const emailSiswa = `siswa.${cleanNomor}@sekolah.internal`
      const defaultPasswordSiswa = `Siswa@${pendaftaran.nomorPendaftaran.replace(/[^a-zA-Z0-9]/g, "")}`

      // 2. Buat User Supabase Auth untuk Orang Tua
      let authOrtuId: string
      const { data: authOrtuData, error: authOrtuError } =
        await supabaseAdmin.auth.admin.createUser({
          email: emailOrtu,
          password: defaultPasswordOrtu,
          email_confirm: true,
          user_metadata: {
            nama: pendaftaran.namaOrangTua,
            role: Role.ORANG_TUA,
          },
        })

      if (authOrtuError) {
        // Jika user auth sudah ada sebelumnya, ambil user_id yang sudah ada
        if (authOrtuError.message.includes("already been registered")) {
          const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
          const matched = existingUser.users.find((u) => u.email === emailOrtu)
          if (!matched) throw new Error("Gagal mengambil akun auth orang tua")
          authOrtuId = matched.id
        } else {
          throw new Error(`Gagal membuat akun auth orang tua: ${authOrtuError.message}`)
        }
      } else {
        authOrtuId = authOrtuData.user.id
      }

      // 3. Buat User Supabase Auth untuk Siswa
      const { data: authSiswaData, error: authSiswaError } =
        await supabaseAdmin.auth.admin.createUser({
          email: emailSiswa,
          password: defaultPasswordSiswa,
          email_confirm: true,
          user_metadata: {
            nama: pendaftaran.namaLengkap,
            role: Role.SISWA,
          },
        })

      if (authSiswaError) {
        throw new Error(`Gagal membuat akun auth siswa: ${authSiswaError.message}`)
      }
      const authSiswaId = authSiswaData.user.id

      // 4. Eksekusi Transaction di Prisma
      await prisma.$transaction(async (tx) => {
        // A. Create/Find User & OrangTua
        let userOrtu = await tx.user.findUnique({
          where: { email: emailOrtu },
        })

        if (!userOrtu) {
          userOrtu = await tx.user.create({
            data: {
              email: emailOrtu,
              nama: pendaftaran.namaOrangTua,
              role: Role.ORANG_TUA,
              authId: authOrtuId,
              orangTua: {
                create: {
                  noHp: pendaftaran.noHpOrangTua,
                  alamat: pendaftaran.alamatOrangTua || pendaftaran.alamatSiswa,
                },
              },
            },
          })
        }

        const orangTuaRecord = await tx.orangTua.findUnique({
          where: { userId: userOrtu.id },
        })

        // B. Create User & Siswa
        const userSiswa = await tx.user.create({
          data: {
            email: emailSiswa,
            nama: pendaftaran.namaLengkap,
            role: Role.SISWA,
            authId: authSiswaId,
            siswa: {
              create: {
                nisn: pendaftaran.nisn || null,
                tempatLahir: pendaftaran.tempatLahir,
                tanggalLahir: pendaftaran.tanggalLahir,
                jenisKelamin: pendaftaran.jenisKelamin,
                alamat: pendaftaran.alamatSiswa,
                kelasId: pendaftaran.kelasTujuanId || null,
                pendaftaranId: pendaftaran.id,
              },
            },
          },
        })

        const siswaRecord = await tx.siswa.findUnique({
          where: { userId: userSiswa.id },
        })

        // C. Hubungkan Orang Tua dan Siswa (ParentStudent)
        if (orangTuaRecord && siswaRecord) {
          await tx.parentStudent.create({
            data: {
              orangTuaId: orangTuaRecord.id,
              siswaId: siswaRecord.id,
              hubungan: "Orang Tua",
            },
          })
        }

        // D. Update Status Bukti Transfer
        if (latestBuktiId) {
          await tx.buktiTransferPendaftaran.update({
            where: { id: latestBuktiId },
            data: {
              status: StatusVerifikasiBukti.DITERIMA,
              diverifikasiOlehId: guruUser.id,
              waktuVerifikasi: new Date(),
            },
          })
        }

        // E. Update Pendaftaran menjadi DITERIMA
        await tx.pendaftaran.update({
          where: { id: pendaftaranId },
          data: {
            status: StatusPendaftaran.DITERIMA,
            catatanAdmin: catatanAdmin || null,
            diverifikasiOlehId: guruUser.id,
            waktuVerifikasi: new Date(),
          },
        })
      })

      revalidatePath("/dashboard/pendaftaran")
      return {
        success: true,
        message: `Pendaftaran ${pendaftaran.nomorPendaftaran} BERHASIL DITERIMA. Akun Siswa & Orang Tua telah otomatis dibuat.`,
      }
    }

    return {
      success: false,
      message: "Status verifikasi tidak dikenali",
    }
  } catch (error: any) {
    console.error("Error verifikasiPendaftaran:", error)
    return {
      success: false,
      message: error.message || "Gagal memproses verifikasi pendaftaran",
    }
  }
}