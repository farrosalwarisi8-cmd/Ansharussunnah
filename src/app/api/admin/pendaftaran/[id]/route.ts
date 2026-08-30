// src/app/api/admin/pendaftaran/[id]/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest } from "@/lib/api-auth"
import { getPendaftaranDetail } from "@/actions/verifikasi"
import { Role } from "@prisma/client"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await authenticateApiRequest(request, [Role.GURU])
  if (!auth.authenticated) return auth.errorResponse!

  try {
    const { id } = await params
    const result = await getPendaftaranDetail(id)

    return NextResponse.json(result, {
      status: result.success ? 200 : 404,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat detail pendaftaran" },
      { status: 500 }
    )
  }
}