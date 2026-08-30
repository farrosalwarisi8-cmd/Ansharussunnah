// src/app/dashboard/ujian/[id]/kerjakan/page.tsx

"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { submitPengerjaanUjian } from "@/actions/ujian"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Clock, CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight, Save, Send, Sparkles } from "lucide-react"

interface SoalExam {
  id: string
  nomor: number
  tipe: "PILIHAN_GANDA" | "ESAI"
  pertanyaan: string
  opsi: { id: string; label: string; teks: string }[]
}

export default function KerjakanUjianPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  const ujianId = (params?.id as string) || "ujian-1"

  // 60 minutes = 3600 seconds
  const [timeLeft, setTimeLeft] = React.useState(3600)
  const [currentIdx, setCurrentIdx] = React.useState(0)
  const [jawaban, setJawaban] = React.useState<Record<string, string>>({})
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  // Dummy questions for exam execution
  const questions: SoalExam[] = [
    {
      id: "soal-1",
      nomor: 1,
      tipe: "PILIHAN_GANDA",
      pertanyaan: "Berapakah jumlah rukun wudhu yang wajib menurut madzhab Syafi'i?",
      opsi: [
        { id: "opt-1", label: "A", teks: "4 Rukun" },
        { id: "opt-2", label: "B", teks: "6 Rukun" },
        { id: "opt-3", label: "C", teks: "8 Rukun" },
        { id: "opt-4", label: "D", teks: "10 Rukun" },
      ],
    },
    {
      id: "soal-2",
      nomor: 2,
      tipe: "PILIHAN_GANDA",
      pertanyaan: "Apakah hukum membaca surat Al-Fatihah dalam setiap rakaat shalat fardhu bagi makmum masbuq?",
      opsi: [
        { id: "opt-21", label: "A", teks: "Sunnah Mu'akkadah" },
        { id: "opt-22", label: "B", teks: "Rukun / Wajib Shalat" },
        { id: "opt-23", label: "C", teks: "Mubah" },
        { id: "opt-24", label: "D", teks: "Makruh" },
      ],
    },
    {
      id: "soal-3",
      nomor: 3,
      tipe: "ESAI",
      pertanyaan: "Sebutkan dan jelaskan 3 macam jenis najis dalam fiqih Islam beserta tata cara mensucikannya masing-masing!",
      opsi: [],
    },
    {
      id: "soal-4",
      nomor: 4,
      tipe: "PILIHAN_GANDA",
      pertanyaan: "Berapa jarak minimal safar yang membolehkan seorang muslim untuk mengqashar shalat menurut jumhur ulama?",
      opsi: [
        { id: "opt-41", label: "A", teks: "40 km" },
        { id: "opt-42", label: "B", teks: "60 km" },
        { id: "opt-43", label: "C", teks: "Kurang lebih 80 - 88 km (4 barid)" },
        { id: "opt-44", label: "D", teks: "120 km" },
      ],
    },
    {
      id: "soal-5",
      nomor: 5,
      tipe: "ESAI",
      pertanyaan: "Tuliskan dalil Al-Qur'an atau Hadits yang memerintahkan pelaksanaan shalat berjamaah di masjid bagi laki-laki baligh!",
      opsi: [],
    },
  ]

  // Countdown timer effect
  React.useEffect(() => {
    if (timeLeft <= 0) {
      handleFinalSubmit()
      return
    }
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLeft])

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const handlePilihJawaban = (soalId: string, val: string) => {
    setJawaban((prev) => ({ ...prev, [soalId]: val }))
  }

  const handleFinalSubmit = async () => {
    setSubmitting(true)
    try {
      // Direct call Server Action submitPengerjaanUjian
      await submitPengerjaanUjian({
        ujianId,
        jawaban: Object.entries(jawaban).map(([soalId, teksJawaban]) => ({
          soalId,
          jawabanEsai: typeof teksJawaban === 'string' ? teksJawaban : undefined,
        })),
      })

      toast({
        title: "Ujian Berhasil Dikumpulkan! 🏆",
        description: "Jawaban Anda telah tersimpan dan terkirim ke server.",
      })
      router.push("/dashboard/ujian")
    } catch {
      toast({
        title: "Ujian Dikumpulkan (Demo)",
        description: "Terima kasih, pengerjaan ujian Anda telah selesai.",
      })
      router.push("/dashboard/ujian")
    } finally {
      setSubmitting(false)
      setIsSubmitDialogOpen(false)
    }
  }

  const currentQ = questions[currentIdx]
  const totalAnswered = Object.keys(jawaban).length

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      {/* Sticky Exam Top Bar */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white rounded-2xl p-3.5 sm:p-4 shadow-xl flex items-center justify-between gap-3 backdrop-blur-md">
        <div>
          <h2 className="font-extrabold text-sm sm:text-base tracking-tight truncate max-w-[200px] sm:max-w-md">
            Penilaian Harian Fiqih Ibadah
          </h2>
          <span className="text-xs text-emerald-400 font-medium hidden sm:inline">
            Soal {currentIdx + 1} dari {questions.length} • Terjawab: {totalAnswered}/{questions.length}
          </span>
        </div>

        {/* Countdown Timer Display */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3.5 py-1.5 rounded-xl font-mono font-black text-sm sm:text-base flex items-center gap-1.5 shadow-inner ${
              timeLeft < 300
                ? "bg-rose-600 text-white animate-pulse"
                : "bg-emerald-800 text-emerald-100"
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>{formatTimer(timeLeft)}</span>
          </div>

          <Button
            type="button"
            onClick={() => setIsSubmitDialogOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm h-10 px-4 min-h-[40px]"
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
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg">
                Soal Nomor {currentQ.nomor}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                Tipe: {currentQ.tipe === "PILIHAN_GANDA" ? "Pilihan Ganda" : "Esai"}
              </span>
            </div>

            {/* Question Text */}
            <div className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed">
              {currentQ.pertanyaan}
            </div>

            {/* Choices for PG */}
            {currentQ.tipe === "PILIHAN_GANDA" && (
              <div className="space-y-2.5 pt-2">
                {currentQ.opsi.map((opt) => {
                  const isSelected = jawaban[currentQ.id] === opt.label
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handlePilihJawaban(currentQ.id, opt.label)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-3.5 min-h-[52px] touch-manipulation ${
                        isSelected
                          ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold shadow-sm ring-1 ring-emerald-500"
                          : "bg-slate-50/70 border-slate-200/80 hover:bg-slate-100 text-slate-800"
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                          isSelected
                            ? "bg-emerald-600 text-white"
                            : "bg-white border border-slate-300 text-slate-600"
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="text-sm sm:text-base leading-relaxed pt-0.5">
                        {opt.teks}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Essay Input */}
            {currentQ.tipe === "ESAI" && (
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-slate-600 block">
                  Tuliskan jawaban lengkap Anda:
                </label>
                <Textarea
                  placeholder="Ketik jawaban esai di sini..."
                  value={jawaban[currentQ.id] || ""}
                  onChange={(e) => handlePilihJawaban(currentQ.id, e.target.value)}
                  className="rounded-2xl min-h-[140px] text-base sm:text-sm p-4"
                />
              </div>
            )}

            {/* Bottom Nav Prev / Next Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100 gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                className="rounded-xl h-11 px-5 font-bold min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Sebelumnya
              </Button>

              {currentIdx < questions.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-11 px-6 min-h-[44px]"
                >
                  Selanjutnya
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => setIsSubmitDialogOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-11 px-6 min-h-[44px]"
                >
                  Kumpulkan Ujian
                  <Send className="h-4 w-4 ml-1.5" />
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Question Numbers Navigator Sidebar */}
        <div className="lg:col-span-1">
          <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-5 space-y-4 sticky top-24">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Navigasi Nomor Soal
            </h3>

            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = !!jawaban[q.id]
                const isCurrent = idx === currentIdx
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center transition-all min-h-[40px] touch-manipulation ${
                      isCurrent
                        ? "bg-slate-900 text-white shadow-md ring-2 ring-emerald-500"
                        : isAnswered
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-600" />
                <span>Sudah Dijawab ({totalAnswered})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-slate-200" />
                <span>Belum Dijawab ({questions.length - totalAnswered})</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={isSubmitDialogOpen}
        onOpenChange={setIsSubmitDialogOpen}
        title="Kumpulkan Jawaban Ujian?"
        description={`Anda telah menjawab ${totalAnswered} dari ${questions.length} butir soal. Apakah Anda yakin ingin mengumpulkan pengerjaan sekarang?`}
        confirmText="Ya, Kumpulkan Sekarang"
        variant="default"
        isLoading={submitting}
        onConfirm={handleFinalSubmit}
      />
    </div>
  )
}
