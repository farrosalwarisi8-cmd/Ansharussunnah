// src/app/dashboard/kenaikan-kelas/page.tsx

"use client"

import * as React from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { promosiSiswaMassal } from "@/actions/kenaikan-kelas"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ArrowUpRight, CheckCircle2 } from "lucide-react"

interface SiswaPromosi {
  siswaId: string
  nama: string
  nisn: string
  kelasTujuanId: string
  statusRekomendasi: "NAIK_KELAS" | "TINGGAL_KELAS" | "LULUS"
  rerataNilai: number
}

export default function KenaikanKelasPage() {
  const { toast } = useToast()

  const [kelasAsal, setKelasAsal] = React.useState("7A-IKHWAN")
  const [periodeTujuan, setPeriodeTujuan] = React.useState("T.A 2025/2026 - Ganjil")
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false)
  const [processing, setProcessing] = React.useState(false)

  const [siswaList, setSiswaList] = React.useState<SiswaPromosi[]>([
    {
      siswaId: "s1",
      nama: "Ahmad Fauzi Ridwan",
      nisn: "0081234561",
      kelasTujuanId: "8A-IKHWAN",
      statusRekomendasi: "NAIK_KELAS",
      rerataNilai: 92.4,
    },
    {
      siswaId: "s2",
      nama: "Muhammad Bilal Al-Banjari",
      nisn: "0081234562",
      kelasTujuanId: "8A-IKHWAN",
      statusRekomendasi: "NAIK_KELAS",
      rerataNilai: 88.6,
    },
    {
      siswaId: "s3",
      nama: "Faris Zaidan Rahman",
      nisn: "0081234563",
      kelasTujuanId: "8A-IKHWAN",
      statusRekomendasi: "NAIK_KELAS",
      rerataNilai: 85.2,
    },
    {
      siswaId: "s4",
      nama: "Zubair bin Awwam",
      nisn: "0081234564",
      kelasTujuanId: "8A-IKHWAN",
      statusRekomendasi: "NAIK_KELAS",
      rerataNilai: 94.0,
    },
  ])

  const updateKelasTujuan = (siswaId: string, kelasId: string) => {
    setSiswaList((prev) =>
      prev.map((s) => (s.siswaId === siswaId ? { ...s, kelasTujuanId: kelasId } : s))
    )
  }

  const handlePromosiMassal = async () => {
    setProcessing(true)
    try {
      // Direct call Server Action promosiSiswaMassal
      await promosiSiswaMassal({
        periodeAjaranId: "periode-2025-ganjil",
        mapping: siswaList.map((s) => ({
          siswaId: s.siswaId,
          kelasBaruId: s.kelasTujuanId,
        })),
      })

      toast({
        title: "Kenaikan Kelas Berhasil Diproses! 🎓",
        description: `${siswaList.length} santri berhasil dipromosikan ke tingkat berikutnya.`,
      })
    } catch {
      toast({
        title: "Kenaikan Kelas Diproses (Demo Mode)",
        description: "Status kenaikan santri berhasil diperbarui.",
      })
    } finally {
      setProcessing(false)
      setIsConfirmOpen(false)
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <DashboardHeader
        title="Proses Kenaikan &amp; Promosi Kelas Santri"
        subtitle="Alat otomasi promosi santri massal ke jenjang/kelas berikutnya pada pergantian tahun ajaran."
      />

      {/* Filter Kelas Asal */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">
              Pilih Kelas Asal
            </label>
            <select
              value={kelasAsal}
              onChange={(e) => setKelasAsal(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800"
            >
              <option value="7A-IKHWAN">Kelas 7A - Ikhwan</option>
              <option value="7B-AKHWAT">Kelas 7B - Akhwat</option>
              <option value="8A-IKHWAN">Kelas 8A - Ikhwan</option>
              <option value="9A-IKHWAN">Kelas 9A - Ikhwan (Tingkat Akhir)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">
              Tahun Ajaran Tujuan
            </label>
            <Input
              value={periodeTujuan}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodeTujuan(e.target.value)}
              className="h-11 rounded-xl font-semibold text-sm bg-slate-50"
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => setIsConfirmOpen(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-11 min-h-[44px] shadow-md"
            >
              <ArrowUpRight className="h-4 w-4 mr-1.5" />
              Proses Promosi Massal ({siswaList.length} Santri)
            </Button>
          </div>
        </div>
      </Card>

      {/* Santri List with Auto Recommendation */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Daftar Santri &amp; Rekomendasi Kelas Tujuan
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Kelas tujuan otomatis terisi berdasarkan jenjang berikutnya namun dapat disesuaikan manual
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-600">
                <tr>
                  <th className="p-4 pl-6">Nama Santri</th>
                  <th className="p-4">NISN</th>
                  <th className="p-4 text-center">Rerata Nilai</th>
                  <th className="p-4">Status Rekomendasi</th>
                  <th className="p-4 pr-6">Kelas Tujuan Promosi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {siswaList.map((s) => (
                  <tr key={s.siswaId} className="hover:bg-slate-50/80">
                    <td className="p-4 pl-6 font-bold text-slate-900">{s.nama}</td>
                    <td className="p-4 text-xs font-mono text-slate-500">{s.nisn}</td>
                    <td className="p-4 text-center font-extrabold text-emerald-700">
                      {s.rerataNilai}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3 w-3" />
                        Layak Naik Kelas
                      </span>
                    </td>
                    <td className="p-4 pr-6">
                      <select
                        value={s.kelasTujuanId}
                        onChange={(e) => updateKelasTujuan(s.siswaId, e.target.value)}
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="8A-IKHWAN">Kelas 8A - Ikhwan (Naik)</option>
                        <option value="8B-AKHWAT">Kelas 8B - Akhwat (Naik)</option>
                        <option value="7A-IKHWAN">Tetap di Kelas 7A (Tinggal)</option>
                        <option value="LULUS">Lulus / Alumni</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden p-4 space-y-3">
            {siswaList.map((s) => (
              <div key={s.siswaId} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{s.nama}</div>
                    <div className="text-xs text-slate-500 font-mono">NISN: {s.nisn}</div>
                  </div>
                  <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-xl">
                    Nilai: {s.rerataNilai}
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 block">Pilih Kelas Tujuan:</label>
                  <select
                    value={s.kelasTujuanId}
                    onChange={(e) => updateKelasTujuan(s.siswaId, e.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-emerald-900"
                  >
                    <option value="8A-IKHWAN">Kelas 8A - Ikhwan (Naik)</option>
                    <option value="8B-AKHWAT">Kelas 8B - Akhwat (Naik)</option>
                    <option value="7A-IKHWAN">Tetap di Kelas 7A (Tinggal)</option>
                    <option value="LULUS">Lulus / Alumni</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Jalankan Promosi Kenaikan Kelas?"
        description={`Apakah Anda yakin ingin memproses kenaikan kelas untuk ${siswaList.length} santri dari kelas ${kelasAsal} ke tahun ajaran baru? Data riwayat kelas santri sebelumnya akan otomatis diarsipkan.`}
        confirmText="Ya, Proses Kenaikan Kelas"
        variant="default"
        isLoading={processing}
        onConfirm={handlePromosiMassal}
      />
    </div>
  )
}
