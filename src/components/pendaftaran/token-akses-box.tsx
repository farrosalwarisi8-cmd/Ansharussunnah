// src/components/pendaftaran/token-akses-box.tsx

"use client"

import * as React from "react"
import { Copy, Check, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getTokenAkses } from "@/lib/pendaftaran-token-client"

// Menampilkan Token Akses Pendaftaran yang tersimpan di sessionStorage
// (hanya muncul jika pengguna mendaftar pada perangkat/tab ini). Token ini
// rahasia: dibutuhkan bersama nomor pendaftaran untuk mengunggah dokumen
// atau bukti transfer, sehingga hanya pemilik yang bisa melengkapi berkas.
export function TokenAksesBox({ nomor }: { nomor: string }) {
  const [token, setToken] = React.useState("")
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    setToken(getTokenAkses(nomor))
  }, [nomor])

  if (!token) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = token
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopied(true)
    }
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound className="h-4 w-4 text-amber-700" />
        <p className="text-sm font-semibold text-amber-900">
          Token Akses Pendaftaran
        </p>
      </div>
      <p className="text-xs text-amber-700 mb-2">
        Rahasia — bersama nomor pendaftaran, dipakai untuk mengunggah dokumen &
        bukti transfer. Salin dan simpan di tempat aman.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-white border border-amber-200 px-3 py-2 text-sm font-mono text-amber-900">
          {token}
        </code>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleCopy}
          aria-label="Salin token akses"
        >
          {copied ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}