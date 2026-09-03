"use client"



import * as React from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { getRekapHasilUjian, beriNilaiEsai } from "@/actions/ujian"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import dynamic from "next/dynamic"
const Dialog = dynamic(() => import("@/components/ui/dialog").then(m => m.Dialog), { ssr: false })
const DialogContent = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogContent), { ssr: false })
const DialogHeader = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogHeader), { ssr: false })
const DialogTitle = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogTitle), { ssr: false })
const DialogFooter = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogFooter), { ssr: false })
import { ArrowLeft, FileEdit, CheckCircle2, Loader2, AlertCircle } from "lucide-react"

interface PesertaRekap {
  id: string
  siswa: {
    id: string
    nisn: string
    user: { nama: string; email: string }
  }
  status: string
  waktuMulai: string | Date
  waktuSubmit: string | Date | null
  submitTerlambat: boolean
  nilaiTotal: number | null
  nilaiPg: number | null
  nilaiEsai: number | null
  jawaban: Array<{
    soal: { id: string; nomorSoal: number; tipe: string; bobot: number }
    nilaiSoal: number | null
    benar: boolean | null
    jawabanEsai?: string | null
  }>
}

interface RekapData {
  ujian: {
    id: string
    judul: string
    kelas: { nama: string }
    soal: Array<{ id: string; nomorSoal: number; bobot: number; tipe: string }>
  }
  peserta: PesertaRekap[]
}

