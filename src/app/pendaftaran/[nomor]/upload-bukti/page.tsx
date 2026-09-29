// src/app/pendaftaran/[nomor]/upload-bukti/page.tsx

import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Lock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { UploadBuktiForm } from "@/components/pendaftaran/upload-bukti-form"
import { isTokenAksesBelumKedaluwarsa } from "@/lib/pendaftaran-token"
import prisma from "@/lib/prisma"

interface UploadBuktiPageProps {
  params: Promise<{ nomor: string }>
}

// Server component: menolak menampilkan form bila pendaftaran tidak memenuhi
// syarat, sehingga pengguna tidak sempat mengisi form yang pasti ditolak.
// Penegakan yang menentukan tetap ada di server action
// uploadBuktiTransferPendaftaran (yang juga memeriksa token, status, dan masa
// berlaku token) — pemeriksaan di sini murni untuk UX.
export default async function UploadBuktiPage({ params }: UploadBuktiPageProps) {
  const { nomor } = await params

  const pendaftaran = await prisma.pendaftaran.findUnique({
    where: { nomorPendaftaran: nomor, deleted_at: null },
    select: {
      nomorPendaftaran: true,
      status: true,
      tokenAksesExpiraAt: true,
      emailOrangTuaTerverifikasiAt: true,
    },
  })

  if (!pendaftaran) {
    notFound()
  }

  const emailTerverifikasi = Boolean(pendaftaran.emailOrangTuaTerverifikasiAt)
  const tokenMasihBerlaku = isTokenAksesBelumKedaluwarsa(
    pendaftaran.tokenAksesExpiraAt
  )
  // MENUNGGU_PEMBAYARAN & DITOLAK boleh: pada DITOLAK bukti baru bisa
  // menghidupkan kembali pendaftaran, sama seperti di server action.
  const statusBolehUpload =
    pendaftaran.status === "MENUNGGU_PEMBAYARAN" ||
    pendaftaran.status === "DITOLAK"
  const uploadTerbuka = emailTerverifikasi && tokenMasihBerlaku && statusBolehUpload

  const pesanTerkunci = !emailTerverifikasi
    ? "Email orang tua belum diverifikasi. Buka halaman hasil pendaftaran, masukkan kode verifikasi dari email, lalu kembali ke halaman ini."
    : !tokenMasihBerlaku
      ? "Masa berlaku akses pendaftaran sudah habis (90 hari). Silakan hubungi panitia PPDB untuk lebih lanjut."
      : "Pendaftaran sudah diproses panitia, jadi tidak lagi bisa diunggah lewat halaman ini."

  if (uploadTerbuka) {
    return (
      <UploadBuktiForm
        nomorPendaftaran={pendaftaran.nomorPendaftaran}
      />
    )
  }

  return (
    <div className="min-h-screen batik-light flex items-center justify-center">
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full">
              <Lock className="h-8 w-8 text-amber-700" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              Upload Bukti Transfer Terkunci
            </h1>
            <p className="text-gray-600 text-sm">{pesanTerkunci}</p>
            <Link
              href={`/pendaftaran/sukses?nomor=${pendaftaran.nomorPendaftaran}`}
            >
              <div className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke halaman hasil pendaftaran
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
