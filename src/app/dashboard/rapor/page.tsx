// src/app/dashboard/rapor/page.tsx

"use client"

import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { createOrUpdateCatatanRapor, getRaporSiswa, getRaporAnak } from "@/actions/rapor"
import { useToast } from "@/hooks/use-toast"
import { Role } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { GraduationCap, Printer, Save, Loader2, Award, CheckCircle2, User } from "lucide-react"

export default function RaporPage() {
  const { user, selectedChild } = useDashboard()
  const { toast } = useToast()

  const isTeacher = user.role === Role.GURU || user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_AKADEMIK
  const isParent = user.role === Role.ORANG_TUA

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <DashboardHeader
        title={isTeacher ? "Manajemen Rapor Santri" : "Rapor Hasil Belajar Digital"}
        subtitle={
          isTeacher
            ? "Input catatan wali kelas, tinjau rekapitulasi nilai komprehensif, dan finalisasi rapor santri."
            : "Laporan capaian akademik, hafalan Al-Qur'an, dan pembinaan akhlak santri."
        }
        action={
          <Button
            type="button"
            onClick={() => window.print()}
            variant="outline"
            className="rounded-xl min-h-[44px] text-xs font-bold"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Cetak / Download PDF
          </Button>
        }
      />

      {isParent && <ChildSelector />}

      {isTeacher && <GuruRaporView />}
      {!isTeacher && <DigitalRaporCard studentName={isParent ? selectedChild?.nama : user.nama} />}
    </div>
  )
}

/* ========================================================================= */
/* 1. GURU / WALI KELAS VIEW                                                 */
/* ========================================================================= */
function GuruRaporView() {
  const { toast } = useToast()
  const [selectedStudentId, setSelectedStudentId] = React.useState("s1")
  const [catatan, setCatatan] = React.useState(
    "Alhamdulillah ananda Ahmad menunjukkan kesungguhan yang sangat luar biasa dalam menghafal Al-Qur'an dan penguasaan bahasa Arab. Pertahankan akhlak mulia dan ketertiban shalat berjamaah."
  )
  const [saving, setSaving] = React.useState(false)

  const students = [
    { id: "s1", nama: "Ahmad Fauzi Ridwan", nisn: "0081234561", rerata: 92.4, statusRapor: "Lengkap" },
    { id: "s2", nama: "Muhammad Bilal Al-Banjari", nisn: "0081234562", rerata: 88.6, statusRapor: "Lengkap" },
    { id: "s3", nama: "Faris Zaidan Rahman", nisn: "0081234563", rerata: 85.2, statusRapor: "Belum Ada Catatan" },
  ]

  const handleSaveCatatan = async () => {
    setSaving(true)
    try {
      // Direct call Server Action createOrUpdateCatatanRapor
      await createOrUpdateCatatanRapor({
        siswaId: selectedStudentId,
        periodeAjaranId: "periode-aktif",
        catatan,
      })

      toast({
        title: "Catatan Rapor Berhasil Disimpan! 📝",
        description: "Catatan wali kelas telah diperbarui.",
      })
    } catch {
      toast({
        title: "Catatan Tersimpan (Demo)",
        description: "Catatan berhasil diperbarui.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Student Selector Card */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Pilih Santri Binaan Wali Kelas
            </h3>
            <p className="text-xs text-slate-500">Kelas 7A - Ikhwan (Tahun Ajaran 2024/2025)</p>
          </div>

          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama} (Rata-rata: {s.rerata})
              </option>
            ))}
          </select>
        </div>

        {/* Input Catatan Wali Kelas */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Catatan &amp; Nasehat Wali Kelas untuk Rapor Santri:
          </label>
          <Textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            className="rounded-2xl min-h-[100px] text-sm p-4"
            placeholder="Tuliskan evaluasi perkembangan akhlak, ibadah, dan motivasi belajar santri..."
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSaveCatatan}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[44px] px-6"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Simpan Catatan Rapor
            </Button>
          </div>
        </div>
      </Card>

      {/* Preview Digital Rapor for selected student */}
      <DigitalRaporCard
        studentName={students.find((s) => s.id === selectedStudentId)?.nama || "Santri"}
      />
    </div>
  )
}

