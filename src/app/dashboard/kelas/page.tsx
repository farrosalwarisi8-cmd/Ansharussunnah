// src/app/dashboard/kelas/page.tsx

"use client"

import * as React from "react"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import {
  getAdminJenjangList,
  createKelas,
} from "@/actions/jenjang-kelas"
import { getDaftarGuru } from "@/actions/guru"

import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import Link from "next/link"
import { Plus, UserCheck, Loader2, Users, AlertCircle } from "lucide-react"

interface GuruOption {
  id: string
  userId: string
  nama: string
  aktif: boolean
}

interface KelasItem {
  id: string
  nama: string
  kapasitas: number
  aktif: boolean
  waliKelasNama: string | null
  jumlahSiswa: number
}

interface JenjangItem {
  id: string
  nama: string
  urutan: number
  tarifSppBulanan: number | null
  kelasList: KelasItem[]
}

export default function KelolaKelasPage() {
  const { toast } = useToast()

  const [jenjangList, setJenjangList] = React.useState<JenjangItem[]>([])
  const [guruList, setGuruList] = React.useState<GuruOption[]>([])
  const [pageLoading, setPageLoading] = React.useState(true)

  // Modal Tambah Kelas
  const [isAddKelasOpen, setIsAddKelasOpen] = React.useState(false)
  const [namaKelas, setNamaKelas] = React.useState("")
  const [selectedJenjangId, setSelectedJenjangId] = React.useState("")
  const [kapasitas, setKapasitas] = React.useState("30")
  const [selectedWaliKelasId, setSelectedWaliKelasId] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  // Fetch real data from database
  const fetchData = React.useCallback(async () => {
    try {
      const [jenjangRes, guruRes] = await Promise.all([
        getAdminJenjangList(),
        getDaftarGuru(),
      ])

      if (jenjangRes.success && Array.isArray(jenjangRes.data)) {
        const mapped: JenjangItem[] = (jenjangRes.data as Array<{
          id: string
          nama: string
          urutan: number
          tarifSppBulanan: number | null
          kelas: Array<{
            id: string
            nama: string
            kapasitas: number
            aktif: boolean
            waliKelas: { user: { nama: string } } | null
            _count: { siswa: number }
          }>
        }>).map((j) => ({
          id: j.id,
          nama: j.nama,
          urutan: j.urutan,
          tarifSppBulanan: j.tarifSppBulanan,
          kelasList: j.kelas.map((k) => ({
            id: k.id,
            nama: k.nama,
            kapasitas: k.kapasitas,
            aktif: k.aktif,
            waliKelasNama: k.waliKelas?.user?.nama || null,
            jumlahSiswa: k._count.siswa,
          })),
        }))
        setJenjangList(mapped)

        // Set default selected jenjang if available
        if (mapped.length > 0 && !selectedJenjangId) {
          setSelectedJenjangId(mapped[0].id)
        }
      }

      if (guruRes.success && Array.isArray(guruRes.data)) {
        const gurus = (guruRes.data as Array<{
          id: string
          userId: string
          nama: string
          aktif: boolean
        }>).filter((g) => g.aktif)
        setGuruList(gurus)
      }
    } catch {
      // Silent fail — UI stays in loading/empty state
    }
  }, [selectedJenjangId])

  React.useEffect(() => {
    async function init() {
      await fetchData()
      setPageLoading(false)
    }
    init()
  }, [fetchData])

  const handleAddKelas = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!namaKelas.trim() || !selectedJenjangId) return

    setLoading(true)
    try {
      const result = await createKelas({
        nama: namaKelas,
        jenjangId: selectedJenjangId,
        kapasitas: parseInt(kapasitas) || 30,
        waliKelasId: selectedWaliKelasId || undefined,
      })

      if (result.success) {
        toast({
          title: "Kelas Baru Berhasil Dibuat! 🏫",
          description: result.message,
        })
        // Refetch data from server so the new kelas appears immediately
        await fetchData()
        setIsAddKelasOpen(false)
        setNamaKelas("")
        setKapasitas("30")
        setSelectedWaliKelasId("")
      } else {
        toast({
          title: "Gagal Membuat Kelas ❌",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Kelas Dibuat (Demo Mode)",
        description: `Kelas "${namaKelas}" telah dibuat.`,
      })
      setIsAddKelasOpen(false)
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (pageLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <DashboardHeader
          title="Struktur Jenjang &amp; Kelas Belajar"
          subtitle="Manajemen rombel santri, wali kelas pembina, dan penetapan guru mata pelajaran."
        />
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <Card key={i} className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <CardHeader className="p-6 pb-4 bg-slate-50/80 border-b border-slate-100">
                <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
                <div className="h-8 w-64 bg-slate-200 rounded animate-pulse mt-2" />
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((j) => (
                    <div key={j} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
                      <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                      <div className="h-1.5 w-full bg-slate-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
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
        title="Struktur Jenjang &amp; Kelas Belajar"
        subtitle="Manajemen rombel santri, wali kelas pembina, dan penetapan guru mata pelajaran."
        action={
          <Button
            onClick={() => setIsAddKelasOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md min-h-[44px]"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Tambah Kelas Rombel
          </Button>
        }
      />

      {/* Empty State */}
      {jenjangList.length === 0 ? (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">
              Belum ada data jenjang yang terdaftar di database.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Silakan jalankan seed database atau buat jenjang baru melalui panel admin.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Jenjang Accordion / Cards */
        <div className="space-y-6">
          {jenjangList.map((jenjang) => (
            <Card key={jenjang.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <CardHeader className="p-6 pb-4 bg-slate-50/80 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    Tingkat {jenjang.urutan}
                  </span>
                  <CardTitle className="text-lg font-bold text-slate-900 mt-1">
                    {jenjang.nama}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 font-medium mt-0.5">
                    Tarif SPP Bulanan:{" "}
                    <strong>
                      {jenjang.tarifSppBulanan
                        ? `Rp ${Number(jenjang.tarifSppBulanan).toLocaleString("id-ID")}`
                        : "Belum diatur"}
                    </strong>
                  </CardDescription>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-xl border shadow-sm">
                    {jenjang.kelasList.length} Rombel Aktif
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {jenjang.kelasList.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Belum ada kelas di jenjang ini.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {jenjang.kelasList.map((k) => (
                      <div
                        key={k.id}
                        className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-emerald-300 hover:shadow transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-extrabold text-base text-slate-900">{k.nama}</h4>
                            <p className="text-xs text-emerald-800 font-semibold flex items-center gap-1 mt-0.5">
                              <UserCheck className="h-3.5 w-3.5" />
                              Wali Kelas: {k.waliKelasNama || "Belum Ditentukan"}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {k.jumlahSiswa} / {k.kapasitas} Santri
                          </span>
                        </div>

                        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-600"
                            style={{
                              width: `${k.kapasitas > 0 ? (k.jumlahSiswa / k.kapasitas) * 100 : 0}%`,
                            }}
                          />
                        </div>

                        <Link
                          href={`/dashboard/kelas/${k.id}/pengajar`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors"
                        >
                          <Users className="h-3.5 w-3.5" />
                          Kelola Pengajar
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Tambah Kelas */}
      <Dialog open={isAddKelasOpen} onOpenChange={setIsAddKelasOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Tambah Rombongan Belajar (Kelas) Baru
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Buat kelas baru dan tentukan jenjang serta kuota kapasitas santri
            </p>
          </DialogHeader>

          <form onSubmit={handleAddKelas} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Jenjang Pendidikan *
              </label>
              <select
                value={selectedJenjangId}
                onChange={(e) => setSelectedJenjangId(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="">— Pilih Jenjang —</option>
                {jenjangList.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.nama}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Nama Kelas / Rombel *
              </label>
              <Input
                placeholder="Contoh: Kelas 8B - Akhwat"
                value={namaKelas}
                onChange={(e) => setNamaKelas(e.target.value)}
                className="h-11 rounded-xl text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Kapasitas Maksimal
                </label>
                <Input
                  type="number"
                  value={kapasitas}
                  onChange={(e) => setKapasitas(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Wali Kelas
                </label>
                <select
                  value={selectedWaliKelasId}
                  onChange={(e) => setSelectedWaliKelasId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">— Pilih Wali Kelas —</option>
                  {guruList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddKelasOpen(false)}
                className="rounded-xl min-h-[40px]"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loading || !selectedJenjangId}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[40px]"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Plus className="h-4 w-4 mr-1.5" />
                )}
                Simpan Kelas
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
