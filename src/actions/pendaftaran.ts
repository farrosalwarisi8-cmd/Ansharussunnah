// src/actions/pendaftaran.ts

"use server"

import prisma from "@/lib/prisma"
import { generateNomorPendaftaran } from "@/lib/registration-number"
import { pendaftaranSchema } from "@/lib/validations/pendaftaran"
import type { ActionResponse } from "@/types"

/**
 * Server Action untuk membuat pendaftaran baru (PUBLIC - tanpa auth)
 */
export async function createPendaftaran(
  formData: FormData
): Promise<ActionResponse<{ nomorPendaftaran: string }>> {
  try {
    // 1. Parse & validasi data form
    const rawData = {
      namaLengkap: formData.get("namaLengkap") as string,
      tempatLahir: formData.get("tempatLahir") as string,
      tanggalLahir: formData.get("tanggalLahir") as string,
      jenisKelamin: formData.get("jenisKelamin") as string,
      alamatSiswa: formData.get("alamatSiswa") as string,
      nisn: (formData.get("nisn") as string) || undefined,
      namaOrangTua: formData.get("namaOrangTua") as string,
      noHpOrangTua: formData.get("noHpOrangTua") as string,
      emailOrangTua: formData.get("emailOrangTua") as string,
      alamatOrangTua: (formData.get("alamatOrangTua") as string) || undefined,
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

    // 2. Cek apakah jenjang tujuan valid
    const jenjang = await prisma.jenjang.findUnique({
      where: { id: data.jenjangTujuanId },
    })
    if (!jenjang) {
      return {
        success: false,
        message: "Jenjang tujuan tidak ditemukan",
      }
    }

    // 3. Cek apakah kelas tujuan valid (jika diisi)
    if (data.kelasTujuanId) {
      const kelas = await prisma.kelas.findFirst({
        where: {
          id: data.kelasTujuanId,
          jenjangId: data.jenjangTujuanId,
        },
      })
      if (!kelas) {
        return {
          success: false,
          message: "Kelas tujuan tidak valid untuk jenjang yang dipilih",
        }
      }
    }

    // 4. Parse dokumen pendukung dari FormData
    const dokKK = formData.get("dokKartuKeluarga") as string | null
    const dokAkte = formData.get("dokAkteLahir") as string | null
    const dokFoto = formData.get("dokFoto") as string | null
    const dokLainnyaRaw = formData.getAll("dokLainnya") as string[]

    // 5. Generate nomor pendaftaran
    const nomorPendaftaran = await generateNomorPendaftaran()

    // 6. Buat record pendaftaran di database
    const biayaPendaftaran = parseFloat(
      process.env.NEXT_PUBLIC_REGISTRATION_FEE || "500000"
    )

    const pendaftaran = await prisma.pendaftaran.create({
      data: {
        nomorPendaftaran,
        namaLengkap: data.namaLengkap,
        tempatLahir: data.tempatLahir,
        tanggalLahir: new Date(data.tanggalLahir),
        jenisKelamin: data.jenisKelamin as "LAKI_LAKI" | "PEREMPUAN",
        alamatSiswa: data.alamatSiswa,
        nisn: data.nisn,
        namaOrangTua: data.namaOrangTua,
        noHpOrangTua: data.noHpOrangTua,
        emailOrangTua: data.emailOrangTua,
        alamatOrangTua: data.alamatOrangTua,
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
      data: {
        nomorPendaftaran: pendaftaran.nomorPendaftaran,
      },
    }
  } catch (error) {
    console.error("Error createPendaftaran:", error)
    return {
      success: false,
      message: "Terjadi kesalahan saat memproses pendaftaran. Silakan coba lagi.",
    }
  }
}