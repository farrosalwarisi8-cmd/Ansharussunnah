// src/app/api/cek-pendaftaran/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit"
import { hitungStatusBerkas } from "@/lib/status-berkas"

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
    const nomorRaw = searchParams.get("nomor")

    if (!nomorRaw) {
      return NextResponse.json(
        { success: false, message: "Nomor pendaftaran wajib diisi" },
        { status: 400 }
      )
    }

    const nomor = nomorRaw.trim().toUpperCase()
    if (nomor.length > 40) {
      return NextResponse.json(
        { success: false, message: "Nomor pendaftaran tidak valid" },
        { status: 400 }
      )
    }

    // ✅ Per-nomor limiter: batasi probing/enumerasi yang menargetkan SATU
    // nomor (mis. pemetaan oracle status). Berlaku di samping batas per-IP.
    const nomorLimiter = await rateLimitAsync(`cek-pendaftaran:${ip}:${nomor}`, {
      maxRequests: 10,
      windowMs: 60 * 1000, // 1 menit
    })

    if (!nomorLimiter.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Terlalu banyak permintaan. Silakan coba lagi setelah 1 menit.",
        },
        { status: 429, headers: { "Retry-After": "60" } }
      )
    }

    const pendaftaran = await prisma.pendaftaran.findUnique({
      where: { nomorPendaftaran: nomor, deleted_at: null },
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

    const statusBerkas = hitungStatusBerkas(pendaftaran)

    return NextResponse.json(
      {
        success: true,
        data: {
          nomorPendaftaran: pendaftaran.nomorPendaftaran,
          // Nama dimaskir untuk mengurangi ekspos PII di endpoint publik.
          namaLengkap: maskName(pendaftaran.namaLengkap),
          status: pendaftaran.status,
          jenjangTujuan: pendaftaran.jenjangTujuan.nama,
          kelasTujuan: pendaftaran.kelasTujuan?.nama || null,
          // alasanPenolakan dipertahankan: ini data milik pendaftar sendiri
          // saat mengecek kenapa pendaftarannya ditolak (fitur cek-status).
          alasanPenolakan: pendaftaran.alasanPenolakan,
          // Status kelengkapan dokumen dihitung OLEH SATU HELPER yang sama
          // dengan halaman upload, panel admin, dan dashboard wali
          // (src/lib/status-berkas.ts) supaya tidak berbeda antar halaman.
          //
          // Hanya boolean/angka: path file di bucket TIDAK pernah diekspos di
          // endpoint publik ini. Email konfirmasi pendaftaran menjanjikan
          // "status berkas tertera di halaman cek status" — inilah pemenuhan
          // janji tersebut.
          dokumen: {
            kartuKeluarga: statusBerkas.kartuKeluarga,
            akteLahir: statusBerkas.akteLahir,
            foto: statusBerkas.foto,
            lainnya: statusBerkas.lainnya,
            jumlahLengkap: statusBerkas.jumlahLengkap,
          },
          createdAt: pendaftaran.createdAt,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }
    )
  } catch (error) {
    console.error("Error cek-pendaftaran API:", error)
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan internal pada server" },
      { status: 500 }
    )
  }
}

/**
 * Nama dimaskir di endpoint publik: tampilkan maksimal 2 kata pertama
 * dan huruf awal kata terakhir (mis. "Ahmad F***").
 */
function maskName(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) {
    const n = parts[0]
    return n.length <= 2 ? n : `${n.slice(0, 2)}***`
  }
  const firstTwo = parts.slice(0, 2).join(" ")
  const last = parts[parts.length - 1]
  return `${firstTwo} ${last[0]}${"*".repeat(Math.max(2, last.length - 1))}`
}