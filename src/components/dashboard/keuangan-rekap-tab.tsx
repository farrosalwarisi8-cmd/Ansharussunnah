"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { Loader2, RefreshCw } from "lucide-react"
import { getRekapSppPerKelas, getRekapSppPerJenjang, batalkanTagihanSpp } from "@/actions/akuntansi"

type RekapKelasItem = {
  kelasId: string
  namaKelas: string
  namaJenjang: string
  jumlahSiswa: number
  totalTagihan: number
  totalLunas: number
  totalNunggak: number
  persentaseKepatuhan: number
}

type RekapJenjangItem = {
  jenjangId: string
  namaJenjang: string
  jumlahKelas: number
  jumlahSiswa: number
  totalTagihan: number
  totalLunas: number
  totalNunggak: number
  persentaseKepatuhan: number
}

const BULAN_OPTIONS = [
  { value: "1", label: "Januari" }, { value: "2", label: "Februari" }, { value: "3", label: "Maret" },
  { value: "4", label: "April" }, { value: "5", label: "Mei" }, { value: "6", label: "Juni" },
  { value: "7", label: "Juli" }, { value: "8", label: "Agustus" }, { value: "9", label: "September" },
  { value: "10", label: "Oktober" }, { value: "11", label: "November" }, { value: "12", label: "Desember" },
]

const formatRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`

const getComplianceColor = (pct: number) => {
  if (pct >= 80) return "text-yellow-600 bg-yellow-50"
  if (pct >= 70) return "text-amber-700 bg-amber-50"
  return "text-rose-700 bg-rose-50"
}

const getComplianceBadge = (pct: number) => {
  if (pct >= 80) return { bg: "bg-yellow-500", label: "Tinggi", text: "text-yellow-600" }
  if (pct >= 70) return { bg: "bg-amber-500", label: "Sedang", text: "text-amber-700" }
  return { bg: "bg-rose-500", label: "Rendah", text: "text-rose-700" }
}

export function RekapTab() {
  const { toast } = useToast()
  const [rekapView, setRekapView] = React.useState<"kelas" | "jenjang">("kelas")
  const [filterBulan, setFilterBulan] = React.useState<string>("")
  const [rekapKelasData, setRekapKelasData] = React.useState<RekapKelasItem[]>([])
  const [rekapJenjangData, setRekapJenjangData] = React.useState<RekapJenjangItem[]>([])
  const [loadingRekap, setLoadingRekap] = React.useState(true)
  const [periodeLabel, setPeriodeLabel] = React.useState("Semua Periode")

  const fetchRekap = React.useCallback(async () => {
    setLoadingRekap(true)
    try {
      const filter = filterBulan ? { bulan: parseInt(filterBulan), tahun: new Date().getFullYear() } : undefined
      if (rekapView === "kelas") {
        const result = await getRekapSppPerKelas(filter)
        if (result.success && result.data) {
          setRekapKelasData(result.data.items)
          setPeriodeLabel(result.data.periodeDipakai)
        } else {
          toast({ title: "Gagal memuat rekap", description: result.message, variant: "destructive" })
        }
      } else {
        const result = await getRekapSppPerJenjang(filter)
        if (result.success && result.data) {
          setRekapJenjangData(result.data.items)
          setPeriodeLabel(result.data.periodeDipakai)
        } else {
          toast({ title: "Gagal memuat rekap", description: result.message, variant: "destructive" })
        }
      }
    } catch {
      toast({ title: "Error", description: "Gagal mengambil data rekap", variant: "destructive" })
    } finally {
      setLoadingRekap(false)
    }
  }, [rekapView, filterBulan, toast])

  React.useEffect(() => { fetchRekap() }, [fetchRekap])

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase">Tampilan:</span>
            <div className="flex rounded-xl bg-slate-100 p-0.5">
              <button onClick={() => setRekapView("kelas")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${rekapView === "kelas" ? "bg-white text-yellow-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Per Kelas</button>
              <button onClick={() => setRekapView("jenjang")} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${rekapView === "jenjang" ? "bg-white text-yellow-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Per Jenjang</button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-48">
              <Select value={filterBulan} onValueChange={setFilterBulan}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-semibold"><SelectValue placeholder="Semua Periode" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Periode</SelectItem>
                  {BULAN_OPTIONS.map((b) => (<SelectItem key={b.value} value={b.value}>{b.label} {new Date().getFullYear()}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={fetchRekap} disabled={loadingRekap} className="rounded-xl text-xs font-bold">
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingRekap ? "animate-spin" : ""}`} /> Muat Ulang
            </Button>
          </div>
          <div className="text-xs text-slate-500 ml-auto">Periode: <strong>{periodeLabel}</strong></div>
        </div>
      </Card>

      {loadingRekap ? (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-8">
          <div className="text-center text-slate-500 text-sm flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Memuat data rekap...</div>
        </Card>
      ) : rekapView === "kelas" ? (
        <>
          {/* Desktop Table */}
          <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden hidden md:block">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-800">Rekap SPP Per Kelas</CardTitle>
              <CardDescription className="text-xs text-slate-500">Ringkasan tagihan, pembayaran, dan tunggakan SPP untuk setiap kelas aktif</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Kelas</TableHead><TableHead>Jenjang</TableHead><TableHead className="text-center">Siswa</TableHead>
                <TableHead className="text-right">Total Tagihan</TableHead><TableHead className="text-right">Lunas</TableHead><TableHead className="text-right">Nunggak</TableHead><TableHead className="text-center">Kepatuhan</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rekapKelasData.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500 text-sm">Tidak ada data rekap untuk periode ini</TableCell></TableRow>
                ) : rekapKelasData.map((item) => {
                  const badge = getComplianceBadge(item.persentaseKepatuhan)
                  return (
                    <TableRow key={item.kelasId}>
                      <TableCell className="font-bold text-slate-800">{item.namaKelas}</TableCell>
                      <TableCell className="text-sm text-slate-600">{item.namaJenjang}</TableCell>
                      <TableCell className="text-center text-sm">{item.jumlahSiswa}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">{formatRp(item.totalTagihan)}</TableCell>
                      <TableCell className="text-right text-sm text-yellow-600 font-semibold">{formatRp(item.totalLunas)}</TableCell>
                      <TableCell className="text-right text-sm text-rose-600 font-semibold">{item.totalNunggak > 0 ? formatRp(item.totalNunggak) : "-"}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getComplianceColor(item.persentaseKepatuhan)}`}>{item.persentaseKepatuhan}%</span>
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${badge.bg}`} style={{ width: `${Math.min(item.persentaseKepatuhan, 100)}%` }} /></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
          {/* Mobile Card List */}
          <div className="md:hidden space-y-3">
            {rekapKelasData.length === 0 ? (
              <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm p-6 text-center text-slate-500 text-sm">Tidak ada data rekap untuk periode ini</Card>
            ) : rekapKelasData.map((item) => {
              const badge = getComplianceBadge(item.persentaseKepatuhan)
              return (
                <Card key={item.kelasId} className="rounded-2xl border-slate-200/80 bg-white shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div><div className="font-bold text-slate-800 text-sm">{item.namaKelas}</div><div className="text-xs text-slate-500">{item.namaJenjang} &bull; {item.jumlahSiswa} siswa</div></div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getComplianceColor(item.persentaseKepatuhan)}`}>{item.persentaseKepatuhan}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3"><div className={`h-full rounded-full transition-all ${badge.bg}`} style={{ width: `${Math.min(item.persentaseKepatuhan, 100)}%` }} /></div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><div className="text-slate-400">Tagihan</div><div className="font-bold text-slate-800">{formatRp(item.totalTagihan)}</div></div>
                    <div><div className="text-slate-400">Lunas</div><div className="font-bold text-yellow-600">{formatRp(item.totalLunas)}</div></div>
                    <div><div className="text-slate-400">Nunggak</div><div className="font-bold text-rose-600">{item.totalNunggak > 0 ? formatRp(item.totalNunggak) : "-"}</div></div>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden hidden md:block">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-800">Rekap SPP Per Jenjang</CardTitle>
              <CardDescription className="text-xs text-slate-500">Agregasi tagihan, pembayaran, dan tunggakan SPP untuk setiap jenjang pendidikan</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Jenjang</TableHead><TableHead className="text-center">Kelas</TableHead><TableHead className="text-center">Siswa</TableHead>
                <TableHead className="text-right">Total Tagihan</TableHead><TableHead className="text-right">Lunas</TableHead><TableHead className="text-right">Nunggak</TableHead><TableHead className="text-center">Kepatuhan</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rekapJenjangData.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500 text-sm">Tidak ada data rekap untuk periode ini</TableCell></TableRow>
                ) : rekapJenjangData.map((item) => {
                  const badge = getComplianceBadge(item.persentaseKepatuhan)
                  return (
                    <TableRow key={item.jenjangId}>
                      <TableCell className="font-bold text-slate-800">{item.namaJenjang}</TableCell>
                      <TableCell className="text-center text-sm">{item.jumlahKelas}</TableCell>
                      <TableCell className="text-center text-sm">{item.jumlahSiswa}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">{formatRp(item.totalTagihan)}</TableCell>
                      <TableCell className="text-right text-sm text-yellow-600 font-semibold">{formatRp(item.totalLunas)}</TableCell>
                      <TableCell className="text-right text-sm text-rose-600 font-semibold">{item.totalNunggak > 0 ? formatRp(item.totalNunggak) : "-"}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getComplianceColor(item.persentaseKepatuhan)}`}>{item.persentaseKepatuhan}%</span>
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${badge.bg}`} style={{ width: `${Math.min(item.persentaseKepatuhan, 100)}%` }} /></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
          {/* Mobile Card List */}
          <div className="md:hidden space-y-3">
            {rekapJenjangData.length === 0 ? (
              <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm p-6 text-center text-slate-500 text-sm">Tidak ada data rekap untuk periode ini</Card>
            ) : rekapJenjangData.map((item) => {
              const badge = getComplianceBadge(item.persentaseKepatuhan)
              return (
                <Card key={item.jenjangId} className="rounded-2xl border-slate-200/80 bg-white shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div><div className="font-bold text-slate-800 text-sm">{item.namaJenjang}</div><div className="text-xs text-slate-500">{item.jumlahKelas} kelas &bull; {item.jumlahSiswa} siswa</div></div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getComplianceColor(item.persentaseKepatuhan)}`}>{item.persentaseKepatuhan}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3"><div className={`h-full rounded-full transition-all ${badge.bg}`} style={{ width: `${Math.min(item.persentaseKepatuhan, 100)}%` }} /></div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><div className="text-slate-400">Tagihan</div><div className="font-bold text-slate-800">{formatRp(item.totalTagihan)}</div></div>
                    <div><div className="text-slate-400">Lunas</div><div className="font-bold text-yellow-600">{formatRp(item.totalLunas)}</div></div>
                    <div><div className="text-slate-400">Nunggak</div><div className="font-bold text-rose-600">{item.totalNunggak > 0 ? formatRp(item.totalNunggak) : "-"}</div></div>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
