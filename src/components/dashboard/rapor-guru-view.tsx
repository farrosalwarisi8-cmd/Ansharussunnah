"use client"

import * as React from "react"
import { createOrUpdateCatatanRapor, getRekapRaporKelas } from "@/actions/rapor"
import { getPeriodeAjaranAktif } from "@/actions/periode-ajaran"
import { getDaftarKelasYangDiajarGuru } from "@/actions/guru-kelas"
import { getSiswaByKelas } from "@/actions/absensi"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Loader2, BarChart2, Save } from "lucide-react"

type KelasItem = {
  kelasId: string
  namaKelas: string
  jenjang: string
  jumlahSiswa: number
}

type SiswaOption = {
  siswaId: string
  nama: string
  nisn: string | null
}

export function GuruRaporView() {
  const { toast } = useToast()
  const [kelasList, setKelasList] = React.useState<KelasItem[]>([])
  const [kelasId, setKelasId] = React.useState("")
  const [loadingKelas, setLoadingKelas] = React.useState(true)
  const [periodeAjaranId, setPeriodeAjaranId] = React.useState("")

  const [students, setStudents] = React.useState<SiswaOption[]>([])
  const [selectedStudentId, setSelectedStudentId] = React.useState("")
  const [catatan, setCatatan] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const [showRekap, setShowRekap] = React.useState(false)
  const [rekapData, setRekapData] = React.useState<{
    totalSiswa: number
    periode?: { id: string; nama: string }
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

  // Muat daftar kelas yang diajar guru (konsisten dengan absensi/ujian/tugas) & periode aktif
  React.useEffect(() => {
    let mounted = true
    async function load() {
      setLoadingKelas(true)
      const [kelasRes, periodeRes] = await Promise.all([
        getDaftarKelasYangDiajarGuru(),
        getPeriodeAjaranAktif(),
      ])
      if (!mounted) return
      if (kelasRes.success && kelasRes.data) {
        const data = kelasRes.data as KelasItem[]
        const unik = Array.from(new Map(data.map((k) => [k.kelasId, k])).values())
        setKelasList(unik)
        if (unik.length > 0) {
          setKelasId(unik[0].kelasId)
        }
      }
      if (periodeRes.success && periodeRes.data?.id) {
        setPeriodeAjaranId(periodeRes.data.id)
      }
      setLoadingKelas(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const handleKelasChange = (newKelasId: string) => {
    setKelasId(newKelasId)
  }

  // Muat daftar siswa otomatis saat kelas berubah (termasuk pemilihan awal)
  React.useEffect(() => {
    if (!kelasId) {
      setStudents([])
      setSelectedStudentId("")
      setShowRekap(false)
      return
    }
    let mounted = true
    setStudents([])
    setSelectedStudentId("")
    setShowRekap(false)
    async function loadSiswa() {
      const res = await getSiswaByKelas(kelasId)
      if (!mounted) return
      if (res.success && res.data) {
        const list = res.data as SiswaOption[]
        setStudents(list)
        if (list.length > 0) {
          setSelectedStudentId(list[0].siswaId)
        }
      }
    }
    loadSiswa()
    return () => {
      mounted = false
    }
  }, [kelasId])

  const handleSaveCatatan = async () => {
    if (!selectedStudentId || !periodeAjaranId) {
      toast({ variant: "destructive", title: "Pilih santri & periode aktif terlebih dahulu." })
      return
    }
    setSaving(true)
    try {
      const result = await createOrUpdateCatatanRapor({
        siswaId: selectedStudentId,
        periodeAjaranId,
        catatan,
      })
      if (result.success) {
        toast({ title: "Catatan Rapor Berhasil Disimpan! 📝", description: result.message })
      } else {
        toast({ variant: "destructive", title: "Gagal Menyimpan", description: result.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal Menyimpan", description: "Terjadi kesalahan saat menyimpan catatan rapor." })
    } finally {
      setSaving(false)
    }
  }

  const handleLoadRekap = async () => {
    if (!kelasId || !periodeAjaranId) {
      toast({ variant: "destructive", title: "Pilih kelas & periode aktif terlebih dahulu." })
      return
    }
    setLoadingRekap(true)
    try {
      const result = await getRekapRaporKelas({
        kelasId,
        periodeAjaranId,
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

  if (loadingKelas) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        <span className="ml-3 text-sm text-slate-500">Memuat daftar kelas...</span>
      </div>
    )
  }

  if (kelasList.length === 0) {
    return (
      <EmptyState
        title="Belum Ada Kelas"
        description="Anda belum ditugaskan mengajar di kelas manapun."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Kelas & Periode Selector */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Kelas</label>
            <select
              value={kelasId || ""}
              onChange={(e) => handleKelasChange(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-yellow-500"
            >
              <option value="">— Pilih Kelas —</option>
              {kelasList.map((k) => (
                <option key={k.kelasId} value={k.kelasId}>
                  {k.namaKelas} ({k.jumlahSiswa} siswa)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Periode</label>
            <input
              type="text"
              value={periodeAjaranId ? "Periode aktif" : "Memuat periode..."}
              readOnly
              disabled
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Student Selector Card */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Catatan Santri (Wali Kelas)
            </h3>
            <p className="text-xs text-slate-500">Pilih santri untuk mengisi catatan rapor</p>
          </div>

          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            disabled={students.length === 0}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-yellow-500 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {students.length === 0 ? (
              <option value="">Pilih kelas untuk memuat santri</option>
            ) : (
              students.map((s) => (
                <option key={s.siswaId} value={s.siswaId}>
                  {s.nama}{s.nisn ? ` (${s.nisn})` : ""}
                </option>
              ))
            )}
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
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[44px] px-6"
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
            <CardTitle className="text-base font-bold text-slate-800">
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
              {rekapData.periode?.nama ? ` • ${rekapData.periode.nama}` : ""}
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
                      <td className="p-3 pl-5 font-bold text-slate-800 text-sm">{r.nama}</td>
                      <td className="p-3 text-center">
                        <span className="font-extrabold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-lg border border-yellow-200 text-sm">
                          {r.rataRataKeseluruhan}
                        </span>
                      </td>
                      <td className="p-3 text-center text-xs text-slate-600">{r.kehadiran}</td>
                      <td className="p-3 text-center">
                        <span className={`text-xs font-bold ${r.totalAlpha > 3 ? "text-rose-600" : "text-slate-600"}`}>
                          {r.totalAlpha}
                        </span>
                      </td>
                      <td className="p-3 text-center text-xs font-bold text-slate-700">
                        {r.ranking || "-"}
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
