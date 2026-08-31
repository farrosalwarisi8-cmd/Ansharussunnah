// src/lib/prisma.ts

import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // Tambahkan pool config ke DATABASE_URL dengan aman
  // Default: connection_limit=10, pool_timeout=20
  const dbUrl = process.env.DATABASE_URL ?? ""
  let datasourceUrl: string | undefined

  try {
    const url = new URL(dbUrl)
    const params = url.searchParams
    if (!params.has("connection_limit")) {
      params.set("connection_limit", "10")
    }
    if (!params.has("pool_timeout")) {
      params.set("pool_timeout", "20")
    }
    datasourceUrl = url.toString()
  } catch {
    // URL tidak valid atau kosong — biarkan Prisma handle sendiri
    datasourceUrl = undefined
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn"] : ["error"],
    ...(datasourceUrl ? { datasourceUrl } : {}),
  })
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export default prisma