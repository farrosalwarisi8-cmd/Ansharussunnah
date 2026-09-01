// src/app/cek-pendaftaran/page.tsx

"use client"

import * as React from "react"
import { Search, GraduationCap, ArrowLeft, Loader2, FileText } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"

export default function CekPendaftaranPage() {
  const [nomor, setNomor] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [searched, setSearched] = React.useState(false)
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

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!nomor.trim()) return
    setLoading(true)
    setSearched(true)
    setResult(null)

    try {
      const res = await fetch(
        `/api/cek-pendaftaran?nomor=${encodeURIComponent(nomor.trim())}`
      )
      const data = await res.json()

      if (data.success && data.data) {
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden">
              <img src="/ansharussunnah-logo.jpeg" alt="Logo Ansharussunnah" className="w-full h-full object-cover" />
            </div>
            <span className="font-extrabold text-base text-slate-800">Ansharussunnah</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-500 hover:text-yellow-600 transition-colors min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 sm:py-16 max-w-xl flex-1 flex flex-col justify-center">
        <Card className="border-slate-200/80 bg-white shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="text-center pb-4 pt-8">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-yellow-50 text-yellow-500 flex items-center justify-center mb-3">
              <Search className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl sm:text-2xl font-extrabold text-slate-800">
              Cek Status Pendaftaran
            </CardTitle>
            <CardDescription className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto">
              Masukkan Nomor Pendaftaran resmi yang Anda terima saat mendaftar (contoh: REG-2024-XXXXX).
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 sm:p-8 pt-2 space-y-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
              <Input
                placeholder="REG-2024-XXXXX"
                value={nomor}
                onChange={(e) => setNomor(e.target.value)}
                className="h-12 rounded-xl text-base sm:text-sm uppercase tracking-wider font-mono"
                required
              />
              <Button
                type="submit"
                disabled={loading || !nomor.trim()}
                className="h-12 px-6 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-bold shrink-0 min-h-[48px]"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-1.5" />
                    Cek Status
                  </>
                )}
              </Button>
            </form>

            {/* Not Found State */}
            {searched && result && !result.found && (
              <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-2 animate-in fade-in">
                <p className="font-bold text-rose-900 text-sm">Nomor Pendaftaran Tidak Ditemukan</p>
                <p className="text-xs text-rose-600 leading-relaxed">
                  Mohon pastikan nomor yang Anda ketik sesuai dengan bukti pendaftaran Anda. Hubungi panitia jika mengalami kendala.
                </p>
              </div>
            )}

            {/* Result Found State */}
            {result?.found && result.data && (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    No. Registrasi
                  </span>
                  <span className="font-mono font-bold text-yellow-700 text-sm">
                    {result.data.nomorPendaftaran}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <span className="text-xs font-semibold text-slate-500">Nama Calon Santri</span>
                  <span className="font-bold text-slate-800 text-sm">{result.data.namaLengkap}</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <span className="text-xs font-semibold text-slate-500">Jenjang Tujuan</span>
                  <span className="font-semibold text-slate-700 text-sm">{result.data.jenjangTujuan}</span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold text-slate-500">Status Pendaftaran</span>
                  <StatusBadge status={result.data.status as "MENUNGGU_VERIFIKASI" | "DITERIMA" | "DITOLAK"} size="lg" />
                </div>

                {result.data.status === "DITOLAK" && result.data.alasanPenolakan && (
                  <div className="p-3.5 rounded-xl bg-rose-100 border border-rose-200 text-rose-900 text-xs">
                    <span className="font-bold block mb-1">Catatan Panitia:</span>
                    <p>{result.data.alasanPenolakan}</p>
                  </div>
                )}

                {(result.data.status === "MENUNGGU_PEMBAYARAN" || result.data.status === "DITOLAK") && (
                  <Button asChild className="w-full h-11 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white font-bold text-sm mt-2">
                    <Link href={`/pendaftaran/${result.data.nomorPendaftaran}/upload-bukti`}>
                      <FileText className="h-4 w-4 mr-2" />
                      Unggah Bukti Pembayaran
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="py-6 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Ansharussunnah
      </footer>
    </div>
  )
}