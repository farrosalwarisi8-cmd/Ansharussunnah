"use client"



import * as React from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { submitTugas, beriNilaiTugas, getRekapPengumpulanTugas } from "@/actions/tugas"
import { useToast } from "@/hooks/use-toast"
import { Role } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge, type StatusType } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import dynamic from "next/dynamic"
const Dialog = dynamic(() => import("@/components/ui/dialog").then(m => m.Dialog), { ssr: false })
const DialogContent = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogContent), { ssr: false })
const DialogHeader = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogHeader), { ssr: false })
const DialogTitle = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogTitle), { ssr: false })
const DialogFooter = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogFooter), { ssr: false })
import { ArrowLeft, Clock, Upload, CheckCircle2, Link as LinkIcon, Loader2, AlertCircle } from "lucide-react"

interface SubmisiItem {
  siswaId: string
  nama: string
  nisn: string
  status: string
  waktuKumpul: string | Date | null
  nilai: number | null
  feedback: string | null
  jumlahRevisi: number
  penilai: string | null
}

interface RekapData {
  tugas: {
    id: string
    judul: string
    deadline: string | Date
    mataPelajaran: string
  }
  statistik: {
    totalSiswa: number
    sudahKumpul: number
    belumKumpul: number
    sudahDinilai: number
    terlambat: number
  }
  rekap: SubmisiItem[]
}

