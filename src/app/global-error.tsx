// src/app/global-error.tsx
// Error boundary global (tingkat root) yang menangkap error tak terduga di luar
// error.tsx, termasuk saat root layout gagal dirender.

"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Global Application Error:", error)
  }, [error])

  return (
    <html lang="id">
      <body>
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-destructive/10 rounded-full mb-6">
              <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Terjadi Kesalahan
            </h2>
            <p className="text-gray-500 mb-8">
              Maaf, terjadi kesalahan yang tidak terduga. Silakan coba lagi
              atau hubungi administrator sekolah.
            </p>
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Coba Lagi
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
