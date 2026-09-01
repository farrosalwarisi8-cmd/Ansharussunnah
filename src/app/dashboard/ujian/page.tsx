// src/app/dashboard/ujian/page.tsx

"use client"

import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { Role } from "@prisma/client"
import { Plus, Clock, FileText, Play, BarChart2, Calendar, Award, Loader2, Pencil, Trash2, BarChart } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { getDaftarUjianSiswa, getDaftarUjianAnak, getDaftarUjianGuru, deleteUjian } from "@/actions/ujian"
import { useToast } from "@/hooks/use-toast"

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

export default function UjianPage() {
  const { user, selectedChild } = useDashboard()

  const isTeacher = user.role === Role.GURU || user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_AKADEMIK
  const isStudent = user.role === Role.SISWA
  const isParent = user.role === Role.ORANG_TUA

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={isTeacher ? "Manajemen Ujian & Evaluasi" : "Ujian & Penilaian Santri"}
        subtitle={
          isTeacher
            ? "Kelola ujian online, buat bank soal, dan evaluasi hasil belajar santri."
            : "Ikuti ujian aktif dengan timer terintegrasi atau lihat riwayat hasil ujian."
        }
        action={
          isTeacher ? (
            <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-md min-h-[44px]">
              <Link href="/dashboard/ujian/buat">
                <Plus className="h-4 w-4 mr-1.5" />
                Buat Ujian Baru
              </Link>
            </Button>
          ) : null
        }
      />

      {isParent && <ChildSelector />}

      {isTeacher && <GuruUjianView />}
      {isStudent && <SiswaUjianView />}
      {isParent && <OrangTuaUjianView selectedChild={selectedChild} />}
    </div>
  )
}

/* ========================================================================= */
/* 1. GURU UJIAN VIEW                                                        */
/* ========================================================================= */
function GuruUjianView() {
  const { user } = useDashboard()
  const { toast } = useToast()
  const router = useRouter()
  const [ujianList, setUjianList] = React.useState<UjianItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<UjianItem | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const fetchUjian = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const kelasId = user.kelas?.id
      if (!kelasId) {
        setError("Anda belum ditugaskan ke kelas manapun")
        setLoading(false)
        return
      }
      const result = await getDaftarUjianGuru(kelasId)
      if (result.success && result.data) {
        setUjianList(result.data as UjianItem[])
      } else {
        setError(result.message || "Gagal memuat data ujian")
      }
    } catch {
      setError("Gagal memuat data ujian")
    } finally {
      setLoading(false)
    }
  }, [user.kelas?.id])

  React.useEffect(() => {
    fetchUjian()
  }, [fetchUjian])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const result = await deleteUjian(deleteTarget.id)
      if (result.success) {
        toast({
          title: "Ujian Berhasil Dihapus",
          description: `"${deleteTarget.judul}" telah dihapus.`,
        })
        setUjianList((prev) => prev.filter((u) => u.id !== deleteTarget.id))
      } else {
        toast({
          variant: "destructive",
          title: "Gagal Menghapus Ujian",
          description: result.message,
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal Menghapus Ujian",
        description: "Terjadi kesalahan saat menghapus ujian.",
      })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
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

  if (ujianList.length === 0) {
    return (
      <EmptyState
        title="Belum Ada Ujian"
        description="Anda belum membuat ujian untuk kelas ini. Klik tombol di atas untuk membuat ujian baru."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {ujianList.map((item) => (
          <Card key={item.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-lg border border-yellow-100">
                  {item.mataPelajaran}
                </span>
                <StatusBadge status={item.status as "DRAFT" | "AKTIF" | "SELESAI" | "PUBLISHED"} />
              </div>
              <CardTitle className="text-base font-bold text-slate-800 leading-snug">
                {item.judul}
              </CardTitle>
            </CardHeader>

            <CardContent className="p-5 pt-0 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs py-3 border-y border-slate-100 text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>{item.durasiMenit} Menit</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span>{item.totalSoal} Butir Soal</span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>Mulai: {new Date(item.waktuMulai).toLocaleDateString("id-ID")} WIB</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Peserta:</span>
                <span className="font-bold text-slate-800">
                  {item.totalPeserta || 0} Santri
                </span>
              </div>

              {/* Actions: Rekap Hasil + Edit + Hapus */}
              <div className="flex items-center gap-2 pt-1">
                <Button asChild variant="outline" size="sm" className="flex-1 rounded-xl min-h-[38px] text-xs font-bold">
                  <Link href={`/dashboard/ujian/${item.id}/rekap`}>
                    <BarChart2 className="h-3.5 w-3.5 mr-1 text-yellow-600" />
                    Rekap Hasil
                  </Link>
                </Button>
                <Button asChild size="sm" className="bg-slate-800 hover:bg-slate-800 text-white rounded-xl min-h-[38px] text-xs font-bold">
                  <Link href={`/dashboard/ujian/${item.id}/kerjakan`}>
                    Preview
                  </Link>
                </Button>
              </div>

              {/* Edit & Delete buttons */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/dashboard/ujian/buat?edit=${item.id}`)}
                  className="flex-1 rounded-xl min-h-[38px] text-xs font-bold text-slate-600 border-slate-200"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDeleteTarget(item)
                    setDeleteDialogOpen(true)
                  }}
                  className="rounded-xl min-h-[38px] text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) setDeleteTarget(null)
        }}
        title="Hapus Ujian?"
        description={`Apakah Anda yakin ingin menghapus ujian "${deleteTarget?.judul}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText={deleting ? "Menghapus..." : "Ya, Hapus"}
        cancelText="Batal"
        variant="destructive"
        isLoading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}

/* ========================================================================= */
/* 2. SISWA UJIAN VIEW                                                       */
/* ========================================================================= */
function SiswaUjianView() {
  const [ujianList, setUjianList] = React.useState<UjianItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchUjian() {
      setLoading(true)
      setError(null)
      try {
        const result = await getDaftarUjianSiswa()
        if (result.success && result.data) {
          setUjianList(result.data as UjianItem[])
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
  }, [])

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
              <Card key={exam.id} className="rounded-3xl border-yellow-300 bg-gradient-to-br from-yellow-50/80 to-white shadow-md p-6 space-y-4">
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
          <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
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
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-extrabold text-yellow-600 bg-yellow-50 px-3 py-1 rounded-xl border border-yellow-200">
                      {ex.nilai != null ? Number(ex.nilai) : "-"}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

/* ========================================================================= */
/* 3. ORANG TUA UJIAN VIEW                                                   */
/* ========================================================================= */
function OrangTuaUjianView({ selectedChild }: { selectedChild: { id: string; nama: string } | null }) {
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
