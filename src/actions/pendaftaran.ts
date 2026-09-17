// src/actions/pendaftaran.ts

"use server"

import prisma from "@/lib/prisma"
import { generateNomorPendaftaran } from "@/lib/registration-number"
import { siswaCocokKelas } from "@/lib/guru-kelas-gender"
import { pendaftaranSchema } from "@/lib/validations/pendaftaran"
import { rateLimitAsync, getClientIpFromHeaders } from "@/lib/rate-limit"
import { toUserFriendlyError } from "@/lib/prisma-error"
import type { ActionResponse } from "@/types"
import { Prisma, StatusPendaftaran } from "@prisma/client"
import { nanoid } from "nanoid"

const MAX_RETRY = 5

// Segment folder di dalam bucket "dokumen-pendaftaran" (mis. "temp-<nanoid>").
const RE_DOKUMEN_SEGMENT = /^[A-Za-z0-9_-]{6,40}$/
// Nama file yang dihasilkan klien: nanoid + ekstensi yang diizinkan.
const RE_DOKUMEN_FILE = /^[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp|pdf)$/i

/**
 * KEAMANAN (M2): Path dokumen yang dikirim klien harus berbentuk persis hasil
 * upload form pendaftaran: dokumen-pendaftaran/pendaftaran/temp-<nanoid>/<file>.
 * Menolak URL eksternal, path bucket lain, path server (pendaftaran/<id>),
 * path traversal, atau format lain apa pun yang bukan milik flow pendaftaran.
 */
