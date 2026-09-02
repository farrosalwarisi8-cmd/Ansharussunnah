"use client"

import * as React from "react"
import { type ChildStudent } from "@/components/dashboard/dashboard-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge, type StatusType } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Loader2 } from "lucide-react"
import { getTugasAnak } from "@/actions/tugas"

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

export function OrangTuaTugasView({ selectedChild }: { selectedChild: ChildStudent | null }) {
  const [tugasList, setTugasList] = React.useState<TugasItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchTugas() {
      if (!selectedChild?.id) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const result = await getTugasAnak(selectedChild.id)
        if (result.success && result.data) {
          const data = result.data as { tugas?: TugasItem[]; tugasList?: TugasItem[] }
          setTugasList(data.tugas || data.tugasList || [])
        } else {
          setError(result.message || "Gagal memuat daftar tugas anak")
        }
      } catch {
        setError("Gagal memuat daftar tugas anak")
      } finally {
        setLoading(false)
      }
    }
    fetchTugas()
  }, [selectedChild?.id])

  if (!selectedChild) {
    return (
      <EmptyState
        title="Pilih Anak Terlebih Dahulu"
        description="Gunakan selector di atas untuk memilih anak yang ingin dipantau."
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        <span className="ml-3 text-sm text-slate-500">Memuat data tugas...</span>
      </div>
    )
  }

  if (error) {
    return <EmptyState title="Gagal Memuat Data" description={error} />
  }

  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
      <CardHeader className="p-6 pb-3">
        <CardTitle className="text-base font-bold text-slate-800">
          Monitoring Tugas Santri: {selectedChild.nama}
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Riwayat pengumpulan tugas dan catatan nilai dari asatidz
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 divide-y divide-slate-100">
        {tugasList.length === 0 ? (
          <EmptyState
            title="Belum Ada Tugas"
            description="Belum ada tugas yang tercatat untuk anak ini."
          />
        ) : (
          tugasList.map((item) => (
            <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-800 text-sm">{item.judul}</div>
                <div className="text-xs text-slate-500">
                  {item.mataPelajaran} • {new Date(item.deadline).toLocaleDateString("id-ID")}
                </div>
              </div>
              {item.nilai != null ? (
                <div className="text-base font-black text-yellow-600 bg-yellow-50 px-3 py-1 rounded-xl border border-yellow-200">
                  Nilai: {Number(item.nilai)}
                </div>
              ) : (
                <StatusBadge status={item.statusPengumpulan as StatusType} />
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
