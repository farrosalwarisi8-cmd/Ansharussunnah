"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { FileSpreadsheet, Loader2 } from "lucide-react"
import { generateBulkSpp } from "@/actions/akuntansi"

export function GenerateSppTab() {
  const { toast } = useToast()
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
  const now = new Date()
  const tahunSekarang = now.getFullYear()
  const [bulanGenerate, setBulanGenerate] = React.useState(`${BULAN[now.getMonth()]} ${tahunSekarang}`)
  const [nominalDefault, setNominalDefault] = React.useState("500000")
  const [generating, setGenerating] = React.useState(false)

  const handleGenerateSpp = async () => {
    setGenerating(true)
    try {
      const [bulanNama, tahunStr] = bulanGenerate.split(" ")
      const bulan = BULAN.indexOf(bulanNama) + 1
      const tahun = parseInt(tahunStr, 10)

      const defaultNominal = Number(nominalDefault)
      if (!Number.isFinite(defaultNominal) || defaultNominal <= 0) {
        toast({ variant: "destructive", title: "Tarif default tidak valid", description: "Isi tarif dasar default dengan angka lebih dari 0." })
        return
      }

      const result = await generateBulkSpp({
        bulan,
        tahun,
        nominalDefault: defaultNominal,
      })

      if (!result.success) {
        toast({ variant: "destructive", title: "Gagal Menerbitkan Tagihan", description: result.message })
        return
      }

      toast({ title: "Tagihan SPP Massal Terbit! 📊", description: `Tagihan bulan ${bulanGenerate} berhasil diterbitkan untuk seluruh santri aktif.` })
    } catch {
      toast({ variant: "destructive", title: "Gagal Menerbitkan Tagihan", description: "Terjadi kesalahan saat menerbitkan tagihan SPP." })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-6 sm:p-8 max-w-2xl">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-lg font-bold text-slate-800">Penerbitan Tagihan SPP Bulanan Massal</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-slate-500 leading-relaxed">
          Sistem akan secara otomatis membuatkan invoice tagihan SPP untuk seluruh santri aktif sesuai tarif SPP masing-masing jenjang.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 space-y-4 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Bulan Tagihan</label>
            <select value={bulanGenerate} onChange={(e) => setBulanGenerate(e.target.value)} className="w-full h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold focus:ring-2 focus:ring-yellow-500">
              {BULAN.map((b) => (
                <option key={b} value={`${b} ${tahunSekarang}`}>{b} {tahunSekarang}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Tarif Dasar Default (Rp)</label>
            <Input type="number" value={nominalDefault} onChange={(e) => setNominalDefault(e.target.value)} className="h-12 rounded-xl text-base sm:text-sm" />
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
          ⚠️ Santri dengan tarif beasiswa / SPP khusus tidak akan terpengaruh nominal default dan akan otomatis mengikuti nominal khusus yang tersimpan pada profil santri.
        </div>
        <div className="pt-2 flex justify-end">
          <Button onClick={handleGenerateSpp} disabled={generating} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold h-12 px-8 rounded-xl min-h-[48px] shadow-md">
            {generating ? (
              <><Loader2 className="h-5 w-5 animate-spin mr-2" />Sedang Menerbitkan...</>
            ) : (
              <><FileSpreadsheet className="h-5 w-5 mr-2" />Terbitkan Tagihan SPP ({bulanGenerate})</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
