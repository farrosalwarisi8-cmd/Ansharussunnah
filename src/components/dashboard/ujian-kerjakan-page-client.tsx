"use client"



import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { mulaiPengerjaanUjian, submitPengerjaanUjian } from "@/actions/ujian"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import dynamic from "next/dynamic"
const ConfirmDialog = dynamic(() => import("@/components/ui/confirm-dialog").then(m => m.ConfirmDialog), { ssr: false })
import { EmptyState } from "@/components/ui/empty-state"
import { Clock, ArrowLeft, ArrowRight, Send, Loader2, AlertCircle } from "lucide-react"

interface OpsiSoal {
  id: string
  label: string
  teks: string
}

interface SoalExam {
  id: string
  nomor: number
  tipe: "PILIHAN_GANDA" | "ESAI"
  pertanyaan: string
  bobot: number
  opsi: OpsiSoal[]
}

interface UjianData {
  id: string
  judul: string
  mataPelajaran: string
  durasiMenit: number
  waktuMulaiSiswa: string | Date
  deadlineSelesai: string | Date
  soal: SoalExam[]
}

interface JawabanTersimpan {
  soalId: string
  opsiDipilihId?: string | null
  jawabanEsai?: string | null
}

export default function KerjakanUjianPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  const ujianId = params?.id as string

  // Loading states
  const [initializing, setInitializing] = React.useState(true)
  const [initError, setInitError] = React.useState<string | null>(null)

  // Ujian data (from server)
  const [ujianData, setUjianData] = React.useState<UjianData | null>(null)
  const [pengerjaanId, setPengerjaanId] = React.useState<string | null>(null)

  // Timer: calculate from deadlineSelesai
  const [timeLeft, setTimeLeft] = React.useState(0)
  const [currentIdx, setCurrentIdx] = React.useState(0)
  const [jawaban, setJawaban] = React.useState<Record<string, { opsiDipilihId?: string; jawabanEsai?: string }>>({})
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  // Initialize ujian data from server
  React.useEffect(() => {
    if (!ujianId) {
      setInitError("ID ujian tidak valid")
      setInitializing(false)
      return
    }

    async function initUjian() {
      setInitializing(true)
      setInitError(null)
      try {
        const result = await mulaiPengerjaanUjian(ujianId)
        if (!result.success || !result.data) {
          setInitError(result.message || "Gagal memuat data ujian")
          setInitializing(false)
          return
        }

        const data = result.data as {
          pengerjaanId: string
          ujian: UjianData
          jawabanTersimpan: JawabanTersimpan[]
        }

        setUjianData(data.ujian)
        setPengerjaanId(data.pengerjaanId)

        // Pre-fill saved answers
        const savedJawaban: Record<string, { opsiDipilihId?: string; jawabanEsai?: string }> = {}
        if (data.jawabanTersimpan && Array.isArray(data.jawabanTersimpan)) {
          for (const jwb of data.jawabanTersimpan) {
            savedJawaban[jwb.soalId] = {
              opsiDipilihId: jwb.opsiDipilihId || undefined,
              jawabanEsai: jwb.jawabanEsai || undefined,
            }
          }
        }
        setJawaban(savedJawaban)

        // Calculate time left from deadline
        const deadline = new Date(data.ujian.deadlineSelesai)
        const now = new Date()
        const diffMs = deadline.getTime() - now.getTime()
        setTimeLeft(Math.max(0, Math.floor(diffMs / 1000)))
      } catch {
        setInitError("Terjadi kesalahan saat memuat ujian")
      } finally {
        setInitializing(false)
      }
    }
    initUjian()
  }, [ujianId])

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const handlePilihJawaban = (soalId: string, val: string, tipe: "PILIHAN_GANDA" | "ESAI") => {
    setJawaban((prev) => ({
      ...prev,
      [soalId]: tipe === "PILIHAN_GANDA"
        ? { opsiDipilihId: val }
        : { jawabanEsai: val },
    }))
  }

  const handleFinalSubmit = React.useCallback(async () => {
    if (!ujianId || !pengerjaanId) return
    setSubmitting(true)
    try {
      // Build jawaban array: include ALL soal, even unanswered ones
      const jawabanArray = ujianData?.soal.map((soal) => {
        const jwb = jawaban[soal.id]
        return {
          soalId: soal.id,
          opsiDipilihId: jwb?.opsiDipilihId || undefined,
          jawabanEsai: jwb?.jawabanEsai || undefined,
        }
      }) || []

      const result = await submitPengerjaanUjian({
        ujianId,
        jawaban: jawabanArray,
      })

      toast({
        title: "Ujian Berhasil Dikumpulkan! 🏆",
        description: result.message || "Jawaban Anda telah tersimpan dan terkirim ke server.",
      })
      router.push("/dashboard/ujian")
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal Mengumpulkan Ujian",
        description: "Terjadi kesalahan saat mengirim jawaban. Silakan coba lagi.",
      })
    } finally {
      setSubmitting(false)
      setIsSubmitDialogOpen(false)
    }
  }, [ujianId, pengerjaanId, ujianData, jawaban, toast, router])

  // Countdown timer effect
  React.useEffect(() => {
    if (timeLeft <= 0 && !initializing && ujianData) {
      handleFinalSubmit()
      return
    }
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLeft, initializing, ujianData, handleFinalSubmit])

  // Loading state
  if (initializing) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto pb-12">
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
          <span className="ml-3 text-sm text-slate-500">Memuat soal ujian...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (initError) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto pb-12">
        <EmptyState
          icon={AlertCircle}
          title="Gagal Memuat Ujian"
          description={initError}
          actionLabel="Kembali ke Daftar Ujian"
          actionHref="/dashboard/ujian"
        />
      </div>
    )
  }

  if (!ujianData || !ujianData.soal || ujianData.soal.length === 0) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto pb-12">
        <EmptyState
          icon={AlertCircle}
          title="Tidak Ada Soal"
          description="Ujian ini belum memiliki soal. Hubungi guru pembuat ujian."
          actionLabel="Kembali ke Daftar Ujian"
          actionHref="/dashboard/ujian"
        />
      </div>
    )
  }

  const questions = ujianData.soal
  const currentQ = questions[currentIdx]
  const totalAnswered = Object.keys(jawaban).filter((key) => {
    const jwb = jawaban[key]
    return jwb?.opsiDipilihId || jwb?.jawabanEsai
  }).length

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      {/* Sticky Exam Top Bar */}
      <header className="sticky top-0 z-30 bg-slate-800 text-white rounded-2xl p-3.5 sm:p-4 shadow-xl flex items-center justify-between gap-3 backdrop-blur-md">
        <div>
          <h2 className="font-extrabold text-sm sm:text-base tracking-tight truncate max-w-[200px] sm:max-w-md">
            {ujianData.judul}
          </h2>
          <span className="text-xs text-yellow-400 font-medium hidden sm:inline">
            Soal {currentIdx + 1} dari {questions.length} • Terjawab: {totalAnswered}/{questions.length}
          </span>
        </div>

        {/* Countdown Timer Display */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3.5 py-1.5 rounded-xl font-mono font-black text-sm sm:text-base flex items-center gap-1.5 shadow-inner ${
              timeLeft < 300
                ? "bg-rose-600 text-white animate-pulse"
                : "bg-yellow-700 text-yellow-100"
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>{formatTimer(timeLeft)}</span>
          </div>

          <Button
            type="button"
            onClick={() => setIsSubmitDialogOpen(true)}
            className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm h-10 px-4 min-h-[40px]"
          >
            <Send className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Selesai
          </Button>
        </div>
      </header>

      {/* Main Grid: Question Content & Navigator Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Question Panel */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-5 sm:p-7 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-yellow-600 bg-yellow-50 px-3 py-1 rounded-lg">
                Soal Nomor {currentQ.nomor}
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                currentQ.tipe === "ESAI" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"
              }`}>
                {currentQ.tipe === "ESAI" ? "Esai" : "Pilihan Ganda"}
              </span>
            </div>

            <p className="text-sm sm:text-base font-semibold text-slate-800 leading-relaxed">
              {currentQ.pertanyaan}
            </p>

            {currentQ.tipe === "PILIHAN_GANDA" ? (
              <div className="space-y-2.5">
                {currentQ.opsi.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handlePilihJawaban(currentQ.id, opt.id, "PILIHAN_GANDA")}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-xl border-2 transition-all text-sm font-medium ${
                      jawaban[currentQ.id]?.opsiDipilihId === opt.id
                        ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-bold mr-2">{opt.label}.</span> {opt.teks}
                  </button>
                ))}
              </div>
            ) : (
              <Textarea
                placeholder="Tuliskan jawaban esai Anda di sini..."
                value={jawaban[currentQ.id]?.jawabanEsai || ""}
                onChange={(e) => handlePilihJawaban(currentQ.id, e.target.value, "ESAI")}
                className="min-h-[200px] rounded-xl border-slate-200 text-sm"
              />
            )}
          </Card>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
              className="rounded-xl border-slate-200 text-slate-700"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Sebelumnya
            </Button>
            <Button
              type="button"
              onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIdx === questions.length - 1}
              className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl"
            >
              Selanjutnya
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>

        {/* Sidebar Navigator */}
        <div className="lg:col-span-1">
          <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm p-4 sticky top-24">
            <h3 className="text-xs font-bold uppercase text-slate-500 mb-3">Navigasi Soal</h3>
            <div className="grid grid-cols-5 lg:grid-cols-3 gap-2">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIdx(idx)}
                  className={`w-full aspect-square rounded-xl text-xs font-bold transition-all ${
                    idx === currentIdx
                      ? "bg-yellow-500 text-white shadow-md"
                      : jawaban[q.id]?.opsiDipilihId || jawaban[q.id]?.jawabanEsai
                      ? "bg-yellow-100 text-yellow-600 border border-yellow-300"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {q.nomor}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <ConfirmDialog
        open={isSubmitDialogOpen}
        onOpenChange={setIsSubmitDialogOpen}
        title="Konfirmasi Selesai Ujian?"
        description={`Anda telah menjawab ${totalAnswered} dari ${questions.length} soal. Jawaban yang belum diisi akan dibiarkan kosong.`}
        onConfirm={handleFinalSubmit}
        confirmText={submitting ? "Mengirim..." : "Ya, Selesai!"}
        cancelText="Kembali Mengerjakan"
        isLoading={submitting}
      />
    </div>
  )
}
