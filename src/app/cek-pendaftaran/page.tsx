// src/app/cek-pendaftaran/page.tsx

"use client"

import * as React from "react"
import { Search, GraduationCap } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const statusVariant: Record<string, "default" | "warning" | "success" | "destructive"> = {
  MENUNGGU_PEMBAYARAN: "warning",
  MENUNGGU_VERIFIKASI: "default",
  DITERIMA: "success",
  DITOLAK: "destructive",
}

const statusLabel: Record<string, string> = {
  MENUNGGU_PEMBAYARAN: "Menunggu Pembayaran",
  MENUNGGU_VERIFIKASI: "Menunggu Verifikasi",
  DITERIMA: "Diterima",
  DITOLAK: "Ditolak",
}

export default function CekPendaftaranPage() {
  const [nomor, setNomor] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<{
    found: boolean
    data?: {
      nomorPendaftaran: string
      namaLengkap: string
      status: string
      jenjangTujuan: string
      alasanPenolakan?: string | null
    }
  } | null>(null)

  const handleSearch = async () => {
    if (!nomor.trim()) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch(
        `/api/cek-pendaftaran?nomor=${encodeURIComponent(nomor.trim())}`
      )
      const data = await res.json()

      if (data.success) {
        setResult({ found: true, data: data.data })
      } else {
        setResult({ found: false })
      }
    } catch {
      setResult({ found: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="bg-primary rounded-xl p-2">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">Cek Status Pendaftaran</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Cek Status Pendaftaran
        </h1>

        <div className="flex gap-2 mb-6">
          <Input
            placeholder="Masukkan nomor pendaftaran (REG-2024-XXXXX)"
            value={nomor}
            onChange={(e) => setNomor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={loading}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {result && !result.found && (
          <Card>
            <CardContent className="p-6 text-center text-gray-500">
              Nomor pendaftaran tidak ditemukan.
            </CardContent>
          </Card>
        )}

        {result?.found && result.data && (
          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">No. Pendaftaran</span>
                <span className="font-mono font-bold text-primary">
                  {result.data.nomorPendaftaran}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">Nama</span>
                <span className="font-medium">{result.data.namaLengkap}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">Jenjang</span>
                <span className="font-medium">{result.data.jenjangTujuan}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Status</span>
                <Badge variant={statusVariant[result.data.status] || "default"}>
                  {statusLabel[result.data.status] || result.data.status}
                </Badge>
              </div>
              {result.data.status === "DITOLAK" && result.data.alasanPenolakan && (
                <div className="bg-destructive/10 rounded-lg p-3 mt-2">
                  <p className="text-xs text-destructive font-medium">Alasan Penolakan:</p>
                  <p className="text-sm text-destructive">{result.data.alasanPenolakan}</p>
                </div>
              )}
              {result.data.status === "MENUNGGU_PEMBAYARAN" && (
                <Link href={`/pendaftaran/${result.data.nomorPendaftaran}/upload-bukti`}>
                  <Button className="w-full mt-2" size="sm">
                    Upload Bukti Transfer
                  </Button>
                </Link>
              )}
              {result.data.status === "DITOLAK" && (
                <Link href={`/pendaftaran/${result.data.nomorPendaftaran}/upload-bukti`}>
                  <Button className="w-full mt-2" variant="outline" size="sm">
                    Upload Ulang Bukti Transfer
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}