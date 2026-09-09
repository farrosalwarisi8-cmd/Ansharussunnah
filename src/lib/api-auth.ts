// src/lib/api-auth.ts

import { NextRequest } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import prisma from "@/lib/prisma"
import { Role } from "@prisma/client"

// Semakin kecil indeks = semakin tinggi hak akses.
const ROLE_PRIVILEGE_INDEX: Record<Role, number> = {
  [Role.SUPER_ADMIN]: 0,
  [Role.ADMIN_AKADEMIK]: 1,
  [Role.ADMIN_KEUANGAN]: 2,
  [Role.GURU]: 3,
  [Role.SISWA]: 4,
  [Role.ORANG_TUA]: 5,
}

export async function authenticateApiRequest(
  request: NextRequest,
  allowedRoles?: Role[],
  options?: { requireAdmin?: boolean }
) {
  try {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        authenticated: false,
        errorResponse: Response.json(
          {
            success: false,
            message:
              "Missing or invalid Authorization header (Bearer token required)",
          },
          { status: 401 }
        ),
      }
    }

    const token = authHeader.split(" ")[1]
    const supabase = createSupabaseAdmin()

    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !authUser) {
      return {
        authenticated: false,
        errorResponse: Response.json(
          { success: false, message: "Unauthorized: Invalid or expired token" },
          { status: 401 }
        ),
      }
    }

    // Resolusi role: jika satu authId terhubung ke beberapa akun (multi-role),
    // pilih akun dengan hak akses tertinggi yang masih aktif, bukan urutan alfabetis.
    const userRecords = await prisma.user.findMany({
      where: { authId: authUser.id, deleted_at: null },
      select: {
        id: true,
        role: true,
        aktif: true,
        isAdmin: true,
      },
    })

    const user = userRecords
      .filter((u) => u.aktif)
      .sort(
        (a, b) =>
          (ROLE_PRIVILEGE_INDEX[a.role] ?? 999) - (ROLE_PRIVILEGE_INDEX[b.role] ?? 999)
      )[0] ?? null

    if (!user || !user.aktif) {
      return {
        authenticated: false,
        errorResponse: Response.json(
          {
            success: false,
            message: "User account is inactive or not found in database",
          },
          { status: 403 }
        ),
      }
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return {
        authenticated: false,
        errorResponse: Response.json(
          {
            success: false,
            message: `Forbidden: Requires roles: ${allowedRoles.join(", ")}`,
          },
          { status: 403 }
        ),
      }
    }

    if (options?.requireAdmin && !user.isAdmin) {
      return {
        authenticated: false,
        errorResponse: Response.json(
          { success: false, message: "Forbidden: Admin access required" },
          { status: 403 }
        ),
      }
    }

    return {
      authenticated: true,
      user,
    }
  } catch (error) {
    console.error("API Auth Error:", error)
    return {
      authenticated: false,
      errorResponse: Response.json(
        { success: false, message: "Internal Auth Server Error" },
        { status: 500 }
      ),
    }
  }
}