"use client"

import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import {
  getDaftarSiswaKeuangan,
  getStrukturKelasUntukKeuangan,
} from "@/actions/siswa-keuangan"
import { Role } from "@prisma/client"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Loader2, Users2 } from "lucide-react"

type SiswaItem = {
  id: string
  userId: string
  nama: string
  email: string
  nisn: string | null
  nis: string | null
  jenisKelamin: string | null
  kelasNama: string | null
  jenjangNama: string | null
  aktif: boolean
}

type JenjangOption = {
  id: string
  nama: string
  urutan: number
  kelas: Array<{ id: string; nama: string }>
}

export default function DaftarSiswaKeuanganPage() {
  const { user } = useDashboard()
  const isKeuangan = user.role === Role.ADMIN_KEUANGAN || user.role === Role.SUPER_ADMIN

  if (!isKeuangan) {
    return (
      <EmptyState
        title="Akses Ditolak"
        description="Halaman ini hanya untuk Admin Keuangan."
      />
    )
  }

  return <DaftarSiswaKeuanganContent />
}

function DaftarSiswaKeuanganContent() {
  const [jenjangList, setJenjangList] = React.useState<JenjangOption[]>([])
  const [jenjangId, setJenjangId] = React.useState("")
  const [kelasId, setKelasId] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [students, setStudents] = React.useState<SiswaItem[]>([])
  const [error, setError] = React.useState<string | null>(null)

  // Muat struktur jenjang → kelas
  React.useEffect(() => {
    let mounted = true
    async function load() {
      const res = await getStrukturKelasUntukKeuangan()
      if (mounted && res.success && res.data) {
        setJenjangList(res.data.jenjangList)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  // Muat daftar siswa (bisa difilter)
  const fetchStudents = React.useCallback(async (params: { jenjangId?: string; kelasId?: string }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getDaftarSiswaKeuangan(params)
      if (res.success && res.data) {
        setStudents(res.data)
      } else {
        setStudents([])
        setError(res.message || "Gagal memuat daftar siswa")
      }
    } catch {
      setStudents([])
      setError("Terjadi kesalahan saat memuat daftar siswa")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchStudents({})
  }, [fetchStudents])

  const handleJenjangChange = (val: string) => {
    setJenjangId(val)
    setKelasId("")
    fetchStudents({ jenjangId: val || undefined })
  }

  const handleKelasChange = (val: string) => {
    setKelasId(val)
    fetchStudents({ jenjangId: jenjangId || undefined, kelasId: val || undefined })
  }

  const selectedJenjang = jenjangList.find((j) => j.id === jenjangId) || null

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Daftar Siswa"
        subtitle="Seluruh santri di semua jenjang & kelas (mode baca — data tidak dapat diubah)."
        action={
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <Users2 className="h-4 w-4 text-yellow-600" />
            <span>{loading ? "Memuat..." : `${students.length} santri`}</span>
          </div>
        }
      />

      {/* Filter Jenjang & Kelas */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Filter Jenjang
              </label>
              <select
                value={jenjangId}
                onChange={(e) => handleJenjangChange(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-yellow-500"
              >
                <option value="">— Semua Jenjang —</option>
                {jenjangList.map((j) => (
                  <option key={j.id} value={j.id}>{j.nama}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Filter Kelas
              </label>
              <select
                value={kelasId}
                onChange={(e) => handleKelasChange(e.target.value)}
                disabled={!jenjangId}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-yellow-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">— Semua Kelas di Jenjang Ini —</option>
                {selectedJenjang?.kelas.map((k) => (
                  <option key={k.id} value={k.id}>Kelas {k.nama}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
          <span className="ml-3 text-sm text-slate-500">Memuat daftar siswa...</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <EmptyState title="Gagal Memuat Data" description={error} />
      )}

      {/* Empty */}
      {!loading && !error && students.length === 0 && (
        <EmptyState title="Tidak Ada Data" description="Tidak ada santri yang cocok dengan filter saat ini." />
      )}

      {/* Table */}
      {!loading && !error && students.length > 0 && (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">No</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Nama</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Jenjang</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Kelas</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">NISN</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Jenis Kelamin</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {students.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{s.nama}</td>
                    <td className="px-4 py-3 text-slate-600">{s.jenjangNama}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-100 text-xs font-semibold">
                        {s.kelasNama}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.nisn || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{s.jenisKelamin || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{s.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
