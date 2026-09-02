"use client"



import * as React from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { promosiSiswaMassal, getSiswaUntukPromosi } from "@/actions/kenaikan-kelas"
import { getAdminJenjangList } from "@/actions/jenjang-kelas"
import { getPeriodeAjaranAktif } from "@/actions/periode-ajaran"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import dynamic from "next/dynamic"
const ConfirmDialog = dynamic(() => import("@/components/ui/confirm-dialog").then(m => m.ConfirmDialog), { ssr: false })
import { EmptyState } from "@/components/ui/empty-state"
import { ArrowUpRight, CheckCircle2, Loader2, AlertCircle } from "lucide-react"

interface KelasTujuan {
  id: string
  nama: string
  jenjang: string
  terisi: number
  kapasitas: number
  sisaKuota: number
}

interface SiswaPromosi {
  siswaId: string
  nama: string
  nisn: string
  kelasAsal: string
  kelasTujuanId: string | null
}

interface KelasOption {
  id: string
  nama: string
  jenjangNama: string
}

export default function KenaikanKelasPage() {
  const { toast } = useToast()

  // Kelas list for dropdown
  const [kelasOptions, setKelasOptions] = React.useState<KelasOption[]>([])
  const [loadingKelas, setLoadingKelas] = React.useState(true)

  const [kelasAsalId, setKelasAsalId] = React.useState("")
  const [periodeAjaranId, setPeriodeAjaranId] = React.useState("")
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false)
  const [processing, setProcessing] = React.useState(false)

  // Data from getSiswaUntukPromosi
  const [siswaList, setSiswaList] = React.useState<SiswaPromosi[]>([])
  const [kelasTujuanList, setKelasTujuanList] = React.useState<KelasTujuan[]>([])
  const [loadingSiswa, setLoadingSiswa] = React.useState(false)
  const [siswaError, setSiswaError] = React.useState<string | null>(null)

  // Kelas asal info
  const [kelasAsalInfo, setKelasAsalInfo] = React.useState<{
    nama: string
    jenjang: string
    totalSiswa: number
  } | null>(null)

  // Fetch kelas list for dropdown
  React.useEffect(() => {
    async function fetchKelas() {
      setLoadingKelas(true)
      try {
        const result = await getAdminJenjangList()
        if (result.success && result.data) {
          const options: KelasOption[] = []
          for (const jenjang of result.data as Array<{
            id: string
            nama: string
            kelas: Array<{ id: string; nama: string }>
          }>) {
            for (const kelas of jenjang.kelas) {
              options.push({
                id: kelas.id,
                nama: `${jenjang.nama} - ${kelas.nama}`,
                jenjangNama: jenjang.nama,
              })
            }
          }
          setKelasOptions(options)
          if (options.length > 0 && !kelasAsalId) {
            setKelasAsalId(options[0].id)
          }
        }
      } catch {
        // Silent fail
      } finally {
        setLoadingKelas(false)
      }
    }
    fetchKelas()
  }, [kelasAsalId])

  // Muat periode ajaran aktif
  React.useEffect(() => {
    let mounted = true
    async function loadPeriode() {
      const res = await getPeriodeAjaranAktif()
      if (mounted && res.success && res.data?.id) {
        setPeriodeAjaranId(res.data.id)
      }
    }
    loadPeriode()
    return () => {
      mounted = false
    }
  }, [])

  // Fetch siswa when kelas asal changes
  React.useEffect(() => {
    if (!kelasAsalId) return

    async function fetchSiswa() {
      setLoadingSiswa(true)
      setSiswaError(null)
      try {
        const result = await getSiswaUntukPromosi(kelasAsalId)
        if (result.success && result.data) {
          const data = result.data as {
            kelasAsal: { id: string; nama: string; jenjang: string; totalSiswa: number }
            jenjangBerikutnya: { id: string; nama: string } | null
            kelasTujuan: KelasTujuan[]
            daftarSiswa: Array<{
              siswaId: string
              nama: string
              nisn: string
              kelasAsal: string
              rekomendasiKelasId: string | null
            }>
          }

          setKelasAsalInfo(data.kelasAsal)
          setKelasTujuanList(data.kelasTujuan)

          // Map to SiswaPromosi with kelas tujuan recommendation
          const mapped: SiswaPromosi[] = data.daftarSiswa.map((s) => ({
            siswaId: s.siswaId,
            nama: s.nama,
            nisn: s.nisn,
            kelasAsal: s.kelasAsal,
            kelasTujuanId: s.rekomendasiKelasId,
          }))
          setSiswaList(mapped)
        } else {
          setSiswaError(result.message || "Gagal memuat data siswa")
          setSiswaList([])
          setKelasAsalInfo(null)
          setKelasTujuanList([])
        }
      } catch {
        setSiswaError("Gagal memuat data siswa untuk promosi")
        setSiswaList([])
      } finally {
        setLoadingSiswa(false)
      }
    }
    fetchSiswa()
  }, [kelasAsalId])

  const updateKelasTujuan = (siswaId: string, kelasId: string) => {
    setSiswaList((prev) =>
      prev.map((s) => (s.siswaId === siswaId ? { ...s, kelasTujuanId: kelasId } : s))
    )
  }

  const handlePromosiMassal = async () => {
    if (siswaList.length === 0) {
      toast({ variant: "destructive", title: "Tidak ada siswa untuk dipromosikan" })
      return
    }

    setProcessing(true)
    try {
      // Filter siswa yang punya kelas tujuan
      const validMapping = siswaList
        .filter((s) => s.kelasTujuanId && s.kelasTujuanId !== "")
        .map((s) => ({
          siswaId: s.siswaId,
          kelasBaruId: s.kelasTujuanId!,
        }))

      if (validMapping.length === 0) {
        toast({ variant: "destructive", title: "Tidak ada siswa yang dipilih kelas tujuannya" })
        setProcessing(false)
        return
      }

      const result = await promosiSiswaMassal({
        periodeAjaranId,
        mapping: validMapping,
      })

      if (result.success) {
        toast({
          title: "Kenaikan Kelas Berhasil! 🎓",
          description: result.message,
        })
        // Refresh data
        setSiswaList([])
        setKelasAsalInfo(null)
        setKelasTujuanList([])
        setSiswaError(null)
      } else {
        toast({
          variant: "destructive",
          title: "Gagal Memproses Promosi",
          description: result.message,
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal Memproses Promosi",
        description: "Terjadi kesalahan saat memproses kenaikan kelas.",
      })
    } finally {
      setProcessing(false)
      setIsConfirmOpen(false)
    }
  }

  const totalValidSiswa = siswaList.filter((s) => s.kelasTujuanId && s.kelasTujuanId !== "").length

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <DashboardHeader
        title="Proses Kenaikan &amp; Promosi Kelas Santri"
        subtitle="Alat otomasi promosi santri massal ke jenjang/kelas berikutnya pada pergantian tahun ajaran."
      />

      {/* Filter Kelas Asal + Periode */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">
              Pilih Kelas Asal *
            </label>
            <select
              value={kelasAsalId}
              onChange={(e) => setKelasAsalId(e.target.value)}
              disabled={loadingKelas}
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-yellow-500"
            >
              <option value="">— Pilih Kelas —</option>
              {kelasOptions.map((k) => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">
              Periode Ajaran Tujuan
            </label>
            <input
              type="text"
              value={periodeAjaranId ? "Periode aktif" : "Memuat periode aktif..."}
              readOnly
              disabled
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500"
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => setIsConfirmOpen(true)}
              disabled={siswaList.length === 0 || processing}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl h-11 min-h-[44px] shadow-md"
            >
              <ArrowUpRight className="h-4 w-4 mr-1.5" />
              Proses Promosi ({totalValidSiswa} Santri)
            </Button>
          </div>
        </div>

        {/* Kelas Asal Info */}
        {kelasAsalInfo && (
          <div className="mt-4 p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-xs text-yellow-700">
            <strong>Kelas Asal:</strong> {kelasAsalInfo.nama} ({kelasAsalInfo.jenjang}) — {kelasAsalInfo.totalSiswa} siswa aktif
          </div>
        )}
      </Card>

      {/* Loading State */}
      {loadingSiswa && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
          <span className="ml-3 text-sm text-slate-500">Memuat daftar siswa untuk promosi...</span>
        </div>
      )}

      {/* Error State */}
      {!loadingSiswa && siswaError && (
        <EmptyState
          icon={AlertCircle}
          title="Gagal Memuat Data"
          description={siswaError}
        />
      )}

      {/* Empty State */}
      {!loadingSiswa && !siswaError && siswaList.length === 0 && kelasAsalId && (
        <EmptyState
          title="Tidak Ada Siswa"
          description="Tidak ada siswa yang ditemukan di kelas ini untuk dipromosikan."
        />
      )}

      {/* Santri List with Auto Recommendation */}
      {!loadingSiswa && !siswaError && siswaList.length > 0 && (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-800">
                Daftar Santri &amp; Rekomendasi Kelas Tujuan ({siswaList.length} Siswa)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Kelas tujuan otomatis terisi berdasarkan jenjang berikutnya. Dapat disesuaikan manual per siswa.
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
                    <th className="p-4">Kelas Asal</th>
                    <th className="p-4 pr-6">Kelas Tujuan Promosi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {siswaList.map((s) => (
                    <tr key={s.siswaId} className="hover:bg-slate-50/80">
                      <td className="p-4 pl-6 font-bold text-slate-800">{s.nama}</td>
                      <td className="p-4 text-xs font-mono text-slate-500">{s.nisn}</td>
                      <td className="p-4 text-xs text-slate-600">{s.kelasAsal}</td>
                      <td className="p-4 pr-6">
                        <select
                          value={s.kelasTujuanId || ""}
                          onChange={(e) => updateKelasTujuan(s.siswaId, e.target.value)}
                          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-yellow-800 focus:ring-2 focus:ring-yellow-500"
                        >
                          <option value="">— Pilih —</option>
                          {kelasTujuanList.map((kt) => (
                            <option key={kt.id} value={kt.id}>
                              {kt.nama} ({kt.terisi}/{kt.kapasitas}) {kt.sisaKuota <= 0 ? "— PENUH" : ""}
                            </option>
                          ))}
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
                      <div className="font-bold text-slate-800 text-sm">{s.nama}</div>
                      <div className="text-xs text-slate-500 font-mono">NISN: {s.nisn}</div>
                      <div className="text-xs text-slate-400">Kelas: {s.kelasAsal}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 block">Kelas Tujuan:</label>
                    <select
                      value={s.kelasTujuanId || ""}
                      onChange={(e) => updateKelasTujuan(s.siswaId, e.target.value)}
                      className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-yellow-800"
                    >
                      <option value="">— Pilih —</option>
                      {kelasTujuanList.map((kt) => (
                        <option key={kt.id} value={kt.id}>
                          {kt.nama} ({kt.sisaKuota} sisa kuota)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Jalankan Promosi Kenaikan Kelas?"
        description={`Apakah Anda yakin ingin memproses kenaikan kelas untuk ${totalValidSiswa} santri? Data riwayat kelas santri sebelumnya akan otomatis diarsipkan.`}
        confirmText={processing ? "Memproses..." : "Ya, Proses Kenaikan Kelas"}
        variant="default"
        isLoading={processing}
        onConfirm={handlePromosiMassal}
      />
    </div>
  )
}
