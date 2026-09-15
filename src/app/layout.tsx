// src/app/layout.tsx

import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"

const inter = Inter({ subsets: ["latin"], display: "swap", preload: true })

// Origin Supabase yang sebenarnya (dari env) untuk preconnect & dns-prefetch
// gambar. Wildcard (*) tidak valid untuk preconnect, jadi pakai origin spesifik.
const supabaseOrigin = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jjybghdoagdumcdujdgm.supabase.co").replace(/\/$/, "")

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://anshorussunnah.com").replace(/\/$/, "")

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Anshorussunnah - Sistem Manajemen Sekolah & LMS",
    template: "%s | Anshorussunnah",
  },
  description:
    "Membina Generasi Qurani Berakhlak Mulia & Unggul Akademik. Platform Manajemen Pendidikan & Pembelajaran Digital Pesantren/Sekolah Anshorussunnah.",
  keywords: [
    "Anshorussunnah",
    "Pesantren Anshorussunnah",
    "LMS Anshorussunnah",
    "Sistem Informasi Sekolah",
    "Pendaftaran Santri Baru",
    "PPDB Pesantren",
  ],
  authors: [{ name: "Pesantren Anshorussunnah" }],
  creator: "Pesantren Anshorussunnah",
  publisher: "Pesantren Anshorussunnah",
  applicationName: "Anshorussunnah LMS",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: siteUrl,
    siteName: "Anshorussunnah",
    title: "Anshorussunnah - Sistem Manajemen Sekolah & LMS",
    description:
      "Membina Generasi Qurani Berakhlak Mulia & Unggul Akademik. Platform pembelajaran terpadu pesantren Anshorussunnah.",
    images: [
      {
        url: "/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "Logo Pesantren Anshorussunnah",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Anshorussunnah - Sistem Manajemen Sekolah & LMS",
    description:
      "Membina Generasi Qurani Berakhlak Mulia & Unggul Akademik. Platform pembelajaran terpadu pesantren Anshorussunnah.",
    images: ["/icon-512x512.png"],
  },
  other: {
    "theme-color": "#f59e0b",
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "Pesantren & Sekolah Anshorussunnah",
  alternateName: "Anshorussunnah",
  url: siteUrl,
  logo: `${siteUrl}/icon-512x512.png`,
  image: `${siteUrl}/icon-512x512.png`,
  description:
    "Membina Generasi Qurani Berakhlak Mulia & Unggul Akademik. Platform Manajemen Pendidikan & Pembelajaran Digital Pesantren/Sekolah Anshorussunnah.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" className="scroll-smooth">
      <head>
        <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={supabaseOrigin} />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.className} min-h-screen bg-slate-50/50 antialiased text-slate-800 selection:bg-yellow-100 selection:text-yellow-800`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}