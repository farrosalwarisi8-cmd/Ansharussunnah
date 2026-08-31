// src/lib/prisma.ts

import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // Tambahkan pool config ke DATABASE_URL jika belum ada
  // Default: connection_limit=10, pool_timeout=20
  const dbUrl = process.env.DATABASE_URL ?? ""
  const hasPoolParams = dbUrl.includes("connection_limit")
  const datasourceUrl = hasPoolParams
    ? undefined // gunakan URL asli dari env
    : `${dbUrl}?connection_limit=10&pool_timeout=20`

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn"] : ["error"],
    ...(datasourceUrl ? { datasourceUrl } : {}),
  })
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export default prisma