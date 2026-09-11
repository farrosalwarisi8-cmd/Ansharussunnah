// src/actions/verifikasi.ts

"use server"

import prisma from "@/lib/prisma"
import { deriveUniqueUsername } from "@/lib/username"
import { siswaCocokKelas } from "@/lib/guru-kelas-gender"
import { requireGuruAdmin } from "@/lib/auth"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { getSignedUrl } from "@/lib/storage"
import { generateSecurePassword } from "@/lib/password"
import {
  sendEmail,
  buildKredensialEmail,
  buildKredensialEmailAnakKedua,
  buildPemberitahuanRoleBaruEmail,
} from "@/lib/email"
import {
  verifikasiPendaftaranSchema,
  type VerifikasiPendaftaranValues,
} from "@/lib/validations/pendaftaran"
import { toUserFriendlyError, AppError } from "@/lib/prisma-error"
import type { ActionResponse, PendaftaranWithRelations } from "@/types"
import { StatusPendaftaran, StatusVerifikasiBukti, Role } from "@prisma/client"
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
    await requireGuruAdmin()

    const page = options?.page || 1
    const limit = options?.limit || 10
    const skip = (page - 1) * limit

    const whereCondition: Record<string, unknown> = { deleted_at: null }

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
          jenjangTujuan: { include: { kelas: true } },
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
    console.error("Error getPendaftaranList:", error)
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memuat daftar pendaftaran. Silakan coba lagi atau hubungi admin."),
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
    await requireGuruAdmin()

    const pendaftaran = await prisma.pendaftaran.findUnique({
      where: { id: pendaftaranId, deleted_at: null },
      include: {
        jenjangTujuan: { include: { kelas: true } },
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
    console.error("Error getPendaftaranDetail:", error)
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memuat detail pendaftaran. Silakan coba lagi atau hubungi admin."),
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
    const guruUser = await requireGuruAdmin()

    const validated = verifikasiPendaftaranSchema.safeParse(payload)
    if (!validated.success) {
      return {
        success: false,
        message: "Data verifikasi tidak valid",
        errors: validated.error.flatten().fieldErrors,
      }
    }

    const { pendaftaranId, status, catatanAdmin, alasanPenolakan, kelasTujuanId } = validated.data

    const pendaftaran = await prisma.pendaftaran.findUnique({
      where: { id: pendaftaranId, deleted_at: null },
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

    // Kelas tujuan final: pakai override dari admin bila dikirim, selain itu
    // gunakan kelas tujuan yang dipilih pendaftar saat mendaftar.
    const finalKelasId = kelasTujuanId || pendaftaran.kelasTujuanId || null

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
      if (finalKelasId) {
        const kelas = await prisma.kelas.findUnique({
          where: { id: finalKelasId },
          include: { _count: { select: { siswa: true } } },
        })
        if (!kelas) {
          return {
            success: false,
            message: "Kelas tujuan tidak ditemukan. Pilih kelas yang tersedia sebelum menerima pendaftaran.",
          }
        }
        if (kelas.kapasitas > 0 && kelas._count.siswa >= kelas.kapasitas) {
          return {
            success: false,
            message: `Kelas "${kelas.nama}" sudah penuh (${kelas._count.siswa}/${kelas.kapasitas}). Pilih kelas lain sebelum menerima pendaftaran.`,
          }
        }

        // ✅ Validasi kecocokan gender pendaftar dengan kelas tujuan
        if (kelas && kelas.jenisKelamin && pendaftaran.jenisKelamin && kelas.jenisKelamin !== pendaftaran.jenisKelamin) {
          const labelKelas = kelas.jenisKelamin === "LAKI_LAKI" ? "Ikhwan" : "Akhwat"
          return {
            success: false,
            message: `Kelas "${kelas.nama}" adalah kelas khusus ${labelKelas} dan tidak sesuai dengan jenis kelamin pendaftar. Pilih kelas tujuan yang sesuai sebelum menerima.`,
          }
        }
      }

      // Amankan credentials secara random. Password ortu hanya digenerate bila
      // akun ortu benar-benar BARU akan dibuat. Jika email ortu sudah punya akun
      // (reuse authId), password lama tetap dipakai — TIDAK ada password ortu baru.
      let passwordOrangTua: string | undefined
      const passwordSiswa = generateSecurePassword(14)

      const emailOrtu = pendaftaran.emailOrangTua.toLowerCase().trim()
      const cleanNomor = pendaftaran.nomorPendaftaran.toLowerCase().replace(/[^a-z0-9]/g, "")
      const emailSiswa = `siswa.${cleanNomor}@sekolah.internal`

      const newlyCreatedAuthIds: string[] = []
      let authOrtuId: string
      let ortuAlreadyExisted = false
      let ortuRecordBaruDibuat = false

      // Create Supabase Auth Orang Tua
      passwordOrangTua = generateSecurePassword(14)
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
          // Akun reuse: password ortu "baru" yang digenerate tidak dipakai
          // kemana-mana (createUser gagal, akun lama tidak diubah).
          passwordOrangTua = undefined
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
            // ✅ Validasi NISN agar tidak duplikat dengan siswa yang SUDAH ADA
            // ATAU pendaftaran aktif lain. Kolom nisn di model Siswa bersifat
            // @unique — tanpa pengecekan proaktif ini, approve akan crash dengan
            // error mentah P2002 langsung ke layar admin. Kita cek lebih awal dan
            // beri pesan yang jelas. Satu NISN hanya boleh milik SATU calon siswa:
            // dicek juga terhadap pendaftaran aktif (MENUNGGU_PEMBAYARAN /
            // MENUNGGU_VERIFIKASI) lain, paritas dengan jalur pendaftaran online
            // & siswa manual.
            if (pendaftaran.nisn) {
              const [nisnSiswa, nisnPendaftaran] = await Promise.all([
                tx.siswa.findUnique({
                  where: { nisn: pendaftaran.nisn },
                  select: { id: true, user: { select: { nama: true, id: true } } },
                }),
                tx.pendaftaran.findFirst({
                  where: {
                    nisn: pendaftaran.nisn,
                    id: { not: pendaftaran.id },
                    status: {
                      in: [
                        StatusPendaftaran.MENUNGGU_PEMBAYARAN,
                        StatusPendaftaran.MENUNGGU_VERIFIKASI,
                      ],
                    },
                  },
                  select: { nomorPendaftaran: true, namaLengkap: true, status: true },
                }),
              ])
              if (nisnSiswa) {
                throw new AppError(
                  `NISN "${pendaftaran.nisn}" sudah terdaftar atas nama ${nisnSiswa.user.nama}. Mohon periksa kembali data pendaftaran ini sebelum melanjutkan.`
                )
              }
              if (nisnPendaftaran) {
                throw new AppError(
                  `NISN "${pendaftaran.nisn}" sudah digunakan pada pendaftaran lain (Nomor: ${nisnPendaftaran.nomorPendaftaran}, atas nama ${nisnPendaftaran.namaLengkap}) yang sedang ${nisnPendaftaran.status === StatusPendaftaran.MENUNGGU_VERIFIKASI ? "diverifikasi admin" : "menunggu pembayaran"}. Satu NISN hanya boleh untuk satu calon siswa. Mohon periksa kembali.`
                )
              }
            }

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

          // Jangan pernah mengambil/menimpa record user dengan role lain (misal
          // ADMIN_KEUANGAN/GURU) yang ber-email sama. Satu orang bisa punya
          // beberapa role, dan role ORANG_TUA harus punya record tersendiri agar
          // muncul di fitur "Ganti Akun" dan bisa login sebagai wali santri.
          if (!userOrtu) {
            userOrtu = await tx.user.create({
              data: {
                email: emailOrtu,
                username: await deriveUniqueUsername(tx, emailOrtu),
                nama: pendaftaran.namaOrangTua,
                role: Role.ORANG_TUA,
                authId: authOrtuId,
                // Akun reuse (email sudah punya akun di role lain): tidak ada
                // password baru → jangan paksa ganti password.
                ...(ortuAlreadyExisted
                  ? { mustChangePassword: false }
                  : { mustChangePassword: true }),
                aktif: true,
                orangTua: {
                  create: {
                    noHp: pendaftaran.noHpOrangTua,
                    alamat: pendaftaran.alamatOrangTua || pendaftaran.alamatSiswa,
                  },
                },
              },
            })
            if (ortuAlreadyExisted) {
              // Record ORANG_TUA ini BARU dibuat dari akun yang email-nya sudah
              // punya akun lain (reuse authId) → peran ORANG_TUA baru ditambahkan.
              ortuRecordBaruDibuat = true
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
            where: { userId: userOrtu.id, deleted_at: null },
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

          // Re-check kapasitas + gender kelas DI DALAM transaction untuk
          if (finalKelasId) {
            const kelasTx = await tx.kelas.findUnique({
              where: { id: finalKelasId },
              include: { _count: { select: { siswa: true } } },
            })
            if (!kelasTx) {
              throw new AppError("Kelas tujuan tidak ditemukan pada saat verifikasi.")
            }
            if (
              kelasTx &&
              kelasTx.kapasitas > 0 &&
              kelasTx._count.siswa >= kelasTx.kapasitas
            ) {
              throw new AppError(
                `Kelas "${kelasTx.nama}" sudah penuh (${kelasTx._count.siswa}/${kelasTx.kapasitas}).`
              )
            }
            if (kelasTx && !siswaCocokKelas(pendaftaran.jenisKelamin, kelasTx.jenisKelamin)) {
              throw new AppError(
                `Kelas "${kelasTx.nama}" adalah kelas khusus gender yang tidak sesuai dengan jenis kelamin pendaftar.`
              )
            }
          }

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
                      kelasId: finalKelasId,
                      pendaftaranId: pendaftaran.id,
                    },
                  },
                },
              })
            }
          }

          const siswaRecord = await tx.siswa.findUnique({
            where: { userId: userSiswa.id, deleted_at: null },
          })

          if (orangTuaRecord && siswaRecord) {
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
              kelasTujuanId: finalKelasId,
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

      // Kirim email kredensial / pemberitahuan.
      // - Akun ortu BARU (authId benar-benar baru): kirim kredensial lengkap
      //   (ortu + siswa) via buildKredensialEmail.
      // - Akun ortu SUDAH ADA (reuse authId): kirim kredensial SISWA via
      //   buildKredensialEmailAnakKedua — tanpa password ortu baru (tidak ada
      //   password ortu baru yang digenerate). Alur ini TIDAK diubah.
      // Jika peran ORANG_TUA benar-benar BARU ditambahkan ke akun yang sudah ada
      // (sebelumnya email ini hanya punya role lain, dan record ORANG_TUA baru
      // diciptakan), kirim juga pemberitahuan role baru — TANPA password.
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

      if (ortuAlreadyExisted && ortuRecordBaruDibuat) {
        await sendEmail({
          to: emailOrtu,
          subject: "Akun Orang Tua Baru Ditambahkan — Ansharussunnah",
          html: buildPemberitahuanRoleBaruEmail({
            nama: pendaftaran.namaOrangTua,
            email: emailOrtu,
            roleBaru: "Orang Tua",
          }),
        })
      }

      revalidatePath("/dashboard/pendaftaran")
      revalidatePath("/dashboard/siswa")
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
      message: toUserFriendlyError(error, "Terjadi kesalahan saat memproses verifikasi. Silakan coba lagi atau hubungi admin."),
    }
  }
}