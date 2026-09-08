// src/lib/crypto.ts
// Enkripsi data sensitif (mis. password cadangan akun siswa) dengan AES-256-GCM.
// Nilai disimpan sebagai `enc:v1:<base64(iv + authTag + ciphertext)>`.
// Nilai lama yang belum terenkripsi dikembalikan apa adanya oleh decryptSecret
// agar akun yang sudah ada tidak rusak hingga password-nya diubah berikutnya.

import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const TAG_LENGTH = 16
const PREFIX = "enc:v1:"

function getKey(): Buffer {
  const secret = process.env.PASSWORD_ENCRYPTION_KEY
  if (!secret) {
    throw new Error("PASSWORD_ENCRYPTION_KEY is not configured")
  }
  return crypto.createHash("sha256").update(secret).digest()
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, authTag, encrypted])
  return PREFIX + payload.toString("base64")
}

export function decryptSecret(
  value: string | null | undefined
): string | null {
  if (!value) return null
  if (!value.startsWith(PREFIX)) return value

  try {
    const payload = Buffer.from(value.slice(PREFIX.length), "base64")
    if (payload.length < IV_LENGTH + TAG_LENGTH) return null

    const iv = payload.subarray(0, IV_LENGTH)
    const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const encrypted = payload.subarray(IV_LENGTH + TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      "utf8"
    )
  } catch {
    return null
  }
}