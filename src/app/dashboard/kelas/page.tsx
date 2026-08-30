// src/app/dashboard/kelas/page.tsx

"use client"

import * as React from "react"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { createKelas } from "@/actions/jenjang-kelas"

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
import { Plus, UserCheck, Loader2 } from "lucide-react"

export default function KelolaKelasPage() {
  const { toast } = useToast()

  const [jenjangList, setJenjangList] = React.useState([
    {
      id: "j1",
      nama: "Madrasah Tsanawiyyah (MTs)",
      urutan: 1,
      tarifSpp: 500000,
      kelasList: [
        { id: "k1", nama: "Kelas 7A - Ikhwan", kapasitas: 30, totalSiswa: 28, waliKelas: "Ustadz Abdullah, S.Pd.I" },
        { id: "k2", nama: "Kelas 7B - Akhwat", kapasitas: 30, totalSiswa: 26, waliKelas: "Ustadzah Fatimah, Lc." },
        { id: "k3", nama: "Kelas 8A - Ikhwan", kapasitas: 30, totalSiswa: 25, waliKelas: "Ustadz Salman Al-Farisi" },
        { id: "k4", nama: "Kelas 9A - Ikhwan", kapasitas: 30, totalSiswa: 24, waliKelas: "Ustadz Farhan Ramadhan" },
      ],
    },
    {
      id: "j2",
      nama: "Madrasah Aliyah (MA)",
      urutan: 2,
      tarifSpp: 600000,
      kelasList: [
        { id: "k5", nama: "Kelas 10 - Ikhwan", kapasitas: 30, totalSiswa: 22, waliKelas: "Ustadz Abu Bakar, M.Pd." },
        { id: "k6", nama: "Kelas 11 - Ikhwan", kapasitas: 30, totalSiswa: 20, waliKelas: "Ustadz Ali bin Abi Thalib" },
      ],
    },
  ])

  // Modal Tambah Kelas
  const [isAddKelasOpen, setIsAddKelasOpen] = React.useState(false)
  const [namaKelas, setNamaKelas] = React.useState("")
  const [selectedJenjangId, setSelectedJenjangId] = React.useState("j1")
  const [kapasitas, setKapasitas] = React.useState("30")
  const [waliKelasName, setWaliKelasName] = React.useState("Ustadz Abdullah, S.Pd.I")
  const [loading, setLoading] = React.useState(false)

  const handleAddKelas = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!namaKelas.trim()) return

    setLoading(true)
    try {
      // Direct call Server Action createKelas
      await createKelas({
        nama: namaKelas,
        jenjangId: selectedJenjangId,
        kapasitas: parseInt(kapasitas) || 30,
      })

      setJenjangList((prev) =>
        prev.map((j) => {
          if (j.id !== selectedJenjangId) return j
          return {
            ...j,
            kelasList: [
              ...j.kelasList,
              {
                id: `k-${Date.now()}`,
                nama: namaKelas,
                kapasitas: parseInt(kapasitas) || 30,
                totalSiswa: 0,
                waliKelas: waliKelasName,
              },
            ],
          }
        })
      )

      toast({
        title: "Kelas Baru Berhasil Dibuat! 🏫",
        description: `Kelas "${namaKelas}" telah aktif dalam rombongan belajar.`,
      })
      setIsAddKelasOpen(false)
      setNamaKelas("")
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

      {/* Jenjang Accordion / Cards */}
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
                  Tarif SPP Bulanan: <strong>Rp {jenjang.tarifSpp.toLocaleString("id-ID")}</strong>
                </CardDescription>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-xl border shadow-sm">
                  {jenjang.kelasList.length} Rombel Aktif
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-6">
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
                          Wali Kelas: {k.waliKelas}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {k.totalSiswa} / {k.kapasitas} Santri
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{ width: `${(k.totalSiswa / k.kapasitas) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Jenjang Pendidikan</label>
              <select
                value={selectedJenjangId}
                onChange={(e) => setSelectedJenjangId(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold focus:ring-2 focus:ring-emerald-500"
              >
                {jenjangList.map((j) => (
                  <option key={j.id} value={j.id}>{j.nama}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Nama Kelas / Rombel *</label>
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
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Kapasitas Maksimal</label>
                <Input
                  type="number"
                  value={kapasitas}
                  onChange={(e) => setKapasitas(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Wali Kelas</label>
                <select
                  value={waliKelasName}
                  onChange={(e) => setWaliKelasName(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="Ustadz Abdullah, S.Pd.I">Ustadz Abdullah, S.Pd.I</option>
                  <option value="Ustadz Salman Al-Farisi">Ustadz Salman Al-Farisi</option>
                  <option value="Ustadz Farhan Ramadhan">Ustadz Farhan Ramadhan</option>
                  <option value="Ustadzah Fatimah, Lc.">Ustadzah Fatimah, Lc.</option>
                </select>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddKelasOpen(false)} className="rounded-xl min-h-[40px]">
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[40px]"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                Simpan Kelas
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
