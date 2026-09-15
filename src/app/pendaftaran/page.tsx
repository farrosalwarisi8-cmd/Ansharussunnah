// src/app/pendaftaran/page.tsx

import { PendaftaranForm } from "@/components/pendaftaran/pendaftaran-form"
import { getJenjangDenganKelas } from "@/actions/jenjang-kelas"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default async function PendaftaranPage() {
  // Ambil data jenjang & kelas dari server
  let jenjangData: Awaited<ReturnType<typeof getJenjangDenganKelas>> = { success: false, message: "Data jenjang tidak tersedia.", data: [] }
  try {
    jenjangData = await getJenjangDenganKelas()
  } catch {
    // Database tidak tersedia — tampilkan form dengan data kosong
  }

  return (
    <div className="min-h-screen batik-light">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden relative">
              <Image src="/anshorussunnah-logo.webp" alt="Logo Anshorussunnah" fill sizes="36px" className="object-contain" priority />
            </div>
            <span className="font-bold text-gray-900">Pendaftaran Santri Baru</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
        </div>
      </header>

      {/* Form */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Formulir Pendaftaran
          </h1>
          <p className="text-base text-gray-800 font-medium leading-relaxed">
            Silakan lengkapi seluruh data di bawah ini untuk mendaftarkan calon santri baru.
          </p>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            Formulir terdiri dari <span className="font-semibold text-gray-800">5 langkah</span>:
            data calon santri, data orang tua/wali, asal sekolah, berkas persyaratan, dan konfirmasi.
            Kolom bertanda <span className="text-red-500 font-bold">*</span> wajib diisi. Pastikan semua
            data benar sebelum menekan tombol lanjut — kesalahan data dapat mempengaruhi proses verifikasi.
          </p>
        </div>

        <PendaftaranForm
          jenjangList={jenjangData.data || []}
        />
      </main>
    </div>
  )
}