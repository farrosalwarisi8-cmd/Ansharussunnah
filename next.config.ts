// next.config.ts

import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // ✅ Konfigurasi batas upload server actions (5MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },

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

  // ✅ Konfigurasi Whitelist Supabase Storage domain
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/**",
      },
    ],
  },
}

export default nextConfig