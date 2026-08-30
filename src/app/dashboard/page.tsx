// src/app/dashboard/page.tsx

"use client"

import * as React from "react"
import { useDashboard, type DashboardUser, type ChildStudent } from "@/components/dashboard/dashboard-context"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Role } from "@prisma/client"
import {
  CalendarCheck2,
  Award,
  FileCheck2,
  CreditCard,
  Users2,
  DollarSign,
  Clock,
  Sparkles,
  Plus,
  Eye,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"

export default function DashboardPage() {
  const { user, selectedChild } = useDashboard()

  return (
    <div className="space-y-6">
      {/* 1. Header with custom greetings */}
      <DashboardHeader
        title={`Assalamu'alaikum, ${user.nama}`}
        subtitle="Selamat datang di Portal Akademik & LMS Terpadu Ansharussunnah."
      />

      {/* 2. Child Selector for Orang Tua */}
      {user.role === Role.ORANG_TUA && <ChildSelector />}

      {/* 3. Role-Specific Content */}
      {user.role === Role.GURU && <GuruDashboardHome />}
      {user.role === Role.SISWA && <SiswaDashboardHome user={user} />}
      {user.role === Role.ORANG_TUA && <OrangTuaDashboardHome selectedChild={selectedChild} />}
      {user.role === Role.ADMIN_KEUANGAN && <KeuanganDashboardHome />}
      {(user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_AKADEMIK) && (
        <AdminDashboardHome />
      )}
    </div>
  )
}

/* ========================================================================= */
/* A. GURU DASHBOARD HOME                                                    */
/* ========================================================================= */
function GuruDashboardHome() {
  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Kelas Diampu
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Users2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
              4 Kelas
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Total 120 Santri</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Perlu Dinilai
              </span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <FileCheck2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-2">
              18 Tugas
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Dari 2 tugas aktif</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Ujian Aktif
              </span>
              <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                <Award className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
              2 Ujian
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Pekan UTS Ganjil</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Kehadiran Hari Ini
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <CalendarCheck2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-2">
              96.5%
            </div>
            <span className="text-xs text-emerald-600 mt-1 block font-medium">3 kelas terinput</span>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-3xl p-5 sm:p-6 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-700/60 text-emerald-200 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Aksi Cepat Guru</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold">Isi Absensi Kelas Hari Ini</h2>
          <p className="text-xs sm:text-sm text-emerald-200/80 max-w-xl">
            Pastikan seluruh kehadiran santri tercatat tepat waktu untuk laporan harian wali santri.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
          <Button asChild className="bg-emerald-400 hover:bg-emerald-300 text-slate-900 font-bold rounded-xl min-h-[44px]">
            <Link href="/dashboard/absensi">
              <CalendarCheck2 className="h-4 w-4 mr-1.5" />
              Buka Absensi Cepat
            </Link>
          </Button>
          <Button asChild variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl min-h-[44px]">
            <Link href="/dashboard/ujian/buat">
              <Plus className="h-4 w-4 mr-1.5" />
              Buat Ujian
            </Link>
          </Button>
        </div>
      </div>

      {/* Two Column Layout on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tugas Perlu Dinilai */}
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Tugas Memerlukan Penilaian
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Pengumpulan tugas terbaru santri
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-emerald-700 hover:text-emerald-800">
              <Link href="/dashboard/tugas">Lihat Semua</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-5 divide-y divide-slate-100">
            {[
              { mapel: "Bahasa Arab", judul: "Tashrif Fi'il Tsulatsi Mujarrad", kelas: "7A - Ikhwan", pending: 12, deadline: "Hari Ini" },
              { mapel: "Tahfidz & Tajwid", judul: "Setoran Hafalan Surat Al-Mulk", kelas: "8B - Akhwat", pending: 6, deadline: "Kemarin" },
            ].map((item, idx) => (
              <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      {item.mapel}
                    </span>
                    <span className="text-xs text-slate-500">{item.kelas}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">{item.judul}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    {item.pending} Belum Dinilai
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Ujian Mendatang / Aktif */}
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Jadwal Ujian Aktif
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Monitoring pelaksanaan evaluasi
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-emerald-700 hover:text-emerald-800">
              <Link href="/dashboard/ujian">Kelola Ujian</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-5 divide-y divide-slate-100">
            {[
              { mapel: "Fiqih Ibadah", judul: "Penilaian Harian Thaharah & Shalat", kelas: "Kelas 7 & 8", status: "PUBLISHED", durasi: "60 Menit" },
              { mapel: "Aqidah Akhlak", judul: "Kuis Rukun Iman & Tauhid", kelas: "Kelas 9A", status: "DRAFT", durasi: "45 Menit" },
            ].map((item, idx) => (
              <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                      {item.mapel}
                    </span>
                    <span className="text-xs text-slate-500">{item.durasi}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">{item.judul}</div>
                </div>
                <StatusBadge status={item.status as any} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* B. SISWA DASHBOARD HOME                                                   */
/* ========================================================================= */
function SiswaDashboardHome({ user }: { user: DashboardUser }) {
  return (
    <div className="space-y-6">
      {/* Top Banner with Student Class & Quick Motivation */}
      <div className="bg-gradient-to-tr from-emerald-800 to-teal-700 rounded-3xl p-5 sm:p-7 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs uppercase font-bold text-emerald-200 tracking-wider">
              {user.kelas ? `${user.kelas.jenjang?.nama} - ${user.kelas.nama}` : "Santri Ansharussunnah"}
            </span>
            <h2 className="text-xl sm:text-2xl font-black">
              Tetap Semangat Menuntut Ilmu, {user.nama.split(" ")[0]}!
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-lg leading-relaxed">
              &ldquo;Barangsiapa menempuh jalan untuk menuntut ilmu, Allah mudahkan jalannya menuju Surga.&rdquo; (HR. Muslim)
            </p>
          </div>
          <Button asChild className="bg-emerald-400 hover:bg-emerald-300 text-slate-900 font-bold rounded-xl shrink-0 min-h-[44px]">
            <Link href="/dashboard/ujian">
              <Award className="h-4 w-4 mr-1.5" />
              Kerjakan Ujian
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Tugas Belum Dikirim</span>
              <FileCheck2 className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-2">
              2 Tugas
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Deadline terdekat: Besok</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Ujian Menunggu</span>
              <Award className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
              1 Ujian
            </div>
            <span className="text-xs text-emerald-600 mt-1 block font-medium">Fiqih Ibadah</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Kehadiran Bulan Ini</span>
              <CalendarCheck2 className="h-4 w-4 text-teal-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-teal-700 mt-2">
              98.2%
            </div>
            <span className="text-xs text-slate-500 mt-1 block">22 Hadir, 1 Izin</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Status SPP</span>
              <CreditCard className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-2">
              Lunas
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Bulan Berjalan</span>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tugas Pending */}
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-900">
              Tugas Mendatang
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs text-emerald-700">
              <Link href="/dashboard/tugas">Buka Tugas</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-5 divide-y divide-slate-100">
            <div className="py-3 first:pt-0 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  Bahasa Arab
                </span>
                <div className="text-sm font-bold text-slate-900">
                  Latihan Tashrif Fi&apos;il Tsulatsi
                </div>
                <div className="text-xs text-slate-500">Deadline: 20:00 WIB Hari Ini</div>
              </div>
              <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl min-h-[38px]">
                <Link href="/dashboard/tugas">Kirim</Link>
              </Button>
            </div>
            <div className="py-3 last:pb-0 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                  Hadits Arba&apos;in
                </span>
                <div className="text-sm font-bold text-slate-900">
                  Resume Hadits Ke-1 &amp; Ke-2
                </div>
                <div className="text-xs text-slate-500">Deadline: 2 Hari Lagi</div>
              </div>
              <Button asChild size="sm" variant="outline" className="rounded-xl min-h-[38px]">
                <Link href="/dashboard/tugas">Detail</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Ujian Tersedia */}
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-900">
              Ujian Tersedia
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs text-emerald-700">
              <Link href="/dashboard/ujian">Semua Ujian</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-5">
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-full shadow-sm">
                  Fiqih Ibadah
                </span>
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> 60 Menit
                </span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Penilaian Harian Thaharah &amp; Shalat Berjamaah
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  25 Soal Pilihan Ganda &amp; 2 Soal Esai
                </p>
              </div>
              <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[44px]">
                <Link href="/dashboard/ujian">Mulai Ujian Sekarang</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* C. ORANG TUA DASHBOARD HOME                                               */
/* ========================================================================= */
function OrangTuaDashboardHome({ selectedChild }: { selectedChild: ChildStudent | null }) {
  const childName = selectedChild?.nama || "Santri"
  const childClass = selectedChild ? `${selectedChild.jenjangNama} - ${selectedChild.kelasNama}` : "Kelas Santri"

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Kehadiran Santri</span>
              <CalendarCheck2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-2">
              98.5%
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Hadir aktif bulan ini</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Tugas Santri</span>
              <FileCheck2 className="h-4 w-4 text-teal-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
              100%
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Semua tugas dikumpulkan</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Rata-rata Nilai</span>
              <Award className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-800 mt-2">
              88.4
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Predikat Sangat Baik (A)</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Tagihan SPP</span>
              <CreditCard className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-2">
              Lunas
            </div>
            <span className="text-xs text-emerald-600 mt-1 block font-medium">Tidak ada tunggakan</span>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rapor & Nilai Terakhir */}
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Perkembangan Belajar {childName.split(" ")[0]}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">{childClass}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-emerald-700">
              <Link href="/dashboard/rapor">Buka Rapor</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-5 space-y-3.5">
            {[
              { mapel: "Tahfidz Al-Qur'an", skor: "95", note: "Lancar juz 30 & Tajwid makharijul huruf baik" },
              { mapel: "Bahasa Arab", skor: "88", note: "Penguasaan kosa kata & muhadatsah aktif" },
              { mapel: "Fiqih Ibadah", skor: "90", note: "Praktik wudhu & shalat sangat tertib" },
            ].map((n, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 text-sm">{n.mapel}</div>
                  <div className="text-xs text-slate-500">{n.note}</div>
                </div>
                <div className="text-base font-extrabold text-emerald-700 bg-white px-3 py-1.5 rounded-xl border border-emerald-100 shadow-sm shrink-0">
                  {n.skor}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Tagihan & Pembayaran */}
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Administrasi &amp; SPP
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">Status kewajiban SPP santri</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-emerald-700">
              <Link href="/dashboard/tagihan">Riwayat SPP</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-800">SPP Bulan Ini</span>
                <div className="text-base font-extrabold text-emerald-900">Rp 500.000</div>
              </div>
              <StatusBadge status="LUNAS" />
            </div>

            <Button asChild className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl min-h-[44px]">
              <Link href="/dashboard/tagihan">
                <CreditCard className="h-4 w-4 mr-2" />
                Lihat Tagihan &amp; Upload Bukti Transfer
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* D. ADMIN KEUANGAN DASHBOARD HOME                                          */
/* ========================================================================= */
function KeuanganDashboardHome() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Penerimaan SPP Bulan Ini</span>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-2">Rp 48.500.000</div>
            <span className="text-xs text-slate-500 mt-1 block">97 dari 120 Santri</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Tunggakan</span>
            <div className="text-xl sm:text-2xl font-extrabold text-rose-600 mt-2">Rp 11.500.000</div>
            <span className="text-xs text-slate-500 mt-1 block">23 Santri tertunda</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verifikasi Bukti</span>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-2">5 Pembayaran</div>
            <span className="text-xs text-slate-500 mt-1 block">Menunggu review kasir</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo Kas Operasional</span>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-2">Rp 142.800.000</div>
            <span className="text-xs text-emerald-600 mt-1 block font-medium">+8.2% bulan lalu</span>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[44px]">
          <Link href="/dashboard/keuangan">
            <DollarSign className="h-4 w-4 mr-1.5" />
            Kelola Transaksi &amp; Generate SPP
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-xl min-h-[44px]">
          <Link href="/dashboard/verifikasi-pendaftaran">
            <Eye className="h-4 w-4 mr-1.5" />
            Verifikasi Pendaftaran Baru
          </Link>
        </Button>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* E. SUPER ADMIN DASHBOARD HOME                                             */
/* ========================================================================= */
function AdminDashboardHome() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500">Total Santri</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">240 Santri</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500">Total Guru</span>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">18 Ustadz/ah</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500">Pendaftar Baru</span>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">14 Calon</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500">Total Kelas</span>
            <div className="text-2xl font-extrabold text-teal-700 mt-1">8 Rombel</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Button asChild className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-12 rounded-xl">
          <Link href="/dashboard/guru">Manajemen Akun Guru</Link>
        </Button>
        <Button asChild variant="outline" className="h-12 rounded-xl font-bold">
          <Link href="/dashboard/kelas">Kelola Jenjang &amp; Kelas</Link>
        </Button>
        <Button asChild variant="outline" className="h-12 rounded-xl font-bold">
          <Link href="/dashboard/kenaikan-kelas">Proses Kenaikan Kelas</Link>
        </Button>
      </div>
    </div>
  )
}
