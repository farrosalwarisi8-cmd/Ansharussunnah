// src/lib/api-auth.ts

import { NextRequest } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import prisma from "@/lib/prisma"
import { Role } from "@prisma/client"

export async function authenticateApiRequest(
  request: NextRequest,
  allowedRoles?: Role[]
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

    const user = await prisma.user.findFirst({
      where: { authId: authUser.id },
      include: { guru: true, siswa: true, orangTua: true },
    })

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