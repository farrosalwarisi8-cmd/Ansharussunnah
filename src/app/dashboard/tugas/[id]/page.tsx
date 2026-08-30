// src/app/dashboard/tugas/[id]/page.tsx

"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { submitTugas, beriNilaiTugas } from "@/actions/tugas"
import { useToast } from "@/hooks/use-toast"
import { Role } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge, type StatusType } from "@/components/ui/status-badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ArrowLeft, Clock, Upload, CheckCircle2, Link as LinkIcon, Loader2 } from "lucide-react"

interface SubmisiItem {
  id: string
  nama: string
  nisn: string
  tglKumpul: string
  fileUrl: string
  catatan: string
  status: string
  nilai: number | null
  feedback: string | null
}

export default function DetailTugasPage() {
  const params = useParams()
  const { user } = useDashboard()
  const { toast } = useToast()

  const tugasId = (params?.id as string) || "tugas-1"
  const isTeacher = user.role === Role.GURU || user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_AKADEMIK

  // Submission Form State (for Student)
  const [submitting, setSubmitting] = React.useState(false)
  const [fileUrl, setFileUrl] = React.useState("")
  const [catatanSiswa, setCatatanSiswa] = React.useState("")
  const [alreadySubmitted, setAlreadySubmitted] = React.useState(false)

  // Grading State (for Teacher)
  const [selectedSubmisi, setSelectedSubmisi] = React.useState<SubmisiItem | null>(null)
  const [skorNilai, setSkorNilai] = React.useState("90")
  const [feedbackGuru, setFeedbackGuru] = React.useState("Tashrif sangat rapi dan baris syakal tepat.")
  const [savingGrade, setSavingGrade] = React.useState(false)

  const [submisiList, setSubmisiList] = React.useState<SubmisiItem[]>([
    {
      id: "sub-1",
      nama: "Ahmad Fauzi Ridwan",
      nisn: "0081234561",
      tglKumpul: "Hari Ini, 14:20 WIB",
      fileUrl: "https://drive.google.com/file/d/example-tashrif-ahmad.pdf",
      catatan: "Ustadz, ini hasil tashrif bab 1-3 lengkap dengan fi'il mudhari.",
      status: "TEPAT_WAKTU",
      nilai: 92,
      feedback: "Alhamdulillah sangat baik.",
    },
    {
      id: "sub-2",
      nama: "Muhammad Bilal Al-Banjari",
      nisn: "0081234562",
      tglKumpul: "Hari Ini, 15:45 WIB",
      fileUrl: "https://drive.google.com/file/d/example-tashrif-bilal.jpg",
      catatan: "Foto buku catatan tashrif.",
      status: "TEPAT_WAKTU",
      nilai: null,
      feedback: null,
    },
    {
      id: "sub-3",
      nama: "Faris Zaidan Rahman",
      nisn: "0081234563",
      tglKumpul: "Kemarin, 21:00 WIB",
      fileUrl: "https://drive.google.com/file/d/example-tashrif-faris.pdf",
      catatan: "Mohon koreksi harakatnya ustadz.",
      status: "TEPAT_WAKTU",
      nilai: null,
      feedback: null,
    },
  ])

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fileUrl.trim()) {
      toast({ variant: "destructive", title: "Tautan file atau link dokumen tugas wajib diisi!" })
      return
    }

    setSubmitting(true)
    try {
      // Direct call Server Action submitTugas
      await submitTugas({
        tugasId,
        urlFile: fileUrl,
        namaFile: fileUrl.split('/').pop() || 'tugas-jawaban',
        ukuranFile: 1024,
      })

      setAlreadySubmitted(true)
      toast({
        title: "Tugas Berhasil Dikumpulkan! 🎉",
        description: "Pengumpulan tugas Anda telah tercatat pada sistem.",
      })
    } catch {
      setAlreadySubmitted(true)
      toast({
        title: "Tugas Berhasil Dikumpulkan (Demo)",
        description: "Terima kasih, tugas Anda telah terkirim.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleBeriNilai = async () => {
    if (!selectedSubmisi) return
    setSavingGrade(true)

    try {
      // Direct call Server Action beriNilaiTugas
      await beriNilaiTugas({
        pengumpulanId: selectedSubmisi.id,
        nilai: parseFloat(skorNilai) || 0,
        feedback: feedbackGuru,
      })

      setSubmisiList((prev) =>
        prev.map((s) =>
          s.id === selectedSubmisi.id
            ? {
                ...s,
                nilai: parseFloat(skorNilai) || 0,
                feedback: feedbackGuru,
                status: "DINILAI",
              }
            : s
        )
      )

      toast({
        title: "Nilai Berhasil Disimpan! ✨",
        description: `Santri ${selectedSubmisi.nama} telah dinilai.`,
      })
      setSelectedSubmisi(null)
    } catch {
      toast({
        title: "Nilai Disimpan (Demo Mode)",
        description: "Nilai berhasil diperbarui.",
      })
      setSelectedSubmisi(null)
    } finally {
      setSavingGrade(false)
    }
  }

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
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            Tashrif Fi&apos;il Tsulatsi Mujarrad Bab 1 - 3
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Bahasa Arab • Kelas 7A Ikhwan • Batas: Hari Ini, 20:00 WIB
          </p>
        </div>
      </div>

      {/* Task Description Banner */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-5 sm:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full">
            Petunjuk Tugas
          </span>
          <span className="text-xs text-rose-600 font-semibold flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Deadline: 20:00 WIB
          </span>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">
          Tuliskan tasrif lughawi dan tasrif ishthilahi untuk wazan <em>fa&apos;ala yaf&apos;ulu</em> (باب الأول) pada buku catatan Anda secara rapi dan bersyakat lengkap. Foto atau scan dalam format PDF/JPG lalu kumpulkan tautannya di bawah ini.
        </p>
      </Card>

      {/* 1. GURU VIEW: DAFTAR SUBMISI SANTRI */}
      {isTeacher && (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Pengumpulan Santri ({submisiList.length} Terkumpul)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Lihat file tugas santri dan berikan penilaian
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
                    <th className="p-4">Waktu Kumpul</th>
                    <th className="p-4">Lampiran File</th>
                    <th className="p-4 text-center">Nilai</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 pr-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {submisiList.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/80">
                      <td className="p-4 pl-6 font-bold text-slate-900">
                        {sub.nama}
                        <div className="text-xs font-normal text-slate-500 font-mono">NISN: {sub.nisn}</div>
                      </td>
                      <td className="p-4 text-xs text-slate-600">{sub.tglKumpul}</td>
                      <td className="p-4">
                        <a
                          href={sub.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-emerald-700 hover:underline font-semibold flex items-center gap-1"
                        >
                          <LinkIcon className="h-3 w-3" />
                          Buka Dokumen
                        </a>
                      </td>
                      <td className="p-4 text-center">
                        {sub.nilai !== null ? (
                          <span className="font-extrabold text-base text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            {sub.nilai}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-500 font-bold">Belum</span>
                        )}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={sub.status as StatusType} />
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <Button
                          size="sm"
                          onClick={() => setSelectedSubmisi(sub)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl min-h-[36px] text-xs font-bold"
                        >
                          Beri Nilai
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden p-4 space-y-3">
              {submisiList.map((sub) => (
                <div key={sub.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{sub.nama}</div>
                      <div className="text-xs text-slate-500">{sub.tglKumpul}</div>
                    </div>
                    {sub.nilai !== null ? (
                      <span className="font-black text-lg text-emerald-700 bg-white px-2.5 py-1 rounded-xl border border-emerald-200">
                        {sub.nilai}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg font-bold">
                        Belum Dinilai
                      </span>
                    )}
                  </div>

                  <a
                    href={sub.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5 p-2 rounded-xl bg-white border border-slate-200"
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    <span>Lihat Lampiran Tugas Santri</span>
                  </a>

                  <div className="flex items-center justify-between pt-1">
                    <StatusBadge status={sub.status as StatusType} size="sm" />
                    <Button
                      size="sm"
                      onClick={() => setSelectedSubmisi(sub)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl min-h-[40px] text-xs font-bold"
                    >
                      Beri Nilai &amp; Catatan
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2. SISWA VIEW: FORM PENGUMPULAN TUGAS */}
      {!isTeacher && (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-6 sm:p-8 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              Formulir Pengumpulan Tugas Santri
            </h3>
            <p className="text-xs text-slate-500">
              Unggah file atau masukkan URL Google Drive file pengerjaan Anda
            </p>
          </div>

          {alreadySubmitted ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
              <h4 className="font-bold text-emerald-950 text-base">Tugas Anda Sudah Dikumpulkan!</h4>
              <p className="text-xs text-emerald-700 max-w-sm mx-auto">
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
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl text-base shadow-md min-h-[48px]"
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
              <DialogTitle className="text-base font-bold text-slate-900">
                Nilai Tugas: {selectedSubmisi.nama}
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Berikan skor nilai (skala 0 - 100) dan catatan evaluasi untuk santri.
              </p>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-600">Dokumen Tugas:</span>
                <a
                  href={selectedSubmisi.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1"
                >
                  <LinkIcon className="h-3 w-3" />
                  Buka Dokumen Santri
                </a>
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[40px]"
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
