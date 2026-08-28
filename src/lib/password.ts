// src/lib/password.ts

import crypto from "crypto"

/**
 * Generate random password yang aman
 * Panjang minimal 12 karakter, campuran huruf besar/kecil/angka/simbol
 */
export function generateSecurePassword(length: number = 14): string {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ" // tanpa I, O agar tidak ambigu
  const lowercase = "abcdefghjkmnpqrstuvwxyz"   // tanpa l, o
  const digits = "23456789"                      // tanpa 0, 1
  const symbols = "@#$%&*+-="

  const allChars = uppercase + lowercase + digits + symbols

  // Pastikan minimal 1 karakter dari setiap kategori
  const password = [
    uppercase[crypto.randomInt(uppercase.length)],
    lowercase[crypto.randomInt(lowercase.length)],
    digits[crypto.randomInt(digits.length)],
    symbols[crypto.randomInt(symbols.length)],
  ]

  // Isi sisa panjang dengan karakter random dari semua kategori
  for (let i = password.length; i < length; i++) {
    password.push(allChars[crypto.randomInt(allChars.length)])
  }

  // Shuffle array agar posisi karakter wajib tidak predictable
  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[password[i], password[j]] = [password[j], password[i]]
  }

  return password.join("")
}

/**
 * Generate OTP 6 digit angka
 */
export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString()
}