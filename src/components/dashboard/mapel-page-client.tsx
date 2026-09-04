"use client"

import * as React from "react"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import {
  getAdminMapelList,
  createMapel,
  updateMapel,
  deleteMapel,
  toggleMapelAktif,
  getJenjangList,
  getKelasByJenjang,
} from "@/actions/mapel"

import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import dynamic from "next/dynamic"
const Dialog = dynamic(() => import("@/components/ui/dialog").then(m => m.Dialog), { ssr: false })
const DialogContent = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogContent), { ssr: false })
const DialogHeader = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogHeader), { ssr: false })
const DialogTitle = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogTitle), { ssr: false })
const DialogFooter = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogFooter), { ssr: false })
const ConfirmDialog = dynamic(() => import("@/components/ui/confirm-dialog").then(m => m.ConfirmDialog), { ssr: false })
import { Plus, Loader2, Pencil, Trash2, BookOpen, Search, Power, Tag } from "lucide-react"

interface MapelItem {
  id: string
  kode: string
  nama: string
  kelompok: string | null
  jenjangId: string | null
  jenjangNama: string | null
  aktif: boolean
  kelasList: Array<{ id: string; nama: string }>
  count: {
    guruKelas: number
    ujian: number
    tugas: number
    materi: number
    nilaiRapor: number
  }
}

