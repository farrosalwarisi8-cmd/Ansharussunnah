// src/lib/username.ts

import type { Prisma } from "@prisma/client"

type UsernameDb = Pick<Prisma.TransactionClient, "user">

/**
 * Menurunkan username dari prefix email, lalu memastikan hasilnya UNIK
 * secara global (login via username bersifat global — ambiguitas bisa
 * membuat login salah akun).
 *
 * - Karakter yang tidak diizinkan (> huruf kecil, angka, titik, strip, underscore) dibuang.
 * - Bila hasil slug kosong → kembalikan null (login cukup pakai email).
 * - Bila slug sudah dipakai user lain → ditambahkan suffix angka (2, 3, dst).
 */
export async function deriveUniqueUsername(
  db: UsernameDb,
  email: string
): Promise<string | null> {
  const base = email.split("@")[0].replace(/[^a-z0-9._-]/g, "").toLowerCase()
  if (!base) return null

  let candidate = base
  let suffix = 2
  while (suffix <= 1000) {
    const existing = await db.user.findFirst({
      where: { username: candidate },
      select: { id: true },
    })
    if (!existing) return candidate
    candidate = `${base}${suffix}`
    suffix++
  }

  return null
}