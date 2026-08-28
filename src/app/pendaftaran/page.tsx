// src/app/pendaftaran/page.tsx

import { PendaftaranForm } from "@/components/pendaftaran/pendaftaran-form"
import { getJenjangDenganKelas } from "@/actions/jenjang-kelas"
import { GraduationCap, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function PendaftaranPage() {
  // Ambil data jenjang & kelas dari server
  const jenjangData = await getJenjangDenganKelas()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="bg-primary rounded-xl p-2">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">Pendaftaran Siswa Baru</span>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Formulir Pendaftaran
          </h1>
          <p className="text-gray-500">
            Lengkapi data berikut untuk mendaftarkan calon siswa baru.
            Pastikan semua data yang diisi sudah benar.
          </p>
        </div>

        <PendaftaranForm
          jenjangList={jenjangData.data || []}
        />
      </main>
    </div>
  )
}