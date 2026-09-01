// src/app/pendaftaran/sukses/page.tsx

import Link from "next/link"
import Image from "next/image"
import {
  CheckCircle2,
  Copy,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"

interface SuksesPageProps {
  searchParams: Promise<{ nomor?: string }>
}

export default async function SuksesPage({ searchParams }: SuksesPageProps) {
  const params = await searchParams
  const nomor = params.nomor

  if (!nomor) {
    notFound()
  }

  const pendaftaran = await prisma.pendaftaran.findUnique({
    where: { nomorPendaftaran: nomor },
  })

  if (!pendaftaran) {
    notFound()
  }

  const biaya = parseFloat(pendaftaran.biayaPendaftaran.toString())

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden relative">
            <Image src="/ansharussunnah-logo.jpeg" alt="Logo Ansharussunnah" fill sizes="36px" className="object-cover" priority />
          </div>
          <span className="font-bold text-gray-900">Pendaftaran Siswa Baru</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-2xl">
        {/* Success Banner */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-success/10 rounded-full mb-4">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Pendaftaran Berhasil!
          </h1>
          <p className="text-gray-500">
            Data pendaftaran Anda telah kami terima. Silakan selesaikan
            pembayaran untuk melanjutkan proses verifikasi.
          </p>
        </div>

        {/* Nomor Pendaftaran */}
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-gray-500 mb-1">Nomor Pendaftaran Anda</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-bold font-mono text-primary tracking-wider">
                {pendaftaran.nomorPendaftaran}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  navigator.clipboard.writeText(pendaftaran.nomorPendaftaran)
                }
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Simpan nomor ini untuk mengecek status pendaftaran Anda
            </p>
          </CardContent>
        </Card>

        {/* Status */}
        <div className="flex justify-center mb-6">
          <Badge variant="warning" className="text-sm px-4 py-1.5">
            {pendaftaran.status.replace(/_/g, " ")}
          </Badge>
        </div>

        {/* Instruksi Pembayaran */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Instruksi Pembayaran</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600 font-medium">
                  Biaya Pendaftaran
                </span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(biaya)}
                </span>
              </div>
              <div className="border-t border-blue-200 pt-3 space-y-2">
                <p className="text-sm text-gray-600">
                  Transfer ke rekening berikut:
                </p>
                <div className="bg-white rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-sm">Bank</span>
                    <span className="font-semibold">
                      {process.env.NEXT_PUBLIC_BANK_NAME}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-sm">No. Rekening</span>
                    <span className="font-mono font-semibold">
                      {process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-sm">Atas Nama</span>
                    <span className="font-semibold">
                      {process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800 font-medium mb-1">
                ⚠️ Penting:
              </p>
              <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                <li>
                  Transfer sesuai nominal:{" "}
                  <strong>{formatCurrency(biaya)}</strong>
                </li>
                <li>
                  Gunakan nomor pendaftaran{" "}
                  <strong>{pendaftaran.nomorPendaftaran}</strong> sebagai
                  keterangan transfer
                </li>
                <li>
                  Setelah transfer, segera upload bukti pembayaran di bawah ini
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/pendaftaran/${pendaftaran.nomorPendaftaran}/upload-bukti`}
            className="flex-1"
          >
            <Button size="xl" className="w-full">
              Upload Bukti Transfer
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/cek-pendaftaran" className="flex-1">
            <Button variant="outline" size="xl" className="w-full">
              Cek Status Nanti
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}