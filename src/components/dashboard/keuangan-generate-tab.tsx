"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { FileSpreadsheet, Loader2, Settings2, Check, Download } from "lucide-react"
import { generateBulkSpp } from "@/actions/akuntansi"
import {
  getTarifSppPerJenjang,
  updateTarifSppJenjang,
} from "@/actions/setting-spp"

type TarifJenjang = { id: string; nama: string; tarifSppBulanan: number | null }

type LaporanItem = {
  jenjangId: string
  namaJenjang: string
  jumlahSiswa: number
  jumlahTagihan: number
  totalNominal: number
}

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n)

export function GenerateSppTab() {
  const { toast } = useToast()
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
  const now = new Date()
  const tahunSekarang = now.getFullYear()
  const [bulanGenerate, setBulanGenerate] = React.useState(`${BULAN[now.getMonth()]} ${tahunSekarang}`)
  const [nominalDefault, setNominalDefault] = React.useState("500000")
  const [generating, setGenerating] = React.useState(false)

  // Tarif SPP per jenjang
  const [tarifList, setTarifList] = React.useState<TarifJenjang[]>([])
  const [edits, setEdits] = React.useState<Record<string, string>>({})
  const [savingTarif, setSavingTarif] = React.useState<string | null>(null)
  const [selectedJenjangId, setSelectedJenjangId] = React.useState("")

  // Hasil generate
  const [laporan, setLaporan] = React.useState<LaporanItem[] | null>(null)
  const [hasilGenerate, setHasilGenerate] = React.useState<{
    totalSiswaTerproses: number
    totalDilewati: number
  } | null>(null)

  React.useEffect(() => {
    async function loadTarif() {
      const res = await getTarifSppPerJenjang()
      if (res.success && res.data) {
        const list = res.data as TarifJenjang[]
        setTarifList(list)
        setEdits(
          Object.fromEntries(
            list.map((t) => [t.id, t.tarifSppBulanan != null ? String(t.tarifSppBulanan) : ""])
          )
        )
      }
    }
    loadTarif()
  }, [])

  const setTarifField = (jenjangId: string, value: string) => {
    setEdits((prev) => ({ ...prev, [jenjangId]: value }))
  }

  const handleSimpanTarif = async (jenjang: TarifJenjang) => {
    const raw = edits[jenjang.id]
    if (raw === "") return
    const nominal = Number(raw)
    if (!Number.isFinite(nominal) || nominal < 0) {
      toast({ variant: "destructive", title: "Tarif tidak valid", description: "Isi tarif dengan angka lebih dari atau sama dengan 0 (0 = hapus tarif)." })
      return
    }
    setSavingTarif(jenjang.id)
    try {
      const result = await updateTarifSppJenjang({
        jenjangId: jenjang.id,
        tarifSppBulanan: nominal,
      })
      if (result.success) {
        toast({ title: "Tarif SPP Diperbarui ✅", description: result.message })
        setTarifList((prev) =>
          prev.map((t) =>
            t.id === jenjang.id
              ? { ...t, tarifSppBulanan: nominal > 0 ? nominal : null }
              : t
          )
        )
      } else {
        toast({ variant: "destructive", title: "Gagal Memperbarui", description: result.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal Memperbarui", description: "Terjadi kesalahan saat menyimpan tarif SPP jenjang." })
    } finally {
      setSavingTarif(null)
    }
  }

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
        jenjangId: selectedJenjangId || undefined,
      })

      if (!result.success) {
        toast({ variant: "destructive", title: "Gagal Menerbitkan Tagihan", description: result.message })
        return
      }

      setHasilGenerate({
        totalSiswaTerproses: result.data?.totalSiswaTerproses || 0,
        totalDilewati: result.data?.totalDilewati || 0,
      })
      setLaporan((result.data?.laporanPerJenjang as LaporanItem[]) || null)

      toast({ title: "Tagihan SPP Massal Terbit! 📊", description: `Tagihan bulan ${bulanGenerate} berhasil diterbitkan.` })
    } catch {
      toast({ variant: "destructive", title: "Gagal Menerbitkan Tagihan", description: "Terjadi kesalahan saat menerbitkan tagihan SPP." })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Panel: Set Tarif SPP per Jenjang */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-6 sm:p-8">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-yellow-600" />
            Tarif SPP per Jenjang
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Atur harga SPP bulanan untuk masing-masing jenjang. Tarif ini dipakai otomatis saat menerbitkan tagihan
            massal — santri di jenjang berbeda akan mendapat nominal berbeda. Isi 0 untuk menghapus tarif (fallback ke
            tarif default).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          {tarifList.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-yellow-500" />
              Memuat daftar jenjang...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-3 pl-4">Jenjang</th>
                    <th className="p-3">Tarif SPP Bulanan (Rp)</th>
                    <th className="p-3 pr-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tarifList.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80">
                      <td className="p-3 pl-4">
                        <div className="font-bold text-slate-800">{t.nama}</div>
                        <div className="text-[11px] text-slate-400">
                          {t.tarifSppBulanan != null
                            ? `Aktif: ${formatRp(t.tarifSppBulanan)}/bulan`
                            : "Belum ada tarif (pakai default)"}
                        </div>
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min={0}
                          step="1000"
                          value={edits[t.id] || ""}
                          onChange={(e) => setTarifField(t.id, e.target.value)}
                          placeholder="Contoh: 500000"
                          className="h-10 rounded-xl text-sm max-w-[180px]"
                        />
                      </td>
                      <td className="p-3 pr-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleSimpanTarif(t)}
                          disabled={savingTarif !== null}
                          className="rounded-xl text-xs font-bold bg-yellow-500 hover:bg-yellow-600 text-white min-h-[36px]"
                        >
                          {savingTarif === t.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <Check className="h-3.5 w-3.5 mr-1" />
                          )}
                          Simpan
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel: Penerbitan Tagihan SPP */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-6 sm:p-8">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-lg font-bold text-slate-800">Penerbitan Tagihan SPP Bulanan Massal</CardTitle>
          <CardDescription className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Sistem akan membuatkan invoice tagihan SPP untuk santri aktif sesuai tarif SPP masing-masing jenjang.
            Pilih jenjang untuk menerbitkan tagihan hanya untuk jenjang tersebut (opsional).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Bulan Tagihan</label>
              <select value={bulanGenerate} onChange={(e) => setBulanGenerate(e.target.value)} className="w-full h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold focus:ring-2 focus:ring-yellow-500">
                {BULAN.map((b) => (
                  <option key={b} value={`${b} ${tahunSekarang}`}>{b} {tahunSekarang}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Jenjang (opsional)</label>
              <select
                value={selectedJenjangId}
                onChange={(e) => setSelectedJenjangId(e.target.value)}
                className="w-full h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold focus:ring-2 focus:ring-yellow-500"
              >
                <option value="">Semua Jenjang</option>
                {tarifList.map((t) => (
                  <option key={t.id} value={t.id}>{t.nama}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Tarif Dasar Default (Rp)</label>
              <Input type="number" value={nominalDefault} onChange={(e) => setNominalDefault(e.target.value)} className="h-12 rounded-xl text-base sm:text-sm" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
            ⚠️ Urutan penentuan nominal: (1) SPP khusus / beasiswa per santri → (2) tarif SPP jenjang → (3) tarif default.
            Santri dengan tarif SPP khusus tidak akan terpengaruh nominal jenjang/default.
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

      {/* Laporan Hasil Generate */}
      {laporan && (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Download className="h-4 w-4 text-yellow-600" />
              Laporan Penerbitan Tagihan {bulanGenerate}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              {hasilGenerate
                ? `Terproses: ${hasilGenerate.totalSiswaTerproses} siswa baru • Dilewati (sudah ada / tanpa tarif): ${hasilGenerate.totalDilewati}.`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-600">
                  <tr>
                    <th className="p-3 pl-5">Jenjang</th>
                    <th className="p-3 text-center">Siswa Aktif</th>
                    <th className="p-3 text-center">Tagihan Dibuat</th>
                    <th className="p-3 text-right pr-5">Total Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {laporan.map((item) => (
                    <tr key={item.jenjangId} className="hover:bg-slate-50/80">
                      <td className="p-3 pl-5 font-bold text-slate-800">{item.namaJenjang}</td>
                      <td className="p-3 text-center text-slate-600">{item.jumlahSiswa}</td>
                      <td className="p-3 text-center">
                        <span className="font-extrabold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-lg border border-yellow-200">
                          {item.jumlahTagihan}
                        </span>
                      </td>
                      <td className="p-3 pr-5 text-right font-bold text-slate-700">
                        {formatRp(item.totalNominal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}