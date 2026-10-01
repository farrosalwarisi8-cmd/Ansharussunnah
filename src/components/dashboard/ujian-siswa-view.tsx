"use client"

import * as React from "react"
import { getDaftarUjianSiswa } from "@/actions/ujian"
import { Clock, Play, Award, CheckCircle2 } from "lucide-react"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { ListPagination } from "@/components/ui/list-pagination"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge, type StatusType } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"

type UjianItem = {
  id: string
  judul: string
  deskripsi?: string | null
  mataPelajaran: string
  durasiMenit: number
  waktuMulai: Date
  waktuSelesai: Date
  totalSoal: number
  guru: string
  statusPengerjaan?: string
  nilai?: number | null
  status?: string
  totalPeserta?: number
  kelasId?: string
}

export function SiswaUjianView() {
  const [ujianList, setUjianList] = React.useState<UjianItem[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchUjian() {
      setLoading(true)
      setError(null)
      try {
        const result = await getDaftarUjianSiswa({ page })
        if (result.success && result.data) {
          const data = result.data as {
            items: UjianItem[]
            total: number
            totalPages: number
          }
          setUjianList(data.items)
          setTotal(data.total)
          setTotalPages(data.totalPages)
        } else {
          setError(result.message || "Gagal memuat data ujian")
        }
      } catch {
        setError("Gagal memuat data ujian")
      } finally {
        setLoading(false)
      }
    }
    fetchUjian()
  }, [page])

  if (loading) {
    return (
<PageSkeleton label="Memuat data ujian..." />
    )
  }

  if (error) {
    return <EmptyState title="Gagal Memuat Data" description={error} />
  }

  const activeExams = ujianList.filter(
    (u) => u.statusPengerjaan === "BELUM_MULAI" || u.statusPengerjaan === "SEDANG_MENGERJAKAN"
  )
  const finishedExams = ujianList.filter(
    (u) => u.statusPengerjaan === "SELESAI" || u.statusPengerjaan === "DINILAI"
  )

  return (
    <div className="space-y-6">
      {/* Ujian Aktif Tersedia */}
      <div>
        <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Award className="h-4 w-4 text-yellow-500" />
          <span>Ujian Tersedia (Wajib Dikerjakan)</span>
        </h3>

        {activeExams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeExams.map((exam) => (
              <Card key={exam.id} className="rounded-3xl border-yellow-300 bg-yellow-50/80 shadow-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-yellow-700 bg-yellow-100 px-3 py-1 rounded-full">
                    {exam.mataPelajaran}
                  </span>
                  <span className="text-xs font-semibold text-yellow-600 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {exam.durasiMenit} Menit
                  </span>
                </div>

                <div>
                  <h4 className="text-lg font-bold text-slate-800 leading-snug">
                    {exam.judul}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {exam.totalSoal} Butir Soal • Guru: {exam.guru}
                  </p>
                </div>

                <Button asChild className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl h-12 text-sm shadow-md min-h-[48px]">
                  <Link href={`/dashboard/ujian/${exam.id}/kerjakan`}>
                    <Play className="h-4 w-4 mr-2" />
                    {exam.statusPengerjaan === "SEDANG_MENGERJAKAN" ? "Lanjutkan Ujian" : "Mulai Kerjakan Ujian Sekarang"}
                  </Link>
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Tidak Ada Ujian Aktif"
            description="Saat ini belum ada jadwal ujian baru untuk kelas Anda."
          />
        )}
      </div>

      {/* Riwayat Nilai Ujian */}
      {finishedExams.length > 0 && (
        <div>
          <h3 className="text-base font-bold text-slate-800 mb-3">
            Riwayat Nilai Ujian Sebelumnya
          </h3>
          <Card className="overflow-hidden">
            <CardContent className="p-5 divide-y divide-slate-100">
              {finishedExams.map((ex) => (
                <div key={ex.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">{ex.mataPelajaran}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs text-slate-400">{new Date(ex.waktuMulai).toLocaleDateString("id-ID")}</span>
                    </div>
                    <div className="font-bold text-slate-800 text-sm">{ex.judul}</div>
                    <div>
                      <StatusBadge status={(ex.statusPengerjaan || (ex.status as StatusType) || "SELESAI") as StatusType} size="sm" />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {ex.nilai != null ? (
                      <div className="text-lg font-extrabold text-yellow-600 bg-yellow-50 px-3 py-1 rounded-xl border border-yellow-200">
                        {Number(ex.nilai)}
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        <div className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Nilai Belum Keluar
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <ListPagination
        page={page}
        pageSize={25}
        total={total}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
        itemLabel="ujian"
      />
    </div>
  )
}
