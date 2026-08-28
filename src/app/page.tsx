// src/app/page.tsx

import Link from "next/link"
import { GraduationCap, UserPlus, LogIn, Search } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary rounded-xl p-2">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-900">
                {process.env.NEXT_PUBLIC_APP_NAME || "Sistem Pendaftaran Siswa"}
              </h1>
              <p className="text-xs text-gray-500">Portal Pendaftaran Online</p>
            </div>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/cek-pendaftaran"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary transition-colors"
            >
              <Search className="h-4 w-4" />
              Cek Status
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Login
            </Link>
            <Link
              href="/pendaftaran"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
            >
              <UserPlus className="h-4 w-4" />
              Daftar Sekarang
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4">
        <section className="py-20 text-center">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Pendaftaran Tahun Ajaran 2024/2025 Dibuka!
            </div>

            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              Pendaftaran Siswa Baru
              <span className="text-primary block">Mudah & Cepat</span>
            </h2>

            <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
              Daftarkan putra-putri Anda secara online. Proses pendaftaran yang
              simple, transparan, dan bisa dipantau kapan saja.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/pendaftaran"
                className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-0.5"
              >
                <UserPlus className="h-5 w-5" />
                Mulai Pendaftaran
              </Link>
              <Link
                href="/cek-pendaftaran"
                className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-gray-700 bg-white rounded-xl hover:bg-gray-50 transition-all border border-gray-200 shadow-sm"
              >
                <Search className="h-5 w-5" />
                Cek Status Pendaftaran
              </Link>
            </div>
          </div>
        </section>

        {/* Steps Section */}
        <section className="py-16">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-12">
            Cara Mendaftar
          </h3>
          <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: "1",
                title: "Isi Formulir",
                desc: "Lengkapi data calon siswa dan orang tua/wali",
                color: "bg-blue-500",
              },
              {
                step: "2",
                title: "Upload Dokumen",
                desc: "Unggah KK, akta lahir, dan pas foto",
                color: "bg-indigo-500",
              },
              {
                step: "3",
                title: "Bayar & Upload Bukti",
                desc: "Transfer biaya pendaftaran dan upload bukti transfer",
                color: "bg-violet-500",
              },
              {
                step: "4",
                title: "Verifikasi",
                desc: "Tim kami akan memverifikasi pendaftaran Anda",
                color: "bg-purple-500",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div
                  className={`${item.color} w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 shadow-lg`}
                >
                  {item.step}
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {item.title}
                </h4>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Info Section */}
        <section className="py-16">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              Informasi Biaya Pendaftaran
            </h3>
            <div className="bg-blue-50 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-gray-700 font-medium">
                  Biaya Pendaftaran
                </span>
                <span className="text-2xl font-bold text-primary">
                  Rp {parseInt(process.env.NEXT_PUBLIC_REGISTRATION_FEE || "500000").toLocaleString("id-ID")}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">
                Transfer ke Rekening:
              </h4>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Bank</span>
                  <span className="font-medium">
                    {process.env.NEXT_PUBLIC_BANK_NAME}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">No. Rekening</span>
                  <span className="font-mono font-medium">
                    {process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Atas Nama</span>
                  <span className="font-medium">
                    {process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          <p>
            © {new Date().getFullYear()}{" "}
            {process.env.NEXT_PUBLIC_APP_NAME || "Sistem Pendaftaran Siswa"}.
            All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}