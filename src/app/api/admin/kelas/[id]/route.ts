// src/app/api/admin/kelas/[id]/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest } from "@/lib/api-auth"
import { Role, JenisKelamin } from "@prisma/client"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { guruCocokKelas } from "@/lib/guru-kelas-gender"
import prisma from "@/lib/prisma"

type RouteContext = { params: Promise<{ id: string }> }

// Validasi bersama updateKelas di src/actions/jenjang-kelas.ts agar API route
// tidak memperbolehkan nilai yang ditolak aksi server (nama kosong, kapasitas
// di luar 1-100, jenisKelamin tidak dikenal, ...).
const updateKelasPayloadSchema = z
  .object({
    nama: z.string().min(1, "Nama kelas wajib diisi").max(50).optional(),
    jenjangId: z.string().min(1).optional(),
    waliKelasId: z.string().nullish().transform((v) => v ?? null),
    kapasitas: z.coerce.number().int().min(1).max(100).optional(),
    jenisKelamin: z
      .union([z.literal(""), z.nativeEnum(JenisKelamin), z.null()])
      .optional()
      .transform((v) => (v === "" ? null : v)),
    aktif: z.boolean().optional(),
  })
  .strict()

function labelKelas(jenisKelamin: JenisKelamin | null): string {
  if (jenisKelamin === JenisKelamin.LAKI_LAKI) return "Ikhwan"
  if (jenisKelamin === JenisKelamin.PEREMPUAN) return "Akhwat"
  return "Campuran"
}

// Validasi kecocokan gender guru wali dengan gender kelas (hasil update),
// identik dengan updateKelas di src/actions/jenjang-kelas.ts.
async function validateWaliKelas(
  waliKelasId: string | null,
  jenisKelamin: JenisKelamin | null
): Promise<{ valid: true } | { valid: false; message: string }> {
  if (!waliKelasId) return { valid: true }

  const wali = await prisma.guru.findUnique({
    where: { id: waliKelasId },
    select: {
      id: true,
      jenisKelamin: true,
      user: { select: { nama: true } },
    },
  })

  if (!wali) return { valid: false, message: "Guru wali kelas tidak ditemukan" }

  if (!guruCocokKelas(wali.jenisKelamin, jenisKelamin)) {
    const label = labelKelas(jenisKelamin)
    return {
      valid: false,
      message: `Kelas khusus ${label} hanya dapat diampu oleh guru ${label}, namun "${wali.user.nama}" ${wali.jenisKelamin === "LAKI_LAKI" ? "laki-laki" : "perempuan"}.`,
    }
  }

  return { valid: true }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = await authenticateApiRequest(request, [Role.GURU], {
    requireAdmin: true,
  })
  if (!auth.authenticated) return auth.errorResponse!

  try {
    const { id } = await params

    const existing = await prisma.kelas.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Kelas tidak ditemukan" },
        { status: 404 }
      )
    }

    const parsed = updateKelasPayloadSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Data kelas tidak valid",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const payload = parsed.data
    const jenisKelamin =
      payload.jenisKelamin !== undefined ? payload.jenisKelamin : existing.jenisKelamin
    const waliKelasId =
      payload.waliKelasId !== undefined ? payload.waliKelasId : existing.waliKelasId

    // ✅ Kecocokan gender guru wali dengan gender kelas
    const waliCheck = await validateWaliKelas(waliKelasId ?? null, jenisKelamin ?? null)
    if (!waliCheck.valid) {
      return NextResponse.json(
        { success: false, message: waliCheck.message },
        { status: 400 }
      )
    }

    // ✅ Duplikasi (nama, jenjang) tidak boleh bentrok dengan kelas lain
    if (payload.nama || payload.jenjangId) {
      const nama = payload.nama ?? existing.nama
      const jenjangId = payload.jenjangId ?? existing.jenjangId
      const duplicate = await prisma.kelas.findUnique({
        where: { nama_jenjangId: { nama, jenjangId } },
      })
      if (duplicate && duplicate.id !== existing.id) {
        return NextResponse.json(
          {
            success: false,
            message: `Kelas "${nama}" sudah ada di jenjang yang dipilih`,
          },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.kelas.update({
      where: { id },
      data: {
        nama: payload.nama,
        jenjangId: payload.jenjangId,
        waliKelasId: payload.waliKelasId !== undefined ? payload.waliKelasId : undefined,
        kapasitas: payload.kapasitas,
        jenisKelamin:
          payload.jenisKelamin !== undefined ? payload.jenisKelamin : undefined,
        aktif: payload.aktif,
      },
    })

    revalidatePath("/dashboard/kelas")
    revalidatePath("/pendaftaran")

    return NextResponse.json({
      success: true,
      message: "Kelas berhasil diperbarui",
      data: updated,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memperbarui kelas" },
      { status: 400 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await authenticateApiRequest(request, [Role.GURU], {
    requireAdmin: true,
  })
  if (!auth.authenticated) return auth.errorResponse!

  try {
    const { id } = await params

    // Cek semua relasi yang mungkin menaut kelas, identik dengan deleteKelas
    // di src/actions/jenjang-kelas.ts (bukan hanya siswa/pendaftaran).
    const checkRelations = await prisma.kelas.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            siswa: true,
            pendaftaran: true,
            ujian: true,
            absensi: true,
            tugas: true,
            materi: true,
            nilaiRapor: true,
            riwayatSebagaiKelas: true,
            riwayatSebagaiKelasAsal: true,
          },
        },
      },
    })

    if (!checkRelations) {
      return NextResponse.json(
        { success: false, message: "Kelas tidak ditemukan" },
        { status: 404 }
      )
    }

    const {
      siswa,
      pendaftaran,
      ujian,
      absensi,
      tugas,
      materi,
      nilaiRapor,
      riwayatSebagaiKelas,
      riwayatSebagaiKelasAsal,
    } = checkRelations._count

    if (
      siswa > 0 ||
      pendaftaran > 0 ||
      ujian > 0 ||
      absensi > 0 ||
      tugas > 0 ||
      materi > 0 ||
      nilaiRapor > 0 ||
      riwayatSebagaiKelas > 0 ||
      riwayatSebagaiKelasAsal > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak dapat menghapus kelas karena masih memiliki data terkait (siswa, pendaftaran, ujian, absensi, tugas, materi, nilai rapor, atau riwayat kelas)",
        },
        { status: 400 }
      )
    }

    await prisma.kelas.delete({ where: { id } })

    revalidatePath("/dashboard/kelas")
    revalidatePath("/pendaftaran")

    return NextResponse.json({
      success: true,
      message: "Kelas berhasil dihapus",
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal menghapus kelas" },
      { status: 400 }
    )
  }
}