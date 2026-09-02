// src/app/layout.tsx

import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"

const inter = Inter({ subsets: ["latin"], display: "swap", preload: true })

export const metadata: Metadata = {
  title: "Ansharussunnah - Sistem Manajemen Sekolah & LMS",
  description: "Platform Manajemen Pendidikan & Pembelajaran Digital Pesantren/Sekolah Ansharussunnah",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" className="scroll-smooth">
      <head>
        {/* Preconnect ke Supabase untuk load gambar lebih cepat */}
        <link rel="preconnect" href="https://*.supabase.co" />
        <link rel="dns-prefetch" href="https://*.supabase.co" />
      </head>
      <body className={`${inter.className} min-h-screen bg-slate-50/50 antialiased text-slate-800 selection:bg-yellow-100 selection:text-yellow-800`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}