// src/actions/password-reset.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    passwordResetToken: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

const { mockUpdateUserById, mockSignOut, mockCreateSupabaseAdmin } = vi.hoisted(
  () => ({
    mockUpdateUserById: vi.fn(),
    mockSignOut: vi.fn(),
    mockCreateSupabaseAdmin: vi.fn(),
  })
)

vi.mock("@/lib/supabase/admin", () => {
  mockCreateSupabaseAdmin.mockReturnValue({
    auth: {
      admin: {
        updateUserById: mockUpdateUserById,
        signOut: mockSignOut,
      },
    },
  })
  return { createSupabaseAdmin: mockCreateSupabaseAdmin }
})

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  buildOtpEmail: vi.fn().mockReturnValue("<html>OTP</html>"),
}))

vi.mock("@/lib/otp", () => ({
  createOtpWithHash: vi.fn().mockResolvedValue({
    plainOtp: "123456",
    hashedOtp: "$2a$10$hashedvalue",
  }),
  verifyOtp: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: vi.fn().mockResolvedValue({ success: true }),
  rateLimitAsyncStrict: vi.fn().mockResolvedValue({ success: true }),
  getClientIpFromHeaders: vi.fn().mockResolvedValue("127.0.0.1"),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import prisma from "@/lib/prisma"
import { verifyOtp } from "@/lib/otp"
import { rateLimitAsync, rateLimitAsyncStrict } from "@/lib/rate-limit"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import {
  requestPasswordReset,
  verifyResetOtp,
  resetPassword,
} from "@/actions/password-reset"

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  nama: "Test User",
  authId: "auth-1",
  aktif: true,
  role: "SISWA" as const,
}

describe("requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus mengembalikan response sukses generik jika email tidak terdaftar", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    const result = await requestPasswordReset("unknown@example.com")
    expect(result.success).toBe(true)
    expect(result.message).toContain("Jika email terdaftar")
  })

  it("harus membatasi request OTP baru dalam masa cooldown", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as never)
    vi.mocked(prisma.passwordResetToken.findFirst).mockResolvedValue({
      id: "token-1",
      createdAt: new Date(),
    } as never)

    // Cooldown tidak boleh mengungkap bahwa email terdaftar —
    // respons harus identik dengan kasus email tidak dikenal.
    const result = await requestPasswordReset("test@example.com")
    expect(result.success).toBe(true)
    expect(result.message).toContain("Jika email terdaftar")
  })
})

describe("verifyResetOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("harus menolak OTP jika format salah", async () => {
    const result = await verifyResetOtp("test@example.com", "wrong")
    expect(result.success).toBe(false)
  })

  it("harus mengunci token jika limit percobaan salah (lockout) terpenuhi", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as never)
    vi.mocked(prisma.passwordResetToken.findFirst).mockResolvedValue({
      id: "token-1",
      jumlahGagal: 3,
      expiredAt: new Date(Date.now() + 600000),
    } as never)

    // Anti-enumeration: lockout memakai pesan generik yang sama dengan
    // OTP salah/kedaluwarsa agar tidak mengungkap status token.
    const result = await verifyResetOtp("test@example.com", "123456")
    expect(result.success).toBe(false)
    expect(result.message).toContain("Kode verifikasi tidak valid")
  })

  it("harus menambah counter gagal jika OTP salah", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as never)
    vi.mocked(prisma.passwordResetToken.findFirst).mockResolvedValue({
      id: "token-1",
      kodeOtpHash: "$2a$10$hashed",
      jumlahGagal: 0,
      expiredAt: new Date(Date.now() + 600000),
    } as never)
    vi.mocked(verifyOtp).mockResolvedValue(false)

    const result = await verifyResetOtp("test@example.com", "000000")
    expect(result.success).toBe(false)
    expect(prisma.passwordResetToken.update).toHaveBeenCalled()
  })
})
// ========================================================
// Rate limit per-IP
//
// Aksi OTP juga dipanggil dari Server Component (app/lupa-password/*) yang
// TIDAK melewati route API, jadi rate limit harus ditegakkan di dalam action.
// Test berikut memastikan tidak ada jalur yang lolos limiter.
// ========================================================

describe("OTP — Rate Limit per IP", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimitAsync).mockResolvedValue({
      success: true,
    } as never)
    mockUpdateUserById.mockResolvedValue({ error: null })
    mockSignOut.mockResolvedValue({ error: null })
  })

  it("requestPasswordReset: menolak saat limiter per-IP menolak", async () => {
    vi.mocked(rateLimitAsyncStrict).mockResolvedValue({ success: false } as never)

    const result = await requestPasswordReset("test@example.com")

    expect(result.success).toBe(false)
    expect(result.message).toContain("Terlalu banyak permintaan")
    // Tidak menyentuh database maupun mengirim email
    expect(prisma.user.findFirst).not.toHaveBeenCalled()
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled()
  })

  it("requestPasswordReset: memakai bucket per-IP dengan batas 3/5 menit", async () => {
    await requestPasswordReset("test@example.com")

    expect(rateLimitAsyncStrict).toHaveBeenCalledWith(
      "request-password-reset:127.0.0.1",
      { maxRequests: 3, windowMs: 5 * 60 * 1000 }
    )
  })

  it("verifyResetOtp: menolak saat limiter per-IP menolak", async () => {
    vi.mocked(rateLimitAsyncStrict).mockResolvedValue({ success: false } as never)

    const result = await verifyResetOtp("test@example.com", "123456")

    expect(result.success).toBe(false)
    expect(result.message).toContain("Terlalu banyak percobaan")
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(prisma.passwordResetToken.update).not.toHaveBeenCalled()
  })

  it("verifyResetOtp: memakai bucket per-IP dengan batas 5/1 menit", async () => {
    await verifyResetOtp("test@example.com", "123456")

    expect(rateLimitAsyncStrict).toHaveBeenCalledWith("verify-reset-otp:127.0.0.1", {
      maxRequests: 5,
      windowMs: 60 * 1000,
    })
  })

  it("resetPassword: menolak saat limiter per-IP menolak", async () => {
    vi.mocked(rateLimitAsyncStrict).mockResolvedValue({ success: false } as never)

    const result = await resetPassword(
      "test@example.com",
      "token-1",
      "PasswordBaru123",
      "PasswordBaru123"
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain("Terlalu banyak percobaan")
    // Tidak boleh menyentuh Supabase Auth
    expect(createSupabaseAdmin).not.toHaveBeenCalled()
  })

  it("resetPassword: memakai bucket per-IP dengan batas 10/5 menit", async () => {
    await resetPassword(
      "test@example.com",
      "token-1",
      "PasswordBaru123",
      "PasswordBaru123"
    )

    expect(rateLimitAsyncStrict).toHaveBeenCalledWith("reset-password:127.0.0.1", {
      maxRequests: 10,
      windowMs: 5 * 60 * 1000,
    })
  })

  it("bucket ketiga fungsi saling terpisah (tidak saling menghabiskan kuota)", async () => {
    await requestPasswordReset("test@example.com")
    await verifyResetOtp("test@example.com", "123456")
    await resetPassword(
      "test@example.com",
      "token-1",
      "PasswordBaru123",
      "PasswordBaru123"
    )

    const keys = vi.mocked(rateLimitAsyncStrict).mock.calls.map((c) => c[0])
    expect(keys).toEqual([
      "request-password-reset:127.0.0.1",
      "verify-reset-otp:127.0.0.1",
      "reset-password:127.0.0.1",
    ])
    expect(new Set(keys).size).toBe(3)
  })
})
