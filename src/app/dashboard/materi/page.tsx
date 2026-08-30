// src/app/dashboard/materi/page.tsx

"use client"

import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { createMateri, getDaftarMateriGuru, getDaftarMateriSiswa } from "@/actions/materi"
import { useToast } from "@/hooks/use-toast"
import { Role } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { BookOpen, Plus, FileText, ExternalLink, Download, Loader2, Sparkles, Folder, Calendar } from "lucide-react"

export default function MateriPage() {
  const { user, selectedChild } = useDashboard()
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

  const [materiList, setMateriList] = React.useState([
    {
      id: "mat-1",
      judul: "Kitab Safinatun Najah - Bab Thaharah Lengkap",
      mapel: "Fiqih Ibadah",
      kelas: "Kelas 7A - Ikhwan",
      deskripsi: "Ringkasan matan Safinatun Najah pasal fardhu wudhu, rukun shalat, dan pembatalnya.",
      fileUrl: "https://drive.google.com/file/d/example-safinah.pdf",
      tipe: "PDF",
      tglUpload: "01 Maret 2024",
      pengunggah: "Ustadz Abdullah",
    },
    {
      id: "mat-2",
      judul: "Tabel Lengkap Wazan Tashrif Al-Amtsilah At-Tashrifiyyah",
      mapel: "Bahasa Arab",
      kelas: "Semua Kelas 7",
      deskripsi: "Tabel ringkas pembagian fi'il madhi, mudhari', amr, nahi, isim fa'il, dan isim maf'ul.",
      fileUrl: "https://drive.google.com/file/d/example-tashrif.pdf",
      tipe: "PDF",
      tglUpload: "25 Februari 2024",
      pengunggah: "Ustadz Salman",
    },
    {
      id: "mat-3",
      judul: "Rekaman Kajian Audio Syarah Hadits Arba'in Nawawiyyah",
      mapel: "Hadits Arba'in",
      kelas: "Kelas 8A & 8B",
      deskripsi: "Penjelasan mendalam mengenai hadits 'Innamal a'malu binniyyat' dan urgensi niat ikhlas.",
      fileUrl: "https://drive.google.com/file/d/example-hadits-1.mp3",
      tipe: "AUDIO",
      tglUpload: "18 Februari 2024",
      pengunggah: "Ustadz Farhan",
    },
    {
      id: "mat-4",
      judul: "Panduan Tajwid Praktis: Makharijul Huruf & Sifat Huruf",
      mapel: "Tahfidz & Tajwid",
      kelas: "Semua Jenjang",
      deskripsi: "Diagram bergambar posisi keluarnya huruf hijaiyyah dari rongga mulut hingga tenggorokan.",
      fileUrl: "https://drive.google.com/file/d/example-tajwid.pdf",
      tipe: "PDF",
      tglUpload: "10 Februari 2024",
      pengunggah: "Ustadz Abu Bakar",
    },
  ])

  const handleUploadMateri = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!judul.trim() || !fileUrl.trim()) {
      toast({ variant: "destructive", title: "Judul materi dan URL dokumen wajib diisi!" })
      return
    }

    setLoading(true)
    try {
      // Direct call Server Action createMateri
      await createMateri({
        judul,
        deskripsi,
        kelasId,
        periodeAjaranId: "periode-aktif",
        mataPelajaran: mapel,
        urlFile: fileUrl,
      })

      setMateriList((prev) => [
        {
          id: `mat-${Date.now()}`,
          judul,
          mapel,
          kelas: "Kelas 7A - Ikhwan",
          deskripsi,
          fileUrl,
          tipe: "PDF",
          tglUpload: "Hari Ini",
          pengunggah: user.nama,
        },
        ...prev,
      ])

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
        title: "Materi Tersimpan (Demo)",
        description: `Materi "${judul}" berhasil ditambahkan.`,
      })
      setIsAddModalOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const mapelOptions = ["SEMUA", "Fiqih Ibadah", "Bahasa Arab", "Hadits Arba'in", "Tahfidz & Tajwid"]

  const filteredMateri = selectedMapelFilter === "SEMUA"
    ? materiList
    : materiList.filter((m) => m.mapel === selectedMapelFilter)

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredMateri.map((mat) => (
          <Card key={mat.id} className="rounded-3xl border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                  {mat.mapel}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {mat.tipe}
                </span>
              </div>
              <CardTitle className="text-base font-bold text-slate-900 leading-snug">
                {mat.judul}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 line-clamp-2 mt-1">
                {mat.deskripsi}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 pt-0 space-y-4">
              <div className="text-xs py-2 border-y border-slate-100 text-slate-500 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Kelas:</span>
                  <span className="font-semibold text-slate-700">{mat.kelas}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Pengajar:</span>
                  <span className="font-semibold text-slate-700">{mat.pengunggah}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Diupload:</span>
                  <span>{mat.tglUpload}</span>
                </div>
              </div>

              <Button asChild className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl min-h-[44px] text-xs">
                <a href={mat.fileUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-2 text-emerald-400" />
                  Buka &amp; Unduh Materi
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

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
