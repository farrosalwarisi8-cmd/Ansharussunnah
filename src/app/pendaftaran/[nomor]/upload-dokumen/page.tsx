// src/app/pendaftaran/[nomor]/upload-dokumen/page.tsx

import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import { UploadDokumenForm } from "@/components/pendaftaran/upload-dokumen-form"

interface UploadDokumenPageProps {
  params: Promise<{ nomor: string }>
}

export default async function UploadDokumenPage({
  params,
}: UploadDokumenPageProps) {
  const { nomor } = await params

  const pendaftaran = await prisma.pendaftaran.findUnique({
    where: { nomorPendaftaran: nomor, deleted_at: null },
    select: {
      nomorPendaftaran: true,
      dokKartuKeluarga: true,
      dokAkteLahir: true,
      dokFoto: true,
    },
  })

  if (!pendaftaran) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden relative">
              <Image
                src="/ansharussunnah-logo.webp"
                alt="Logo Ansharussunnah"
                fill
                sizes="36px"
                className="object-contain"
                priority
              />
            </div>
            <span className="font-bold text-gray-900">
              Upload Dokumen Pendaftaran
            </span>
          </div>
          <Link
            href={`/pendaftaran/sukses?nomor=${pendaftaran.nomorPendaftaran}`}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-1">Nomor Pendaftaran</p>
          <p className="text-xl font-bold font-mono text-primary">
            {pendaftaran.nomorPendaftaran}
          </p>
        </div>

        <UploadDokumenForm
          nomorPendaftaran={pendaftaran.nomorPendaftaran}
          sudahAda={{
            kartuKeluarga: Boolean(pendaftaran.dokKartuKeluarga),
            akteLahir: Boolean(pendaftaran.dokAkteLahir),
            foto: Boolean(pendaftaran.dokFoto),
          }}
        />
      </main>
    </div>
  )
}