// src/app/dashboard/rapor/page.tsx

"use client"

import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { createOrUpdateCatatanRapor, getRaporSiswa, getRaporAnak, getRekapRaporKelas } from "@/actions/rapor"
import { getDaftarPeriodeAjaran } from "@/actions/periode-ajaran"
import { useToast } from "@/hooks/use-toast"
import { Role } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { GraduationCap, Printer, Save, Loader2, BarChart2 } from "lucide-react"

type PeriodeItem = { id: string; nama: string; tahunAjaran: string; semester: string }
type RaporData = {
  identitas: { nama?: string; namaSiswa?: string; nisn: string; kelas: string; jenjang: string }
  periode: { nama: string; tahunAjaran: string; semester: string }
  nilaiPerMapel: Array<{
    mataPelajaran: string
    rataRataUjian: number
    rataRataTugas: number
    nilaiGabungan: number
    jumlahUjian: number
    jumlahTugas: number
  }>
  rataRataKeseluruhan: number
  kehadiran: { total: number; hadir: number; sakit: number; izin: number; alpha: number; persentase: string }
  catatan?: string | null
  ranking?: number | null
}

export default function RaporPage() {
  const { user, selectedChild } = useDashboard()
  useToast()

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
      {!isTeacher && <SiswaOrangTuaRaporView isParent={isParent} selectedChild={selectedChild} />}
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
    "Alhamdulillah ananda menunjukkan kesungguhan yang sangat luar biasa dalam menghafal Al-Qur'an dan penguasaan bahasa Arab. Pertahankan akhlak mulia dan ketertiban shalat berjamaah."
  )
  const [saving, setSaving] = React.useState(false)

  // Rekap Kelas state
  const [showRekap, setShowRekap] = React.useState(false)
  const [rekapData, setRekapData] = React.useState<{
    totalSiswa: number
    rekap: Array<{
      siswaId: string
      nama: string
      nisn: string
      rataRataKeseluruhan: number
      jumlahMapel: number
      kehadiran: string
      totalAlpha: number
      ranking: number | null
      hasCatatan: boolean
    }>
  } | null>(null)
  const [loadingRekap, setLoadingRekap] = React.useState(false)

  // Note: Student list would need a getStudentsByKelas action for real data
  // Currently using placeholder — to be connected when getStudentsByKelas is available
  const students = [
    { id: "s1", nama: "Santri Binaan", nisn: "—" },
  ]

  const handleSaveCatatan = async () => {
    setSaving(true)
    try {
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
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: "Terjadi kesalahan saat menyimpan catatan rapor.",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleLoadRekap = async () => {
    setLoadingRekap(true)
    try {
      const result = await getRekapRaporKelas({
        kelasId: "7A-IKHWAN",
        periodeAjaranId: "periode-aktif",
      })
      if (result.success && result.data) {
        setRekapData(result.data as typeof rekapData)
        setShowRekap(true)
      } else {
        toast({ variant: "destructive", title: "Gagal", description: result.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal memuat rekap rapor kelas." })
    } finally {
      setLoadingRekap(false)
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
            <p className="text-xs text-slate-500">Pilih santri untuk mengisi catatan rapor</p>
          </div>

          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
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

      {/* Rekap Rapor Kelas */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Rekap Rapor Kelas
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Gambaran umum performa seluruh siswa dalam satu kelas
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleLoadRekap}
            disabled={loadingRekap}
            className="rounded-xl min-h-[38px] text-xs font-bold"
          >
            {loadingRekap ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <BarChart2 className="h-4 w-4 mr-1.5" />}
            {showRekap ? "Refresh" : "Lihat Rekap"}
          </Button>
        </CardHeader>

        {showRekap && rekapData && (
          <CardContent className="p-0">
            <div className="p-4 mb-2 text-xs text-slate-500">
              Total {rekapData.totalSiswa} siswa
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-600">
                  <tr>
                    <th className="p-3 pl-5">Nama</th>
                    <th className="p-3 text-center">Rata-rata</th>
                    <th className="p-3 text-center">Kehadiran</th>
                    <th className="p-3 text-center">Alpha</th>
                    <th className="p-3 text-center">Ranking</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rekapData.rekap.map((r) => (
                    <tr key={r.siswaId} className="hover:bg-slate-50/80">
                      <td className="p-3 pl-5 font-bold text-slate-900 text-sm">{r.nama}</td>
                      <td className="p-3 text-center">
                        <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 text-sm">
                          {r.rataRataKeseluruhan}
                        </span>
                      </td>
                      <td className="p-3 text-center text-xs text-slate-600">{r.kehadiran}</td>
                      <td className="p-3 text-center">
                        <span className={`text-xs font-bold ${r.totalAlpha > 3 ? 'text-rose-600' : 'text-slate-600'}`}>
                          {r.totalAlpha}
                        </span>
                      </td>
                      <td className="p-3 text-center text-xs font-bold text-slate-700">
                        {r.ranking || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

/* ========================================================================= */
/* 2. SISWA & ORANG TUA RAPOR VIEW (READ-ONLY, REAL DATA)                    */
/* ========================================================================= */
function SiswaOrangTuaRaporView({
  isParent,
  selectedChild,
}: {
  isParent: boolean
  selectedChild: { id: string; nama: string } | null
}) {
  const [periodes, setPeriodes] = React.useState<PeriodeItem[]>([])
  const [selectedPeriodeId, setSelectedPeriodeId] = React.useState<string>("")
  const [raporData, setRaporData] = React.useState<RaporData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [fetchingRapor, setFetchingRapor] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch available periods
  React.useEffect(() => {
    async function fetchPeriodes() {
      setLoading(true)
      try {
        const result = await getDaftarPeriodeAjaran()
        if (result.success && result.data) {
          const data = result.data as PeriodeItem[]
          setPeriodes(data)
          if (data.length > 0) {
            setSelectedPeriodeId(data[0].id)
          }
        }
      } catch {
        // Ignore — periodes might not be available
      } finally {
        setLoading(false)
      }
    }
    fetchPeriodes()
  }, [])

  // Fetch rapor when period or child changes
  React.useEffect(() => {
    async function fetchRapor() {
      if (!selectedPeriodeId) {
        setRaporData(null)
        return
      }

      setFetchingRapor(true)
      setError(null)
      try {
        let result
        if (isParent && selectedChild) {
          result = await getRaporAnak(selectedChild.id, selectedPeriodeId)
        } else {
          result = await getRaporSiswa(selectedPeriodeId)
        }

        if (result.success && result.data) {
          setRaporData(result.data as RaporData)
        } else {
          setError(result.message || "Gagal memuat data rapor")
          setRaporData(null)
        }
      } catch {
        setError("Gagal memuat data rapor")
        setRaporData(null)
      } finally {
        setFetchingRapor(false)
      }
    }
    fetchRapor()
  }, [selectedPeriodeId, isParent, selectedChild])

  if (isParent && !selectedChild) {
    return (
      <EmptyState
        title="Pilih Anak Terlebih Dahulu"
        description="Gunakan selector di atas untuk memilih anak yang ingin dipantau."
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <span className="ml-3 text-sm text-slate-500">Memuat data...</span>
      </div>
    )
  }

  if (periodes.length === 0) {
    return <EmptyState title="Belum Ada Periode Ajaran" description="Belum ada periode ajaran yang tersedia." />
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Pilih Periode:
          </label>
          <select
            value={selectedPeriodeId}
            onChange={(e) => setSelectedPeriodeId(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
          >
            {periodes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama} ({p.tahunAjaran})
              </option>
            ))}
          </select>
        </div>
      </Card>

      {fetchingRapor && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="ml-3 text-sm text-slate-500">Memuat rapor...</span>
        </div>
      )}

      {!fetchingRapor && error && (
        <EmptyState title="Gagal Memuat Rapor" description={error} />
      )}

      {!fetchingRapor && !error && raporData && (
        <DigitalRaporCard raporData={raporData} />
      )}
    </div>
  )
}

/* ========================================================================= */
/* 3. DIGITAL RAPOR FORMAL COMPONENT (REAL DATA)                             */
/* ========================================================================= */
function DigitalRaporCard({ raporData }: { raporData: RaporData }) {
  const studentName = raporData.identitas.nama || raporData.identitas.namaSiswa || "Santri"

  const totalNilai = raporData.nilaiPerMapel.reduce((acc, curr) => acc + curr.nilaiGabungan, 0)
  const rerata = raporData.nilaiPerMapel.length > 0
    ? (totalNilai / raporData.nilaiPerMapel.length).toFixed(1)
    : "0"

  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white shadow-xl overflow-hidden print:border-none print:shadow-none">
      {/* Formal Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white p-6 sm:p-8 text-center border-b border-emerald-500/20">
        <div className="w-12 h-12 rounded-2xl overflow-hidden mx-auto mb-3 shadow-md">
          <img src="/ansharussunnah-logo.jpeg" alt="Logo Ansharussunnah" className="w-full h-full object-cover" />
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
            <span className="font-bold text-slate-900 text-sm">{studentName}</span>
          </div>
          <div>
            <span className="text-slate-400 block">NISN</span>
            <span className="font-semibold text-slate-800 font-mono">{raporData.identitas.nisn}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Kelas</span>
            <span className="font-semibold text-slate-800">{raporData.identitas.kelas}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Semester / T.A</span>
            <span className="font-semibold text-slate-800">
              {raporData.periode.nama} ({raporData.periode.tahunAjaran})
            </span>
          </div>
        </div>

        {/* Subjects Table */}
        {raporData.nilaiPerMapel.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-3 pl-4">Mata Pelajaran</th>
                  <th className="p-3 text-center">Rata Ujian</th>
                  <th className="p-3 text-center">Rata Tugas</th>
                  <th className="p-3 text-center">Nilai Gabungan</th>
                  <th className="p-3 text-center">Jumlah Ujian</th>
                  <th className="p-3 text-center">Jumlah Tugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {raporData.nilaiPerMapel.map((sub, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="p-3 pl-4 font-bold text-slate-900">{sub.mataPelajaran}</td>
                    <td className="p-3 text-center font-medium text-slate-700">{sub.rataRataUjian}</td>
                    <td className="p-3 text-center font-medium text-slate-700">{sub.rataRataTugas}</td>
                    <td className="p-3 text-center font-black text-emerald-800 bg-emerald-50/50">
                      {sub.nilaiGabungan}
                    </td>
                    <td className="p-3 text-center text-slate-500">{sub.jumlahUjian}</td>
                    <td className="p-3 text-center text-slate-500">{sub.jumlahTugas}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="p-3 pl-4 uppercase text-xs">
                    Rata-Rata Nilai Kumulatif
                  </td>
                  <td className="p-3 text-center text-base text-emerald-700 font-extrabold">
                    {rerata}
                  </td>
                  <td className="p-3 text-center">{raporData.nilaiPerMapel.reduce((a, m) => a + m.jumlahUjian, 0)}</td>
                  <td className="p-3 text-center">{raporData.nilaiPerMapel.reduce((a, m) => a + m.jumlahTugas, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <EmptyState title="Belum Ada Data Nilai" description="Belum ada data penilaian untuk periode ini." />
        )}

        {/* Kehadiran & Catatan */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              Rekapitulasi Kehadiran
            </span>
            <div className="text-xs space-y-1 text-slate-600">
              <div className="flex justify-between"><span>Hadir:</span> <strong>{raporData.kehadiran.hadir} Hari</strong></div>
              <div className="flex justify-between"><span>Izin:</span> <strong>{raporData.kehadiran.izin} Hari</strong></div>
              <div className="flex justify-between"><span>Sakit:</span> <strong>{raporData.kehadiran.sakit} Hari</strong></div>
              <div className="flex justify-between"><span>Alpa:</span> <strong>{raporData.kehadiran.alpha} Hari</strong></div>
              <div className="flex justify-between"><span>Persentase:</span> <strong>{raporData.kehadiran.persentase}</strong></div>
            </div>
          </div>

          <div className="md:col-span-2 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 block">
              Catatan &amp; Bimbingan Wali Kelas
            </span>
            {raporData.catatan ? (
              <p className="text-xs sm:text-sm text-emerald-950 leading-relaxed italic">
                &ldquo;{raporData.catatan}&rdquo;
              </p>
            ) : (
              <p className="text-xs text-emerald-700 italic">Belum ada catatan wali kelas.</p>
            )}
            {raporData.ranking && (
              <div className="pt-2 text-right text-[11px] font-bold text-emerald-800">
                Ranking: {raporData.ranking}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
