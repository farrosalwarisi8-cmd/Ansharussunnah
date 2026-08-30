// src/app/dashboard/ujian/page.tsx

"use client"

import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { Role } from "@prisma/client"
import { Award, Plus, Clock, FileText, CheckCircle2, Play, BarChart2, Calendar } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"

export default function UjianPage() {
  const { user, selectedChild } = useDashboard()

  const isTeacher = user.role === Role.GURU || user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_AKADEMIK
  const isStudent = user.role === Role.SISWA
  const isParent = user.role === Role.ORANG_TUA

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={isTeacher ? "Manajemen Ujian & Evaluasi" : "Ujian & Penilaian Santri"}
        subtitle={
          isTeacher
            ? "Kelola ujian online, buat bank soal, dan evaluasi hasil belajar santri."
            : "Ikuti ujian aktif dengan timer terintegrasi atau lihat riwayat hasil ujian."
        }
        action={
          isTeacher ? (
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md min-h-[44px]">
              <Link href="/dashboard/ujian/buat">
                <Plus className="h-4 w-4 mr-1.5" />
                Buat Ujian Baru
              </Link>
            </Button>
          ) : null
        }
      />

      {isParent && <ChildSelector />}

      {isTeacher && <GuruUjianView />}
      {isStudent && <SiswaUjianView />}
      {isParent && <OrangTuaUjianView selectedChild={selectedChild} />}
    </div>
  )
}

