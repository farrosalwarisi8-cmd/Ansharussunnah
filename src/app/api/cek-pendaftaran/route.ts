// src/app/api/cek-pendaftaran/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit"

export async function GET(request: NextRequest) {
  try {
    // ✅ FIX: Rate limiting per IP — 5 request per menit
    const ip = getClientIp(request)
    const maxRequests = parseInt(process.env.RATE_LIMIT_CEK_PENDAFTARAN || "5")
    const limiter = await rateLimitAsync(`cek-pendaftaran:${ip}`, {
      maxRequests,
      windowMs: 60 * 1000, // 1 menit
    })

    if (!limiter.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Terlalu banyak permintaan. Silakan coba lagi setelah 1 menit.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil((limiter.resetAt - Date.now()) / 1000).toString(),
            "X-RateLimit-Remaining": "0",
          },
        }
      )
    }

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
        jenjangTujuan: { select: { nama: true } },
        kelasTujuan: { select: { nama: true } },
      },
    })

    if (!pendaftaran) {
      return NextResponse.json(
        { success: false, message: "Pendaftaran tidak ditemukan" },
        { status: 404 }
      )
    }

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