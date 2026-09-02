"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge, type StatusType } from "@/components/ui/status-badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { EmptyState } from "@/components/ui/empty-state"
import { Clock, Upload, Loader2 } from "lucide-react"
import Link from "next/link"
import { getDaftarTugasSiswa } from "@/actions/tugas"

type TugasItem = {
  id: string
  judul: string
  deskripsi?: string
  mataPelajaran: string
  deadline: string | Date
  guru?: string
  isOverdue?: boolean
  statusPengumpulan?: string
  nilai?: number | null
  feedback?: string | null
  jumlahRevisi?: number
  dapatSubmit?: boolean
  hasLampiran?: boolean
  periode?: string
}

export function SiswaTugasView() {
  const [tugasList, setTugasList] = React.useState<TugasItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchTugas() {
      setLoading(true)
      setError(null)
      try {
        const result = await getDaftarTugasSiswa()
        if (result.success && result.data) {
          setTugasList(result.data as TugasItem[])
        } else {
          setError(result.message || "Gagal memuat daftar tugas")
        }
      } catch {
        setError("Gagal memuat daftar tugas")
      } finally {
        setLoading(false)
      }
    }
    fetchTugas()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        <span className="ml-3 text-sm text-slate-500">Memuat daftar tugas...</span>
      </div>
    )
  }

  if (error) {
    return <EmptyState title="Gagal Memuat Data" description={error} />
  }

  const pendingTugas = tugasList.filter(
    (t) => t.statusPengumpulan === "BELUM_DIKUMPULKAN" || t.statusPengumpulan === "TERLAMBAT" || t.statusPengumpulan === "TEPAT_WAKTU"
  )
  const submittedTugas = tugasList.filter(
    (t) => t.statusPengumpulan === "MENUNGGU_VERIFIKASI" || t.statusPengumpulan === "DINILAI"
  )

  return (
    <div className="space-y-6">
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-2 max-w-md">
          <TabsTrigger value="pending">Belum Dikumpul ({pendingTugas.length})</TabsTrigger>
          <TabsTrigger value="history">Riwayat Tugas ({submittedTugas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-4">
          {pendingTugas.length === 0 ? (
            <EmptyState
              title="Semua Tugas Selesai! 🎉"
              description="Tidak ada tugas yang perlu dikumpulkan saat ini."
            />
          ) : (
            pendingTugas.map((tugas) => (
              <Card key={tugas.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-yellow-700 bg-yellow-50 px-3 py-1 rounded-full">
                    {tugas.mataPelajaran}
                  </span>
                  <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Deadline: {new Date(tugas.deadline).toLocaleDateString("id-ID")}
                  </span>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-snug">
                    {tugas.judul}
                  </h3>
                  {tugas.deskripsi && (
                    <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                      {tugas.deskripsi}
                    </p>
                  )}
                </div>

                {tugas.guru && (
                  <p className="text-xs text-slate-400">Guru: {tugas.guru}</p>
                )}

                <div className="pt-2 flex justify-end">
                  <Button asChild className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[44px]">
                    <Link href={`/dashboard/tugas/${tugas.id}`}>
                      <Upload className="h-4 w-4 mr-2" />
                      Kumpulkan Tugas
                    </Link>
                  </Button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {submittedTugas.length === 0 ? (
            <EmptyState
              title="Belum Ada Riwayat"
              description="Belum ada tugas yang dikumpulkan."
            />
          ) : (
            submittedTugas.map((tugas) => (
              <Card key={tugas.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">{tugas.mataPelajaran}</span>
                    <h4 className="font-bold text-slate-800 text-sm sm:text-base">{tugas.judul}</h4>
                  </div>
                  {tugas.nilai != null ? (
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Nilai</span>
                      <span className="text-xl font-black text-yellow-600">{Number(tugas.nilai)}</span>
                    </div>
                  ) : (
                    <StatusBadge status={tugas.statusPengumpulan as StatusType} />
                  )}
                </div>

                {tugas.feedback && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                    <strong>Catatan Ustadz:</strong> {tugas.feedback}
                  </div>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
