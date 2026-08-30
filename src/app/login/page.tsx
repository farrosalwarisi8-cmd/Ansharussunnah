// src/app/login/page.tsx

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { GraduationCap, ArrowLeft, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import LoginForm from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative Ornaments */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300/80 hover:text-white mb-6 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Beranda</span>
        </Link>

        <Card className="border-slate-800 bg-slate-900/90 backdrop-blur-xl shadow-2xl text-white rounded-3xl overflow-hidden">
          <CardHeader className="text-center pt-8 pb-6 px-6">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-900/50 mb-4">
              <GraduationCap className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
              <span>Masuk Portal LMS</span>
              <span className="text-emerald-400">✦</span>
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm mt-1">
              Portal Akademik & Pembelajaran Pesantren Ansharussunnah
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-8">
            <Suspense fallback={<div className="h-40 bg-slate-800 animate-pulse rounded-xl" />}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>

        {/* Security Trust Note */}
        <div className="mt-6 text-center flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Sistem Terenkripsi & Terintegrasi Ansharussunnah</span>
        </div>
      </div>
    </div>
  )
}
