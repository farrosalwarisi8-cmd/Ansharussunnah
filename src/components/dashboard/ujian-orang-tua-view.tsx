"use client"

import * as React from "react"
import { getDaftarUjianAnak } from "@/actions/ujian"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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

export function OrangTuaUjianView({ selectedChild }: { selectedChild: { id: string; nama: string } | null }) {
  const [ujianList, setUjianList] = React.useState<UjianItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchUjian() {
      if (!selectedChild?.id) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const result = await getDaftarUjianAnak(selectedChild.id)
        if (result.success && result.data) {
          setUjianList(result.data as UjianItem[])
        } else {
          setError(result.message || "Gagal memuat data ujian anak")
        }
      } catch {
        setError("Gagal memuat data ujian anak")
      } finally {
        setLoading(false)
      }
    }
    fetchUjian()
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
        <span className="ml-3 text-sm text-slate-500">Memuat data ujian...</span>
      </div>
    )
  }

  if (error) {
    return <EmptyState title="Gagal Memuat Data" description={error} />
  }

  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-base font-bold text-slate-800">
          Hasil Ujian &amp; Evaluasi: {selectedChild.nama}
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Daftar ujian dan perolehan skor ujian santri (hanya lihat — tidak bisa mengerjakan)
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-3">
        {ujianList.length === 0 ? (
          <EmptyState
            title="Belum Ada Ujian"
            description="Belum ada ujian yang dipublikasikan untuk kelas anak Anda."
          />
        ) : (
          ujianList.map((item) => (
            <div key={item.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-800 text-sm">{item.judul}</div>
                <div className="text-xs text-slate-500">
                  {item.mataPelajaran} • {new Date(item.waktuMulai).toLocaleDateString("id-ID")}
                </div>
              </div>
              <div className="text-base font-black text-yellow-700 bg-white px-3.5 py-1.5 rounded-xl border border-yellow-200 shadow-sm">
                Skor: {item.nilai != null ? Number(item.nilai) : "-"}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
