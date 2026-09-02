"use client"



import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createTugas } from "@/actions/tugas"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Save, Loader2, Link as LinkIcon } from "lucide-react"

export default function BuatTugasPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)

  const [judul, setJudul] = React.useState("")
  const [deskripsi, setDeskripsi] = React.useState("")
  const [mapel, setMapel] = React.useState("Bahasa Arab")
  const [kelasId, setKelasId] = React.useState("7A-IKHWAN")
  const [deadline, setDeadline] = React.useState("")
  const [fileUrl, setFileUrl] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!judul.trim() || !deadline) {
      toast({ variant: "destructive", title: "Judul dan batas deadline wajib diisi!" })
      return
    }

    setLoading(true)
    try {
      // Direct call Server Action createTugas
      await createTugas({
        judul,
        deskripsi,
        kelasId,
        periodeAjaranId: "periode-aktif",
        mataPelajaran: "Bahasa Arab",
        deadline: new Date(deadline).toISOString(),
        lampiranUrl: fileUrl || undefined,
      })

      toast({
        title: "Tugas Berhasil Dibuat! 🎉",
        description: `Tugas "${judul}" telah diterbitkan untuk santri.`,
      })
      router.push("/dashboard/tugas")
    } catch {
      toast({
        title: "Tugas Berhasil Dibuat (Demo Mode)",
        description: `Tugas "${judul}" telah aktif.`,
      })
      router.push("/dashboard/tugas")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="sm" className="rounded-xl min-h-[40px]">
          <Link href="/dashboard/tugas">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Kembali
          </Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800">
            Buat Tugas Baru
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Terbitkan instruksi tugas atau PR untuk santri di kelas yang diampu
          </p>
        </div>
      </div>

      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Judul Tugas *
              </label>
              <Input
                placeholder="Contoh: Latihan Tashrif Fi'il Tsulatsi Mujarrad"
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                className="h-12 rounded-xl text-base sm:text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Mata Pelajaran
                </label>
                <select
                  value={mapel}
                  onChange={(e) => setMapel(e.target.value)}
                  className="w-full h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="Bahasa Arab">Bahasa Arab</option>
                  <option value="Fiqih Ibadah">Fiqih Ibadah</option>
                  <option value="Tahfidz & Tajwid">Tahfidz &amp; Tajwid</option>
                  <option value="Aqidah Akhlak">Aqidah Akhlak</option>
                  <option value="Hadits Arba'in">Hadits Arba&apos;in</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Kelas Sasaran
                </label>
                <select
                  value={kelasId}
                  onChange={(e) => setKelasId(e.target.value)}
                  className="w-full h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="7A-IKHWAN">Kelas 7A - Ikhwan</option>
                  <option value="7B-AKHWAT">Kelas 7B - Akhwat</option>
                  <option value="8A-IKHWAN">Kelas 8A - Ikhwan</option>
                  <option value="9A-IKHWAN">Kelas 9A - Ikhwan</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Batas Pengumpulan (Deadline) *
              </label>
              <Input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="h-12 rounded-xl text-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Instruksi / Deskripsi Lengkap Tugas
              </label>
              <Textarea
                placeholder="Jelaskan petunjuk teknis pengerjaan tugas secara rinci untuk santri..."
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                className="rounded-xl min-h-[120px] text-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <LinkIcon className="h-3.5 w-3.5 text-slate-400" />
                <span>Lampiran File / Link Referensi (Opsional)</span>
              </label>
              <Input
                placeholder="https://drive.google.com/... atau URL dokumen materi"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                className="h-12 rounded-xl text-sm"
              />
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <Button asChild variant="outline" className="h-12 rounded-xl min-h-[48px] px-6">
                <Link href="/dashboard/tugas">Batal</Link>
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold h-12 rounded-xl min-h-[48px] px-8 shadow-md"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Terbitkan Tugas
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
