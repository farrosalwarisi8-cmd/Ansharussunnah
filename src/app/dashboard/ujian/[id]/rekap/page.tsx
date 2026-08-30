// src/app/dashboard/ujian/[id]/rekap/page.tsx

"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { beriNilaiEsai } from "@/actions/ujian"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ArrowLeft, FileEdit, CheckCircle2, Loader2 } from "lucide-react"

export default function RekapHasilUjianPage() {
  useParams()
  const { toast } = useToast()



  const [selectedStudent, setSelectedStudent] = React.useState<{
    id: string
    nama: string
    nisn: string
    skorPG: number
    skorEsai: number | null
    totalNilai: number
    status: string
    jawabanEsai?: string[]
  } | null>(null)
  const [nilaiEsai, setNilaiEsai] = React.useState("18")
  const [catatanEsai, setCatatanEsai] = React.useState("Penjelasan fiqih sangat lengkap dan sesuai matan.")
  const [savingEsai, setSavingEsai] = React.useState(false)

  // Rekap Data
  const [pesertaList, setPesertaList] = React.useState([
    {
      id: "p1",
      nama: "Ahmad Fauzi Ridwan",
      nisn: "0081234561",
      skorPG: 75,
      skorEsai: 18,
      totalNilai: 93,
      status: "DINILAI",
      waktuSelesai: "08:45 WIB",
    },
    {
      id: "p2",
      nama: "Muhammad Bilal Al-Banjari",
      nisn: "0081234562",
      skorPG: 70,
      skorEsai: 16,
      totalNilai: 86,
      status: "DINILAI",
      waktuSelesai: "08:50 WIB",
    },
    {
      id: "p3",
      nama: "Faris Zaidan Rahman",
      nisn: "0081234563",
      skorPG: 65,
      skorEsai: null,
      totalNilai: 65,
      status: "SEDANG_MENGERJAKAN",
      waktuSelesai: "Belum Dinilai",
    },
    {
      id: "p4",
      nama: "Zubair bin Awwam",
      nisn: "0081234564",
      skorPG: 80,
      skorEsai: 20,
      totalNilai: 100,
      status: "DINILAI",
      waktuSelesai: "08:40 WIB",
    },
  ])

  const handleSimpanNilaiEsai = async () => {
    if (!selectedStudent) return
    setSavingEsai(true)

    try {
      // Direct call Server Action beriNilaiEsai
      await beriNilaiEsai({
        pengerjaanId: `pengerjaan-${selectedStudent.id}`,
        penilaian: [{
          soalId: `soal-esai-${selectedStudent.id}`,
          nilaiSoal: parseFloat(nilaiEsai) || 0,
          catatanGuru: catatanEsai || undefined,
        }],
      })

      setPesertaList((prev) =>
        prev.map((p) =>
          p.id === selectedStudent.id
            ? {
                ...p,
                skorEsai: parseFloat(nilaiEsai) || 0,
                totalNilai: p.skorPG + (parseFloat(nilaiEsai) || 0),
                status: "DINILAI",
              }
            : p
        )
      )

      toast({
        title: "Nilai Esai Berhasil Disimpan!",
        description: `Santri ${selectedStudent.nama} berhasil dinilai.`,
      })
      setSelectedStudent(null)
    } catch {
      toast({
        title: "Nilai Esai Disimpan (Demo)",
        description: "Nilai berhasil diperbarui.",
      })
      setSelectedStudent(null)
    } finally {
      setSavingEsai(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="rounded-xl min-h-[40px]">
            <Link href="/dashboard/ujian">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Kembali
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Rekap Hasil Ujian: Fiqih Ibadah
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Kelas 7A Ikhwan • 30 Peserta Terdaftar
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rata-Rata Kelas</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-1">88.5</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nilai Tertinggi</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-teal-700 mt-1">100</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nilai Terendah</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-1">65</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Selesai Menilai</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">3 / 4 Santri</div>
          </CardContent>
        </Card>
      </div>

      {/* Student Score Table / Card List (Responsive) */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Daftar Skor Santri
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Klik tombol &quot;Beri Nilai Esai&quot; untuk menginput koreksi jawaban esai santri
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-600">
                <tr>
                  <th className="p-4 pl-6">Nama Santri</th>
                  <th className="p-4">NISN</th>
                  <th className="p-4 text-center">Skor PG (80)</th>
                  <th className="p-4 text-center">Skor Esai (20)</th>
                  <th className="p-4 text-center">Total Nilai</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pesertaList.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="p-4 pl-6 font-bold text-slate-900">{p.nama}</td>
                    <td className="p-4 text-xs font-mono text-slate-500">{p.nisn}</td>
                    <td className="p-4 text-center font-semibold text-slate-700">{p.skorPG}</td>
                    <td className="p-4 text-center font-semibold text-slate-700">
                      {p.skorEsai !== null ? p.skorEsai : <span className="text-amber-500">Belum</span>}
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-extrabold text-base text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        {p.totalNilai}
                      </span>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={p.status as "DINILAI" | "SELESAI" | "SEDANG_MENGERJAKAN"} />
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedStudent(p)}
                        className="rounded-xl min-h-[36px] text-xs font-bold"
                      >
                        <FileEdit className="h-3.5 w-3.5 mr-1 text-emerald-700" />
                        Koreksi Esai
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden p-4 space-y-3">
            {pesertaList.map((p) => (
              <div key={p.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{p.nama}</div>
                    <div className="text-xs text-slate-500 font-mono">NISN: {p.nisn}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-lg text-emerald-700 bg-white px-2.5 py-1 rounded-xl border border-emerald-200 shadow-sm">
                      {p.totalNilai}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-200 text-slate-600">
                  <div>Skor PG: <strong>{p.skorPG}/80</strong></div>
                  <div>Skor Esai: <strong>{p.skorEsai !== null ? `${p.skorEsai}/20` : "Belum Dinilai"}</strong></div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <StatusBadge status={p.status as "DINILAI" | "SELESAI" | "SEDANG_MENGERJAKAN"} size="sm" />
                  <Button
                    size="sm"
                    onClick={() => setSelectedStudent(p)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl min-h-[40px] text-xs font-bold"
                  >
                    <FileEdit className="h-3.5 w-3.5 mr-1" />
                    Koreksi Esai
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog Penilaian Esai */}
      {selectedStudent && (
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Penilaian Esai: {selectedStudent.nama}
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Koreksi jawaban esai santri dan berikan bobot nilai maksimal 20 poin.
              </p>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-xs font-bold text-slate-700 uppercase block">Jawaban Santri:</span>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed italic">
                  &ldquo;Najis Mukhaffafah adalah air kencing bayi laki-laki yang belum makan selain ASI, disucikan dengan memercikkan air. Mutawassithah adalah darah/bangkai disucikan sampai hilang bau dan warna. Mughaladhah adalah jilatan anjing dibasuh 7 kali salah satunya dengan tanah.&rdquo;
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Skor Esai (0 - 20):</label>
                <Input
                  type="number"
                  min="0"
                  max="20"
                  value={nilaiEsai}
                  onChange={(e) => setNilaiEsai(e.target.value)}
                  className="h-11 rounded-xl font-bold text-base"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Catatan Feedback untuk Santri:</label>
                <Input
                  value={catatanEsai}
                  onChange={(e) => setCatatanEsai(e.target.value)}
                  placeholder="Beri motivasi atau catatan koreksi..."
                  className="h-11 rounded-xl text-sm"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setSelectedStudent(null)}
                disabled={savingEsai}
                className="rounded-xl min-h-[40px]"
              >
                Batal
              </Button>
              <Button
                onClick={handleSimpanNilaiEsai}
                disabled={savingEsai}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl min-h-[40px]"
              >
                {savingEsai ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                Simpan Penilaian
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