export default function MapelPage() {
  const { toast } = useToast()

  const [mapelList, setMapelList] = React.useState<MapelItem[]>([])
  const [pageLoading, setPageLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")

  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editMapel, setEditMapel] = React.useState<MapelItem | null>(null)
  const [nama, setNama] = React.useState("")
  const [kode, setKode] = React.useState("")
  const [kelompok, setKelompok] = React.useState("")
  const [jenjangId, setJenjangId] = React.useState<string | null>(null)
  const [selectedKelasIds, setSelectedKelasIds] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(false)

  const [jenjangList, setJenjangList] = React.useState<Array<{ id: string; nama: string; urutan: number }>>([])
  const [kelasOptions, setKelasOptions] = React.useState<Array<{ id: string; nama: string }>>([])
  const [kelasLoading, setKelasLoading] = React.useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<MapelItem | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const [toggleLoading, setToggleLoading] = React.useState<string | null>(null)

  const fetchData = React.useCallback(async () => {
    try {
      const res = await getAdminMapelList()
      if (res.success && Array.isArray(res.data)) {
        const mapped: MapelItem[] = (res.data as Array<{
          id: string
          kode: string
          nama: string
          kelompok: string | null
          jenjangId: string | null
          jenjangNama: string | null
          aktif: boolean
          kelasList: Array<{ id: string; nama: string }>
          _count: {
            guruKelas: number
            ujian: number
            tugas: number
            materi: number
            nilaiRapor: number
          }
        }>).map((m) => ({
          id: m.id,
          kode: m.kode,
          nama: m.nama,
          kelompok: m.kelompok,
          jenjangId: m.jenjangId,
          jenjangNama: m.jenjangNama,
          aktif: m.aktif,
          kelasList: m.kelasList,
          count: m._count,
        }))
        setMapelList(mapped)
      }
    } catch {
      // Silent fail
    }
  }, [])

  React.useEffect(() => {
    async function init() {
      const [mapelRes, jenjangRes] = await Promise.all([
        getAdminMapelList(),
        getJenjangList(),
      ])
      if (mapelRes.success && Array.isArray(mapelRes.data)) {
        const mapped: MapelItem[] = (mapelRes.data as Array<{
          id: string
          kode: string
          nama: string
          kelompok: string | null
          jenjangId: string | null
          jenjangNama: string | null
          aktif: boolean
          kelasList: Array<{ id: string; nama: string }>
          _count: {
            guruKelas: number
            ujian: number
            tugas: number
            materi: number
            nilaiRapor: number
          }
        }>).map((m) => ({
          id: m.id,
          kode: m.kode,
          nama: m.nama,
          kelompok: m.kelompok,
          jenjangId: m.jenjangId,
          jenjangNama: m.jenjangNama,
          aktif: m.aktif,
          kelasList: m.kelasList,
          count: m._count,
        }))
        setMapelList(mapped)
      }
      if (jenjangRes.success && Array.isArray(jenjangRes.data)) {
        setJenjangList(jenjangRes.data)
      }
      setPageLoading(false)
    }
    init()
  }, [])

  // Fetch kelas when jenjang changes in form
  React.useEffect(() => {
    if (!jenjangId) {
      setKelasOptions([])
      setSelectedKelasIds([])
      return
    }
    let cancelled = false
    setKelasLoading(true)
    getKelasByJenjang(jenjangId).then((res) => {
      if (!cancelled) {
        if (res.success && Array.isArray(res.data)) {
          setKelasOptions(res.data)
        } else {
          setKelasOptions([])
        }
        setKelasLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [jenjangId])

  const openAdd = () => {
    setEditMapel(null)
    setNama("")
    setKode("")
    setKelompok("")
    setJenjangId(null)
    setSelectedKelasIds([])
    setIsDialogOpen(true)
  }

  const openEdit = (m: MapelItem) => {
    setEditMapel(m)
    setNama(m.nama)
    setKode(m.kode)
    setKelompok(m.kelompok || "")
    setJenjangId(m.jenjangId || null)
    setSelectedKelasIds(m.kelasList.map((k) => k.id))
    setIsDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nama.trim() || !kode.trim()) return

    setLoading(true)
    try {
      let result
      if (editMapel) {
        result = await updateMapel(editMapel.id, {
          nama: nama.trim(),
          kode: kode.trim().toUpperCase(),
          kelompok: kelompok.trim() || null,
          jenjangId,
          kelasIds: selectedKelasIds,
        })
      } else {
        result = await createMapel({
          nama: nama.trim(),
          kode: kode.trim().toUpperCase(),
          kelompok: kelompok.trim() || null,
          jenjangId: jenjangId || undefined,
          kelasIds: selectedKelasIds,
        })
      }

      if (result.success) {
        toast({
          title: editMapel ? "Mapel Diperbarui! ✅" : "Mapel Baru Dibuat! 📘",
          description: result.message,
        })
        await fetchData()
        setIsDialogOpen(false)
        setEditMapel(null)
        setNama("")
        setKode("")
        setKelompok("")
        setJenjangId(null)
        setSelectedKelasIds([])
      } else {
        toast({ title: "Gagal", description: result.message, variant: "destructive" })
      }
    } catch {
      toast({ title: "Gagal", description: "Terjadi kesalahan server.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const result = await deleteMapel(deleteTarget.id)

      if (result.success) {
        toast({ title: "Mapel Dihapus", description: result.message })
        await fetchData()
      } else {
        toast({ variant: "destructive", title: "Gagal Menghapus", description: result.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Terjadi kesalahan server." })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  const handleToggle = async (m: MapelItem) => {
    setToggleLoading(m.id)
    try {
      const result = await toggleMapelAktif(m.id)
      if (result.success) {
        toast({ description: result.message })
        await fetchData()
      } else {
        toast({ variant: "destructive", title: "Gagal", description: result.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Terjadi kesalahan server." })
    } finally {
      setToggleLoading(null)
    }
  }

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return mapelList
    return mapelList.filter(
      (m) =>
        m.nama.toLowerCase().includes(q) ||
        m.kode.toLowerCase().includes(q) ||
        (m.kelompok || "").toLowerCase().includes(q) ||
        (m.jenjangNama || "").toLowerCase().includes(q)
    )
  }, [mapelList, search])

  const totalTerpakai = (m: MapelItem) =>
    m.count.guruKelas + m.count.ujian + m.count.tugas + m.count.materi + m.count.nilaiRapor

  if (pageLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <DashboardHeader title="Mata Pelajaran" subtitle="Kelola daftar mata pelajaran pada program pembelajaran." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-6 w-20 bg-slate-200 rounded-full animate-pulse" />
                  <div className="h-8 w-8 bg-slate-200 rounded-xl animate-pulse" />
                </div>
                <div className="h-5 w-3/4 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-slate-200 rounded animate-pulse mt-2" />
                <div className="h-4 w-full bg-slate-200 rounded animate-pulse mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <DashboardHeader
        title="Mata Pelajaran"
        subtitle="Kelola daftar mata pelajaran pada program pembelajaran."
        action={
          <Button
            onClick={openAdd}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-md min-h-[44px] w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Tambah Mapel
          </Button>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Cari nama, kode, atau kelompok mapel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 rounded-xl border-slate-200 bg-white text-sm shadow-sm"
        />
      </div>

      {/* Empty State */}
      {mapelList.length === 0 ? (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">
              Belum ada mata pelajaran yang terdaftar.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Klik &quot;Tambah Mapel&quot; di atas untuk membuat mata pelajaran baru.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">
              Tidak ada hasil untuk &quot;{search}&quot;.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <Card
              key={m.id}
              className={`rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden transition-all ${
                !m.aktif ? "opacity-70" : ""
              }`}
            >
              <CardHeader className="p-5 pb-3 flex flex-row items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-yellow-100 text-yellow-700 flex items-center justify-center shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <Badge
                      variant={m.aktif ? "success" : "secondary"}
                      className="text-[10px] font-bold px-2 py-0.5"
                    >
                      {m.kode}
                    </Badge>
                    <CardTitle className="text-base font-bold text-slate-800 mt-1.5 leading-snug">
                      {m.nama}
                    </CardTitle>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(m)}
                    className="rounded-xl min-h-[36px] text-xs"
                    aria-label={`Edit ${m.nama}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDeleteTarget(m)
                      setDeleteDialogOpen(true)
                    }}
                    className="rounded-xl min-h-[36px] text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                    aria-label={`Hapus ${m.nama}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-5 pt-2">
                {m.jenjangNama && (
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mb-1">
                    <Tag className="h-3 w-3 text-blue-600" />
                    Jenjang: <strong className="text-slate-700">{m.jenjangNama}</strong>
                  </p>
                )}
                {m.kelompok && (
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mb-1">
                    <Tag className="h-3 w-3 text-yellow-600" />
                    Kelompok: <strong className="text-slate-700">{m.kelompok}</strong>
                  </p>
                )}
                {m.kelasList.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 mb-3">
                    {m.kelasList.map((k) => (
                      <span key={k.id} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {k.nama}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-slate-600">
                  <span className="px-2 py-1 rounded-lg bg-slate-100">{m.count.guruKelas} Pengajar</span>
                  <span className="px-2 py-1 rounded-lg bg-slate-100">{m.count.ujian} Ujian</span>
                  <span className="px-2 py-1 rounded-lg bg-slate-100">{m.count.tugas} Tugas</span>
                  <span className="px-2 py-1 rounded-lg bg-slate-100">{m.count.materi} Materi</span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className={`text-xs font-bold ${m.aktif ? "text-emerald-600" : "text-slate-400"}`}>
                    {m.aktif ? "Aktif" : "Non-aktif"}
                  </span>
                  <Button
                    size="sm"
                    variant={m.aktif ? "secondary" : "success"}
                    onClick={() => handleToggle(m)}
                    disabled={toggleLoading === m.id}
                    className="rounded-xl min-h-[36px] text-xs"
                  >
                    {toggleLoading === m.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Power className="h-3.5 w-3.5 mr-1" />
                    )}
                    {m.aktif ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Tambah/Edit Mapel */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open)
        if (!open) setEditMapel(null)
      }}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">
              {editMapel ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran Baru"}
            </DialogTitle>
            <p className="text-xs text-slate-500">
              {editMapel ? "Perbarui data mata pelajaran" : "Lengkapi kode, nama, dan kelompok mapel (jika ada)"}
            </p>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Kode Mapel *
              </label>
              <Input
                placeholder="Contoh: MTK, BIN, AQH"
                value={kode}
                onChange={(e) => setKode(e.target.value.toUpperCase())}
                className="h-11 rounded-xl text-sm font-semibold tracking-wide"
                required
              />
              <p className="text-[11px] text-slate-400">
                Kode singkat, otomatis diubah menjadi huruf kapital.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Nama Mata Pelajaran *
              </label>
              <Input
                placeholder="Contoh: Matematika, Bahasa Indonesia, Al-Qur'an"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="h-11 rounded-xl text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Kelompok
              </label>
              <Input
                placeholder="Contoh: A (Wajib), B (Peminatan)"
                value={kelompok}
                onChange={(e) => setKelompok(e.target.value)}
                className="h-11 rounded-xl text-sm"
              />
              <p className="text-[11px] text-slate-400">
                Opsional. Kosongkan jika tidak termasuk kelompok tertentu.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Jenjang
              </label>
              <select
                value={jenjangId || ""}
                onChange={(e) => setJenjangId(e.target.value || null)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white text-sm px-3 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500"
              >
                <option value="">-- Pilih Jenjang --</option>
                {jenjangList.map((j) => (
                  <option key={j.id} value={j.id}>{j.nama}</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Pilih jenjang untuk mata pelajaran ini.
              </p>
            </div>

            {jenjangId && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Kelas Tersedia
                </label>
                {kelasLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat kelas...
                  </div>
                ) : kelasOptions.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">Tidak ada kelas aktif untuk jenjang ini.</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1">
                    {kelasOptions.map((k) => (
                      <label
                        key={k.id}
                        className="flex items-center gap-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg px-2 py-1.5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedKelasIds.includes(k.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedKelasIds((prev) => [...prev, k.id])
                            } else {
                              setSelectedKelasIds((prev) => prev.filter((id) => id !== k.id))
                            }
                          }}
                          className="rounded border-slate-300 text-yellow-500 focus:ring-yellow-500/20"
                        />
                        <span className="text-xs font-medium">{k.nama}</span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-slate-400">
                  Pilih kelas yang bisa menggunakan mata pelajaran ini.
                </p>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsDialogOpen(false); setEditMapel(null) }}
                className="rounded-xl min-h-[40px]"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loading || !nama.trim() || !kode.trim()}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[40px]"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                {editMapel ? "Simpan Perubahan" : "Simpan Mapel"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) setDeleteTarget(null)
        }}
        title="Hapus Mata Pelajaran?"
        description={
          deleteTarget
            ? `Apakah Anda yakin ingin menghapus mapel "${deleteTarget.nama}"? Mapel hanya bisa dihapus jika belum terhubung dengan pengajar, ujian, tugas, materi, atau rapor. Total ${totalTerpakai(deleteTarget)} data terkait.`
            : ""
        }
        confirmText={deleting ? "Menghapus..." : "Ya, Hapus"}
        cancelText="Batal"
        variant="destructive"
        isLoading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}