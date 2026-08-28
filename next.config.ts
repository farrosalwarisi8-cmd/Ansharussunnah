// next.config.ts

import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // ✅ Security Headers untuk Production
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ]
  },

  // ✅ Izinkan domain gambar dari Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/**",
      },
    ],
  },

  // ✅ Batasi ukuran body untuk API routes (default 1MB, naikkan untuk upload)
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
}

export default nextConfig