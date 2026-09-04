// src/actions/auth.ts

"use server"

import { headers } from "next/headers"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { rateLimitAsync, getClientIpFromHeaders } from "@/lib/rate-limit"
import prisma from "@/lib/prisma"
import type { ActionResponse } from "@/types"

/**
 * Helper: ambil User-Agent dari request headers.
 * Dipotong max 500 karakter untuk mencegah abuse.
 */
async function getUserAgent(): Promise<string | null> {
  try {
    const headersList = await headers()
    const ua = headersList.get("user-agent")
    return ua ? ua.slice(0, 500) : null
  } catch {
    return null
  }
}

/**
 * Audit trail: catat percobaan login ke database.
 * Fire-and-forget — tidak memblokir response utama.
 */
async function logLoginAttempt(params: {
  email: string
  ip: string | null
  userAgent: string | null
  status: "SUCCESS" | "FAILED" | "RATE_LIMITED"
  reason?: string
}): Promise<void> {
  try {
    await prisma.loginAudit.create({
      data: {
        email: params.email,
        ip: params.ip,
        userAgent: params.userAgent,
        status: params.status,
        reason: params.reason || null,
      },
    })
  } catch (err) {
    // Jangan biarkan audit logging memblokir login flow
    console.error("Gagal mencatat audit login:", err)
  }
}

export async function login(formData: FormData): Promise<ActionResponse<{ hasMultipleRoles?: boolean }>> {
  try {
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    if (!email || !password) {
      return {
        success: false,
        message: "Email dan password wajib diisi",
      }
    }

    const normalizedEmail = email.toLowerCase().trim()
    const ip = await getClientIpFromHeaders()
    const userAgent = await getUserAgent()

    // Rate Limit #1: Per-IP — maksimal 10 percobaan login per 15 menit per IP
    const ipLimiter = await rateLimitAsync(`login-ip:${ip}`, {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000, // 15 menit
    })
    if (!ipLimiter.success) {
      logLoginAttempt({
        email: normalizedEmail,
        ip,
        userAgent,
        status: "RATE_LIMITED",
        reason: "IP rate limit exceeded",
      })
      return {
        success: false,
        message: "Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.",
      }
    }

    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // Rate Limit #2: Per-email — maksimal 5 percobaan GAGAL per 15 menit.
      // Hanya dikenakan saat autentikasi GAGAL, sehingga serangan dengan
      // password salah tidak bisa mengunci email korban (anti DoS login).
      const emailLimiter = await rateLimitAsync(`login-email:${normalizedEmail}`, {
        maxRequests: 5,
        windowMs: 15 * 60 * 1000, // 15 menit
      })

      logLoginAttempt({
        email: normalizedEmail,
        ip,
        userAgent,
        status: emailLimiter.success ? "FAILED" : "RATE_LIMITED",
        reason: emailLimiter.success ? error.message : "Email rate limit exceeded",
      })

      return {
        success: false,
        message:
          "Email atau password salah" +
          (emailLimiter.success
            ? ""
            : ". Terlalu banyak percobaan gagal untuk email ini. Silakan coba lagi dalam 15 menit."),
      }
    }

    logLoginAttempt({
      email: normalizedEmail,
      ip,
      userAgent,
      status: "SUCCESS",
    })

    // Check if this auth user has multiple roles in the database
    const authUser = await supabase.auth.getUser()
    const authUserId = authUser.data.user?.id

    let hasMultipleRoles = false
    if (authUserId) {
      const userRecords = await prisma.user.findMany({
        where: { authId: authUserId, aktif: true },
        select: { id: true },
      })
      hasMultipleRoles = userRecords.length > 1
    }

    return {
      success: true,
      message: "Login berhasil",
      data: { hasMultipleRoles },
    }
  } catch (error: unknown) {
    console.error("Error login:", error)
    return {
      success: false,
      message: "Terjadi kesalahan saat login. Silakan coba lagi.",
    }
  }
}

export async function logout() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()

  // Clear role selection cookies
  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()
  cookieStore.delete("selected_role")
  cookieStore.delete("selected_user_id")

  redirect("/login")
}