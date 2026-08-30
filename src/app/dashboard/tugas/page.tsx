// src/app/dashboard/tugas/page.tsx

"use client"

import * as React from "react"
import { useDashboard, type ChildStudent } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { Role } from "@prisma/client"
import { Plus, Clock, FileText, Upload } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge, type StatusType } from "@/components/ui/status-badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export default function TugasPage() {
  const { user, selectedChild } = useDashboard()

  const isTeacher = user.role === Role.GURU || user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_AKADEMIK
  const isStudent = user.role === Role.SISWA
  const isParent = user.role === Role.ORANG_TUA

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={isTeacher ? "Manajemen Tugas Santri" : "Tugas & Pekerjaan Rumah (PR)"}
        subtitle={
          isTeacher
            ? "Kelola penugasan kelas, periksa submisi santri, dan berikan nilai serta catatan evaluasi."
            : "Kumpulkan tugas sebelum batas waktu deadline dan pantau nilai feedback dari ustadz/ah."
        }
        action={
          isTeacher ? (
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md min-h-[44px]">
              <Link href="/dashboard/tugas/buat">
                <Plus className="h-4 w-4 mr-1.5" />
                Buat Tugas Baru
              </Link>
            </Button>
          ) : null
        }
      />

      {isParent && <ChildSelector />}

      {isTeacher && <GuruTugasView />}
      {isStudent && <SiswaTugasView />}
      {isParent && <OrangTuaTugasView selectedChild={selectedChild} />}
    </div>
  )
}

