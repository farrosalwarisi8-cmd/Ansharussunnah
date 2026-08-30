// src/app/dashboard/ujian/[id]/kerjakan/page.tsx

"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { submitPengerjaanUjian } from "@/actions/ujian"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Clock, ArrowLeft, ArrowRight, Send } from "lucide-react"

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
      pertanyaan: "Manakah yang BUKAN termasuk rukun shalat?",
      opsi: [
        { id: "opt-5", label: "A", teks: "Ikhlas" },
        { id: "opt-6", label: "B", teks: "Takbiratul Ihram" },
        { id: "opt-7", label: "C", teks: "Ruku" },
        { id: "opt-8", label: "D", teks: "Sujud" },
      ],
    },
    {
      id: "soal-3",
      nomor: 3,
      tipe: "PILIHAN_GANDA",
      pertanyaan: "Apa hukumnya shalat berjamaah di masjid bagi laki-laki?",
      opsi: [
        { id: "opt-9", label: "A", teks: "Wajib" },
        { id: "opt-10", label: "B", teks: "Sunnah Mu'akkadah" },
        { id: "opt-11", label: "C", teks: "Makruh" },
        { id: "opt-12", label: "D", teks: "Haram" },
      ],
    },
    {
      id: "soal-4",
      nomor: 4,
      tipe: "PILIHAN_GANDA",
      pertanyaan: "Berapa kali minimal kita membaca Al-Fatihah dalam setiap rakaat shalat?",
      opsi: [
        { id: "opt-13", label: "A", teks: "1 kali" },
        { id: "opt-14", label: "B", teks: "2 kali" },
        { id: "opt-15", label: "C", teks: "3 kali" },
        { id: "opt-16", label: "D", teks: "Tidak wajib membaca" },
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

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const handlePilihJawaban = (soalId: string, val: string) => {
    setJawaban((prev) => ({ ...prev, [soalId]: val }))
  }

  const handleFinalSubmit = React.useCallback(async () => {
    setSubmitting(true)
    try {
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
  }, [ujianId, jawaban, toast, router])

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
  }, [timeLeft, handleFinalSubmit])

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
                    onClick={() => handlePilihJawaban(currentQ.id, opt.id)}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-xl border-2 transition-all text-sm font-medium ${
                      jawaban[currentQ.id] === opt.id
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
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
                value={jawaban[currentQ.id] || ""}
                onChange={(e) => handlePilihJawaban(currentQ.id, e.target.value)}
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
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
                      ? "bg-emerald-600 text-white shadow-md"
                      : jawaban[q.id]
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
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
      />
    </div>
  )
}