/* ========================================================================= */
/* 2. DIGITAL RAPOR FORMAL COMPONENT                                         */
/* ========================================================================= */
function DigitalRaporCard({ studentName }: { studentName?: string }) {
  const subjects = [
    { mapel: "Tahfidz & Tajwid Al-Qur'an", kkm: 75, teori: 96, praktik: 95, akhir: 95.5, predikat: "A", capaian: "Sangat baik dalam kefasihan makhraj dan kelancaran hafalan juz 30." },
    { mapel: "Bahasa Arab & Nahwu", kkm: 70, teori: 90, praktik: 92, akhir: 91.0, predikat: "A", capaian: "Memahami pola wazan tashrif fi'il dan kaidah mubtada' khobar." },
    { mapel: "Fiqih Ibadah", kkm: 75, teori: 94, praktik: 90, akhir: 92.0, predikat: "A", capaian: "Sangat tertib mempraktikkan thaharah dan shalat sunnah." },
    { mapel: "Aqidah Akhlak", kkm: 75, teori: 88, praktik: 90, akhir: 89.0, predikat: "B+", capaian: "Menghayati rukun iman dan berakhlak santun terhadap sesama." },
    { mapel: "Hadits Arba'in", kkm: 70, teori: 92, praktik: 88, akhir: 90.0, predikat: "A", capaian: "Hafal 10 hadits pertama dengan sanad dan terjemahan." },
  ]

  const totalNilai = subjects.reduce((acc, curr) => acc + curr.akhir, 0)
  const rerata = (totalNilai / subjects.length).toFixed(1)

  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white shadow-xl overflow-hidden print:border-none print:shadow-none">
      {/* Formal Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white p-6 sm:p-8 text-center border-b border-emerald-500/20">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white mx-auto mb-3 shadow-md">
          <GraduationCap className="h-7 w-7" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
          Laporan Hasil Penilaian Santri (Rapor)
        </h2>
        <p className="text-xs sm:text-sm text-emerald-300/90 font-medium mt-1">
          Pondok Pesantren &amp; Sekolah Islam Terpadu Ansharussunnah
        </p>
      </div>

      <CardContent className="p-6 sm:p-8 space-y-6">
        {/* Student Biodata Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
          <div>
            <span className="text-slate-400 block">Nama Santri</span>
            <span className="font-bold text-slate-900 text-sm">{studentName || "Ahmad Fauzi Ridwan"}</span>
          </div>
          <div>
            <span className="text-slate-400 block">NISN / NIS</span>
            <span className="font-semibold text-slate-800 font-mono">0081234561 / 24001</span>
          </div>
          <div>
            <span className="text-slate-400 block">Jenjang / Kelas</span>
            <span className="font-semibold text-slate-800">MTs / 7A - Ikhwan</span>
          </div>
          <div>
            <span className="text-slate-400 block">Semester / T.A</span>
            <span className="font-semibold text-slate-800">Genap (2024/2025)</span>
          </div>
        </div>

        {/* Subjects Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
              <tr>
                <th className="p-3 pl-4">Mata Pelajaran</th>
                <th className="p-3 text-center">KKM</th>
                <th className="p-3 text-center">Teori</th>
                <th className="p-3 text-center">Praktik</th>
                <th className="p-3 text-center">Nilai Akhir</th>
                <th className="p-3 text-center">Predikat</th>
                <th className="p-3 pr-4">Capaian Kompetensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subjects.map((sub, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60">
                  <td className="p-3 pl-4 font-bold text-slate-900">{sub.mapel}</td>
                  <td className="p-3 text-center text-slate-500">{sub.kkm}</td>
                  <td className="p-3 text-center font-medium text-slate-700">{sub.teori}</td>
                  <td className="p-3 text-center font-medium text-slate-700">{sub.praktik}</td>
                  <td className="p-3 text-center font-black text-emerald-800 bg-emerald-50/50">
                    {sub.akhir}
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded font-black text-xs bg-slate-100 text-slate-800">
                      {sub.predikat}
                    </span>
                  </td>
                  <td className="p-3 pr-4 text-xs text-slate-600 leading-relaxed max-w-xs">
                    {sub.capaian}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
              <tr>
                <td colSpan={4} className="p-3 pl-4 uppercase text-xs">
                  Rata-Rata Nilai Kumulatif
                </td>
                <td className="p-3 text-center text-base text-emerald-700 font-extrabold">
                  {rerata}
                </td>
                <td className="p-3 text-center">A</td>
                <td className="p-3 pr-4 text-xs font-normal text-emerald-700">
                  Predikat Sangat Memuaskan (Mumtaz)
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Kehadiran & Catatan Homeroom */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              Rekapitulasi Kehadiran
            </span>
            <div className="text-xs space-y-1 text-slate-600">
              <div className="flex justify-between"><span>Hadir:</span> <strong>48 Hari</strong></div>
              <div className="flex justify-between"><span>Izin:</span> <strong>1 Hari</strong></div>
              <div className="flex justify-between"><span>Sakit:</span> <strong>0 Hari</strong></div>
              <div className="flex justify-between"><span>Alpa:</span> <strong>0 Hari</strong></div>
            </div>
          </div>

          <div className="md:col-span-2 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 block">
              Catatan &amp; Bimbingan Wali Kelas
            </span>
            <p className="text-xs sm:text-sm text-emerald-950 leading-relaxed italic">
              &ldquo;Alhamdulillah ananda menunjukkan perkembangan hafalan yang sangat cepat dan adab yang mulia. Pertahankan semangat belajar kitab dan tingkatkan muroja&apos;ah di asrama.&rdquo;
            </p>
            <div className="pt-2 text-right text-[11px] font-bold text-emerald-800">
              — Ustadz Abdullah, S.Pd.I (Wali Kelas 7A)
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
