// src/lib/prisma.ts

import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // Konfigurasi pool yang tepat untuk serverless (Vercel):
  // - Lewat transaction pooler (Supabase `pgbouncer=true` / Neon `-pooler`):
  //   1 koneksi per instance. connection_limit tinggi justru memicu
  //   P2024 (pool exhaustion) saat banyak lambda berjalan bersamaan.
  // - Koneksi langsung tanpa pooler: batasi 5 agar aman untuk banyak request.
  const dbUrl = process.env.DATABASE_URL ?? ""
  let datasourceUrl: string | undefined

  try {
    const url = new URL(dbUrl)
    const params = url.searchParams

    if (!params.has("connection_limit")) {
      const viaPooler = params.get("pgbouncer") === "true"
      params.set("connection_limit", viaPooler ? "1" : "5")
    }
    if (!params.has("pool_timeout")) {
      // Fail fast ketimbang menggantung 20s saat pool penuh.
      params.set("pool_timeout", "5")
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