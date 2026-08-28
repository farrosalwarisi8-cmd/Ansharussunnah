// src/app/lupa-password/page.tsx

"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { requestPasswordReset } from "@/actions/password-reset"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft, Mail, Loader2, CheckCircle2 } from "lucide-react"

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Login
        </Link>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Lupa Password?</CardTitle>
            <CardDescription>
              Masukkan email terdaftar Anda. Kami akan mengirimkan kode
              verifikasi untuk mereset password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center py-6">
                <CheckCircle2 className="mx-auto h-12 w-12 text-success mb-3" />
                <p className="font-medium text-gray-900 mb-1">Kode Terkirim!</p>
                <p className="text-sm text-gray-500">
                  Mengarahkan ke halaman verifikasi...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@contoh.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
      </div>
    </div>
  )
}