/* ========================================================================= */
/* 1. GURU UJIAN VIEW                                                        */
/* ========================================================================= */
function GuruUjianView() {
  const ujianList = [
    {
      id: "ujian-1",
      judul: "Penilaian Harian Thaharah & Shalat Berjamaah",
      mapel: "Fiqih Ibadah",
      kelas: "Kelas 7A - Ikhwan",
      status: "PUBLISHED",
      durasi: 60,
      totalSoal: 27,
      totalPeserta: 30,
      sudahMengerjakan: 28,
      waktuMulai: "2024-03-05 08:00",
    },
    {
      id: "ujian-2",
      judul: "Kuis Rukun Iman & Tauhid Rububiyah",
      mapel: "Aqidah Akhlak",
      kelas: "Kelas 8A - Ikhwan",
      status: "DRAFT",
      durasi: 45,
      totalSoal: 20,
      totalPeserta: 28,
      sudahMengerjakan: 0,
      waktuMulai: "2024-03-10 09:00",
    },
    {
      id: "ujian-3",
      judul: "Ujian Tengah Semester: Kaidah Nahwu Dasar",
      mapel: "Bahasa Arab",
      kelas: "Kelas 9A - Ikhwan",
      status: "SELESAI",
      durasi: 90,
      totalSoal: 35,
      totalPeserta: 32,
      sudahMengerjakan: 32,
      waktuMulai: "2024-02-20 08:00",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {ujianList.map((item) => (
          <Card key={item.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                  {item.mapel}
                </span>
                <StatusBadge status={item.status as any} />
              </div>
              <CardTitle className="text-base font-bold text-slate-900 leading-snug">
                {item.judul}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 font-medium">
                {item.kelas}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 pt-0 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs py-3 border-y border-slate-100 text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>{item.durasi} Menit</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span>{item.totalSoal} Butir Soal</span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>Mulai: {item.waktuMulai} WIB</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Partisipasi:</span>
                <span className="font-bold text-slate-800">
                  {item.sudahMengerjakan} / {item.totalPeserta} Santri
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button asChild variant="outline" size="sm" className="flex-1 rounded-xl min-h-[38px] text-xs font-bold">
                  <Link href={`/dashboard/ujian/${item.id}/rekap`}>
                    <BarChart2 className="h-3.5 w-3.5 mr-1 text-emerald-700" />
                    Rekap Hasil
                  </Link>
                </Button>
                <Button asChild size="sm" className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl min-h-[38px] text-xs font-bold">
                  <Link href={`/dashboard/ujian/${item.id}/kerjakan`}>
                    Preview
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ========================================================================= */
/* 2. SISWA UJIAN VIEW                                                       */
/* ========================================================================= */
function SiswaUjianView() {
  const activeExams = [
    {
      id: "ujian-1",
      judul: "Penilaian Harian Thaharah & Shalat Berjamaah",
      mapel: "Fiqih Ibadah",
      durasi: 60,
      totalSoal: 27,
      deadline: "Hari Ini, 23:59 WIB",
      status: "BELUM_MENGERJAKAN",
    },
  ]

  const finishedExams = [
    {
      id: "ujian-3",
      judul: "Ujian Tengah Semester: Kaidah Nahwu Dasar",
      mapel: "Bahasa Arab",
      nilai: 92,
      status: "SELESAI",
      tanggal: "20 Februari 2024",
    },
    {
      id: "ujian-past",
      judul: "Penilaian Harian Surat Al-Mulk & Tajwid",
      mapel: "Tahfidz & Tajwid",
      nilai: 96,
      status: "SELESAI",
      tanggal: "12 Februari 2024",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Ujian Aktif Tersedia */}
      <div>
        <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Award className="h-4 w-4 text-emerald-600" />
          <span>Ujian Tersedia (Wajib Dikerjakan)</span>
        </h3>

        {activeExams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeExams.map((exam) => (
              <Card key={exam.id} className="rounded-3xl border-emerald-300 bg-gradient-to-br from-emerald-50/80 to-white shadow-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                    {exam.mapel}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {exam.durasi} Menit
                  </span>
                </div>

                <div>
                  <h4 className="text-lg font-bold text-slate-900 leading-snug">
                    {exam.judul}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {exam.totalSoal} Butir Soal • Batas: {exam.deadline}
                  </p>
                </div>

                <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-12 text-sm shadow-md min-h-[48px]">
                  <Link href={`/dashboard/ujian/${exam.id}/kerjakan`}>
                    <Play className="h-4 w-4 mr-2" />
                    Mulai Kerjakan Ujian Sekarang
                  </Link>
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Tidak Ada Ujian Aktif"
            description="Saat ini belum ada jadwal ujian baru untuk kelas Anda."
          />
        )}
      </div>

      {/* Riwayat Nilai Ujian */}
      <div>
        <h3 className="text-base font-bold text-slate-900 mb-3">
          Riwayat Nilai Ujian Sebelumnya
        </h3>
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardContent className="p-5 divide-y divide-slate-100">
            {finishedExams.map((ex, idx) => (
              <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">{ex.mapel}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-400">{ex.tanggal}</span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">{ex.judul}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                    {ex.nilai}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* 3. ORANG TUA UJIAN VIEW                                                   */
/* ========================================================================= */
function OrangTuaUjianView({ selectedChild }: { selectedChild: any }) {
  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-base font-bold text-slate-900">
          Hasil Ujian &amp; Evaluasi: {selectedChild?.nama || "Santri"}
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Daftar ujian dan perolehan skor ujian santri
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-3">
        {[
          { mapel: "Bahasa Arab", judul: "Ujian Tengah Semester: Nahwu", nilai: 92, tgl: "20 Feb 2024" },
          { mapel: "Tahfidz Al-Qur'an", judul: "Penilaian Harian Surat Al-Mulk", nilai: 96, tgl: "12 Feb 2024" },
          { mapel: "Aqidah Akhlak", judul: "Evaluasi Rukun Iman", nilai: 88, tgl: "05 Feb 2024" },
        ].map((item, idx) => (
          <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-slate-900 text-sm">{item.judul}</div>
              <div className="text-xs text-slate-500">{item.mapel} • {item.tgl}</div>
            </div>
            <div className="text-base font-black text-emerald-800 bg-white px-3.5 py-1.5 rounded-xl border border-emerald-200 shadow-sm">
              Skor: {item.nilai}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
