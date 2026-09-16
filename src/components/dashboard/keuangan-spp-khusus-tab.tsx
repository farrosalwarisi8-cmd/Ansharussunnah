"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  getSiswaUntukTagihanKhusus,
  generateTagihanSppKhusus,
  type SiswaUntukTagihanKhusus,
  type HasilGenerateSppKhusus,
} from "@/actions/akuntansi"
import { getStrukturKelasUntukKeuangan } from "@/actions/siswa-keuangan"
import {
  FileSpreadsheet,
  Loader2,
  Search,
  UserCheck,
  Mail,
  BadgePercent,
  CheckCircle2,
  Info,
} from "lucide-react"

type JenjangOption = {
  id: string
  nama: string
  urutan: number
  kelas: Array<{
    id: string
    nama: string
    jenisKelamin: "LAKI_LAKI" | "PEREMPUAN" | null
  }>
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n)

export function SppKhususTab() {
  const { toast } = useToast()
  const now = new Date()

  const [bulan, setBulan] = React.useState(now.getMonth() + 1)
  const [tahun, setTahun] = React.useState(now.getFullYear())

  const [jenjangList, setJenjangList] = React.useState<JenjangOption[]>([])
  const [jenjangId, setJenjangId] = React.useState("")
  const [kelasId, setKelasId] = React.useState("")
  const [search, setSearch] = React.useState("")

  const [siswaList, setSiswaList] = React.useState<SiswaUntukTagihanKhusus[]>([])
  const [siswaLoading, setSiswaLoading] = React.useState(true)

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [nominalById, setNominalById] = React.useState<Record<string, string>>({})
  const [applyAllNominal, setApplyAllNominal] = React.useState("")

  const [simpanSebagaiSppKhusus, setSimpanSebagaiSppKhusus] = React.useState(true)
  const [kirimEmail, setKirimEmail] = React.useState(true)

  const [generating, setGenerating] = React.useState(false)
  const [hasil, setHasil] = React.useState<HasilGenerateSppKhusus | null>(null)

  const loadStruktur = React.useCallback(async () => {
    const res = await getStrukturKelasUntukKeuangan()
    if (res.success && res.data) {
      setJenjangList(res.data.jenjangList)
    }
  }, [])

  const loadSiswa = React.useCallback(async (params: {
    bulan: number
    tahun: number
    jenjangId?: string
    kelasId?: string
  }) => {
    setSiswaLoading(true)
    try {
      const res = await getSiswaUntukTagihanKhusus(params)
      if (res.success && Array.isArray(res.data)) {
        const daftarSiswa = res.data
        setSiswaList(daftarSiswa)
        // Bersihkan pilihan yang tidak lagi muncul
        setSelectedIds((prev) => {
          const ids = new Set(daftarSiswa.map((s) => s.id))
          return new Set([...prev].filter((id) => ids.has(id)))
        })
      } else {
        setSiswaList([])
      }
    } catch {
      setSiswaList([])
    } finally {
      setSiswaLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadStruktur()
  }, [loadStruktur])

  const refetch = React.useCallback(() => {
    loadSiswa({
      bulan,
      tahun,
      jenjangId: jenjangId || undefined,
      kelasId: kelasId || undefined,
    })
  }, [loadSiswa, bulan, tahun, jenjangId, kelasId])

  const handleFilter = (b: number, t: number, j: string, k: string) => {
    setHasil(null)
    loadSiswa({ bulan: b, tahun: t, jenjangId: j || undefined, kelasId: k || undefined })
  }

  const selectedJenjang = jenjangList.find((j) => j.id === jenjangId) || null

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return siswaList
    return siswaList.filter(
      (s) =>
        s.nama.toLowerCase().includes(q) ||
        (s.kelasNama || "").toLowerCase().includes(q) ||
        (s.jenjangNama || "").toLowerCase().includes(q)
    )
  }, [siswaList, search])

  const defaultNominal = (s: SiswaUntukTagihanKhusus) => s.sppKhusus ?? s.tarifJenjang

  const handleToggle = (s: SiswaUntukTagihanKhusus) => {
    setHasil(null)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(s.id)) {
        next.delete(s.id)
      } else {
        next.add(s.id)
        setNominalById((prevNom) => {
          const base = defaultNominal(s)
          return {
            ...prevNom,
            [s.id]: base != null ? String(base) : (prevNom[s.id] ?? ""),
          }
        })
      }
      return next
    })
  }

  const setNominal = (id: string, value: string) => {
    setHasil(null)
    setNominalById((prev) => ({ ...prev, [id]: value }))
  }

  const applyAll = () => {
    const n = Number(applyAllNominal)
    if (!Number.isFinite(n) || n <= 0) {
      toast({
        variant: "destructive",
        title: "Nominal tidak valid",
        description: "Isi nominal potongan dengan angka lebih dari 0.",
      })
      return
    }
    const next: Record<string, string> = {}
    for (const id of selectedIds) next[id] = String(n)
    setNominalById((prev) => ({ ...prev, ...next }))
    toast({ title: "Nominal diterapkan ✅", description: `Nominal Rp ${n.toLocaleString("id-ID")} diterapkan ke ${selectedIds.size} siswa terpilih.` })
  }

  const handleGenerate = async () => {
    if (selectedIds.size === 0) {
      toast({ variant: "destructive", title: "Belum ada siswa dipilih", description: "Centang minimal 1 siswa yang mendapat potongan SPP." })
      return
    }

    const items: Array<{ siswaId: string; nominal: number }> = []
    const tanpaNominal: string[] = []
    for (const id of selectedIds) {
      const n = Number(nominalById[id])
      if (!Number.isFinite(n) || n <= 0) {
        const s = siswaList.find((x) => x.id === id)
        tanpaNominal.push(s?.nama || "Siswa")
        continue
      }
      items.push({ siswaId: id, nominal: n })
    }

    if (tanpaNominal.length > 0) {
      toast({
        variant: "destructive",
        title: "Nominal belum lengkap",
        description: `Isi nominal terlebih dahulu untuk: ${tanpaNominal.slice(0, 5).join(", ")}${tanpaNominal.length > 5 ? "..." : ""}`,
      })
      return
    }

    setGenerating(true)
    try {
      const result = await generateTagihanSppKhusus({
        bulan,
        tahun,
        items,
        simpanSebagaiSppKhusus,
        kirimEmail,
      })

      if (!result.success) {
        toast({ variant: "destructive", title: "Gagal Menerbitkan Tagihan", description: result.message })
        return
      }

      const data = result.data
      if (data) setHasil(data)
      toast({
        title: "Tagihan Potongan SPP Terbit! 🎯",
        description: result.message,
      })
      setSelectedIds(new Set())
      setNominalById({})
      setApplyAllNominal("")
      refetch()
    } catch {
      toast({ variant: "destructive", title: "Gagal Menerbitkan Tagihan", description: "Terjadi kesalahan server." })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Intro */}
      <Card className="rounded-3xl border-yellow-500/30 bg-gradient-to-br from-amber-50/80 to-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-yellow-100 text-yellow-700 flex items-center justify-center shrink-0">
              <BadgePercent className="h-5 w-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-800 leading-snug">
                Penerbitan Tagihan Khusus — Potongan / Beasiswa SPP
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Pilih siswa yang berhak mendapat potongan biaya SPP pada satu bulan tertentu, atur nominal
                tagihannya (bisa berbeda per siswa), lalu terbitkan. Tagihan yang sudah ada di bulan & tahun yang
                sama otomatis dilewati (tidak dobel).
              </p>
              <div className="flex flex-col gap-1.5 pt-1 text-xs text-slate-600">
                <p className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                  <span><strong>Pengiriman:</strong> &quot;Simpan sebagai SPP khusus&quot; menulis nominal potongan ke data siswa sehingga generate massal berikutnya otomatis memakainya.</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span><strong>Kirim email:</strong> email diteruskan ke email siswa &amp; orang tua/wali masing-masing (menggunakan Resend).</span>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form: periode & filter */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Bulan Tagihan</label>
              <select
                value={bulan}
                onChange={(e) => {
                  const b = Number(e.target.value)
                  setBulan(b)
                  handleFilter(b, tahun, jenjangId, kelasId)
                }}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold focus:ring-2 focus:ring-yellow-500"
              >
                {BULAN.map((b, i) => (
                  <option key={b} value={i + 1}>{b}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Tahun</label>
              <select
                value={tahun}
                onChange={(e) => {
                  const t = Number(e.target.value)
                  setTahun(t)
                  handleFilter(bulan, t, jenjangId, kelasId)
                }}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold focus:ring-2 focus:ring-yellow-500"
              >
                {[tahun, tahun + 1].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Jenjang</label>
              <select
                value={jenjangId}
                onChange={(e) => {
                  const j = e.target.value
                  setJenjangId(j)
                  setKelasId("")
                  handleFilter(bulan, tahun, j, "")
                }}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-yellow-500"
              >
                <option value="">— Semua Jenjang —</option>
                {jenjangList.map((j) => (
                  <option key={j.id} value={j.id}>{j.nama}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Kelas</label>
              <select
                value={kelasId}
                onChange={(e) => {
                  const k = e.target.value
                  setKelasId(k)
                  handleFilter(bulan, tahun, jenjangId, k)
                }}
                disabled={!jenjangId}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-yellow-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">— Semua Kelas —</option>
                {selectedJenjang?.kelas.map((k) => (
                  <option key={k.id} value={k.id}>
                    {selectedJenjang.nama} - {k.nama}
                    {k.jenisKelamin === "LAKI_LAKI" ? " (Ikhwan)" : k.jenisKelamin === "PEREMPUAN" ? " (Akhwat)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Cari Nama</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ketik nama santri..."
                  className="h-11 pl-9 rounded-xl text-sm"
                />
              </div>
            </div>
          </div>

          {/* Syarat & nomor rekening */}
          <div className="flex flex-col gap-2 text-xs text-slate-500 rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <p className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Mail className="h-3.5 w-3.5 text-emerald-600" />
              Pengiriman tagihan ke siswa dituju
            </p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Tagihan otomatis muncul di menu <strong>Tagihan SPP</strong> pada akun orang tua/wali.</li>
              <li>Opsional: <strong>email pemberitahuan</strong> dikirim ke email siswa &amp; orang tua/wali (ceklist di bawah).</li>
              <li>Saran tambahan untuk jangkauan lebih luas: kirim screenshot tagihan via <strong>WhatsApp</strong> (no. HP wali) atau <strong>WA Gateway</strong> — belum terpasang, bisa ditambahkan di kemudian hari.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Daftar siswa */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">Pilih Siswa Penerima Potongan</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              {bulan ? `${BULAN[bulan - 1]} ${tahun}` : ""} — {siswaLoading ? "memuat..." : `${filtered.length} siswa`} • Terpilih: {selectedIds.size}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
            {siswaLoading ? (
              <div className="p-10 text-center text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-yellow-500" />
                Memuat daftar siswa...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                Tidak ada siswa yang cocok dengan filter ini.
              </div>
            ) : (
              filtered.map((s) => {
                const isSel = selectedIds.has(s.id)
                return (
                  <div key={s.id} className={`p-4 sm:p-5 flex flex-col sm:flex-row gap-3 sm:items-center ${isSel ? "bg-yellow-50/70" : "hover:bg-slate-50/60"}`}>
                    <label className="flex items-start sm:items-center gap-3 flex-1 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => handleToggle(s)}
                        disabled={s.sudahAdaTagihan}
                        className="mt-1 sm:mt-0 h-4 w-4 rounded border-slate-300 text-yellow-500 focus:ring-yellow-500/20 disabled:opacity-40"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm">{s.nama}</span>
                          {s.sudahAdaTagihan && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                              Sudah ada tagihan
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {s.jenjangNama || "—"} {s.kelasNama ? `• Kelas ${s.kelasNama}` : ""}{" "}
                          {s.jenisKelamin === "LAKI_LAKI" ? "(Ikhwan)" : s.jenisKelamin === "PEREMPUAN" ? "(Akhwat)" : ""}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-3">
                          <span>Tarif jenjang: {s.tarifJenjang ? formatRp(s.tarifJenjang) : "—"}</span>
                          <span>SPP khusus kini: {s.sppKhusus ? formatRp(s.sppKhusus) : "—"}</span>
                        </div>
                      </div>
                    </label>

                    <div className="flex items-center gap-2 sm:justify-end shrink-0 pl-7 sm:pl-0">
                      <span className="text-[11px] font-semibold text-slate-500 w-auto whitespace-nowrap">Nominal tagihan (Rp)</span>
                      <Input
                        type="number"
                        min={1}
                        disabled={!isSel}
                        value={isSel ? (nominalById[s.id] ?? "") : ""}
                        onChange={(e) => setNominal(s.id, e.target.value)}
                        placeholder={!isSel ? "—" : defaultNominal(s) ? String(defaultNominal(s)) : "nominal"}
                        className="h-9 w-32 rounded-xl text-sm disabled:bg-slate-50 disabled:text-slate-300"
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Action bar */}
          {selectedIds.size > 0 && (
            <div className="p-4 sm:p-5 border-t border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl bg-yellow-50 border border-yellow-200 p-4">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-700 mb-1">Terapkan nominal yang sama ke semua terpilih</div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={applyAllNominal}
                      onChange={(e) => setApplyAllNominal(e.target.value)}
                      placeholder="Contoh: 300000"
                      className="h-10 rounded-xl text-sm max-w-[200px]"
                    />
                    <Button type="button" size="sm" onClick={applyAll} variant="outline" className="rounded-xl min-h-[40px] text-xs font-bold">
                      Terapkan
                    </Button>
                  </div>
                </div>
                <div className="text-sm shrink-0">
                  <span className="text-slate-500">Total terpilih: </span>
                  <span className="font-extrabold text-yellow-700">{selectedIds.size} siswa</span>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Penerima email: {selectedIds.size} {kirimEmail ? "siswa/ortu" : "(dimatikan)"}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simpanSebagaiSppKhusus}
                    onChange={(e) => setSimpanSebagaiSppKhusus(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-yellow-500 focus:ring-yellow-500/20"
                  />
                  Simpan sebagai SPP khusus berkelanjutan
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={kirimEmail}
                    onChange={(e) => setKirimEmail(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-yellow-500 focus:ring-yellow-500/20"
                  />
                  Kirim email pemberitahuan ke siswa &amp; orang tua/wali
                </label>
                <Button
                  onClick={handleGenerate}
                  disabled={generating || selectedIds.size === 0}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold h-12 px-8 rounded-xl min-h-[48px] shadow-md sm:ml-auto"
                >
                  {generating ? (
                    <><Loader2 className="h-5 w-5 animate-spin mr-2" />Menerbitkan...</>
                  ) : (
                    <><FileSpreadsheet className="h-5 w-5 mr-2" />Terbitkan Tagihan Potongan</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hasil generate */}
      {hasil && (
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Hasil Penerbitan — {BULAN[bulan - 1]} {tahun}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Dibuat: {hasil.totalDiproses} • Dilewati: {hasil.totalDilewati} • Email terkirim: {hasil.totalEmailTerkirim}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {hasil.rincian.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-600">
                    <tr>
                      <th className="p-3 pl-4">Siswa</th>
                      <th className="p-3">Nominal</th>
                      <th className="p-3 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {hasil.rincian.map((r) => (
                      <tr key={r.siswaId} className="hover:bg-slate-50/80">
                        <td className="p-3 pl-4 font-semibold text-slate-800">{r.nama}</td>
                        <td className="p-3 font-bold text-yellow-700">{formatRp(r.nominal)}</td>
                        <td className="p-3 pr-4">
                          {r.status === "DIBUAT" && (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">Tagihan dibuat</span>
                          )}
                          {r.status === "SUDAH_ADA" && (
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">Sudah ada (dilewati)</span>
                          )}
                          {r.status === "TIDAK_DITEMUKAN" && (
                            <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg">Siswa tidak ditemukan</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Tidak ada rincian.</p>
            )}
            <div className="mt-4 flex items-start gap-2 text-xs text-slate-500 bg-sky-50 border border-sky-200 rounded-xl p-3">
              <UserCheck className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
              <span>
                Tagihan kini tampil di menu <strong>Tagihan SPP</strong> pada akun orang tua/wali masing-masing siswa.
                {kirimEmail && " Email pemberitahuan telah dikirim (fire-and-forget; jika RESEND belum dikonfigurasi, email diabaikan oleh sistem)."}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}