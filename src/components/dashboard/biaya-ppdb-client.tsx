"use client"

import * as React from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Settings2, Wallet, Check, RefreshCw, MessageCircle } from "lucide-react"
import {
  getBiayaPPDBAdmin,
  updateBiayaJenjang,
  updatePengaturanPPDB,
} from "@/actions/biaya-ppdb"

type JenjangBiaya = {
  id: string
  nama: string
  aktif: boolean
  urutan: number
  biayaPendaftaran: number
  biayaUangGedung: number
  biayaSarpras: number
}

type Pengaturan = {
  bankNama: string
  bankNoRekening: string
  bankAtasNama: string
  kontakWa: string
  namaKontakWa: string
}

type AdminData = {
  jenjang: JenjangBiaya[]
  pengaturan: Pengaturan
}

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n)

/** Input nominal dengan pemisah ribuan titik agar admin tidak salah ketik. */
function NominalInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const display = value === "" ? "" : new Intl.NumberFormat("id-ID").format(Number(value.replace(/\D/g, "")))
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">Rp</span>
      <Input
        type="text"
        inputMode="numeric"
        value={display}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
        className="h-10 rounded-xl text-sm pl-10"
        placeholder="0"
      />
    </div>
  )
}

export function BiayaPPDBClient({
  initialData,
  initialError,
}: {
  initialData: AdminData | null
  initialError: boolean
}) {
  const { toast } = useToast()
  const [data, setData] = React.useState<AdminData | null>(initialData)
  const [loadError, setLoadError] = React.useState(initialError)
  const [refreshing, setRefreshing] = React.useState(false)

  // Edit state per jenjang
  const [edits, setEdits] = React.useState<Record<string, { pendaftaran: string; gedung: string; sarpras: string }>>({})
  const [savingId, setSavingId] = React.useState<string | null>(null)

  // Edit state pengaturan rekening/WA
  const [pengaturanEdit, setPengaturanEdit] = React.useState<Pengaturan | null>(null)
  const [savingPengaturan, setSavingPengaturan] = React.useState(false)

  const syncEdits = React.useCallback((d: AdminData) => {
    setEdits(
      Object.fromEntries(
        d.jenjang.map((j) => [
          j.id,
          {
            pendaftaran: String(j.biayaPendaftaran),
            gedung: String(j.biayaUangGedung),
            sarpras: String(j.biayaSarpras),
          },
        ])
      )
    )
  }, [])

  React.useEffect(() => {
    if (data) syncEdits(data)
  }, [data, syncEdits])

  const refresh = async () => {
    setRefreshing(true)
    try {
      const res = await getBiayaPPDBAdmin()
      if (res.success && res.data) {
        setData(res.data)
        setLoadError(false)
      } else {
        toast({ title: "Gagal memuat", description: res.message, variant: "destructive" as never })
      }
    } catch {
      toast({ title: "Error", description: "Gagal menghubungi server", variant: "destructive" as never })
    } finally {
      setRefreshing(false)
    }
  }

  const totalJenjang = (j: JenjangBiaya) => {
    const e = edits[j.id]
    if (!e) return j.biayaPendaftaran + j.biayaUangGedung + j.biayaSarpras
    return (
      (Number(e.pendaftaran) || 0) + (Number(e.gedung) || 0) + (Number(e.sarpras) || 0)
    )
  }

  const handleSimpanJenjang = async (j: JenjangBiaya) => {
    const e = edits[j.id]
    if (!e) return
    const pendaftaran = Number(e.pendaftaran) || 0
    const gedung = Number(e.gedung) || 0
    const sarpras = Number(e.sarpras) || 0

    if (pendaftaran <= 0) {
      toast({
        title: "Biaya pendaftaran wajib diisi",
        description: "Isi biaya pendaftaran dengan angka lebih dari 0.",
        variant: "destructive" as never,
      })
      return
    }
    if (pendaftaran > 100_000_000 || gedung > 100_000_000 || sarpras > 100_000_000) {
      toast({
        title: "Nominal terlalu besar",
        description: "Maksimal Rp 100.000.000 per komponen.",
        variant: "destructive" as never,
      })
      return
    }

    setSavingId(j.id)
    try {
      const res = await updateBiayaJenjang({
        jenjangId: j.id,
        biayaPendaftaran: pendaftaran,
        biayaUangGedung: gedung,
        biayaSarpras: sarpras,
      })
      if (res.success) {
        toast({ title: "Biaya Diperbarui ✅", description: res.message })
        setData((prev) =>
          prev
            ? {
                ...prev,
                jenjang: prev.jenjang.map((x) =>
                  x.id === j.id
                    ? { ...x, biayaPendaftaran: pendaftaran, biayaUangGedung: gedung, biayaSarpras: sarpras }
                    : x
                ),
              }
            : prev
        )
      } else {
        toast({ title: "Gagal Memperbarui", description: res.message, variant: "destructive" as never })
      }
    } catch {
      toast({ title: "Gagal Memperbarui", description: "Terjadi kesalahan saat menyimpan.", variant: "destructive" as never })
    } finally {
      setSavingId(null)
    }
  }

  const handleSimpanPengaturan = async () => {
    if (!pengaturanEdit) return
    const p = pengaturanEdit
    if (!p.bankNama.trim() || !p.bankNoRekening.trim() || !p.bankAtasNama.trim() || !p.kontakWa.trim() || !p.namaKontakWa.trim()) {
      toast({ title: "Data belum lengkap", description: "Semua kolom wajib diisi.", variant: "destructive" as never })
      return
    }
    if (!/^628\d{7,13}$/.test(p.kontakWa.trim())) {
      toast({
        title: "Nomor WA tidak valid",
        description: "Gunakan format 628xxxxxxxxxx (tanpa tanda +, tanpa spasi).",
        variant: "destructive" as never,
      })
      return
    }
    if (!/^[0-9-]+$/.test(p.bankNoRekening.trim())) {
      toast({ title: "Nomor rekening tidak valid", description: "Hanya boleh berisi angka.", variant: "destructive" as never })
      return
    }

    setSavingPengaturan(true)
    try {
      const res = await updatePengaturanPPDB({
        bankNama: p.bankNama.trim(),
        bankNoRekening: p.bankNoRekening.trim(),
        bankAtasNama: p.bankAtasNama.trim(),
        kontakWa: p.kontakWa.trim(),
        namaKontakWa: p.namaKontakWa.trim(),
      })
      if (res.success) {
        toast({ title: "Pengaturan Disimpan ✅", description: res.message })
        setData((prev) => (prev ? { ...prev, pengaturan: { ...p } } : prev))
        setPengaturanEdit(null)
      } else {
        toast({ title: "Gagal Menyimpan", description: res.message, variant: "destructive" as never })
      }
    } catch {
      toast({ title: "Gagal Menyimpan", description: "Terjadi kesalahan saat menyimpan.", variant: "destructive" as never })
    } finally {
      setSavingPengaturan(false)
    }
  }

  if (loadError && !data) {
    return (
      <div className="space-y-6">
        <DashboardHeader title="Biaya PPDB" subtitle="Pengaturan biaya pendaftaran per jenjang" />
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-8 text-center">
          <p className="text-sm text-slate-500 mb-4">
            Gagal memuat pengaturan biaya PPDB. Coba muat ulang.
          </p>
          <Button onClick={refresh} disabled={refreshing} className="rounded-xl">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Muat Ulang
          </Button>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <DashboardHeader title="Biaya PPDB" subtitle="Pengaturan biaya pendaftaran per jenjang" />
        <div className="p-12 text-center text-sm text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-yellow-500" />
          Memuat pengaturan...
        </div>
      </div>
    )
  }

  const p = pengaturanEdit ?? data.pengaturan

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Biaya PPDB"
        subtitle="Atur biaya pendaftaran per jenjang, rekening tujuan transfer, dan kontak konfirmasi WhatsApp"
      />

      {/* Panel: Biaya per jenjang */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-6 sm:p-8">
        <CardHeader className="p-0 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-yellow-600" />
                Biaya Pendaftaran per Jenjang
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-slate-500 leading-relaxed mt-1">
                Total biaya ini yang harus ditransfer calon santri dan tampil di halaman
                instruksinya. Perubahan langsung berlaku untuk pendaftaran baru — pendaftaran
                yang sudah terlanjur dibuat tetap memakai nominal saat ia mendaftar.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing} className="rounded-xl shrink-0">
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3 pl-4">Jenjang</th>
                  <th className="p-3">Pendaftaran</th>
                  <th className="p-3">Uang Gedung</th>
                  <th className="p-3">Sarpras</th>
                  <th className="p-3">Total</th>
                  <th className="p-3 pr-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.jenjang.map((j) => {
                  const e = edits[j.id] ?? {
                    pendaftaran: String(j.biayaPendaftaran),
                    gedung: String(j.biayaUangGedung),
                    sarpras: String(j.biayaSarpras),
                  }
                  const dirty =
                    Number(e.pendaftaran) !== j.biayaPendaftaran ||
                    Number(e.gedung) !== j.biayaUangGedung ||
                    Number(e.sarpras) !== j.biayaSarpras
                  return (
                    <tr key={j.id} className="hover:bg-slate-50/80">
                      <td className="p-3 pl-4">
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          {j.nama}
                          {!j.aktif && (
                            <Badge variant="secondary" className="text-[10px]">
                              Non-aktif
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">Urutan {j.urutan}</div>
                      </td>
                      <td className="p-3 min-w-[150px]">
                        <NominalInput
                          value={e.pendaftaran}
                          onChange={(v) =>
                            setEdits((prev) => ({ ...prev, [j.id]: { ...e, pendaftaran: v } }))
                          }
                          disabled={savingId !== null}
                        />
                      </td>
                      <td className="p-3 min-w-[150px]">
                        <NominalInput
                          value={e.gedung}
                          onChange={(v) =>
                            setEdits((prev) => ({ ...prev, [j.id]: { ...e, gedung: v } }))
                          }
                          disabled={savingId !== null}
                        />
                      </td>
                      <td className="p-3 min-w-[150px]">
                        <NominalInput
                          value={e.sarpras}
                          onChange={(v) =>
                            setEdits((prev) => ({ ...prev, [j.id]: { ...e, sarpras: v } }))
                          }
                          disabled={savingId !== null}
                        />
                      </td>
                      <td className="p-3 font-bold text-slate-700 whitespace-nowrap">{formatRp(totalJenjang(j))}</td>
                      <td className="p-3 pr-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleSimpanJenjang(j)}
                          disabled={savingId !== null || !dirty}
                          className="rounded-xl text-xs font-bold bg-yellow-500 hover:bg-yellow-600 text-white min-h-[36px]"
                        >
                          {savingId === j.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <Check className="h-3.5 w-3.5 mr-1" />
                          )}
                          Simpan
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Panel: Rekening & kontak WA */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm p-6 sm:p-8">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-yellow-600" />
            Rekening Tujuan &amp; Kontak Konfirmasi
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-slate-500 leading-relaxed mt-1">
            Ditampilkan pada instruksi pembayaran calon santri. Nomor WA dalam format
            internasional tanpa tanda tambah, contoh: 6285702854133.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Nama Bank</Label>
              <Input
                value={p.bankNama}
                disabled={pengaturanEdit === null || savingPengaturan}
                onChange={(e) => setPengaturanEdit({ ...p, bankNama: e.target.value })}
                className="h-11 rounded-xl text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">No. Rekening</Label>
              <Input
                value={p.bankNoRekening}
                disabled={pengaturanEdit === null || savingPengaturan}
                onChange={(e) =>
                  setPengaturanEdit({ ...p, bankNoRekening: e.target.value.replace(/[^\d-]/g, "") })
                }
                className="h-11 rounded-xl text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Atas Nama</Label>
              <Input
                value={p.bankAtasNama}
                disabled={pengaturanEdit === null || savingPengaturan}
                onChange={(e) => setPengaturanEdit({ ...p, bankAtasNama: e.target.value })}
                className="h-11 rounded-xl text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                  Nomor WhatsApp Konfirmasi
                </span>
              </Label>
              <Input
                value={p.kontakWa}
                disabled={pengaturanEdit === null || savingPengaturan}
                onChange={(e) =>
                  setPengaturanEdit({ ...p, kontakWa: e.target.value.replace(/\D/g, "").slice(0, 15) })
                }
                placeholder="628xxxxxxxxxx"
                className="h-11 rounded-xl text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Nama Kontak WA</Label>
              <Input
                value={p.namaKontakWa}
                disabled={pengaturanEdit === null || savingPengaturan}
                onChange={(e) => setPengaturanEdit({ ...p, namaKontakWa: e.target.value })}
                className="h-11 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            {pengaturanEdit === null ? (
              <Button
                onClick={() => setPengaturanEdit({ ...data.pengaturan })}
                variant="outline"
                className="rounded-xl font-semibold"
              >
                Ubah Pengaturan
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleSimpanPengaturan}
                  disabled={savingPengaturan}
                  className="rounded-xl font-bold bg-yellow-500 hover:bg-yellow-600 text-white"
                >
                  {savingPengaturan ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Simpan
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPengaturanEdit(null)}
                  disabled={savingPengaturan}
                  className="rounded-xl"
                >
                  Batal
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
