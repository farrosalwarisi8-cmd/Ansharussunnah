"use client"

// KelasMapelSelector
// Komponen bersama untuk memilih Jenjang → Kelas → (opsional) Mata Pelajaran.
// Data bersumber dari server action struktur-akademik sehingga KONSISTEN di semua
// fitur (ujian, tugas, materi) — menggantikan daftar kelas/mapel hardcoded & basi.

import * as React from "react"
import {
  getStrukturKelasSiswaAkademik,
  getMapelTersedia,
} from "@/actions/struktur-akademik"
import { Loader2 } from "lucide-react"

export interface JenjangOption {
  id: string
  nama: string
  urutan: number
  kelas: Array<{ id: string; nama: string }>
}

interface KelasMapelSelectorProps {
  kelasId: string
  mapel?: string
  onChangeKelas: (kelasId: string) => void
  onChangeMapel?: (mapel: string) => void
  showMapel?: boolean
  className?: string
}

export function KelasMapelSelector({
  kelasId,
  mapel = "",
  onChangeKelas,
  onChangeMapel,
  showMapel = true,
  className = "",
}: KelasMapelSelectorProps) {
  const [jenjang, setJenjang] = React.useState("")
  const [struktur, setStruktur] = React.useState<JenjangOption[]>([])
  const [mapelList, setMapelList] = React.useState<Array<{ id: string; nama: string }>>([])
  const [loading, setLoading] = React.useState(true)
  const [loadingMapel, setLoadingMapel] = React.useState(false)

  // Muat struktur jenjang → kelas sekali
  React.useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      const res = await getStrukturKelasSiswaAkademik()
      if (!mounted) return
      if (res.success && res.data) {
        const list = res.data.jenjangList
        setStruktur(list)
        // Set jenjang berdasarkan kelasId yang sudah terpilih (edit mode)
        if (kelasId) {
          const jn = list.find((j) => j.kelas.some((k) => k.id === kelasId))
          if (jn) setJenjang(jn.id)
        } else if (list.length > 0) {
          setJenjang("")
        }
      }
      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ketika jenjang berubah & belum ada keluarga terpilih, pilih kelas pertama
  const handleJenjangChange = (jenjangId: string) => {
    setJenjang(jenjangId)
    const jn = struktur.find((j) => j.id === jenjangId)
    if (jn && jn.kelas.length > 0) {
      onChangeKelas(jn.kelas[0].id)
    } else {
      onChangeKelas("")
    }
    if (onChangeMapel) onChangeMapel("")
  }

  // Ketika kelas berubah, muat ulang daftar mapel yang tersedia untuk kelas itu
  const handleKelasChange = (newKelasId: string) => {
    onChangeKelas(newKelasId)
    if (onChangeMapel) onChangeMapel("")
  }

  // Muat daftar mapel berdasarkan kelas yang dipilih
  React.useEffect(() => {
    if (!showMapel || !kelasId) {
      setMapelList([])
      return
    }
    let mounted = true
    async function loadMapel() {
      setLoadingMapel(true)
      const res = await getMapelTersedia(kelasId)
      if (mounted) {
        setMapelList(res.success && res.data ? res.data : [])
        setLoadingMapel(false)
      }
    }
    loadMapel()
    return () => {
      mounted = false
    }
  }, [kelasId, showMapel])

  const kelasTerpilihJenjang = struktur.find((j) => j.id === jenjang) || null

  const selectClass =
    "h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-yellow-500"

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Pilih Jenjang */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          Jenjang
        </label>
        <select
          value={jenjang}
          onChange={(e) => handleJenjangChange(e.target.value)}
          className={selectClass}
          disabled={loading}
        >
          <option value="">{loading ? "Memuat jenjang..." : "— Pilih Jenjang —"}</option>
          {struktur.map((j) => (
            <option key={j.id} value={j.id}>
              {j.nama}
            </option>
          ))}
        </select>
      </div>

      {/* Pilih Kelas */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          Kelas <span className="text-rose-500">*</span>
        </label>
        <select
          value={kelasId}
          onChange={(e) => handleKelasChange(e.target.value)}
          className={selectClass}
          disabled={loading || !jenjang}
        >
          <option value="">— Pilih Kelas —</option>
          {kelasTerpilihJenjang?.kelas.map((k) => (
            <option key={k.id} value={k.id}>
              Kelas {k.nama}
            </option>
          ))}
        </select>
        {!jenjang && !loading && (
          <p className="text-xs text-slate-400">Pilih jenjang terlebih dahulu.</p>
        )}
      </div>

      {/* Pilih Mata Pelajaran */}
      {showMapel && (
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Mata Pelajaran <span className="text-rose-500">*</span>
          </label>
          {loadingMapel ? (
            <div className="flex items-center gap-2 h-12 rounded-xl border border-slate-200 px-3 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat daftar mapel...
            </div>
          ) : (
            <select
              value={mapel}
              onChange={(e) => onChangeMapel?.(e.target.value)}
              className={selectClass}
              disabled={!kelasId || mapelList.length === 0}
            >
              <option value="">— Pilih Mata Pelajaran —</option>
              {mapelList.map((m) => (
                <option key={m.id} value={m.nama}>
                  {m.nama}
                </option>
              ))}
            </select>
          )}
          {!loadingMapel && kelasId && mapelList.length === 0 && (
            <p className="text-xs text-slate-400">
              Belum ada mata pelajaran tersedia untuk kelas ini.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
