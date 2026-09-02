"use client"

import * as React from "react"
import { createOrUpdateCatatanRapor, getRekapRaporKelas } from "@/actions/rapor"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Printer, Save, Loader2, BarChart2 } from "lucide-react"

export function GuruRaporView() {
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
            <h3 className="text-base font-bold text-slate-800">
              Pilih Santri Binaan Wali Kelas
            </h3>
            <p className="text-xs text-slate-500">Pilih santri untuk mengisi catatan rapor</p>
          </div>

          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-yellow-500"
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
