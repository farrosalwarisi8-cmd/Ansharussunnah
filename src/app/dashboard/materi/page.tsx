// src/app/dashboard/materi/page.tsx

"use client"

import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { createMateri, getDaftarMateriSiswa, getDaftarMateriAnak } from "@/actions/materi"
import { useToast } from "@/hooks/use-toast"
import { Role } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, ExternalLink, Loader2 } from "lucide-react"

type MateriItem = {
  id: string
  judul: string
  deskripsi?: string | null
  mataPelajaran: string
  urlFile?: string | null
  urlLink?: string | null
  signedUrl?: string | null
  periode?: string
  diunggahOleh?: string
  createdAt?: string | Date
}

export default function MateriPage() {
  const { user } = useDashboard()
  const { toast } = useToast()

  const isTeacher = user.role === Role.GURU || user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_AKADEMIK
  const isParent = user.role === Role.ORANG_TUA

  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [selectedMapelFilter, setSelectedMapelFilter] = React.useState("SEMUA")

  // Form State
  const [judul, setJudul] = React.useState("")
  const [deskripsi, setDeskripsi] = React.useState("")
  const [mapel, setMapel] = React.useState("Fiqih Ibadah")
  const [kelasId, setKelasId] = React.useState("7A-IKHWAN")
  const [fileUrl, setFileUrl] = React.useState("")

  // Real data state
  const [materiList, setMateriList] = React.useState<MateriItem[]>([])
  const [fetchingMateri, setFetchingMateri] = React.useState(true)
  const [materiError, setMateriError] = React.useState<string | null>(null)

  // Fetch materi data for Siswa/OrangTua
  React.useEffect(() => {
    if (isTeacher) return // Guru view uses its own data pattern

    async function fetchMateri() {
      setFetchingMateri(true)
      setMateriError(null)
      try {
        let result
        if (isParent) {
          // For OrangTua, we need selectedChild - handled via dashboard context
          const { selectedChild } = await import("@/components/dashboard/dashboard-context").then((m) => {
            // This is accessed via the provider, but since we're in a child component we use useDashboard
            return { selectedChild: null }
          })
          // We'll handle this in a separate effect with selectedChild dependency
          return
        }
        result = await getDaftarMateriSiswa()
        if (result.success && result.data) {
          setMateriList(result.data as MateriItem[])
        } else {
          setMateriError(result.message || "Gagal memuat daftar materi")
        }
      } catch {
        setMateriError("Gagal memuat daftar materi")
      } finally {
        setFetchingMateri(false)
      }
    }
    fetchMateri()
  }, [isTeacher, isParent])

  return <MateriPageContent isTeacher={isTeacher} isParent={isParent} />
}

