// src/actions/password-reset.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn() },
    passwordResetToken: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: () => ({
    auth: {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({ error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  }),
}))

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

import prisma from "@/lib/prisma"
import { verifyOtp } from "@/lib/otp"
import {
  requestPasswordReset,
  verifyResetOtp,
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
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const result = await requestPasswordReset("unknown@example.com")
    expect(result.success).toBe(true)
    expect(result.message).toContain("Jika email terdaftar")
  })

  it("harus membatasi request OTP baru dalam masa cooldown", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never)
    vi.mocked(prisma.passwordResetToken.findFirst).mockResolvedValue({
      id: "token-1",
      createdAt: new Date(),
    } as never)

    const result = await requestPasswordReset("test@example.com")
    expect(result.success).toBe(false)
    expect(result.message).toContain("tunggu")
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
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never)
    vi.mocked(prisma.passwordResetToken.findFirst).mockResolvedValue({
      id: "token-1",
      jumlahGagal: 3,
      expiredAt: new Date(Date.now() + 600000),
    } as never)

    const result = await verifyResetOtp("test@example.com", "123456")
    expect(result.success).toBe(false)
    expect(result.message).toContain("Terlalu banyak percobaan")
  })

  it("harus menambah counter gagal jika OTP salah", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never)
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