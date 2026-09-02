// src/app/page.tsx

import Link from "next/link"
import Image from "next/image"
import {
  UserPlus,
  LogIn,
  Search,
  BookOpen,
  ShieldCheck,
  Users,
  CheckCircle,
  ArrowRight,
  Sparkles,
  HeartHandshake,
  Building,
} from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-yellow-100 selection:text-yellow-800">
      {/* 1. Header / Navbar */}
      {/* NOTE: sengaja pakai bg opaque (bukan backdrop-blur). backdrop-filter
          membuat GPU bekerja terus-menerus saat scroll & mahal di HP kelas
          bawah / koneksi desa. */}
      <header className="border-b border-slate-200/80 bg-white sticky top-0 z-50 transition-all">
        <div className="container mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden relative shadow-md shadow-emerald-900/20">
              <Image src="/ansharussunnah-logo.webp" alt="Logo Ansharussunnah" fill sizes="(max-width: 640px) 48px, 56px" className="object-cover" priority />
            </div>
            <div>
              <div className="font-extrabold text-base sm:text-lg text-slate-800 tracking-tight flex items-center gap-1.5">
                <span>Ansharussunnah</span>
                <span className="hidden sm:inline-block text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                  Pesantren & Sekolah
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Portal Akademik & Santri Baru</p>
            </div>
          </div>

          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/cek-pendaftaran"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-yellow-600 transition-colors min-h-[44px]"
            >
              <Search className="h-4 w-4" />
              <span className="hidden md:inline">Cek Status</span>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all min-h-[44px]"
            >
              <LogIn className="h-4 w-4 text-slate-500" />
              <span>Login LMS</span>
            </Link>
            <Link
              href="/pendaftaran"
              className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-yellow-600 hover:bg-yellow-700 rounded-xl transition-all shadow-md shadow-yellow-700/20 min-h-[44px]"
            >
              <UserPlus className="h-4 w-4" />
              <span>Daftar Sekarang</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 bg-gradient-to-b from-yellow-900 via-slate-800 to-slate-800 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(#22c55e_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />
        <div className="container mx-auto px-4 sm:px-6 relative z-10 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 text-amber-200 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold mb-8">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span>Penerimaan Santri Baru (PSB) Tahun Ajaran 2024/2025 Dibuka</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Membina Generasi Qurani Berakhlak Mulia &amp;{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-300">
              Unggul Akademik
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            Platform pembelajaran terpadu pesantren Ansharussunnah. Pantau perkembangan hafalan, nilai akademik, tugas, ujian, dan pembayaran SPP dalam satu portal modern.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/pendaftaran"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-slate-800 bg-amber-400 hover:bg-amber-300 rounded-2xl transition-all shadow-lg shadow-amber-500/20 hover:scale-[1.02] min-h-[50px]"
            >
              <UserPlus className="h-5 w-5" />
              <span>Daftar Santri Baru</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-2xl transition-all min-h-[50px]"
            >
              <LogIn className="h-5 w-5 text-yellow-400" />
              <span>Masuk Portal LMS</span>
            </Link>
          </div>

          {/* Quick Stats Banner */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto text-left">
            {[
              { label: "Kurikulum Terpadu", value: "Salaf & Nasional", icon: BookOpen },
              { label: "Tenaga Pendidik", value: "Berpengalaman", icon: Users },
              { label: "Fasilitas Belajar", value: "Modern & Nyaman", icon: Building },
              { label: "Sistem Manajemen", value: "100% Digital", icon: ShieldCheck },
            ].map((stat, idx) => {
              const Icon = stat.icon
              return (
                <div key={idx} className="p-4 rounded-2xl bg-slate-800 border border-slate-700">
                  <Icon className="h-5 w-5 text-amber-400 mb-2" />
                  <div className="font-bold text-white text-sm sm:text-base">{stat.value}</div>
                  <div className="text-xs text-slate-400">{stat.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 3. Steps to Register */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-200/80">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200/60">
              Alur Pendaftaran Cepat
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-800 mt-3">
              4 Langkah Mudah Menjadi Santri
            </h2>
            <p className="text-slate-500 text-sm sm:text-base mt-2">
              Proses pendaftaran santri baru dilakukan secara online dan transparan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Isi Formulir",
                desc: "Lengkapi biodata calon santri, orang tua/wali, serta pilihan jenjang pendidikan.",
              },
              {
                step: "02",
                title: "Unggah Berkas",
                desc: "Upload foto Kartu Keluarga (KK), Akta Kelahiran, dan Pas Foto santri terbaru.",
              },
              {
                step: "03",
                title: "Transfer & Bukti",
                desc: "Transfer biaya administrasi pendaftaran dan upload bukti transfer.",
              },
              {
                step: "04",
                title: "Verifikasi & Hasil",
                desc: "Tim panitia memverifikasi berkas. Pantau status penerimaan langsung via web.",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="relative p-6 rounded-3xl bg-slate-50 border border-slate-200/80              hover:border-amber-300 hover:shadow-lg transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-600 to-yellow-700 text-white font-extrabold text-lg flex items-center justify-center mb-4 shadow-md shadow-yellow-700/20 group-hover:scale-105 transition-transform">
                  {item.step}
                </div>
                <h3 className="font-bold text-lg text-slate-800 mb-2">{item.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/pendaftaran"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-yellow-600 hover:bg-yellow-700 text-white font-bold text-sm shadow-md transition-all min-h-[44px]"
            >
              <UserPlus className="h-4 w-4" />
              <span>Mulai Isi Formulir Pendaftaran Sekarang</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Keunggulan Sistem LMS */}
      <section className="py-16 sm:py-24 bg-slate-50">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-yellow-600 bg-yellow-100/60 px-3 py-1 rounded-full">
              Fitur Lengkap Terintegrasi
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-800 mt-3">
              Portal Akademik Modern untuk Semua Role
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-yellow-100 text-yellow-600 flex items-center justify-center font-bold">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg text-slate-800">Untuk Asatidz &amp; Guru</h3>
              <ul className="text-xs sm:text-sm text-slate-600 space-y-2.5">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                  <span>Input absensi kelas cepat di mobile</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                  <span>Buat ujian online (PG &amp; Esai)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                  <span>Kelola tugas &amp; input nilai rapor</span>
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-2xl overflow-hidden relative">
                <Image src="/ansharussunnah-logo.webp" alt="Logo Ansharussunnah" fill sizes="48px" className="object-contain" />
              </div>
              <h3 className="font-bold text-lg text-slate-800">Untuk Santri / Siswa</h3>
              <ul className="text-xs sm:text-sm text-slate-600 space-y-2.5">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                  <span>Kerjakan ujian dengan countdown timer</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                  <span>Kirim tugas &amp; unduh materi belajar</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                  <span>Lihat rapor hasil belajar digital</span>
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg text-slate-800">Untuk Wali Santri</h3>
              <ul className="text-xs sm:text-sm text-slate-600 space-y-2.5">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>Selector multi-anak yang aman &amp; jelas</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>Pantau kehadiran &amp; nilai santri</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>Bayar SPP &amp; upload bukti transfer</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Footer */}
      <footer className="bg-slate-800 text-slate-400 py-12 border-t border-slate-700">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden relative">
              <Image src="/ansharussunnah-logo.webp" alt="Logo Ansharussunnah" fill sizes="36px" className="object-contain" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">Pesantren Ansharussunnah</div>
              <div className="text-xs text-slate-500">Mencetak Generasi Berakhlak &amp; Berilmu</div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs font-medium">
            <Link href="/pendaftaran" className="hover:text-amber-400 transition-colors">
              Pendaftaran Baru
            </Link>
            <Link href="/cek-pendaftaran" className="hover:text-amber-400 transition-colors">
              Cek Status
            </Link>
            <Link href="/login" className="hover:text-amber-400 transition-colors">
              Portal LMS
            </Link>
          </div>

          <p className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} Ansharussunnah. Hak cipta dilindungi.
          </p>
        </div>
      </footer>
    </div>
  )
}