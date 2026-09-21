"use client"

import * as React from "react"
import { Loader2, Table2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { getDaftarKelasYangDiajarGuru } from "@/actions/guru-kelas"
import { getDaftarPeriodeAjaran } from "@/actions/periode-ajaran"
import { getRekapNilaiMapelKelas } from "@/actions/rekap-nilai"

type KelasItem = {
  kelasId: string
  namaKelas: string
  jenjang: string
  jenisKelamin: "LAKI_LAKI" | "PEREMPUAN" | null
  jumlahSiswa: number
}

type PeriodeItem = {
  id: string
  nama: string
  tahunAjaran: string
  semester: string
  aktif: boolean
}

type Kegiatan = {
  id: string
  judul: string
  tipe: "TUGAS" | "UJIAN"
  mataPelajaran: string
  label: string
  inputManual: boolean
}

type SiswaRekap = {
  siswaId: string
  nama: string
  nisn: string | null
  nilai: Record<string, number | null>
}

export default function RekapNilaiPageClient() {
  const [kelasList, setKelasList] = React.useState<KelasItem[]>([])
  const [periodeList, setPeriodeList] = React.useState<PeriodeItem[]>([])
  const [selectedKelasId, setSelectedKelasId] = React.useState("")
  const [selectedPeriodeId, setSelectedPeriodeId] = React.useState("")
  const [loadingInit, setLoadingInit] = React.useState(true)
  const [loading, setLoading] = React.useState(false)
  const [kegiatan, setKegiatan] = React.useState<Kegiatan[]>([])
  const [siswa, setSiswa] = React.useState<SiswaRekap[]>([])
  const [info, setInfo] = React.useState<{
    kelas: string
    jenjang: string
    jumlahSiswa: number
    periode: string
  } | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [kelasRes, periodeRes] = await Promise.all([
          getDaftarKelasYangDiajarGuru(),
          getDaftarPeriodeAjaran(),
        ])
        if (!mounted) return

        const kelasData = (kelasRes.success ? kelasRes.data : []) as KelasItem[]
        setKelasList(kelasData)
        if (kelasData.length > 0) {
          setSelectedKelasId(kelasData[0].kelasId)
        }

        const periodeData = (
          periodeRes.success ? periodeRes.data : []
        ) as PeriodeItem[]
        setPeriodeList(periodeData)
        const aktif =
          periodeData.find((p) => p.aktif) || periodeData[0]
        if (aktif) setSelectedPeriodeId(aktif.id)
      } catch {
        // Biarkan kosong
      } finally {
        if (mounted) setLoadingInit(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const fetchRekap = React.useCallback(
    async (kelasId: string, periodeId: string) => {
      if (!kelasId || !periodeId) return
      setLoading(true)
      setError(null)
      try {
        const result = await getRekapNilaiMapelKelas(kelasId, periodeId)
        if (result.success && result.data) {
          const data = result.data as {
            kelas: string
            jenjang: string
            jumlahSiswa: number
            periode: { nama: string }
            kegiatan: Kegiatan[]
            siswa: SiswaRekap[]
          }
          setKegiatan(data.kegiatan)
          setSiswa(data.siswa)
          setInfo({
            kelas: data.kelas,
            jenjang: data.jenjang,
            jumlahSiswa: data.jumlahSiswa,
            periode: data.periode.nama,
          })
        } else {
          setError(result.message || "Gagal memuat rekap nilai")
        }
      } catch {
        setError("Gagal memuat rekap nilai")
      } finally {
        setLoading(false)
      }
    },
    []
  )

  React.useEffect(() => {
    fetchRekap(selectedKelasId, selectedPeriodeId)
  }, [selectedKelasId, selectedPeriodeId, fetchRekap])

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        <span className="ml-3 text-sm text-slate-500">Memuat data...</span>
      </div>
    )
  }

  if (kelasList.length === 0) {
    return (
      <EmptyState title="Belum Ada Kelas"
        description="Anda belum ditugaskan mengajar di kelas manapun." />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 flex items-center gap-2">
          <Table2 className="h-6 w-6 text-yellow-600" />
          Rekap Nilai Kelas
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Matriks nilai seluruh tugas &amp; ujian per siswa (termasuk nilai input manual)
        </p>
      </div>

      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pilih Kelas
              </label>
              <select
                value={selectedKelasId}
                onChange={(e) => setSelectedKelasId(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-yellow-500"
              >
                {kelasList.map((k) => (
                  <option key={k.kelasId} value={k.kelasId}>
                    {k.jenjang} - {k.namaKelas} ({k.jumlahSiswa} siswa)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Periode Ajaran
              </label>
              <select
                value={selectedPeriodeId}
                onChange={(e) => setSelectedPeriodeId(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-yellow-500"
              >
                {periodeList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <EmptyState title="Gagal Memuat Data" description={error} />}

      {loading && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
          <span className="ml-3 text-sm text-slate-500">Memuat rekap nilai...</span>
        </div>
      )}

      {!loading && !error && info && (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <div className="text-base font-bold text-slate-800">
                  {info.jenjang} - {info.kelas}
                </div>
                <div className="text-xs text-slate-500">
                  {info.periode} • {info.jumlahSiswa} siswa • {kegiatan.length} kegiatan
                </div>
              </div>
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                Nilai tanpa berkas = input manual
              </span>
            </div>

            {kegiatan.length === 0 ? (
              <EmptyState
                title="Belum Ada Nilai"
                description="Belum ada tugas/ujian yang dinilai untuk kelas & periode ini."
              />
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-xs min-w-[640px]">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2.5 pr-3 font-bold text-slate-600 sticky left-0 bg-white min-w-[160px]">
                        Siswa
                      </th>
                      {kegiatan.map((k) => (
                        <th
                          key={k.id}
                          className="text-center py-2.5 px-2 min-w-[92px] font-bold text-slate-600 whitespace-nowrap"
                          title={k.judul}
                        >
                          <span className="inline-flex items-center gap-1">
                            {k.inputManual && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            )}
                            {k.label}
                          </span>
                          <div className="text-[10px] font-medium text-slate-400 mt-0.5">
                            {k.mataPelajaran}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {siswa.map((s) => (
                      <tr key={s.siswaId} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 pr-3 sticky left-0 bg-white">
                          <div className="font-semibold text-slate-800">{s.nama}</div>
                          {s.nisn && (
                            <div className="text-[10px] text-slate-400">{s.nisn}</div>
                          )}
                        </td>
                        {kegiatan.map((k) => {
                          const nilai = s.nilai[k.id]
                          return (
                            <td
                              key={k.id}
                              className="py-2 px-2 text-center"
                            >
                              {nilai === null || nilai === undefined ? (
                                <span className="text-slate-300">–</span>
                              ) : (
                                <span
                                  className={
                                    k.inputManual
                                      ? "font-bold text-amber-700"
                                      : "font-semibold text-slate-700"
                                  }
                                >
                                  {nilai}
                                </span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}