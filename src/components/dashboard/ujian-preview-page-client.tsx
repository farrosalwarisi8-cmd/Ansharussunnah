"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { getUjianDetail } from "@/actions/ujian"
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { StatusBadge } from "@/components/ui/status-badge"

interface SoalPreview {
  id: string
  nomor: number
  tipe: "PILIHAN_GANDA" | "ESAI"
  pertanyaan: string
  bobotNilai: number
  opsi: Array<{ id?: string; teks: string; benar: boolean }>
}

export default function UjianPreviewPage() {
  const params = useParams()
  const ujianId = params?.id as string

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<{
    judul: string
    deskripsi?: string | null
    mataPelajaran: string
    durasiMenit: number
    status: string
    soal: SoalPreview[]
  } | null>(null)

  React.useEffect(() => {
    if (!ujianId) {
      setError("ID ujian tidak valid")
      setLoading(false)
      return
    }

    async function fetchDetail() {
      setLoading(true)
      try {
        const result = await getUjianDetail(ujianId)
        if (result.success && result.data) {
          setDetail(result.data as never)
        } else {
          setError(result.message || "Gagal memuat detail ujian")
        }
      } catch {
        setError("Gagal memuat detail ujian")
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [ujianId])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        <span className="ml-3 text-sm text-slate-500">Memuat pratinjau ujian...</span>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <EmptyState
          icon={AlertCircle}
          title="Gagal Memuat Pratinjau"
          description={error || "Data tidak tersedia."}
          actionLabel="Kembali ke Daftar Ujian"
          actionHref="/dashboard/ujian"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="rounded-xl min-h-[40px]">
            <Link href="/dashboard/ujian">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Kembali
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800">
              Pratinjau Ujian
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Lihat soal &amp; kunci jawaban sebelum dipublikasikan
            </p>
          </div>
        </div>
        <StatusBadge status={detail.status as "DRAFT" | "AKTIF" | "SELESAI" | "PUBLISHED"} />
      </div>

      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-xs font-bold text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-lg border border-yellow-100">
              {detail.mataPelajaran}
            </span>
            <h2 className="text-lg font-bold text-slate-800">{detail.judul}</h2>
            <p className="text-xs text-slate-500">
              {detail.durasiMenit} Menit • {detail.soal.length} Butir Soal
            </p>
          </div>
        </div>
        {detail.deskripsi && (
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">{detail.deskripsi}</p>
        )}
      </Card>

      {detail.soal.length > 0 ? (
        <div className="space-y-4">
          {detail.soal.map((soal, idx) => (
            <Card key={soal.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">Soal {idx + 1}</span>
                  <span
                    className={
                      soal.tipe === "ESAI"
                        ? "bg-teal-50 text-teal-700 px-2.5 py-1 rounded-lg"
                        : "bg-yellow-50 text-yellow-700 px-2.5 py-1 rounded-lg"
                    }
                  >
                    {soal.tipe === "ESAI" ? "Esai" : "Pilihan Ganda"} • Bobot {soal.bobotNilai}
                  </span>
                </div>
              </div>

              <p className="text-sm sm:text-base font-semibold text-slate-800 leading-relaxed">
                {soal.pertanyaan}
              </p>

              <div className="space-y-2 pt-1">
                {soal.tipe === "ESAI" ? (
                  soal.opsi.length > 0 ? (
                    <div className="flex gap-2 rounded-xl bg-teal-50 border border-teal-200 p-3">
                      <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-teal-700">Kunci Jawaban (untuk pedoman koreksi):</span>
                        <p className="text-sm text-slate-800 italic">{soal.opsi[0].teks}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Belum ada kunci jawaban untuk esai ini.</p>
                  )
                ) : (
                  <div className="space-y-2">
                    {soal.opsi.map((opt) => (
                      <div
                        key={opt.id || opt.teks}
                        className={`flex items-center gap-2.5 rounded-xl border p-3 text-sm ${
                          opt.benar
                            ? "border-green-300 bg-green-50"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        {opt.benar && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                        <span className="font-bold text-slate-700">{shortLabel(soal.opsi.indexOf(opt))}.</span>
                        <span className={opt.benar ? "font-semibold text-green-800" : "text-slate-700"}>
                          {opt.teks}
                        </span>
                        {opt.benar && (
                          <span className="ml-auto text-[11px] font-bold text-green-700 bg-white rounded-full px-2 py-0.5 border border-green-200 shrink-0">
                            Kunci Jawaban
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="Belum Ada Soal"
          description="Ujian ini belum memiliki soal. Tambahkan soal jika diperlukan."
          actionLabel="Buat/Edit Ujian"
          actionHref={`/dashboard/ujian/buat?edit=${ujianId}`}
        />
      )}
    </div>
  )
}

function shortLabel(idx: number): string {
  return String.fromCharCode(65 + idx)
}