export default function RekapHasilUjianPage() {
  const params = useParams()
  const { toast } = useToast()
  const ujianId = params?.id as string

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [rekapData, setRekapData] = React.useState<RekapData | null>(null)

  const [selectedStudent, setSelectedStudent] = React.useState<PesertaRekap | null>(null)
  const [nilaiEsai, setNilaiEsai] = React.useState("")
  const [catatanEsai, setCatatanEsai] = React.useState("")
  const [savingEsai, setSavingEsai] = React.useState(false)

  // Fetch rekap data
  React.useEffect(() => {
    if (!ujianId) {
      setError("ID ujian tidak valid")
      setLoading(false)
      return
    }

    async function fetchRekap() {
      setLoading(true)
      setError(null)
      try {
        const result = await getRekapHasilUjian(ujianId)
        if (result.success && result.data) {
          setRekapData(result.data as RekapData)
        } else {
          setError(result.message || "Gagal memuat rekap hasil ujian")
        }
      } catch {
        setError("Gagal memuat rekap hasil ujian")
      } finally {
        setLoading(false)
      }
    }
    fetchRekap()
  }, [ujianId])

  const handleSimpanNilaiEsai = async () => {
    if (!selectedStudent) return
    setSavingEsai(true)

    try {
      const result = await beriNilaiEsai({
        pengerjaanId: selectedStudent.id,
        penilaian: selectedStudent.jawaban
          .filter((j) => j.soal.tipe === "ESAI" && j.soal.id && j.nilaiSoal === null)
          .map((j) => ({
            soalId: j.soal.id,
            nilaiSoal: parseFloat(nilaiEsai) || 0,
            catatanGuru: catatanEsai || undefined,
          })),
      })

      if (result.success) {
        toast({
          title: "Nilai Esai Berhasil Disimpan!",
          description: `Santri ${selectedStudent.siswa.user.nama} berhasil dinilai.`,
        })
        setSelectedStudent(null)
        // Refetch rekap data
        const refetchResult = await getRekapHasilUjian(ujianId)
        if (refetchResult.success && refetchResult.data) {
          setRekapData(refetchResult.data as RekapData)
        }
      } else {
        toast({
          variant: "destructive",
          title: "Gagal Menyimpan",
          description: result.message,
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: "Terjadi kesalahan saat menyimpan nilai esai.",
      })
    } finally {
      setSavingEsai(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
          <span className="ml-3 text-sm text-slate-500">Memuat rekap hasil ujian...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <EmptyState
          icon={AlertCircle}
          title="Gagal Memuat Data"
          description={error}
          actionLabel="Kembali ke Daftar Ujian"
          actionHref="/dashboard/ujian"
        />
      </div>
    )
  }

  if (!rekapData || !rekapData.peserta || rekapData.peserta.length === 0) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="rounded-xl min-h-[40px]">
            <Link href="/dashboard/ujian">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Kembali
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800">
              Rekap Hasil Ujian
            </h1>
          </div>
        </div>
        <EmptyState
          title="Belum Ada Peserta"
          description="Belum ada siswa yang mengerjakan ujian ini."
        />
      </div>
    )
  }

  const { ujian, peserta } = rekapData

  // Calculate stats
  const nilaiList = peserta
    .filter((p) => p.nilaiTotal !== null)
    .map((p) => Number(p.nilaiTotal))
  const rataRata = nilaiList.length > 0
    ? (nilaiList.reduce((a, b) => a + b, 0) / nilaiList.length).toFixed(1)
    : "0"
  const nilaiTertinggi = nilaiList.length > 0 ? Math.max(...nilaiList) : 0
  const nilaiTerendah = nilaiList.length > 0 ? Math.min(...nilaiList) : 0
  const sudahDinilai = peserta.filter((p) => p.status === "DINILAI").length

  // Total PG soal weight
  const totalBobotPG = ujian.soal
    .filter((s) => s.tipe === "PILIHAN_GANDA")
    .reduce((acc, s) => acc + s.bobot, 0)
  const totalBobotEsai = ujian.soal
    .filter((s) => s.tipe === "ESAI")
    .reduce((acc, s) => acc + s.bobot, 0)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="rounded-xl min-h-[40px]">
            <Link href="/dashboard/ujian">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Kembali
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800">
              Rekap Hasil Ujian: {ujian.judul}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              {ujian.kelas.nama} • {peserta.length} Peserta
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rata-Rata Kelas</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-1">{rataRata}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nilai Tertinggi</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-teal-700 mt-1">{nilaiTertinggi}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nilai Terendah</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-1">{nilaiTerendah}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Selesai Menilai</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-1">{sudahDinilai} / {peserta.length} Santri</div>
          </CardContent>
        </Card>
      </div>

      {/* Student Score Table / Card List (Responsive) */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Daftar Skor Santri
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Klik tombol &quot;Koreksi Esai&quot; untuk menginput koreksi jawaban esai santri
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
                  <th className="p-4 text-center">Skor PG ({totalBobotPG})</th>
                  <th className="p-4 text-center">Skor Esai ({totalBobotEsai})</th>
                  <th className="p-4 text-center">Total Nilai</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {peserta.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="p-4 pl-6 font-bold text-slate-800">{p.siswa.user.nama}</td>
                    <td className="p-4 text-xs font-mono text-slate-500">{p.siswa.nisn}</td>
                    <td className="p-4 text-center font-semibold text-slate-700">
                      {p.nilaiPg !== null ? Number(p.nilaiPg) : "-"}
                    </td>
                    <td className="p-4 text-center font-semibold text-slate-700">
                      {p.nilaiEsai !== null ? Number(p.nilaiEsai) : <span className="text-amber-500">Belum</span>}
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-extrabold text-base text-yellow-600 bg-yellow-50 px-2.5 py-1 rounded-lg border border-yellow-200">
                        {p.nilaiTotal !== null ? Number(p.nilaiTotal) : "-"}
                      </span>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={p.status as "DINILAI" | "SELESAI" | "SEDANG_MENGERJAKAN"} />
                    </td>
                    <td className="p-4 pr-6 text-right">
                      {p.status === "SELESAI" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedStudent(p)
                            setNilaiEsai("")
                            setCatatanEsai("")
                          }}
                          className="rounded-xl min-h-[36px] text-xs font-bold"
                        >
                          <FileEdit className="h-3.5 w-3.5 mr-1 text-yellow-600" />
                          Koreksi Esai
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden p-4 space-y-3">
            {peserta.map((p) => (
              <div key={p.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{p.siswa.user.nama}</div>
                    <div className="text-xs text-slate-500 font-mono">NISN: {p.siswa.nisn}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-lg text-yellow-600 bg-white px-2.5 py-1 rounded-xl border border-yellow-200 shadow-sm">
                      {p.nilaiTotal !== null ? Number(p.nilaiTotal) : "-"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-200 text-slate-600">
                  <div>Skor PG: <strong>{p.nilaiPg !== null ? `${Number(p.nilaiPg)}/${totalBobotPG}` : "-"}</strong></div>
                  <div>Skor Esai: <strong>{p.nilaiEsai !== null ? `${Number(p.nilaiEsai)}/${totalBobotEsai}` : "Belum Dinilai"}</strong></div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <StatusBadge status={p.status as "DINILAI" | "SELESAI" | "SEDANG_MENGERJAKAN"} size="sm" />
                  {p.status === "SELESAI" && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedStudent(p)
                        setNilaiEsai("")
                        setCatatanEsai("")
                      }}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl min-h-[40px] text-xs font-bold"
                    >
                      <FileEdit className="h-3.5 w-3.5 mr-1" />
                      Koreksi Esai
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog Penilaian Esai */}
      {selectedStudent && (
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-800">
                Penilaian Esai: {selectedStudent.siswa.user.nama}
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Koreksi jawaban esai santri dan berikan bobot nilai.
              </p>
            </DialogHeader>

            <div className="space-y-4 py-3">
              {/* Show essay answer */}
              {selectedStudent.jawaban.filter(j => j.soal.tipe === "ESAI").map((jwb, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-xs font-bold text-slate-700 block">
                    Soal {jwb.soal.nomorSoal} (Bobot: {jwb.soal.bobot}):
                  </span>
                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed italic">
                    &ldquo;{jwb.jawabanEsai || "(Tidak ada jawaban)"}&rdquo;
                  </p>
                </div>
              ))}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Skor Esai:</label>
                <Input
                  type="number"
                  min="0"
                  max={totalBobotEsai}
                  value={nilaiEsai}
                  onChange={(e) => setNilaiEsai(e.target.value)}
                  placeholder={`0 - ${totalBobotEsai}`}
                  className="h-11 rounded-xl font-bold text-base"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Catatan Feedback untuk Santri:</label>
                <Input
                  value={catatanEsai}
                  onChange={(e) => setCatatanEsai(e.target.value)}
                  placeholder="Beri motivasi atau catatan koreksi..."
                  className="h-11 rounded-xl text-sm"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setSelectedStudent(null)}
                disabled={savingEsai}
                className="rounded-xl min-h-[40px]"
              >
                Batal
              </Button>
              <Button
                onClick={handleSimpanNilaiEsai}
                disabled={savingEsai}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[40px]"
              >
                {savingEsai ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                Simpan Penilaian
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
