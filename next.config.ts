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

  // ✅ Disable source maps di production (mengurangi transfer size)
  productionBrowserSourceMaps: false,

  // ✅ Server Actions — body size limit (5MB untuk upload file)
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
    // Optimize tree-shaking untuk package besar yang dipakai lintas halaman.
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-avatar",
      "@radix-ui/react-toast",
      "@radix-ui/react-label",
      "@radix-ui/react-slot",
      "class-variance-authority",
      "tailwind-merge",
      "zod",
      "date-fns",
    ],
  },

  // ✅ Turbopack for faster dev builds
  turbopack: {},

  // ✅ Compiler optimizations — remove console.log in production
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  // ✅ Security Headers untuk Production
  async headers() {
    // Cache-Control ketat: tidak ada halaman dinamis (dashboard, data pribadi,
    // status pendaftaran) yang boleh di-cache publik. Aset statik yang
    // ber-hash Justru di-cache lama & immutable.
    const staticHeaders: Array<{ key: string; value: string }> = [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ]

    const identityHeaders: Array<{ key: string; value: string }> = [
      {
        key: "Cache-Control",
        value: "no-store, private",
      },
    ]

    // 'unsafe-eval' hanya dibutuhkan runtime development (webpack/Next dev).
    // Production build Next.js tidak memakai eval — jadi dihapus agar CSP
    // lebih ketat tanpa mengganggu workflow developer.
    const unsafeEval =
      process.env.NODE_ENV === "development" ? "'unsafe-eval' " : ""

    const securityHeaders: Array<{ key: string; value: string }> = [
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
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      {
        key: "Cross-Origin-Opener-Policy",
        value: "same-origin",
      },
      {
        key: "Cross-Origin-Resource-Policy",
        value: "same-origin",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          `script-src 'self' 'unsafe-inline' ${unsafeEval}https://va.vercel-scripts.com`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' blob: data: https://*.supabase.co",
          "font-src 'self'",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      },
    ]

    return [
      // Aset statik ber-hash — cache publik lama.
      {
        source: "/_next/static/(.*)",
        headers: [...securityHeaders, ...staticHeaders],
      },
      // File statik publik (logo dkk).
      {
        source: "/(.*)\\.(png|jpg|jpeg|webp|svg|ico|webmanifest)$",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "public, max-age=3600, must-revalidate" },
        ],
      },
      // Semua halaman dinamis — tidak boleh di-cache publik.
      {
        source: "/(.*)",
        headers: [...securityHeaders, ...identityHeaders],
      },
    ]
  },

  // ✅ Konfigurasi Image Optimization — gunakan AVIF + WebP untuk gambar lebih ringan
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
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
