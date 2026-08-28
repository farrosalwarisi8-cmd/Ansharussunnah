// src/app/api/cek-pendaftaran/route.ts

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const nomor = searchParams.get("nomor")

    if (!nomor) {
      return NextResponse.json(
        { success: false, message: "Nomor pendaftaran wajib diisi" },
        { status: 400 }
      )
    }

    const pendaftaran = await prisma.pendaftaran.findUnique({
      where: { nomorPendaftaran: nomor.trim().toUpperCase() },
      include: {
        jenjangTujuan: {
          select: { nama: true },
        },
        kelasTujuan: {
          select: { nama: true },
        },
      },
    })

    if (!pendaftaran) {
      return NextResponse.json(
        { success: false, message: "Pendaftaran tidak ditemukan" },
        { status: 404 }
      )
    }

    // Hanya kirim data yang aman ke publik (tanpa data sensitif seperti NIK/dokumen)
    return NextResponse.json({
      success: true,
      data: {
        nomorPendaftaran: pendaftaran.nomorPendaftaran,
        namaLengkap: pendaftaran.namaLengkap,
        status: pendaftaran.status,
        jenjangTujuan: pendaftaran.jenjangTujuan.nama,
        kelasTujuan: pendaftaran.kelasTujuan?.nama || null,
        biayaPendaftaran: pendaftaran.biayaPendaftaran,
        alasanPenolakan: pendaftaran.alasanPenolakan,
        createdAt: pendaftaran.createdAt,
      },
    })
  } catch (error) {
    console.error("Error cek-pendaftaran API:", error)
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan internal pada server" },
      { status: 500 }
    )
  }
}