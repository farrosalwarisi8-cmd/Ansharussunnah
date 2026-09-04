// src/actions/verifikasi.ts

"use server"

import prisma from "@/lib/prisma"
import { requireGuru } from "@/lib/auth"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { getSignedUrl } from "@/lib/storage"
import { generateSecurePassword } from "@/lib/password"
import { sendEmail, buildKredensialEmail, buildKredensialEmailAnakKedua } from "@/lib/email"
import {
  verifikasiPendaftaranSchema,
  type VerifikasiPendaftaranValues,
} from "@/lib/validations/pendaftaran"
import type { ActionResponse, PendaftaranWithRelations } from "@/types"
import { Prisma, StatusPendaftaran, StatusVerifikasiBukti, Role } from "@prisma/client"
import { revalidatePath } from "next/cache"

export async function getPendaftaranList(options?: {
  status?: StatusPendaftaran
  search?: string
  limit?: number
  page?: number
  sortBy?: "newest" | "oldest"
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

    const whereCondition: Record<string, unknown> = {}

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

    const sortDirection = options?.sortBy === "oldest" ? "asc" : "desc"

    const [items, total] = await Promise.all([
      prisma.pendaftaran.findMany({
        where: whereCondition,
        orderBy: { createdAt: sortDirection },
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
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat data pendaftaran",
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
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memuat detail pendaftaran",
    }
  }
}

// Helper untuk menghapus user Supabase Auth jika transaction gagal
async function cleanupAuthUsers(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  authIds: string[]
): Promise<void> {
  for (const authId of authIds) {
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(authId)
      if (error) {
        console.error(`⚠️ Cleanup Error (Auth ID: ${authId}): ${error.message}`)
      } else {
        console.log(`✅ Cleanup Sukses (Auth ID: ${authId})`)
      }
    } catch (cleanupErr) {
      console.error(`⚠️ Exception saat membersihkan Auth ID: ${authId}`, cleanupErr)
    }
  }
}

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

    // Guard transisi status: hanya pendaftaran yang masih MENUNGGU_VERIFIKASI
    // boleh diverifikasi (diterima/ditolak). Mencegah verifikasi ganda yang
    // bisa membuat akun yatim/berkontradiksi dengan status record.
    if (pendaftaran.status !== StatusPendaftaran.MENUNGGU_VERIFIKASI) {
      return {
        success: false,
        message: `Pendaftaran ${pendaftaran.nomorPendaftaran} sudah berstatus ${pendaftaran.status} dan tidak dapat diverifikasi lagi.`,
      }
    }

    const latestBuktiId = pendaftaran.buktiTransfer[0]?.id

    // --- CASE A: PENDAFTARAN DITOLAK ---
    if (status === "DITOLAK") {
      if (!alasanPenolakan) {
        return {
          success: false,
          message: "Alasan penolakan wajib diisi jika menolak pendaftaran",
        }
      }

      await prisma.$transaction(
        async (tx) => {
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
        },
        { timeout: 10000, maxWait: 5000 }
      )

      revalidatePath("/dashboard/pendaftaran")
      return {
        success: true,
        message: `Pendaftaran ${pendaftaran.nomorPendaftaran} telah DITOLAK.`,
      }
    }

    // --- CASE B: PENDAFTARAN DITERIMA ---
    if (status === "DITERIMA") {
      const supabaseAdmin = createSupabaseAdmin()

      // ✅ Validasi kapasitas kelas sebelum menerima pendaftaran
      if (pendaftaran.kelasTujuanId) {
        const kelas = await prisma.kelas.findUnique({
          where: { id: pendaftaran.kelasTujuanId },
          include: { _count: { select: { siswa: true } } },
        })
        if (kelas && kelas.kapasitas > 0 && kelas._count.siswa >= kelas.kapasitas) {
          return {
            success: false,
            message: `Kelas "${kelas.nama}" sudah penuh (${kelas._count.siswa}/${kelas.kapasitas}). Pilih kelas lain sebelum menerima pendaftaran.`,
          }
        }
      }

      // Amankan credentials secara random
      const passwordOrangTua = generateSecurePassword(14)
      const passwordSiswa = generateSecurePassword(14)

      const emailOrtu = pendaftaran.emailOrangTua.toLowerCase().trim()
      const cleanNomor = pendaftaran.nomorPendaftaran.toLowerCase().replace(/[^a-z0-9]/g, "")
      const emailSiswa = `siswa.${cleanNomor}@sekolah.internal`

      const newlyCreatedAuthIds: string[] = []
      let authOrtuId: string
      let ortuAlreadyExisted = false

      // Create Supabase Auth Orang Tua
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
          // Paginate dengan perPage besar agar lookup tidak terbatas pada 50 user
          // pertama (listUsers default 50). Email orang tua bisa berada di halaman berikutnya.
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({
            perPage: 1000,
          })
          const matched = existingUsers.users.find((u) => u.email === emailOrtu)
          if (!matched) throw new Error("Gagal memetakan akun auth orang tua")
          authOrtuId = matched.id
          ortuAlreadyExisted = true
        } else {
          throw new Error(`Gagal membuat akun auth orang tua: ${authOrtuError.message}`)
        }
      } else {
        authOrtuId = authOrtuData.user.id
        if (!ortuAlreadyExisted) newlyCreatedAuthIds.push(authOrtuId)
      }

      // Create Supabase Auth Siswa
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
        await cleanupAuthUsers(supabaseAdmin, newlyCreatedAuthIds)
        throw new Error(`Gagal membuat akun auth siswa: ${authSiswaError.message}`)
      }

      const authSiswaId = authSiswaData.user.id
      newlyCreatedAuthIds.push(authSiswaId)

      // ✅ Prisma Transaction with strict rollback cleanup
      try {
        await prisma.$transaction(
          async (tx) => {
            // Find existing user by authId + role first, then by email as fallback
          // (handles cases where authId differs but email matches — e.g. parent
          // re-registers with a new Supabase auth but the DB still has the old record)
          let userOrtu = await tx.user.findFirst({
            where: { authId: authOrtuId, role: Role.ORANG_TUA },
          })

          if (!userOrtu) {
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
            const existingByEmail = await tx.user.findFirst({
              where: { email: emailOrtu },
            })
            if (existingByEmail) {
              userOrtu = existingByEmail
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
                  nama: pendaftaran.namaOrangTua,
                  role: Role.ORANG_TUA,
                  authId: authOrtuId,
                  mustChangePassword: true,
                  aktif: true,
                  orangTua: {
                    create: {
                      noHp: pendaftaran.noHpOrangTua,
                      alamat: pendaftaran.alamatOrangTua || pendaftaran.alamatSiswa,
                    },
                  },
                },
              })
            } catch (err) {
              if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
                // Race condition: proses approve lain (misal untuk anak kedua dari orang tua
                // yang sama) berhasil membuat user ini duluan. Ambil yang sudah ada, jangan gagal.
                userOrtu = await tx.user.findFirstOrThrow({ where: { email: emailOrtu } })
              } else {
                throw err
              }
            }
          } else if (userOrtu.aktif === false) {
            // Reaktivasi akun orang tua yang pernah dinonaktifkan (orang tua dengan
            // anak kedua+ yang sebelumnya dia nonaktifkan / record lama).
            await tx.user.update({
              where: { id: userOrtu.id },
              data: { aktif: true },
            })
          }

          const orangTuaRecord = await tx.orangTua.findUnique({
            where: { userId: userOrtu.id },
          })

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
            }
          }

          if (!userSiswa) {
            // Re-check kapasitas kelas DI DALAM transaction untuk meminimalkan
            // race window (TOCTOU) — pengecekan pertama di atas bisa melewati
            // jika dua approval berjalan bersamaan.
            if (pendaftaran.kelasTujuanId) {
              const kelasTx = await tx.kelas.findUnique({
                where: { id: pendaftaran.kelasTujuanId },
                include: { _count: { select: { siswa: true } } },
              })
              if (
                kelasTx &&
                kelasTx.kapasitas > 0 &&
                kelasTx._count.siswa >= kelasTx.kapasitas
              ) {
                throw new Error(
                  `Kelas "${kelasTx.nama}" sudah penuh (${kelasTx._count.siswa}/${kelasTx.kapasitas}).`
                )
              }
            }
          }

          if (!userSiswa) {
            try {
              userSiswa = await tx.user.create({
                data: {
                  email: emailSiswa,
                  nama: pendaftaran.namaLengkap,
                  role: Role.SISWA,
                  authId: authSiswaId,
                  mustChangePassword: true,
                  siswa: {
                    create: {
                    nisn: pendaftaran.nisn || null,
                    agama: pendaftaran.agama || null,
                    tempatLahir: pendaftaran.tempatLahir,
                    tanggalLahir: pendaftaran.tanggalLahir,
                    jenisKelamin: pendaftaran.jenisKelamin,
                    alamat: pendaftaran.alamatSiswa,
                    noHpSiswa: pendaftaran.noHpSiswa || null,
                    namaAyahKandung: pendaftaran.namaAyahKandung || null,
                    statusAyahKandung: pendaftaran.statusAyahKandung || null,
                    nikAyah: pendaftaran.nikAyah || null,
                    namaIbuKandung: pendaftaran.namaIbuKandung || null,
                    statusIbuKandung: pendaftaran.statusIbuKandung || null,
                    nikIbu: pendaftaran.nikIbu || null,
                    statusWali: pendaftaran.statusWali || null,
                    namaWali: pendaftaran.namaWali || null,
                    kewarganegaraan: pendaftaran.kewarganegaraan || "WNI",
                    kitas: pendaftaran.kitas || null,
                    asalNegara: pendaftaran.asalNegara || null,
                    kelasId: pendaftaran.kelasTujuanId || null,
                    pendaftaranId: pendaftaran.id,
                  },
                },
              },
            })
            } catch (err) {
              if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
                // Race condition: proses approve lain (misal dari pendaftaran berbeda)
                // berhasil membuat user siswa ini duluan. Ambil yang sudah ada.
                userSiswa = await tx.user.findFirstOrThrow({ where: { email: emailSiswa } })
              } else {
                throw err
              }
            }
          }

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
          },
          { timeout: 15000, maxWait: 5000 }
        )
      } catch (txError) {
        console.error("Prisma transaction error, rolling back Supabase Users...", txError)
        await cleanupAuthUsers(supabaseAdmin, newlyCreatedAuthIds)
        throw txError
      }

      // Kirim Credentials email secure
      await sendEmail({
        to: emailOrtu,
        subject: ortuAlreadyExisted
          ? `Santri Baru Diterima — ${pendaftaran.nomorPendaftaran}`
          : `Pendaftaran Disetujui — ${pendaftaran.nomorPendaftaran}`,
        html: ortuAlreadyExisted
          ? buildKredensialEmailAnakKedua({
              namaOrangTua: pendaftaran.namaOrangTua,
              emailOrangTua: emailOrtu,
              namaSiswa: pendaftaran.namaLengkap,
              emailSiswa,
              passwordSiswa,
              nomorPendaftaran: pendaftaran.nomorPendaftaran,
            })
          : buildKredensialEmail({
              namaOrangTua: pendaftaran.namaOrangTua,
              emailOrangTua: emailOrtu,
              passwordOrangTua,
              namaSiswa: pendaftaran.namaLengkap,
              emailSiswa,
              passwordSiswa,
              nomorPendaftaran: pendaftaran.nomorPendaftaran,
            }),
      })

      revalidatePath("/dashboard/pendaftaran")
      return {
        success: true,
        message: `Pendaftaran ${pendaftaran.nomorPendaftaran} DITERIMA. Akun login telah dikirimkan ke ${emailOrtu}.`,
      }
    }

    return { success: false, message: "Status verifikasi tidak dikenali" }
  } catch (error: unknown) {
    console.error("Error verifikasiPendaftaran:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal memproses verifikasi pendaftaran",
    }
  }
}