function isValidDokumenPath(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false
  if (/^https?:\/\//i.test(value)) return false
  if (value.includes("\\") || value.includes("..")) return false

  const parts = value.split("/")
  if (parts.length !== 4) return false
  const [, folderPendaftaran, tempSegment, filePart] = parts
  return (
    parts[0] === "dokumen-pendaftaran" &&
    folderPendaftaran === "pendaftaran" &&
    tempSegment.startsWith("temp-") &&
    RE_DOKUMEN_SEGMENT.test(tempSegment) &&
    RE_DOKUMEN_FILE.test(filePart)
  )
}

export async function createPendaftaran(
  formData: FormData
): Promise<ActionResponse<{ nomorPendaftaran: string; tokenAkses: string }>> {
  try {
    // ✅ Rate Limiting: 30 pendaftaran / 10 menit per IP
    // Batas per-IP dibuat longgar karena satu IP publik sering dipakai bersama
    // (WiFi sekolah/asrama/orang tua) dan musim PPDB bisa memunculkan gelombang
    // pendaftaran sah dari jaringan yang sama dalam waktu singkat. IP yang tidak
    // bisa ditentukan ("unknown") tidak di-rate-limit — lihat rateLimitAsync().
    const ip = await getClientIpFromHeaders()
    const limiter = await rateLimitAsync(`create-pendaftaran:${ip}`, {
      maxRequests: 30,
      windowMs: 10 * 60 * 1000,
    })

    if (!limiter.success) {
      return {
        success: false,
        message: "Terlalu banyak permintaan pendaftaran. Silakan coba lagi dalam 10 menit.",
      }
    }

    const rawData = {
      namaLengkap: formData.get("namaLengkap") as string,
      tempatLahir: formData.get("tempatLahir") as string,
      tanggalLahir: formData.get("tanggalLahir") as string,
      jenisKelamin: formData.get("jenisKelamin") as string,
      agama: (formData.get("agama") as string) || undefined,
      alamatSiswa: formData.get("alamatSiswa") as string,
      nisn: (formData.get("nisn") as string) || undefined,
      noHpSiswa: (formData.get("noHpSiswa") as string) || undefined,
      namaOrangTua: formData.get("namaOrangTua") as string,
      noHpOrangTua: formData.get("noHpOrangTua") as string,
      emailOrangTua: formData.get("emailOrangTua") as string,
      alamatOrangTua: (formData.get("alamatOrangTua") as string) || undefined,
      namaAyahKandung: (formData.get("namaAyahKandung") as string) || undefined,
      statusAyahKandung: (formData.get("statusAyahKandung") as string) || undefined,
      nikAyah: (formData.get("nikAyah") as string) || undefined,
      namaIbuKandung: (formData.get("namaIbuKandung") as string) || undefined,
      statusIbuKandung: (formData.get("statusIbuKandung") as string) || undefined,
      nikIbu: (formData.get("nikIbu") as string) || undefined,
      statusWali: (formData.get("statusWali") as string) || undefined,
      namaWali: (formData.get("namaWali") as string) || undefined,
      kewarganegaraan: (formData.get("kewarganegaraan") as string) || undefined,
      kitas: (formData.get("kitas") as string) || undefined,
      asalNegara: (formData.get("asalNegara") as string) || undefined,
      jenjangTujuanId: formData.get("jenjangTujuanId") as string,
      kelasTujuanId: (formData.get("kelasTujuanId") as string) || undefined,
    }

    const validation = pendaftaranSchema.safeParse(rawData)
    if (!validation.success) {
      const errors: Record<string, string[]> = {}
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as string
        if (!errors[field]) errors[field] = []
        errors[field].push(issue.message)
      })
      return {
        success: false,
        message: "Data pendaftaran tidak valid",
        errors,
      }
    }

    const data = validation.data

    const jenjang = await prisma.jenjang.findUnique({
      where: { id: data.jenjangTujuanId },
    })
    if (!jenjang) {
      return { success: false, message: "Jenjang tujuan tidak ditemukan" }
    }

    if (data.kelasTujuanId) {
      const kelas = await prisma.kelas.findFirst({
        where: { id: data.kelasTujuanId, jenjangId: data.jenjangTujuanId },
        include: { _count: { select: { siswa: true } } },
      })
      if (!kelas) {
        return {
          success: false,
          message: "Kelas tujuan tidak valid untuk jenjang yang dipilih",
        }
      }

      // ✅ Validasi kecocokan gender calon siswa dengan kelas tujuan
      if (!siswaCocokKelas(data.jenisKelamin, kelas.jenisKelamin)) {
        const labelKelas = kelas.jenisKelamin === "LAKI_LAKI" ? "Ikhwan" : "Akhwat"
        return {
          success: false,
          message: `Kelas "${kelas.nama}" adalah kelas khusus ${labelKelas} dan hanya dapat diisi oleh calon santri ${labelKelas}. Pilih kelas yang sesuai jenis kelamin.`,
        }
      }

      // ✅ Validasi kapasitas kelas
      if (kelas.kapasitas > 0 && kelas._count.siswa >= kelas.kapasitas) {
        return {
          success: false,
          message: `Kelas "${kelas.nama}" sudah penuh (${kelas._count.siswa}/${kelas.kapasitas})`,
        }
      }
    }

    // ✅ Cegah duplikasi pendaftaran aktif: satu email orang tua per jenjang
    // hanya boleh memiliki SATU pendaftaran yang belum final (MENUNGGU_PEMBAYARAN
    // / MENUNGGU_VERIFIKASI). Melindungi dari submit ganda/retry yang membuat
    // banyak nomor pendaftaran untuk anak yang sama. Pendaftaran yang sudah
    // DITERIMA/DITOLAK tidak memblokir karena alurnya sudah keluar dari antrean.
    const emailOrtu = data.emailOrangTua.toLowerCase().trim()
    const duplikatAktif = await prisma.pendaftaran.findFirst({
      where: {
        emailOrangTua: { equals: emailOrtu, mode: "insensitive" },
        jenjangTujuanId: data.jenjangTujuanId,
        deleted_at: null,
        status: {
          in: [StatusPendaftaran.MENUNGGU_PEMBAYARAN, StatusPendaftaran.MENUNGGU_VERIFIKASI],
        },
      },
      select: { nomorPendaftaran: true, status: true },
    })

    if (duplikatAktif) {
      const pesan =
        duplikatAktif.status === StatusPendaftaran.MENUNGGU_PEMBAYARAN
          ? `Sudah ada pendaftaran aktif untuk email ini yang menunggu pembayaran. Gunakan nomor pendaftaran yang diterima saat mendaftar untuk melanjutkan pembayaran dan upload bukti transfer.`
          : `Sudah ada pendaftaran aktif untuk email ini yang sedang diverifikasi admin. Gunakan nomor pendaftaran yang diterima saat mendaftar untuk mengecek status.`
      return { success: false, message: pesan }
    }

    // ✅ Validasi NISN: pastikan belum dipakai siswa yang sudah diterima ATAU
    // pendaftaran aktif lain. Kolom nisn di model Siswa @unique — tanpa cek ini,
    // error P2002 muncul mentah di layar (biasanya saat admin approve, tetapi
    // lebih baik dicek sejak awal agar calon pendaftar langsung tahu).
    // Satu NISN harus unik milik SATU siswa: tidak boleh ada dua pendaftaran
    // aktif (MENUNGGU_PEMBAYARAN/MENUNGGU_VERIFIKASI) yang memakai NISN sama.
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
          select: {
            id: true,
            nomorPendaftaran: true,
            status: true,
            namaLengkap: true,
          },
        }),
      ])

      if (nisnSiswa) {
        return {
          success: false,
          message: `NISN "${data.nisn}" sudah terdaftar atas nama santri lain. Mohon gunakan NISN yang benar atau hubungi admin sekolah.`,
        }
      }

      if (nisnPendaftaran) {
        return {
          success: false,
          message: `NISN "${data.nisn}" sudah digunakan pada pendaftaran aktif lain yang sedang ${
            nisnPendaftaran.status === StatusPendaftaran.MENUNGGU_VERIFIKASI
              ? "diverifikasi admin"
              : "menunggu pembayaran"
          }. Satu NISN hanya boleh untuk satu calon siswa. Mohon periksa kembali atau hubungi admin sekolah.`,
        }
      }
    }

    const dokKK = formData.get("dokKartuKeluarga") as string | null
    const dokAkte = formData.get("dokAkteLahir") as string | null
    const dokFoto = formData.get("dokFoto") as string | null
    const dokLainnyaRaw = formData.getAll("dokLainnya") as string[]
    const dokLainnya = dokLainnyaRaw.filter(Boolean)

    // KEAMANAN (M2): hanya izinkan path dokumen yang benar-benar dihasilkan
    // form pendaftaran (folder temp). Menolak path dari bucket/storage lain,
    // URL eksternal, atau alur lain — cegah record pendaftaran menunjuk ke
    // file di luar tempat yang seharusnya.
    const dokumenPaths = [dokKK, dokAkte, dokFoto, ...dokLainnya].filter(
      (p): p is string => !!p
    )
    for (const p of dokumenPaths) {
      if (!isValidDokumenPath(p)) {
        return {
          success: false,
          message: "File dokumen tidak valid. Silakan unggah ulang dokumen.",
        }
      }
    }
    if (dokLainnya.length > 3) {
      return {
        success: false,
        message: "Maksimal 3 dokumen tambahan yang dapat diunggah",
      }
    }

    const biayaPendaftaran = parseFloat(
      process.env.NEXT_PUBLIC_REGISTRATION_FEE || "500000"
    )

    let lastError: Error | null = null

    // ✅ Handle Race Condition dengan retry logic untuk record nomorPendaftaran unik
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        const nomorPendaftaran = await generateNomorPendaftaran()
        // Token akses rahasia: kredensial pemilik untuk upload dokumen/bukti
        // transfer. Hanya dikirim sekali ke klien pada saat pendaftaran dibuat.
        const tokenAkses = nanoid(32)

        const pendaftaran = await prisma.pendaftaran.create({
          data: {
            nomorPendaftaran,
            tokenAkses,
            namaLengkap: data.namaLengkap,
            tempatLahir: data.tempatLahir,
            tanggalLahir: new Date(data.tanggalLahir),
            jenisKelamin: data.jenisKelamin as "LAKI_LAKI" | "PEREMPUAN",
            agama: data.agama || null,
            alamatSiswa: data.alamatSiswa,
            nisn: data.nisn,
            noHpSiswa: data.noHpSiswa || null,
            namaOrangTua: data.namaOrangTua,
            noHpOrangTua: data.noHpOrangTua,
            emailOrangTua: data.emailOrangTua,
            alamatOrangTua: data.alamatOrangTua,
            namaAyahKandung: data.namaAyahKandung || null,
            statusAyahKandung: (data.statusAyahKandung as "MASIH_HIDUP" | "SUDAH_MENINGGAL" | "TIDAK_DIKETAHUI") || null,
            nikAyah: data.nikAyah || null,
            namaIbuKandung: data.namaIbuKandung || null,
            statusIbuKandung: (data.statusIbuKandung as "MASIH_HIDUP" | "SUDAH_MENINGGAL" | "TIDAK_DIKETAHUI") || null,
            nikIbu: data.nikIbu || null,
            statusWali: (data.statusWali as "SAMA_DENGAN_AYAH" | "SAMA_DENGAN_IBU" | "LAINNYA") || null,
            namaWali: data.namaWali || null,
            kewarganegaraan: (data.kewarganegaraan as "WNI" | "WNA") || "WNI",
            kitas: data.kitas || null,
            asalNegara: data.asalNegara || null,
            jenjangTujuanId: data.jenjangTujuanId,
            kelasTujuanId: data.kelasTujuanId,
            dokKartuKeluarga: dokKK,
            dokAkteLahir: dokAkte,
            dokFoto: dokFoto,
            dokLainnya: dokLainnya,
            status: "MENUNGGU_PEMBAYARAN",
            biayaPendaftaran,
          },
        })

        return {
          success: true,
          message: "Pendaftaran berhasil dibuat",
          data: {
            nomorPendaftaran: pendaftaran.nomorPendaftaran,
            tokenAkses: pendaftaran.tokenAkses,
          },
        }
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          (error.meta?.target as string[])?.includes("nomor_pendaftaran")
        ) {
          console.warn(`Nomor Pendaftaran bentrok, mencoba kembali (attempt ${attempt}/${MAX_RETRY})`)
          lastError = error
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt + Math.random() * 100))
          continue
        }
        throw error
      }
    }

    console.error("Gagal men-generate nomor pendaftaran yang unik:", lastError)
    return {
      success: false,
      message: "Sistem sedang padat. Silakan dicoba beberapa saat lagi.",
    }
  } catch (error) {
    console.error("Error createPendaftaran:", error)
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memproses pendaftaran baru. Silakan coba lagi."),
    }
  }
}