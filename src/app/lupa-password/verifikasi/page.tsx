// src/app/lupa-password/verifikasi/page.tsx

"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { verifyResetOtp, requestPasswordReset } from "@/actions/password-reset"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft, Shield, Loader2 } from "lucide-react"

export default function VerifikasiOtpPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""

  const [otp, setOtp] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [resendLoading, setResendLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [countdown, setCountdown] = React.useState(60)

  // Countdown untuk resend
  React.useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await verifyResetOtp(email, otp)

    if (result.success && result.data) {
      router.push(
        `/lupa-password/reset?email=${encodeURIComponent(email)}&token=${result.data.resetToken}`
      )
    } else {
      setError(result.message)
    }

    setLoading(false)
  }

  const handleResend = async () => {
    setResendLoading(true)
    setError(null)
    const result = await requestPasswordReset(email)
    if (result.success) {
      setCountdown(60)
      setOtp("")
    } else {
      setError(result.message)
    }
    setResendLoading(false)
  }

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Email tidak ditemukan. Silakan mulai dari awal.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          href="/lupa-password"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Verifikasi Kode OTP</CardTitle>
            <CardDescription>
              Masukkan 6 digit kode yang dikirim ke{" "}
              <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify} className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="otp">Kode OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  "Verifikasi Kode"
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              {countdown > 0 ? (
                <p className="text-sm text-gray-400">
                  Kirim ulang dalam {countdown}s
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  {resendLoading ? "Mengirim..." : "Kirim ulang kode"}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}