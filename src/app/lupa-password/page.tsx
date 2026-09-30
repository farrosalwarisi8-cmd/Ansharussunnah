// src/app/lupa-password/page.tsx

"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react"
import { requestPasswordReset } from "@/actions/password-reset"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LupaPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await requestPasswordReset(email)

    if (result.success) {
      setSent(true)
      // Redirect ke halaman verifikasi OTP setelah 2 detik
      setTimeout(() => {
        router.push(`/lupa-password/verifikasi?email=${encodeURIComponent(email)}`)
      }, 2000)
    } else {
      setError(result.message)
    }

    setLoading(false)
  }

  return (
    <div className="batik-dark relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 sm:p-6">
      <div
        className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-yellow-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md">
        <Link
          href="/login"
          className="mb-6 inline-flex min-h-[44px] items-center gap-2 rounded-lg text-sm font-medium text-yellow-300/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Kembali ke Login</span>
        </Link>

        <Card className="overflow-hidden rounded-3xl border-slate-700 bg-slate-800/90 shadow-lifted">
          <CardHeader className="px-6 pb-6 pt-8 text-center">
            <div className="relative mx-auto mb-4 h-14 w-14">
              <Image
                src="/anshorussunnah-logo.webp"
                alt="Logo Anshorussunnah"
                fill
                sizes="56px"
                className="object-contain"
                priority
              />
            </div>
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-yellow-400/30 bg-yellow-400/10">
              <Mail className="h-5 w-5 text-yellow-300" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl font-extrabold tracking-tight text-white">
              Lupa Password?
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-slate-400">
              Masukkan email terdaftar Anda. Kami akan mengirimkan kode verifikasi untuk mereset
              password.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-8">
            {sent ? (
              <div className="py-6 text-center" role="status" aria-live="polite">
                <CheckCircle2
                  className="mx-auto mb-3 h-12 w-12 text-emerald-400"
                  aria-hidden="true"
                />
                <p className="mb-1 font-semibold text-white">Kode Terkirim!</p>
                <p className="text-sm text-slate-400">Mengarahkan ke halaman verifikasi...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Alert variant="danger">{error}</Alert>}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="email@contoh.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Mengirim...
                    </>
                  ) : (
                    "Kirim Kode Verifikasi"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-yellow-500" aria-hidden="true" />
          <span>Sistem Terenkripsi &amp; Terintegrasi Anshorussunnah</span>
        </p>
      </div>
    </div>
  )
}