export default function DetailTugasPage() {
  const params = useParams()
  const { user } = useDashboard()
  const { toast } = useToast()

  const tugasId = params?.id as string
  const isTeacher = user.role === Role.GURU || user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_AKADEMIK

  // Real data states
  const [rekapData, setRekapData] = React.useState<RekapData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Submission Form State (for Student)
  const [submitting, setSubmitting] = React.useState(false)
  const [fileUrl, setFileUrl] = React.useState("")
  const [catatanSiswa, setCatatanSiswa] = React.useState("")
  const [alreadySubmitted, setAlreadySubmitted] = React.useState(false)

  // Grading State (for Teacher)
  const [selectedSubmisi, setSelectedSubmisi] = React.useState<SubmisiItem | null>(null)
  const [skorNilai, setSkorNilai] = React.useState("")
  const [feedbackGuru, setFeedbackGuru] = React.useState("")
  const [savingGrade, setSavingGrade] = React.useState(false)

  // Fetch rekap data for guru
  React.useEffect(() => {
    if (!isTeacher || !tugasId) return

    async function fetchRekap() {
      setLoading(true)
      setError(null)
      try {
        const result = await getRekapPengumpulanTugas(tugasId)
        if (result.success && result.data) {
          setRekapData(result.data as RekapData)
        } else {
          setError(result.message || "Gagal memuat rekap pengumpulan")
        }
      } catch {
        setError("Gagal memuat rekap pengumpulan")
      } finally {
        setLoading(false)
      }
    }
    fetchRekap()
  }, [isTeacher, tugasId])

  // For student, mark as loading done immediately
  React.useEffect(() => {
    if (!isTeacher) setLoading(false)
  }, [isTeacher])

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fileUrl.trim()) {
      toast({ variant: "destructive", title: "Tautan file atau link dokumen tugas wajib diisi!" })
      return
    }

    setSubmitting(true)
    try {
      const result = await submitTugas({
        tugasId,
        urlFile: fileUrl,
        namaFile: fileUrl.split('/').pop() || 'tugas-jawaban',
        ukuranFile: 1024,
      })

      if (result.success) {
        setAlreadySubmitted(true)
        toast({
          title: "Tugas Berhasil Dikumpulkan! 🎉",
          description: result.message,
        })
      } else {
        toast({
          variant: "destructive",
          title: "Gagal Mengumpulkan",
          description: result.message,
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal Mengumpulkan",
        description: "Terjadi kesalahan saat mengumpulkan tugas.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleBeriNilai = async () => {
    if (!selectedSubmisi) return
    setSavingGrade(true)

    try {
      const result = await beriNilaiTugas({
        pengumpulanId: selectedSubmisi.siswaId,
        nilai: parseFloat(skorNilai) || 0,
        feedback: feedbackGuru || undefined,
      })

      if (result.success) {
        toast({
          title: "Nilai Berhasil Disimpan! ✨",
          description: `Santri ${selectedSubmisi.nama} telah dinilai.`,
        })
        setSelectedSubmisi(null)
        // Refetch rekap
        const refetchResult = await getRekapPengumpulanTugas(tugasId)
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
        description: "Terjadi kesalahan saat menyimpan nilai.",
      })
    } finally {
      setSavingGrade(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
          <span className="ml-3 text-sm text-slate-500">Memuat detail tugas...</span>
        </div>
      </div>
    )
  }

  if (error && isTeacher) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <EmptyState
          icon={AlertCircle}
          title="Gagal Memuat Data"
          description={error}
          actionLabel="Kembali ke Daftar Tugas"
          actionHref="/dashboard/tugas"
        />
      </div>
    )
  }

  const statistik = rekapData?.statistik

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="sm" className="rounded-xl min-h-[40px]">
          <Link href="/dashboard/tugas">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Kembali
          </Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800">
            {rekapData?.tugas?.judul || "Detail Tugas"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Deadline: {rekapData?.tugas?.deadline ? new Date(rekapData.tugas.deadline).toLocaleDateString("id-ID") : "-"}
          </p>
        </div>
      </div>

      {/* Statistik Ringkas untuk Guru */}
      {isTeacher && statistik && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="rounded-2xl border-slate-200/80 bg-white">
            <CardContent className="p-4 text-center">
              <span className="text-xs text-slate-500 font-semibold uppercase">Total Siswa</span>
              <div className="text-2xl font-extrabold text-slate-800 mt-1">{statistik.totalSiswa}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-slate-200/80 bg-white">
            <CardContent className="p-4 text-center">
              <span className="text-xs text-slate-500 font-semibold uppercase">Sudah Kumpul</span>
              <div className="text-2xl font-extrabold text-yellow-600 mt-1">{statistik.sudahKumpul}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-slate-200/80 bg-white">
            <CardContent className="p-4 text-center">
              <span className="text-xs text-slate-500 font-semibold uppercase">Belum Kumpul</span>
              <div className="text-2xl font-extrabold text-rose-600 mt-1">{statistik.belumKumpul}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-slate-200/80 bg-white">
            <CardContent className="p-4 text-center">
              <span className="text-xs text-slate-500 font-semibold uppercase">Sudah Dinilai</span>
              <div className="text-2xl font-extrabold text-teal-700 mt-1">{statistik.sudahDinilai}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 1. GURU VIEW: DAFTAR SUBMISI SANTRI */}
      {isTeacher && rekapData && (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-800">
                Pengumpulan Santri ({statistik?.sudahKumpul || 0} Terkumpul)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Lihat status pengumpulan dan berikan penilaian
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {rekapData.rekap.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                Belum ada data pengumpulan tugas.
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-600">
                      <tr>
                        <th className="p-4 pl-6">Nama Santri</th>
                        <th className="p-4">Waktu Kumpul</th>
                        <th className="p-4">Jml Revisi</th>
                        <th className="p-4 text-center">Nilai</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 pr-6 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rekapData.rekap.map((sub) => (
                        <tr key={sub.siswaId} className="hover:bg-slate-50/80">
                          <td className="p-4 pl-6 font-bold text-slate-800">
                            {sub.nama}
                            <div className="text-xs font-normal text-slate-500 font-mono">NISN: {sub.nisn}</div>
                          </td>
                          <td className="p-4 text-xs text-slate-600">
                            {sub.waktuKumpul ? new Date(sub.waktuKumpul).toLocaleString("id-ID") : "-"}
                          </td>
                          <td className="p-4 text-xs text-slate-600">{sub.jumlahRevisi}</td>
                          <td className="p-4 text-center">
                            {sub.nilai !== null ? (
                              <span className="font-extrabold text-base text-yellow-600 bg-yellow-50 px-2.5 py-1 rounded-lg border border-yellow-200">
                                {Number(sub.nilai)}
                              </span>
                            ) : (
                              <span className="text-xs text-amber-500 font-bold">Belum</span>
                            )}
                          </td>
                          <td className="p-4">
                            <StatusBadge status={sub.status as StatusType} />
                          </td>
                          <td className="p-4 pr-6 text-right">
                            {sub.status !== "BELUM_DIKUMPULKAN" && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedSubmisi(sub)
                                  setSkorNilai(sub.nilai !== null ? String(Number(sub.nilai)) : "")
                                  setFeedbackGuru(sub.feedback || "")
                                }}
                                className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl min-h-[36px] text-xs font-bold"
                              >
                                {sub.nilai !== null ? "Edit Nilai" : "Beri Nilai"}
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
                  {rekapData.rekap.map((sub) => (
                    <div key={sub.siswaId} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{sub.nama}</div>
                          <div className="text-xs text-slate-500 font-mono">NISN: {sub.nisn}</div>
                        </div>
                        {sub.nilai !== null ? (
                          <span className="font-black text-lg text-yellow-600 bg-white px-2.5 py-1 rounded-xl border border-yellow-200">
                            {Number(sub.nilai)}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg font-bold">
                            Belum Dinilai
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <StatusBadge status={sub.status as StatusType} size="sm" />
                        {sub.status !== "BELUM_DIKUMPULKAN" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedSubmisi(sub)
                              setSkorNilai(sub.nilai !== null ? String(Number(sub.nilai)) : "")
                              setFeedbackGuru(sub.feedback || "")
                            }}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl min-h-[40px] text-xs font-bold"
                          >
                            {sub.nilai !== null ? "Edit Nilai" : "Beri Nilai"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 2. SISWA VIEW: FORM PENGUMPULAN TUGAS */}
      {!isTeacher && (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-6 sm:p-8 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-800">
              Formulir Pengumpulan Tugas Santri
            </h3>
            <p className="text-xs text-slate-500">
              Unggah file atau masukkan URL Google Drive file pengerjaan Anda
            </p>
          </div>

          {alreadySubmitted ? (
            <div className="p-6 rounded-2xl bg-yellow-50 border border-yellow-200 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-yellow-500 mx-auto" />
              <h4 className="font-bold text-yellow-900 text-base">Tugas Anda Sudah Dikumpulkan!</h4>
              <p className="text-xs text-yellow-600 max-w-sm mx-auto">
                Asatidz akan memeriksa pengerjaan Anda dan memberikan nilai serta catatan koreksi.
              </p>
            </div>
          ) : (
            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5 text-slate-500" />
                  <span>Tautan File Pengerjaan (Google Drive / Cloud Link) *</span>
                </label>
                <Input
                  placeholder="https://drive.google.com/file/d/..."
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  className="h-12 rounded-xl text-base sm:text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Catatan untuk Ustadz / Guru (Opsional)
                </label>
                <Textarea
                  placeholder="Tuliskan catatan tambahan mengenai tugas Anda..."
                  value={catatanSiswa}
                  onChange={(e) => setCatatanSiswa(e.target.value)}
                  className="rounded-xl min-h-[90px] text-sm"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold h-12 rounded-xl text-base shadow-md min-h-[48px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Mengirim Tugas...
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 mr-2" />
                    Kumpulkan Tugas Sekarang
                  </>
                )}
              </Button>
            </form>
          )}
        </Card>
      )}

      {/* Dialog Penilaian Tugas Guru */}
      {selectedSubmisi && (
        <Dialog open={!!selectedSubmisi} onOpenChange={() => setSelectedSubmisi(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-800">
                Nilai Tugas: {selectedSubmisi.nama}
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Berikan skor nilai (skala 0 - 100) dan catatan evaluasi untuk santri.
              </p>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-xs font-bold text-slate-700">Info Pengumpulan:</span>
                <div className="text-xs text-slate-600">
                  Waktu: {selectedSubmisi.waktuKumpul ? new Date(selectedSubmisi.waktuKumpul).toLocaleString("id-ID") : "-"}
                </div>
                <div className="text-xs text-slate-600">
                  Status: <StatusBadge status={selectedSubmisi.status as StatusType} size="sm" />
                </div>
                {selectedSubmisi.jumlahRevisi > 0 && (
                  <div className="text-xs text-amber-600">
                    Revisi ke-{selectedSubmisi.jumlahRevisi}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Skor Nilai (0 - 100):</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={skorNilai}
                  onChange={(e) => setSkorNilai(e.target.value)}
                  className="h-11 rounded-xl font-bold text-base"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Catatan Feedback untuk Santri:</label>
                <Input
                  value={feedbackGuru}
                  onChange={(e) => setFeedbackGuru(e.target.value)}
                  placeholder="Beri apresiasi atau catatan perbaikan..."
                  className="h-11 rounded-xl text-sm"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setSelectedSubmisi(null)}
                disabled={savingGrade}
                className="rounded-xl min-h-[40px]"
              >
                Batal
              </Button>
              <Button
                onClick={handleBeriNilai}
                disabled={savingGrade}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[40px]"
              >
                {savingGrade ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                Simpan Penilaian
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