function MateriPageContent({ isTeacher, isParent }: { isTeacher: boolean; isParent: boolean }) {
  const { user, selectedChild } = useDashboard()
  const { toast } = useToast()

  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [selectedMapelFilter, setSelectedMapelFilter] = React.useState("SEMUA")

  // Form State
  const [judul, setJudul] = React.useState("")
  const [deskripsi, setDeskripsi] = React.useState("")
  const [mapel, setMapel] = React.useState("Fiqih Ibadah")
  const [kelasId, setKelasId] = React.useState("7A-IKHWAN")
  const [fileUrl, setFileUrl] = React.useState("")

  // Real data state
  const [materiList, setMateriList] = React.useState<MateriItem[]>([])
  const [fetchingMateri, setFetchingMateri] = React.useState(true)
  const [materiError, setMateriError] = React.useState<string | null>(null)

  // Fetch materi data
  React.useEffect(() => {
    async function fetchMateri() {
      setFetchingMateri(true)
      setMateriError(null)
      try {
        let result
        if (isParent && selectedChild) {
          result = await getDaftarMateriAnak(selectedChild.id)
        } else if (!isParent) {
          result = await getDaftarMateriSiswa()
        } else {
          setFetchingMateri(false)
          return
        }

        if (result && result.success && result.data) {
          setMateriList(result.data as MateriItem[])
        } else if (result) {
          setMateriError(result.message || "Gagal memuat daftar materi")
        }
      } catch {
        setMateriError("Gagal memuat daftar materi")
      } finally {
        setFetchingMateri(false)
      }
    }
    fetchMateri()
  }, [isParent, selectedChild])

  const handleUploadMateri = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!judul.trim() || !fileUrl.trim()) {
      toast({ variant: "destructive", title: "Judul materi dan URL dokumen wajib diisi!" })
      return
    }

    setLoading(true)
    try {
      await createMateri({
        judul,
        deskripsi,
        kelasId,
        periodeAjaranId: "periode-aktif",
        mataPelajaran: mapel,
        urlFile: fileUrl,
      })

      toast({
        title: "Materi Berhasil Diterbitkan! 📚",
        description: `Materi "${judul}" kini dapat diakses santri.`,
      })
      setIsAddModalOpen(false)
      setJudul("")
      setDeskripsi("")
      setFileUrl("")
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: "Terjadi kesalahan saat menyimpan materi.",
      })
    } finally {
      setLoading(false)
    }
  }

  const mapelOptions = ["SEMUA", "Fiqih Ibadah", "Bahasa Arab", "Hadits Arba'in", "Tahfidz & Tajwid"]

  const filteredMateri = selectedMapelFilter === "SEMUA"
    ? materiList
    : materiList.filter((m) => m.mataPelajaran === selectedMapelFilter)

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={isTeacher ? "Pusat Materi Pembelajaran" : "Materi & Modul Pembelajaran"}
        subtitle="Repositori modul digital, kitab rujukan, rangkuman, dan rekaman audio pelajaran santri."
        action={
          isTeacher ? (
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md min-h-[44px]"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Unggah Materi Baru
            </Button>
          ) : null
        }
      />

      {isParent && <ChildSelector />}

      {/* Loading State */}
      {fetchingMateri && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="ml-3 text-sm text-slate-500">Memuat materi pembelajaran...</span>
        </div>
      )}

      {/* Error State */}
      {!fetchingMateri && materiError && (
        <EmptyState title="Gagal Memuat Data" description={materiError} />
      )}

      {/* Content */}
      {!fetchingMateri && !materiError && (
        <>
          {/* Filter Tabs by Mata Pelajaran */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {mapelOptions.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMapelFilter(m)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[40px] touch-manipulation ${
                  selectedMapelFilter === m
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Materi Cards Grid */}
          {filteredMateri.length === 0 ? (
            <EmptyState
              title="Belum Ada Materi"
              description="Belum ada materi pembelajaran yang tersedia untuk filter ini."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredMateri.map((mat) => (
                <Card key={mat.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                        {mat.mataPelajaran}
                      </span>
                    </div>
                    <CardTitle className="text-base font-bold text-slate-900 leading-snug">
                      {mat.judul}
                    </CardTitle>
                    {mat.deskripsi && (
                      <CardDescription className="text-xs text-slate-500 line-clamp-2 mt-1">
                        {mat.deskripsi}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-4">
                    <div className="text-xs py-2 border-y border-slate-100 text-slate-500 space-y-1">
                      {mat.diunggahOleh && (
                        <div className="flex items-center justify-between">
                          <span>Pengajar:</span>
                          <span className="font-semibold text-slate-700">{mat.diunggahOleh}</span>
                        </div>
                      )}
                      {mat.periode && (
                        <div className="flex items-center justify-between">
                          <span>Periode:</span>
                          <span className="font-semibold text-slate-700">{mat.periode}</span>
                        </div>
                      )}
                    </div>

                    {(mat.signedUrl || mat.urlFile || mat.urlLink) && (
                      <Button asChild className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl min-h-[44px] text-xs">
                        <a href={mat.signedUrl || mat.urlFile || mat.urlLink || "#"} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-2 text-emerald-400" />
                          Buka &amp; Unduh Materi
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal Upload Materi (Guru) */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Unggah Materi Pembelajaran Baru
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Bagikan modul atau tautan file bahan ajar kepada para santri
            </p>
          </DialogHeader>

          <form onSubmit={handleUploadMateri} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Judul Materi *
              </label>
              <Input
                placeholder="Contoh: Modul Kaidah Bahasa Arab Bab Fi'il"
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                className="h-11 rounded-xl text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Mata Pelajaran
                </label>
                <select
                  value={mapel}
                  onChange={(e) => setMapel(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Fiqih Ibadah">Fiqih Ibadah</option>
                  <option value="Bahasa Arab">Bahasa Arab</option>
                  <option value="Hadits Arba'in">Hadits Arba&apos;in</option>
                  <option value="Tahfidz & Tajwid">Tahfidz &amp; Tajwid</option>
                  <option value="Aqidah Akhlak">Aqidah Akhlak</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Kelas Tujuan
                </label>
                <select
                  value={kelasId}
                  onChange={(e) => setKelasId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="7A-IKHWAN">Kelas 7A - Ikhwan</option>
                  <option value="7B-AKHWAT">Kelas 7B - Akhwat</option>
                  <option value="8A-IKHWAN">Kelas 8A - Ikhwan</option>
                  <option value="9A-IKHWAN">Kelas 9A - Ikhwan</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Tautan File / Cloud Document Link *
              </label>
              <Input
                placeholder="https://drive.google.com/file/d/..."
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                className="h-11 rounded-xl text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Deskripsi / Ringkasan Materi
              </label>
              <Textarea
                placeholder="Tuliskan gambaran isi materi untuk santri..."
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                className="rounded-xl min-h-[80px] text-sm"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-xl min-h-[40px]"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[40px]"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                Unggah Materi
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
