// src/actions/verifikasi.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuru } from "@/lib/auth"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { getSignedUrl } from "@/lib/storage"
import { generateSecurePassword } from "@/lib/password"
import { sendEmail, buildKredensialEmail } from "@/lib/email"
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
          buktiTransfer: { orderBy: { waktuUpload: "desc" } },
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
        buktiTransfer: { orderBy: { waktuUpload: "desc" } },
        diverifikasiOleh: true,
      },
    })

    if (!pendaftaran) {
      return { success: false, message: "Data pendaftaran tidak ditemukan" }
    }

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
// 2. VERIFIKASI PENDAFTARAN — FIXED: Random Password + Email
// ========================================================

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
        buktiTransfer: { orderBy: { waktuUpload: "desc" }, take: 1 },
      },
    })

    if (!pendaftaran) {
      return { success: false, message: "Data pendaftaran tidak ditemukan" }
    }

    const latestBuktiId = pendaftaran.buktiTransfer[0]?.id

    // ==========================================
    // SKENARIO A: DITOLAK
    // ==========================================
    if (status === "DITOLAK") {
      if (!alasanPenolakan) {
        return {
          success: false,
          message: "Alasan penolakan wajib diisi jika menolak pendaftaran",
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.pendaftaran.update({
          where: { id: pendaftaranId },
          data: {
            status: StatusPendaftaran.DITOLAK,
            catatanAdmin: catatanAdmin || null,
            alasanPenolakan,
            diverifikasiOlehId: guruUser.id,
            waktuVerifikasi: new Date(),
          },
        })

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
        message: `Pendaftaran ${pendaftaran.nomorPendaftaran} telah DITOLAK.`,
      }
    }

    // ==========================================
    // SKENARIO B: DITERIMA — RANDOM PASSWORD + EMAIL
    // ==========================================
    if (status === "DITERIMA") {
      const supabaseAdmin = createSupabaseAdmin()

      // ✅ FIX: Generate password RANDOM, bukan dari nomor pendaftaran
      const passwordOrangTua = generateSecurePassword(14)
      const passwordSiswa = generateSecurePassword(14)

      const emailOrtu = pendaftaran.emailOrangTua.toLowerCase().trim()
      const cleanNomor = pendaftaran.nomorPendaftaran.toLowerCase().replace(/[^a-z0-9]/g, "")
      const emailSiswa = `siswa.${cleanNomor}@sekolah.internal`

      // Buat User Supabase Auth untuk Orang Tua
      let authOrtuId: string
      const { data: authOrtuData, error: authOrtuError } =
        await supabaseAdmin.auth.admin.createUser({
          email: emailOrtu,
          password: passwordOrangTua,
          email_confirm: true,
          user_metadata: {
            nama: pendaftaran.namaOrangTua,
            role: Role.ORANG_TUA,
          },
        })

      if (authOrtuError) {
        if (authOrtuError.message.includes("already been registered")) {
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
          const matched = existingUsers.users.find((u) => u.email === emailOrtu)
          if (!matched) throw new Error("Gagal mengambil akun auth orang tua")
          authOrtuId = matched.id
        } else {
          throw new Error(`Gagal membuat akun auth orang tua: ${authOrtuError.message}`)
        }
      } else {
        authOrtuId = authOrtuData.user.id
      }

      // Buat User Supabase Auth untuk Siswa
      const { data: authSiswaData, error: authSiswaError } =
        await supabaseAdmin.auth.admin.createUser({
          email: emailSiswa,
          password: passwordSiswa,
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

      // Prisma Transaction: buat semua record + set mustChangePassword = true
      await prisma.$transaction(async (tx) => {
        let userOrtu = await tx.user.findUnique({ where: { email: emailOrtu } })

        if (!userOrtu) {
          userOrtu = await tx.user.create({
            data: {
              email: emailOrtu,
              nama: pendaftaran.namaOrangTua,
              role: Role.ORANG_TUA,
              authId: authOrtuId,
              mustChangePassword: true, // ✅ FIX: Paksa ganti password saat login pertama
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

        const userSiswa = await tx.user.create({
          data: {
            email: emailSiswa,
            nama: pendaftaran.namaLengkap,
            role: Role.SISWA,
            authId: authSiswaId,
            mustChangePassword: true, // ✅ FIX: Paksa ganti password saat login pertama
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

        if (orangTuaRecord && siswaRecord) {
          await tx.parentStudent.create({
            data: {
              orangTuaId: orangTuaRecord.id,
              siswaId: siswaRecord.id,
              hubungan: "Orang Tua",
            },
          })
        }

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

      // ✅ FIX: Kirim kredensial via EMAIL, bukan ditampilkan di UI/response
      await sendEmail({
        to: emailOrtu,
        subject: `Pendaftaran Diterima — ${pendaftaran.nomorPendaftaran}`,
        html: buildKredensialEmail({
          namaOrangTua: pendaftaran.namaOrangTua,
          emailOrangTua: emailOrtu,
          passwordOrangTua: passwordOrangTua,
          namaSiswa: pendaftaran.namaLengkap,
          emailSiswa: emailSiswa,
          passwordSiswa: passwordSiswa,
          nomorPendaftaran: pendaftaran.nomorPendaftaran,
        }),
      })

      revalidatePath("/dashboard/pendaftaran")
      return {
        success: true,
        message: `Pendaftaran ${pendaftaran.nomorPendaftaran} DITERIMA. Kredensial login telah dikirim ke email ${emailOrtu}.`,
      }
    }

    return { success: false, message: "Status verifikasi tidak dikenali" }
  } catch (error: any) {
    console.error("Error verifikasiPendaftaran:", error)
    return {
      success: false,
      message: error.message || "Gagal memproses verifikasi pendaftaran",
    }
  }
}