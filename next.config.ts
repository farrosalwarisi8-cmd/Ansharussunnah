// next.config.ts

import type { NextConfig } from "next"
import createBundleAnalyzer from "@next/bundle-analyzer"

const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})

const nextConfig: NextConfig = {
  // ✅ Output standalone untuk deployment lebih ringan (~80% lebih kecil)
  output: "standalone",

  // ✅ React Strict Mode — membantu mendeteksi masalah di development
  reactStrictMode: true,

  // ✅ Aktifkan gzip compression
  compress: true,

  // ✅ Server Actions — body size limit (5MB untuk upload file)
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },

  // ✅ Turbopack for faster dev builds
  turbopack: {},

  // ✅ Compiler optimizations — remove console.log in production
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
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
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data: https://*.supabase.co",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ]
  },

  // ✅ Konfigurasi Image Optimization — gunakan AVIF + WebP untuk gambar lebih ringan
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/**",
      },
    ],
  },
}

export default withBundleAnalyzer(nextConfig)
