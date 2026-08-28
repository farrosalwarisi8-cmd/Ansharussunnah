// src/app/api/health/route.ts

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  const startTime = Date.now()

  try {
    // Cek koneksi database
    await prisma.$queryRaw`SELECT 1`
    const dbLatency = Date.now() - startTime

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: "connected",
        latencyMs: dbLatency,
      },
      environment: process.env.NODE_ENV || "development",
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        database: {
          status: "disconnected",
          error: "Database connection failed",
        },
      },
      { status: 503 }
    )
  }
}