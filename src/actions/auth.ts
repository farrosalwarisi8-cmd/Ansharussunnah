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

export async function login(formData: FormData): Promise<ActionResponse> {
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
    // Audit: catat percobaan yang diblokir rate limit
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

  // Rate Limit #2: Per-email — maksimal 5 percobaan gagal per 15 menit per email
  // Melindungi dari brute-force satu akun dari banyak IP berbeda
  const emailLimiter = await rateLimitAsync(`login-email:${normalizedEmail}`, {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 menit
  })
  if (!emailLimiter.success) {
    logLoginAttempt({
      email: normalizedEmail,
      ip,
      userAgent,
      status: "RATE_LIMITED",
      reason: "Email rate limit exceeded",
    })
    return {
      success: false,
      message: "Terlalu banyak percobaan login untuk email ini. Silakan coba lagi dalam 15 menit.",
    }
  }

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Audit: catat percobaan login gagal
    logLoginAttempt({
      email: normalizedEmail,
      ip,
      userAgent,
      status: "FAILED",
      reason: error.message,
    })
    // Pesan error tetap generik — tidak membedakan email tidak terdaftar vs password salah
    return {
      success: false,
      message: "Email atau password salah",
    }
  }

  // Audit: catat percobaan login berhasil
  logLoginAttempt({
    email: normalizedEmail,
    ip,
    userAgent,
    status: "SUCCESS",
  })

  return {
    success: true,
    message: "Login berhasil",
  }
}

export async function logout() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/login")
}