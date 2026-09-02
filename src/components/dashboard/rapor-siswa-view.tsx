"use client"

import * as React from "react"
import { getRaporSiswa, getRaporAnak } from "@/actions/rapor"
import { getDaftarPeriodeAjaran } from "@/actions/periode-ajaran"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import Image from "next/image"
import { Loader2 } from "lucide-react"

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

export function SiswaOrangTuaRaporView({
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
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
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
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-yellow-500"
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
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
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
/* DIGITAL RAPOR FORMAL COMPONENT (REAL DATA)                                */
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
      <div className="bg-gradient-to-r from-yellow-900 via-slate-800 to-yellow-900 text-white p-6 sm:p-8 text-center border-b border-yellow-500/20">
        <div className="w-12 h-12 rounded-2xl overflow-hidden relative mx-auto mb-3 shadow-md">
          <Image src="/ansharussunnah-logo.webp" alt="Logo Ansharussunnah" fill sizes="48px" className="object-contain" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
          Laporan Hasil Penilaian Santri (Rapor)
        </h2>
        <p className="text-xs sm:text-sm text-yellow-300/90 font-medium mt-1">
          Pondok Pesantren &amp; Sekolah Islam Terpadu Ansharussunnah
        </p>
      </div>

      <CardContent className="p-6 sm:p-8 space-y-6">
        {/* Student Biodata Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
          <div>
            <span className="text-slate-400 block">Nama Santri</span>
            <span className="font-bold text-slate-800 text-sm">{studentName}</span>
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
                    <td className="p-3 pl-4 font-bold text-slate-800">{sub.mataPelajaran}</td>
                    <td className="p-3 text-center font-medium text-slate-700">{sub.rataRataUjian}</td>
                    <td className="p-3 text-center font-medium text-slate-700">{sub.rataRataTugas}</td>
                    <td className="p-3 text-center font-black text-yellow-700 bg-yellow-50/50">
                      {sub.nilaiGabungan}
                    </td>
                    <td className="p-3 text-center text-slate-500">{sub.jumlahUjian}</td>
                    <td className="p-3 text-center text-slate-500">{sub.jumlahTugas}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold text-slate-800 border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="p-3 pl-4 uppercase text-xs">
                    Rata-Rata Nilai Kumulatif
                  </td>
                  <td className="p-3 text-center text-base text-yellow-600 font-extrabold">
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

          <div className="md:col-span-2 p-4 rounded-2xl bg-yellow-50/70 border border-yellow-200 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-yellow-800 block">
              Catatan &amp; Bimbingan Wali Kelas
            </span>
            {raporData.catatan ? (
              <p className="text-xs sm:text-sm text-yellow-900 leading-relaxed italic">
                &ldquo;{raporData.catatan}&rdquo;
              </p>
            ) : (
              <p className="text-xs text-yellow-600 italic">Belum ada catatan wali kelas.</p>
            )}
            {raporData.ranking && (
              <div className="pt-2 text-right text-[11px] font-bold text-yellow-700">
                Ranking: {raporData.ranking}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
