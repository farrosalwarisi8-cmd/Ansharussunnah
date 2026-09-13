"use client"

import * as React from "react"
import {
  createOrUpdateCatatanRapor,
  getCatatanRaporDetail,
  getRekapRaporKelas,
} from "@/actions/rapor"
import { getPeriodeAjaranAktif } from "@/actions/periode-ajaran"
import { getDaftarKelasYangDiajarGuru } from "@/actions/guru-kelas"
import { getSiswaByKelas } from "@/actions/absensi"
import { labelJenisRapor, namaBulan } from "@/lib/bulan"
import { peranOptionSuffix, type PeranKelas } from "@/lib/kelas-peran"
import { PeranKelasBadge, PeranKelasLegend } from "@/components/ui/peran-kelas-badge"
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
  jenisKelamin: "LAKI_LAKI" | "PEREMPUAN" | null
  jumlahSiswa: number
  peran?: PeranKelas
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

  // Jenis rapor: 0 = Akhir Semester, 1-12 = Bulanan
  const [raporBulan, setRaporBulan] = React.useState(0)
  const [ranking, setRanking] = React.useState("")
  const [kedisiplinan, setKedisiplinan] = React.useState("")
  const [kemandirian, setKemandirian] = React.useState("")
  const [tingkahLaku, setTingkahLaku] = React.useState("")
  const [prestasi, setPrestasi] = React.useState("")
  const [loadingDetail, setLoadingDetail] = React.useState(false)

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
        bulan: raporBulan,
        catatan,
        ranking: ranking ? Number(ranking) : undefined,
        kedisiplinan: kedisiplinan !== "" ? Number(kedisiplinan) : undefined,
        kemandirian: kemandirian !== "" ? Number(kemandirian) : undefined,
        tingkahLaku: tingkahLaku || undefined,
        prestasi: prestasi || undefined,
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

  // Muat catatan & nilai sikap yang sudah ada saat santri/jenis rapor diganti
  React.useEffect(() => {
    if (!selectedStudentId || !periodeAjaranId) return
    let cancelled = false
    setLoadingDetail(true)
    async function loadDetail() {
      const res = await getCatatanRaporDetail(selectedStudentId, periodeAjaranId, raporBulan)
      if (!cancelled) {
        if (res.success && res.data) {
          const detail = res.data as unknown as {
            catatan?: {
              catatan: string
              ranking: number | null
              kedisiplinan: number | null
              kemandirian: number | null
              tingkahLaku: string | null
              prestasi: string | null
            }
          }
          setCatatan(detail.catatan?.catatan ?? "")
          setRanking(detail.catatan?.ranking != null ? String(detail.catatan.ranking) : "")
          setKedisiplinan(detail.catatan?.kedisiplinan != null ? String(detail.catatan.kedisiplinan) : "")
          setKemandirian(detail.catatan?.kemandirian != null ? String(detail.catatan.kemandirian) : "")
          setTingkahLaku(detail.catatan?.tingkahLaku ?? "")
          setPrestasi(detail.catatan?.prestasi ?? "")
        } else {
          setCatatan("")
          setRanking("")
          setKedisiplinan("")
          setKemandirian("")
          setTingkahLaku("")
          setPrestasi("")
        }
      }
    }
    loadDetail().finally(() => {
      if (!cancelled) setLoadingDetail(false)
    })
    return () => {
      cancelled = true
    }
  }, [selectedStudentId, periodeAjaranId, raporBulan])

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
        bulan: raporBulan,
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
        <CardContent className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              Kelas
              <PeranKelasBadge
                peran={kelasList.find((k) => k.kelasId === kelasId)?.peran}
              />
            </label>
            <select
              value={kelasId || ""}
              onChange={(e) => handleKelasChange(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-yellow-500"
            >
              <option value="">— Pilih Kelas —</option>
              {kelasList.map((k) => (
                <option key={k.kelasId} value={k.kelasId}>
                  {k.jenjang} - {k.namaKelas}
                  {k.jenisKelamin === "LAKI_LAKI" ? " (Ikhwan)" : k.jenisKelamin === "PEREMPUAN" ? " (Akhwat)" : ""} ({k.jumlahSiswa} siswa)
                  {peranOptionSuffix(k.peran)}
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

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Jenis Rapor</label>
            <select
              value={raporBulan}
              onChange={(e) => setRaporBulan(Number(e.target.value))}
              className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-yellow-500"
            >
              <option value={0}>Rapor Akhir Semester</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Rapor Bulanan - {namaBulan(m)}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <PeranKelasLegend />

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
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Catatan &amp; Nasehat Wali Kelas - {labelJenisRapor(raporBulan)}:
            </label>
            {loadingDetail && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          </div>

          {/* Penilaian Sikap & Perilaku (manual wali kelas) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Ranking Kelas (opsional)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={ranking}
                onChange={(e) => setRanking(e.target.value)}
                placeholder="e.g. 1"
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Nilai Kedisiplinan (0-100)</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={kedisiplinan}
                onChange={(e) => setKedisiplinan(e.target.value)}
                placeholder="e.g. 85"
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Nilai Kemandirian (0-100)</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={kemandirian}
                onChange={(e) => setKemandirian(e.target.value)}
                placeholder="e.g. 90"
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Tingkah Laku / Perilaku</label>
              <input
                type="text"
                value={tingkahLaku}
                onChange={(e) => setTingkahLaku(e.target.value)}
                placeholder="e.g. Berperilaku baik dan santun"
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Prestasi / Capaian</label>
              <input
                type="text"
                value={prestasi}
                onChange={(e) => setPrestasi(e.target.value)}
                placeholder="e.g. Juara hafalan juz 30"
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>

          <Textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            className="rounded-2xl min-h-[100px] text-sm p-4"
            placeholder="Tuliskan evaluasi perkembangan akhlak, ibadah, dan motivasi belajar santri..."
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSaveCatatan}
              disabled={saving || loadingDetail}
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
              {" • "}{labelJenisRapor(raporBulan)}
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
