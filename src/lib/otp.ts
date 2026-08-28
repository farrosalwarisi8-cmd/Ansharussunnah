// src/lib/otp.ts

import bcrypt from "bcryptjs"
import { generateOtp } from "@/lib/password"

const SALT_ROUNDS = 10

/**
 * Generate OTP 6 digit + hash-nya untuk disimpan di DB
 */
export async function createOtpWithHash(): Promise<{
  plainOtp: string
  hashedOtp: string
}> {
  const plainOtp = generateOtp()
  const hashedOtp = await bcrypt.hash(plainOtp, SALT_ROUNDS)
  return { plainOtp, hashedOtp }
}

/**
 * Verifikasi OTP plain text terhadap hash dari database
 */
export async function verifyOtp(
  plainOtp: string,
  hashedOtp: string
): Promise<boolean> {
  return bcrypt.compare(plainOtp, hashedOtp)
}