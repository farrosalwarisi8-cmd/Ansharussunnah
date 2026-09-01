// src/app/layout.tsx

import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"

const inter = Inter({ subsets: ["latin"], display: "swap" })

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
      <body className={`${inter.className} min-h-screen bg-slate-50/50 antialiased text-slate-800 selection:bg-yellow-100 selection:text-yellow-800`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}