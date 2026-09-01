// src/app/dashboard/ujian/buat/page.tsx

"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createUjian, updateUjian, getUjianDetail, addOrUpdateSoalUjian, deleteSoalUjian } from "@/actions/ujian"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, ArrowLeft, Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react"
import Link from "next/link"

interface OpsiItem {
  id?: string
  teks: string
  benar: boolean
}

interface SoalItem {
  id?: string // Database ID if saved
  nomor: number
  tipe: "PILIHAN_GANDA" | "ESAI"
  pertanyaan: string
  bobotNilai: number
  opsi: OpsiItem[]
}

export default function BuatUjianPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")
  const isEditMode = Boolean(editId)

  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [loadingEdit, setLoadingEdit] = React.useState(isEditMode)

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

  const deleteSoal = async (index: number) => {
    const soalToDelete = soalList[index]

    // If soal has a database ID (was previously saved), delete from DB
    if (soalToDelete.id && ujianIdRef.current) {
      try {
        await deleteSoalUjian(ujianIdRef.current, soalToDelete.nomor)
      } catch {
        // Continue with local deletion even if DB delete fails
      }
    }

    setSoalList((prev) => {
      const filtered = prev.filter((_, idx) => idx !== index)
      return filtered.map((s, idx) => ({ ...s, nomor: idx + 1 }))
    })
  }

  // Ref to store ujianId after creation (for edit mode)
  const ujianIdRef = React.useRef<string | null>(editId)

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

  // Fetch existing ujian data when in edit mode
  React.useEffect(() => {
    if (!editId) return

    async function loadUjian() {
      setLoadingEdit(true)
      try {
        const result = await getUjianDetail(editId!)
        if (!result.success || !result.data) {
          toast({
            variant: "destructive",
            title: "Gagal Memuat Data Ujian",
            description: result.message || "Ujian tidak ditemukan.",
          })
          router.push("/dashboard/ujian")
          return
        }
        const data = result.data as {
          judul: string
          deskripsi?: string | null
          mataPelajaran: string
          kelasId: string
          durasiMenit: number
          waktuMulai: string
          waktuSelesai: string
          soal: {
            id?: string
            nomor: number
            tipe: "PILIHAN_GANDA" | "ESAI"
            pertanyaan: string
            bobotNilai: number
            opsi: { id?: string; teks: string; benar: boolean }[]
          }[]
        }
        setJudul(data.judul)
        setDeskripsi(data.deskripsi || "")
        setMapel(data.mataPelajaran)
        setKelasId(data.kelasId)
        setDurasi(String(data.durasiMenit))
        setWaktuMulai(data.waktuMulai ? new Date(data.waktuMulai).toISOString().slice(0, 16) : "")
        setWaktuSelesai(data.waktuSelesai ? new Date(data.waktuSelesai).toISOString().slice(0, 16) : "")
        if (data.soal.length > 0) {
          setSoalList(data.soal)
        }
      } catch {
        toast({
          variant: "destructive",
          title: "Gagal Memuat Data Ujian",
          description: "Terjadi kesalahan saat memuat data ujian.",
        })
        router.push("/dashboard/ujian")
      } finally {
        setLoadingEdit(false)
      }
    }
    loadUjian()
  }, [editId, router, toast])

  const handleSaveUjian = async (publish: boolean = false) => {
    if (!judul.trim()) {
      toast({ variant: "destructive", title: "Judul ujian wajib diisi!" })
      return
    }

    setLoading(true)
    try {
      let ujianId: string

      if (isEditMode && ujianIdRef.current) {
        // Edit mode: update existing ujian
        const result = await updateUjian(ujianIdRef.current, {
          judul,
          deskripsi,
          kelasId,
          periodeAjaranId: "periode-aktif",
          mataPelajaran: mapel,
          durasiMenit: parseInt(durasi) || 60,
          waktuMulai: waktuMulai ? new Date(waktuMulai).toISOString() : undefined,
          waktuSelesai: waktuSelesai ? new Date(waktuSelesai).toISOString() : undefined,
        })

        if (!result.success) {
          toast({
            variant: "destructive",
            title: "Gagal Memperbarui Ujian",
            description: result.message || "Terjadi kesalahan saat memperbarui ujian.",
          })
          return
        }
        ujianId = ujianIdRef.current
      } else {
        // Create mode: create new ujian
        const result = await createUjian({
          judul,
          deskripsi,
          kelasId,
          periodeAjaranId: "periode-aktif",
          mataPelajaran: mapel,
          durasiMenit: parseInt(durasi) || 60,
          waktuMulai: waktuMulai ? new Date(waktuMulai).toISOString() : new Date().toISOString(),
          waktuSelesai: waktuSelesai ? new Date(waktuSelesai).toISOString() : new Date(Date.now() + 86400000).toISOString(),
        })

        if (!result.success || !result.data?.ujianId) {
          toast({
            variant: "destructive",
            title: "Gagal Membuat Ujian",
            description: result.message || "Terjadi kesalahan saat membuat ujian.",
          })
          return
        }
        ujianId = result.data.ujianId
        ujianIdRef.current = ujianId
      }

      // Step 2: Save each soal
      const failedSoal: number[] = []
      const savedSoal: number[] = []

      for (const soal of soalList) {
        try {
          const soalPayload = {
            ujianId,
            nomorSoal: soal.nomor,
            pertanyaan: soal.pertanyaan,
            tipe: soal.tipe,
            bobot: soal.bobotNilai,
            kunciEsai: soal.tipe === "ESAI" ? soal.opsi[0]?.teks || undefined : undefined,
            opsi: soal.tipe === "PILIHAN_GANDA"
              ? soal.opsi.map((o, idx) => ({
                  label: ["A", "B", "C", "D", "E"][idx] || String.fromCharCode(65 + idx),
                  teks: o.teks,
                  benar: o.benar,
                }))
              : undefined,
          }

          const soalResult = await addOrUpdateSoalUjian(soalPayload)

          if (soalResult.success) {
            savedSoal.push(soal.nomor)
          } else {
            failedSoal.push(soal.nomor)
          }
        } catch {
          failedSoal.push(soal.nomor)
        }
      }

      // Step 3: Report results
      if (failedSoal.length > 0) {
        toast({
          variant: "destructive",
          title: `${failedSoal.length} Soal Gagal Disimpan!`,
          description: `Soal nomor ${failedSoal.join(", ")} gagal disimpan. Soal ${savedSoal.length > 0 ? `${savedSoal.join(", ")} berhasil.` : ""}`,
        })
        if (savedSoal.length === 0) {
          // All failed — don't redirect, let user fix
          setLoading(false)
          return
        }
      }

      toast({
        title: publish
          ? (isEditMode ? "Ujian Berhasil Diperbarui! 🎉" : "Ujian Berhasil Dipublikasikan! 🎉")
          : (isEditMode ? "Ujian Berhasil Diperbarui! 📝" : "Draft Ujian Tersimpan! 📝"),
        description: `${savedSoal.length} dari ${soalList.length} soal berhasil disimpan ke ujian "${judul}".`,
      })

      router.push("/dashboard/ujian")
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan Ujian",
        description: "Terjadi kesalahan saat menyimpan data ujian.",
      })
    } finally {
      setLoading(false)
    }
  }

  if (loadingEdit) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="rounded-xl min-h-[40px]">
            <Link href="/dashboard/ujian">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Kembali
            </Link>
          </Button>
        </div>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="ml-3 text-sm text-slate-500">Memuat data ujian...</span>
        </div>
      </div>
    )
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
            {isEditMode
              ? "Edit Ujian"
              : (step === 1 ? "Langkah 1: Pengaturan Ujian" : "Langkah 2: Pembuat Bank Soal")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {isEditMode
              ? "Perbarui data ujian, soal, dan kunci jawaban"
              : (step === 1
                ? "Tentukan detail mapel, kelas, dan batas waktu pengerjaan"
                : `Kelola ${soalList.length} butir soal dan kunci jawaban`)}
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
                {isEditMode ? "Lanjut ke Edit Soal" : `Lanjut ke Pembuat Soal (${soalList.length} Soal)`} &rarr;
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
                {isEditMode ? "Simpan Perubahan" : "Simpan Draft"}
              </Button>
              <Button
                type="button"
                disabled={loading}
                onClick={() => handleSaveUjian(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold h-11 px-6 rounded-xl flex-1 sm:flex-initial shadow-md"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {isEditMode ? "Perbarui & Publikasikan" : "Publikasikan Ujian"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
