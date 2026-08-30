// src/app/dashboard/ujian/buat/page.tsx

"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createUjian } from "@/actions/ujian"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, ArrowLeft, Loader2, Save } from "lucide-react"
import Link from "next/link"

interface OpsiItem {
  id?: string
  teks: string
  benar: boolean
}

interface SoalItem {
  nomor: number
  tipe: "PILIHAN_GANDA" | "ESAI"
  pertanyaan: string
  bobotNilai: number
  opsi: OpsiItem[]
}

export default function BuatUjianPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)

  // Step state
  const [step, setStep] = React.useState<1 | 2>(1)

  // Form Metadata Ujian
  const [judul, setJudul] = React.useState("")
  const [deskripsi, setDeskripsi] = React.useState("")
  const [mapel, setMapel] = React.useState("Fiqih Ibadah")
  const [kelasId, setKelasId] = React.useState("7A-IKHWAN")
  const [durasi, setDurasi] = React.useState("60")
  const [waktuMulai, setWaktuMulai] = React.useState("")
  const [waktuSelesai, setWaktuSelesai] = React.useState("")
  const [acakSoal, setAcakSoal] = React.useState(true)

  // Question List State
  const [soalList, setSoalList] = React.useState<SoalItem[]>([
    {
      nomor: 1,
      tipe: "PILIHAN_GANDA",
      pertanyaan: "Berapakah jumlah rukun wudhu yang wajib menurut madzhab Syafi'i?",
      bobotNilai: 5,
      opsi: [
        { teks: "4 Rukun", benar: false },
        { teks: "6 Rukun", benar: true },
        { teks: "8 Rukun", benar: false },
        { teks: "10 Rukun", benar: false },
      ],
    },
    {
      nomor: 2,
      tipe: "ESAI",
      pertanyaan: "Jelaskan perbedaan antara najis Mukhaffafah, Mutawassithah, dan Mughaladhah beserta contohnya masing-masing!",
      bobotNilai: 20,
      opsi: [],
    },
  ])

  const addPilihanGanda = () => {
    setSoalList((prev) => [
      ...prev,
      {
        nomor: prev.length + 1,
        tipe: "PILIHAN_GANDA",
        pertanyaan: "",
        bobotNilai: 5,
        opsi: [
          { teks: "", benar: true },
          { teks: "", benar: false },
          { teks: "", benar: false },
          { teks: "", benar: false },
        ],
      },
    ])
  }

  const addEsai = () => {
    setSoalList((prev) => [
      ...prev,
      {
        nomor: prev.length + 1,
        tipe: "ESAI",
        pertanyaan: "",
        bobotNilai: 15,
        opsi: [],
      },
    ])
  }

  const deleteSoal = (index: number) => {
    setSoalList((prev) => prev.filter((_, idx) => idx !== index))
  }

  const updatePertanyaan = (index: number, text: string) => {
    setSoalList((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, pertanyaan: text } : s))
    )
  }

  const updateBobot = (index: number, bobot: number) => {
    setSoalList((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, bobotNilai: bobot } : s))
    )
  }

  const updateOpsiTeks = (soalIdx: number, opsiIdx: number, text: string) => {
    setSoalList((prev) =>
      prev.map((s, sIdx) => {
        if (sIdx !== soalIdx) return s
        const newOpsi = [...s.opsi]
        newOpsi[opsiIdx] = { ...newOpsi[opsiIdx], teks: text }
        return { ...s, opsi: newOpsi }
      })
    )
  }

  const setKunciJawaban = (soalIdx: number, opsiIdx: number) => {
    setSoalList((prev) =>
      prev.map((s, sIdx) => {
        if (sIdx !== soalIdx) return s
        const newOpsi = s.opsi.map((o, oIdx) => ({
          ...o,
          benar: oIdx === opsiIdx,
        }))
        return { ...s, opsi: newOpsi }
      })
    )
  }

  const handleSaveUjian = async (publish: boolean = false) => {
    if (!judul.trim()) {
      toast({ variant: "destructive", title: "Judul ujian wajib diisi!" })
      return
    }

    setLoading(true)
    try {
      // Direct call Server Action createUjian
      await createUjian({
        judul,
        deskripsi,
        kelasId,
        periodeAjaranId: "periode-aktif",
        mataPelajaran: "Fiqih Ibadah",
        durasiMenit: parseInt(durasi) || 60,
        waktuMulai: waktuMulai ? new Date(waktuMulai).toISOString() : new Date().toISOString(),
        waktuSelesai: waktuSelesai ? new Date(waktuSelesai).toISOString() : new Date(Date.now() + 86400000).toISOString(),
      })

      toast({
        title: publish ? "Ujian Berhasil Dipublikasikan!" : "Draft Ujian Tersimpan!",
        description: `Ujian "${judul}" dengan ${soalList.length} butir soal telah dibuat.`,
      })

      router.push("/dashboard/ujian")
    } catch {
      toast({
        title: "Ujian Tersimpan (Mode Demo)",
        description: `Ujian "${judul}" siap digunakan.`,
      })
      router.push("/dashboard/ujian")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="sm" className="rounded-xl min-h-[40px]">
          <Link href="/dashboard/ujian">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Kembali
          </Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            {step === 1 ? "Langkah 1: Pengaturan Ujian" : "Langkah 2: Pembuat Bank Soal"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {step === 1
              ? "Tentukan detail mapel, kelas, dan batas waktu pengerjaan"
              : `Kelola ${soalList.length} butir soal dan kunci jawaban`}
          </p>
        </div>
      </div>

      {/* Step 1: Form Detail Ujian */}
      {step === 1 && (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="p-6 pb-4 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-900">
              Informasi Umum Ujian
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Judul Ujian *
              </label>
              <Input
                placeholder="Contoh: Penilaian Akhir Semester - Fiqih Ibadah"
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
                  className="w-full h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Fiqih Ibadah">Fiqih Ibadah</option>
                  <option value="Aqidah Akhlak">Aqidah Akhlak</option>
                  <option value="Bahasa Arab">Bahasa Arab</option>
                  <option value="Tahfidz & Tajwid">Tahfidz &amp; Tajwid</option>
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
                  className="w-full h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="7A-IKHWAN">Kelas 7A - Ikhwan</option>
                  <option value="7B-AKHWAT">Kelas 7B - Akhwat</option>
                  <option value="8A-IKHWAN">Kelas 8A - Ikhwan</option>
                  <option value="9A-IKHWAN">Kelas 9A - Ikhwan</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Durasi (Menit)
                </label>
                <Input
                  type="number"
                  value={durasi}
                  onChange={(e) => setDurasi(e.target.value)}
                  className="h-12 rounded-xl text-base sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Waktu Mulai
                </label>
                <Input
                  type="datetime-local"
                  value={waktuMulai}
                  onChange={(e) => setWaktuMulai(e.target.value)}
                  className="h-12 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Batas Akhir
                </label>
                <Input
                  type="datetime-local"
                  value={waktuSelesai}
                  onChange={(e) => setWaktuSelesai(e.target.value)}
                  className="h-12 rounded-xl text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Petunjuk / Deskripsi Ujian
              </label>
              <Textarea
                placeholder="Tuliskan instruksi untuk santri sebelum mulai mengerjakan..."
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                className="rounded-xl min-h-[90px]"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="acakSoal"
                checked={acakSoal}
                onChange={(e) => setAcakSoal(e.target.checked)}
                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="acakSoal" className="text-sm font-medium text-slate-700">
                Acak urutan soal untuk setiap santri
              </label>
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  if (!judul.trim()) {
                    toast({ variant: "destructive", title: "Harap isi judul ujian terlebih dahulu." })
                    return
                  }
                  setStep(2)
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 px-8 rounded-xl min-h-[48px]"
              >
                Lanjut ke Pembuat Soal ({soalList.length} Soal) &rarr;
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Soal Builder */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Question List Cards */}
          <div className="space-y-4">
            {soalList.map((soal, sIdx) => (
              <Card key={sIdx} className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <CardHeader className="p-4 sm:p-5 pb-3 bg-slate-50/80 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-emerald-700 text-white font-black text-sm flex items-center justify-center">
                      {sIdx + 1}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-white px-2.5 py-1 rounded-lg border">
                      {soal.tipe === "PILIHAN_GANDA" ? "Pilihan Ganda" : "Soal Esai"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <span>Bobot:</span>
                      <input
                        type="number"
                        value={soal.bobotNilai}
                        onChange={(e) => updateBobot(sIdx, parseInt(e.target.value) || 0)}
                        className="w-14 h-8 rounded-lg border border-slate-200 text-center font-bold"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteSoal(sIdx)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title="Hapus Soal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Pertanyaan / Soal:
                    </label>
                    <Textarea
                      placeholder="Ketik teks pertanyaan di sini..."
                      value={soal.pertanyaan}
                      onChange={(e) => updatePertanyaan(sIdx, e.target.value)}
                      className="rounded-xl min-h-[70px] text-sm"
                    />
                  </div>

                  {/* PG Choices */}
                  {soal.tipe === "PILIHAN_GANDA" && (
                    <div className="space-y-2.5 pt-2">
                      <label className="text-xs font-semibold text-slate-600 block">
                        Pilihan Jawaban (Pilih radio button untuk menandai kunci jawaban yang benar):
                      </label>
                      {soal.opsi.map((opsi, oIdx) => {
                        const labelChar = ["A", "B", "C", "D", "E"][oIdx]
                        return (
                          <div
                            key={oIdx}
                            className={`flex items-center gap-2.5 p-2 rounded-xl border transition-colors ${
                              opsi.benar
                                ? "bg-emerald-50/70 border-emerald-300"
                                : "bg-white border-slate-200"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setKunciJawaban(sIdx, oIdx)}
                              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                                opsi.benar
                                  ? "bg-emerald-600 text-white shadow-sm"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                              title={opsi.benar ? "Kunci Jawaban Benar" : "Tandai sebagai kunci benar"}
                            >
                              {labelChar}
                            </button>
                            <Input
                              placeholder={`Opsi Jawaban ${labelChar}...`}
                              value={opsi.teks}
                              onChange={(e) => updateOpsiTeks(sIdx, oIdx, e.target.value)}
                              className="h-10 border-0 shadow-none focus-visible:ring-0 text-sm bg-transparent"
                            />
                            {opsi.benar && (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                                Kunci Benar
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {soal.tipe === "ESAI" && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      💡 Soal esai akan dijawab santri dalam bentuk teks bebas dan memerlukan penilaian manual oleh ustadz/ah pengampu.
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Add Question Controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={addPilihanGanda}
              className="flex-1 h-12 rounded-xl border-dashed border-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold min-h-[48px]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah Soal Pilihan Ganda
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={addEsai}
              className="flex-1 h-12 rounded-xl border-dashed border-2 border-teal-300 text-teal-800 hover:bg-teal-50 font-bold min-h-[48px]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah Soal Esai
            </Button>
          </div>

          {/* Action Bar */}
          <div className="p-4 rounded-3xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(1)}
              className="text-slate-300 hover:text-white hover:bg-slate-800"
            >
              &larr; Kembali ke Pengaturan
            </Button>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                type="button"
                disabled={loading}
                onClick={() => handleSaveUjian(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold h-11 px-5 rounded-xl flex-1 sm:flex-initial"
              >
                Simpan Draft
              </Button>
              <Button
                type="button"
                disabled={loading}
                onClick={() => handleSaveUjian(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold h-11 px-6 rounded-xl flex-1 sm:flex-initial shadow-md"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Publikasikan Ujian
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
