// src/app/login/page.tsx

"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { login } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, ArrowLeft, Loader2, Lock, Mail, Sparkles, ShieldCheck } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectedFrom = searchParams.get("redirectedFrom")

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await login(formData)

    if (result.success) {
      router.push(redirectedFrom || "/dashboard")
      router.refresh()
    } else {
      setError(result.message || "Gagal masuk. Periksa email dan password Anda.")
      setLoading(false)
    }
  }

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
              <Sparkles className="h-4 w-4 text-emerald-400" />
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm mt-1">
              Portal Akademik & Pembelajaran Pesantren Ansharussunnah
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-8">
            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
                <span className="shrink-0 text-rose-400">⚠️</span>
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Alamat Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="nama@ansharussunnah.sch.id"
                    required
                    className="pl-10 h-12 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus-visible:ring-emerald-500 text-base sm:text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Password
                  </Label>
                  <Link
                    href="/lupa-password"
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                  >
                    Lupa password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    className="pl-10 h-12 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus-visible:ring-emerald-500 text-base sm:text-sm"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-lg shadow-emerald-900/50 transition-all active:scale-[0.99] mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Sedang Masuk...
                  </>
                ) : (
                  "Masuk ke Dashboard"
                )}
              </Button>
            </form>

            {/* Quick Links Section */}
            <div className="mt-8 pt-6 border-t border-slate-800 text-center space-y-3">
              <p className="text-xs text-slate-400">
                Calon santri baru belum punya akun?
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                <Link
                  href="/pendaftaran"
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
                >
                  Daftar Santri Baru
                </Link>
                <Link
                  href="/cek-pendaftaran"
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
                >
                  Cek Status Pendaftaran
                </Link>
              </div>
            </div>
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
