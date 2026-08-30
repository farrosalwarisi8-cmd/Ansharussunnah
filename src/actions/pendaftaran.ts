// src/actions/pendaftaran.ts

"use server"

import prisma from "@/lib/prisma"
import { generateNomorPendaftaran } from "@/lib/registration-number"
import { pendaftaranSchema } from "@/lib/validations/pendaftaran"
import { rateLimitAsync, getClientIpFromHeaders } from "@/lib/rate-limit"
import type { ActionResponse } from "@/types"
import { Prisma } from "@prisma/client"

const MAX_RETRY = 5

export async function createPendaftaran(
  formData: FormData
): Promise<ActionResponse<{ nomorPendaftaran: string }>> {
  try {
    // ✅ Rate Limiting: 5 pendaftaran / 10 menit per IP
    const ip = await getClientIpFromHeaders()
    const limiter = await rateLimitAsync(`create-pendaftaran:${ip}`, {
      maxRequests: 5,
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
      })
      if (!kelas) {
        return {
          success: false,
          message: "Kelas tujuan tidak valid untuk jenjang yang dipilih",
        }
      }
    }

    const dokKK = formData.get("dokKartuKeluarga") as string | null
    const dokAkte = formData.get("dokAkteLahir") as string | null
    const dokFoto = formData.get("dokFoto") as string | null
    const dokLainnyaRaw = formData.getAll("dokLainnya") as string[]

    const biayaPendaftaran = parseFloat(
      process.env.NEXT_PUBLIC_REGISTRATION_FEE || "500000"
    )

    let lastError: Error | null = null

    // ✅ Handle Race Condition dengan retry logic untuk record nomorPendaftaran unik
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        const nomorPendaftaran = await generateNomorPendaftaran()

        const pendaftaran = await prisma.pendaftaran.create({
          data: {
            nomorPendaftaran,
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
            dokLainnya: dokLainnyaRaw.filter(Boolean),
            status: "MENUNGGU_PEMBAYARAN",
            biayaPendaftaran,
          },
        })

        return {
          success: true,
          message: "Pendaftaran berhasil dibuat",
          data: { nomorPendaftaran: pendaftaran.nomorPendaftaran },
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
      message: "Gagal memproses pendaftaran baru.",
    }
  }
}