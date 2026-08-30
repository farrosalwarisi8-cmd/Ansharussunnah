// src/app/layout.tsx

import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

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
      <body className={`${inter.className} min-h-screen bg-slate-50/50 antialiased text-slate-900 selection:bg-emerald-100 selection:text-emerald-900`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}