/* ========================================================================= */
/* 1. GURU TUGAS VIEW                                                        */
/* ========================================================================= */
function GuruTugasView() {
  const tugasList = [
    {
      id: "tugas-1",
      judul: "Tashrif Fi'il Tsulatsi Mujarrad Bab 1 - 3",
      mapel: "Bahasa Arab",
      kelas: "Kelas 7A - Ikhwan",
      deadline: "05 Maret 2024, 20:00 WIB",
      totalSiswa: 30,
      terkumpul: 24,
      sudahDinilai: 18,
      status: "AKTIF",
    },
    {
      id: "tugas-2",
      judul: "Setoran Video Rekaman Hafalan Surat Al-Mulk",
      mapel: "Tahfidz & Tajwid",
      kelas: "Kelas 8B - Akhwat",
      deadline: "08 Maret 2024, 18:00 WIB",
      totalSiswa: 28,
      terkumpul: 15,
      sudahDinilai: 0,
      status: "AKTIF",
    },
    {
      id: "tugas-3",
      judul: "Resume Fiqih Thaharah dan Macam-macam Air",
      mapel: "Fiqih Ibadah",
      kelas: "Kelas 7A - Ikhwan",
      deadline: "20 Februari 2024, 23:59 WIB",
      totalSiswa: 30,
      terkumpul: 30,
      sudahDinilai: 30,
      status: "SELESAI",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {tugasList.map((item) => (
          <Card key={item.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                  {item.mapel}
                </span>
                <StatusBadge status={item.status as StatusType} />
              </div>
              <CardTitle className="text-base font-bold text-slate-900 leading-snug">
                {item.judul}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 font-medium">
                {item.kelas}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 pt-0 space-y-4">
              <div className="text-xs py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Deadline: <strong>{item.deadline}</strong></span>
              </div>

              {/* Progress Submisi */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>Pengumpulan:</span>
                  <span>{item.terkumpul} / {item.totalSiswa} Santri</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all"
                    style={{ width: `${(item.terkumpul / item.totalSiswa) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Sudah Dinilai: {item.sudahDinilai}</span>
                  <span>Belum Dinilai: {item.terkumpul - item.sudahDinilai}</span>
                </div>
              </div>

              <Button asChild className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl min-h-[44px]">
                <Link href={`/dashboard/tugas/${item.id}`}>
                  <FileText className="h-4 w-4 mr-2" />
                  Periksa &amp; Beri Nilai
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ========================================================================= */
/* 2. SISWA TUGAS VIEW                                                       */
/* ========================================================================= */
function SiswaTugasView() {
  const pendingTugas = [
    {
      id: "tugas-1",
      judul: "Tashrif Fi'il Tsulatsi Mujarrad Bab 1 - 3",
      mapel: "Bahasa Arab",
      deadline: "Hari Ini, 20:00 WIB",
      status: "BELUM_DIKUMPULKAN",
      deskripsi: "Tuliskan tasrif lughawi dan tasrif ishthilahi untuk wazan fa'ala yaf'ulu pada buku catatan lalu upload foto hasil pengerjaan.",
    },
  ]

  const submittedTugas = [
    {
      id: "tugas-2",
      judul: "Setoran Rekaman Hafalan Surat Al-Mulk",
      mapel: "Tahfidz & Tajwid",
      deadline: "08 Maret 2024",
      status: "MENUNGGU_VERIFIKASI",
      tglKumpul: "Kemarin, 14:30 WIB",
    },
    {
      id: "tugas-3",
      judul: "Resume Fiqih Thaharah dan Macam Air",
      mapel: "Fiqih Ibadah",
      deadline: "20 Feb 2024",
      status: "DINILAI",
      nilai: 95,
      feedback: "Alhamdulillah sangat rapi dan lengkap dengan dalilnya.",
    },
  ]

  return (
    <div className="space-y-6">
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-2 max-w-md">
          <TabsTrigger value="pending">Belum Dikumpul ({pendingTugas.length})</TabsTrigger>
          <TabsTrigger value="history">Riwayat Tugas ({submittedTugas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-4">
          {pendingTugas.map((tugas) => (
            <Card key={tugas.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full">
                  {tugas.mapel}
                </span>
                <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Batas: {tugas.deadline}
                </span>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {tugas.judul}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  {tugas.deskripsi}
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <Button asChild className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[44px]">
                  <Link href={`/dashboard/tugas/${tugas.id}`}>
                    <Upload className="h-4 w-4 mr-2" />
                    Kumpulkan Tugas
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {submittedTugas.map((tugas) => (
            <Card key={tugas.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-500">{tugas.mapel}</span>
                  <h4 className="font-bold text-slate-900 text-sm sm:text-base">{tugas.judul}</h4>
                </div>
                {tugas.nilai ? (
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Nilai</span>
                    <span className="text-xl font-black text-emerald-700">{tugas.nilai}</span>
                  </div>
                ) : (
                  <StatusBadge status={tugas.status as StatusType} />
                )}
              </div>

              {tugas.feedback && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                  <strong>Catatan Ustadz:</strong> {tugas.feedback}
                </div>
              )}
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ========================================================================= */
/* 3. ORANG TUA TUGAS VIEW                                                   */
/* ========================================================================= */
function OrangTuaTugasView({ selectedChild }: { selectedChild: ChildStudent | null }) {
  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
      <CardHeader className="p-6 pb-3">
        <CardTitle className="text-base font-bold text-slate-900">
          Monitoring Tugas Santri: {selectedChild?.nama || "Santri"}
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Riwayat pengumpulan tugas dan catatan nilai dari asatidz
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 divide-y divide-slate-100">
        {[
          { mapel: "Bahasa Arab", judul: "Tashrif Fi'il Tsulatsi", status: "BELUM_DIKUMPULKAN", deadline: "Hari Ini, 20:00 WIB" },
          { mapel: "Fiqih Ibadah", judul: "Resume Fiqih Thaharah", status: "DINILAI", nilai: 95, deadline: "20 Feb 2024" },
          { mapel: "Hadits", judul: "Hafalan Hadits Niat", status: "DINILAI", nilai: 90, deadline: "10 Feb 2024" },
        ].map((item, idx) => (
          <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-slate-900 text-sm">{item.judul}</div>
              <div className="text-xs text-slate-500">{item.mapel} • {item.deadline}</div>
            </div>
            {item.nilai ? (
              <div className="text-base font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                Nilai: {item.nilai}
              </div>
            ) : (
              <StatusBadge status={item.status as StatusType} />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
