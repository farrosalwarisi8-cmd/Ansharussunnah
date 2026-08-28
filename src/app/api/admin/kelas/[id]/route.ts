// src/app/api/admin/kelas/[id]/route.ts

import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest } from "@/lib/api-auth"
import { Role } from "@prisma/client"
import prisma from "@/lib/prisma"

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = await authenticateApiRequest(request, [Role.GURU])
  if (!auth.authenticated) return auth.errorResponse!

  try {
    const { id } = await params
    const { nama, jenjangId, waliKelasId, kapasitas, aktif } = await request.json()

    const existing = await prisma.kelas.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Kelas tidak ditemukan" },
        { status: 404 }
      )
    }

    const updated = await prisma.kelas.update({
      where: { id },
      data: {
        nama: nama ?? existing.nama,
        jenjangId: jenjangId ?? existing.jenjangId,
        waliKelasId: waliKelasId !== undefined ? waliKelasId : existing.waliKelasId,
        kapasitas: kapasitas ? Number(kapasitas) : existing.kapasitas,
        aktif: aktif !== undefined ? aktif : existing.aktif,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Kelas berhasil diperbarui",
      data: updated,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Gagal memperbarui kelas" },
      { status: 400 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await authenticateApiRequest(request, [Role.GURU])
  if (!auth.authenticated) return auth.errorResponse!

  try {
    const { id } = await params

    const checkRelations = await prisma.kelas.findUnique({
      where: { id },
      include: {
        _count: { select: { siswa: true, pendaftaran: true } },
      },
    })

    if (!checkRelations) {
      return NextResponse.json(
        { success: false, message: "Kelas tidak ditemukan" },
        { status: 404 }
      )
    }

    if (checkRelations._count.siswa > 0 || checkRelations._count.pendaftaran > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak dapat menghapus kelas yang masih memiliki siswa atau pendaftar",
        },
        { status: 400 }
      )
    }

    await prisma.kelas.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: "Kelas berhasil dihapus",
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Gagal menghapus kelas" },
      { status: 400 }
    )
  }
}