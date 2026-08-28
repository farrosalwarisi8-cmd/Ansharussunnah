// src/app/lupa-password/reset/page.tsx

"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { resetPassword } from "@/actions/password-reset"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft, Lock, Loader2, CheckCircle2 } from "lucide-react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""
  const token = searchParams.get("token") || ""

  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await resetPassword(email, token, password, confirmPassword)

    if (result.success) {
      setSuccess(true)
      setTimeout(() => router.push("/login"), 3000)
    } else {
      setError(result.message)
    }

    setLoading(false)
  }

  if (!email || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Link tidak valid. Silakan mulai dari awal.</p>
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
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Buat Password Baru</CardTitle>
            <CardDescription>
              Password minimal 8 karakter, mengandung huruf dan angka.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center py-6">
                <CheckCircle2 className="mx-auto h-12 w-12 text-success mb-3" />
                <p className="font-medium text-gray-900 mb-1">Password Berhasil Diubah!</p>
                <p className="text-sm text-gray-500">
                  Mengarahkan ke halaman login...
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
                  <Label htmlFor="password">Password Baru</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimal 8 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Ulangi password baru"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || password.length < 8}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Password Baru"
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