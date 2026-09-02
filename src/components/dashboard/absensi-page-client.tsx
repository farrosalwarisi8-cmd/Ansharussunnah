"use client"



import * as React from "react"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { Role } from "@prisma/client"
import { inputAbsensiBulk, inputAbsensiSingle, editAbsensi, getRiwayatKehadiranSiswa, getRiwayatKehadiranAnak, getSiswaByKelas, getRekapKehadiranKelas } from "@/actions/absensi"
import { getDaftarKelasYangDiajarGuru } from "@/actions/guru-kelas"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Check, UserCheck, Save, Loader2 } from "lucide-react"

type StatusAbsensiType = "HADIR" | "IZIN" | "SAKIT" | "ALPHA"
type SiswaItem = {
  siswaId: string
  nama: string
  nisn?: string | null
}
type KelasItem = {
  kelasId: string
  namaKelas: string
  jenjang: string
  mataPelajaranId: string
  jumlahSiswa: number
}
type RiwayatItem = {
  id: string
  tanggal: string | Date
  status: string
  keterangan?: string | null
  kelas?: string
  periode?: string
}
type RiwayatData = {
  nama?: string
  namaSiswa?: string
  total: number
  ringkasan: { HADIR: number; SAKIT: number; IZIN: number; ALPHA: number }
  riwayat: RiwayatItem[]
}

export default function AbsensiPage() {
  const { user, selectedChild } = useDashboard()
  useToast()

  const isTeacher = user.role === Role.GURU || user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_AKADEMIK
  const isStudent = user.role === Role.SISWA
  const isParent = user.role === Role.ORANG_TUA

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={isTeacher ? "Presensi & Absensi Kelas" : "Riwayat Kehadiran"}
        subtitle={
          isTeacher
            ? "Input dan rekap kehadiran santri per kelas secara cepat & akurat."
            : "Pantau persentase kehadiran dan riwayat absensi harian."
        }
      />

      {isParent && <ChildSelector />}

      {isTeacher && <GuruAbsensiView />}
      {isStudent && <SiswaAbsensiView />}
      {isParent && selectedChild && <OrangTuaAbsensiView selectedChild={selectedChild} />}
      {isParent && !selectedChild && (
        <EmptyState
          title="Pilih Anak Terlebih Dahulu"
          description="Gunakan selector di atas untuk memilih anak yang ingin dipantau."
        />
      )}
    </div>
  )
}

/* ========================================================================= */
/* 1. GURU ABSENSI VIEW (FAST TOUCH TOGGLE)                                  */
/* ========================================================================= */
function GuruAbsensiView() {
  const { toast } = useToast()

  // Kelas data
  const [kelasList, setKelasList] = React.useState<KelasItem[]>([])
  const [selectedKelasId, setSelectedKelasId] = React.useState<string>("")
  const [loadingKelas, setLoadingKelas] = React.useState(true)

  // Siswa data
  const [students, setStudents] = React.useState<SiswaItem[]>([])
  const [loadingSiswa, setLoadingSiswa] = React.useState(false)

  // Attendance state
  const [attendance, setAttendance] = React.useState<Record<string, StatusAbsensiType>>({})
  const [selectedTanggal, setSelectedTanggal] = React.useState(
    new Date().toISOString().split("T")[0]
  )
  const [saving, setSaving] = React.useState(false)

  // Rekap state
  const [showRekap, setShowRekap] = React.useState(false)
  const [rekapData, setRekapData] = React.useState<Array<{
    siswaId: string
    nama: string
    nisn: string
    totalHari: number
    hadir: number
    sakit: number
    izin: number
    alpha: number
    persentaseKehadiran: string
  }> | null>(null)
  const [loadingRekap, setLoadingRekap] = React.useState(false)
  const [periodeAjaranId, setPeriodeAjaranId] = React.useState("periode-aktif")

  const handleLoadRekap = async () => {
    if (!selectedKelasId) return
    setLoadingRekap(true)
    try {
      const result = await getRekapKehadiranKelas({
        kelasId: selectedKelasId,
        periodeAjaranId,
      })
      if (result.success && result.data) {
        const data = result.data as { rekap: typeof rekapData }
        setRekapData(data.rekap)
        setShowRekap(true)
      } else {
        toast({ variant: "destructive", title: "Gagal", description: result.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal memuat rekap kehadiran." })
    } finally {
      setLoadingRekap(false)
    }
  }

  // Fetch guru's kelas list on mount
  React.useEffect(() => {
    async function fetchKelas() {
      setLoadingKelas(true)
      try {
        const result = await getDaftarKelasYangDiajarGuru()
        if (result.success && result.data) {
          const data = result.data as KelasItem[]
          setKelasList(data)
          if (data.length > 0) {
            setSelectedKelasId(data[0].kelasId)
          }
        }
      } catch {
        // Silently fail — will show empty state
      } finally {
        setLoadingKelas(false)
      }
    }
    fetchKelas()
  }, [])

  // Fetch siswa when kelas changes
  React.useEffect(() => {
    if (!selectedKelasId) return
    async function fetchSiswa() {
      setLoadingSiswa(true)
      try {
        const result = await getSiswaByKelas(selectedKelasId)
        if (result.success && result.data) {
          const data = result.data as SiswaItem[]
          setStudents(data)
          // Initialize all attendance as HADIR
          const initial: Record<string, StatusAbsensiType> = {}
          data.forEach((s) => { initial[s.siswaId] = "HADIR" })
          setAttendance(initial)
        } else {
          setStudents([])
        }
      } catch {
        setStudents([])
      } finally {
        setLoadingSiswa(false)
      }
    }
    fetchSiswa()
  }, [selectedKelasId])

  const setAllStatus = (status: StatusAbsensiType) => {
    const updated: Record<string, StatusAbsensiType> = {}
    students.forEach((s) => { updated[s.siswaId] = status })
    setAttendance(updated)
    toast({
      title: `Semua Diatur: ${status}`,
      description: "Status seluruh santri berhasil diubah serentak.",
    })
  }

  const setSingleStatus = (siswaId: string, status: StatusAbsensiType) => {
    setAttendance((prev) => ({ ...prev, [siswaId]: status }))
  }

  const handleSaveBulk = async () => {
    setSaving(true)
    try {
      const result = await inputAbsensiBulk({
        kelasId: selectedKelasId,
        periodeAjaranId: "periode-aktif",
        tanggal: selectedTanggal,
        absensi: students.map((s) => ({
          siswaId: s.siswaId,
          status: attendance[s.siswaId] || "HADIR",
        })),
      })

      if (result.success) {
        toast({
          title: "Absensi Berhasil Disimpan! 🎉",
          description: `Data presensi tanggal ${selectedTanggal} tersimpan ke database.`,
        })
      } else {
        toast({
          variant: "destructive",
          title: "Gagal Menyimpan",
          description: result.message || "Terjadi kesalahan pada server.",
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: "Terjadi kesalahan saat menyimpan absensi.",
      })
    } finally {
      setSaving(false)
    }
  }

  const stats = {
    hadir: Object.values(attendance).filter((s) => s === "HADIR").length,
    izin: Object.values(attendance).filter((s) => s === "IZIN").length,
    sakit: Object.values(attendance).filter((s) => s === "SAKIT").length,
    alpha: Object.values(attendance).filter((s) => s === "ALPHA").length,
  }

  if (loadingKelas) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        <span className="ml-3 text-sm text-slate-500">Memuat daftar kelas...</span>
      </div>
    )
  }

  if (kelasList.length === 0) {
    return (
      <EmptyState
        title="Belum Ada Kelas"
        description="Anda belum ditugaskan mengajar di kelas manapun."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter Card: Kelas & Tanggal */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full sm:w-auto">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                Pilih Kelas
              </label>
              <select
                value={selectedKelasId}
                onChange={(e) => setSelectedKelasId(e.target.value)}
                className="w-full sm:w-56 h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                {kelasList.map((k) => (
                  <option key={k.kelasId} value={k.kelasId}>
                    {k.namaKelas} ({k.jumlahSiswa} siswa)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                Tanggal Presensi
              </label>
              <input
                type="date"
                value={selectedTanggal}
                onChange={(e) => setSelectedTanggal(e.target.value)}
                className="w-full sm:w-48 h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 sm:pt-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAllStatus("HADIR")}
              className="text-xs font-bold text-yellow-600 hover:bg-yellow-50 border-yellow-200 rounded-xl h-11 min-h-[44px] flex-1 sm:flex-initial"
            >
              <UserCheck className="h-4 w-4 mr-1.5" />
              Set Semua Hadir
            </Button>              <Button
                type="button"
                variant="outline"
                onClick={handleLoadRekap}
                disabled={loadingRekap || !selectedKelasId}
                className="text-xs font-bold text-teal-700 hover:bg-teal-50 border-teal-200 rounded-xl h-11 min-h-[44px] flex-1 sm:flex-initial"
              >
                {loadingRekap ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Lihat Rekap
              </Button>
              <Button
                type="button"
                disabled={saving || loadingSiswa || students.length === 0}
                onClick={handleSaveBulk}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl h-11 min-h-[44px] px-6 flex-1 sm:flex-initial shadow-md"
              >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Simpan Presensi
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading Siswa */}
      {loadingSiswa && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
          <span className="ml-3 text-sm text-slate-500">Memuat daftar siswa...</span>
        </div>
      )}

      {/* Summary KPI Strip */}
      {!loadingSiswa && students.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-2 sm:gap-4">
            <div className="p-3 rounded-2xl bg-yellow-50 border border-yellow-200 text-center">
              <span className="text-[11px] font-bold text-yellow-700 uppercase block">Hadir</span>
              <span className="text-xl sm:text-2xl font-black text-yellow-600">{stats.hadir}</span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
              <span className="text-[11px] font-bold text-amber-800 uppercase block">Izin</span>
              <span className="text-xl sm:text-2xl font-black text-amber-700">{stats.izin}</span>
            </div>
            <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-center">
              <span className="text-[11px] font-bold text-sky-800 uppercase block">Sakit</span>
              <span className="text-xl sm:text-2xl font-black text-sky-700">{stats.sakit}</span>
            </div>
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-center">
              <span className="text-[11px] font-bold text-rose-800 uppercase block">Alpa</span>
              <span className="text-xl sm:text-2xl font-black text-rose-700">{stats.alpha}</span>
            </div>
          </div>

          {/* Touch-First Attendance List */}
          <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-800">
                  Daftar Santri ({students.length} Orang)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Tekan tombol status untuk mengganti kehadiran santri
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-3 sm:p-5 space-y-2.5">
              {students.map((student, idx) => (
                <div
                  key={student.siswaId}
                  className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-xs font-bold text-slate-400 text-center">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-sm text-slate-800 leading-tight">
                        {student.nama}
                      </div>
                      {student.nisn && (
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          NISN: {student.nisn}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile Fast Toggle Button Bar */}
                  <div className="grid grid-cols-4 gap-1.5 sm:flex sm:items-center sm:gap-2 shrink-0">
                    {(
                      [
                        { key: "HADIR" as const, label: "Hadir", color: "bg-yellow-500 text-white border-yellow-500 font-bold" },
                        { key: "IZIN" as const, label: "Izin", color: "bg-amber-500 text-white border-amber-500 font-bold" },
                        { key: "SAKIT" as const, label: "Sakit", color: "bg-sky-600 text-white border-sky-600 font-bold" },
                        { key: "ALPHA" as const, label: "Alpa", color: "bg-rose-600 text-white border-rose-600 font-bold" },
                      ]
                    ).map((btn) => {
                      const isSelected = (attendance[student.siswaId] || "HADIR") === btn.key
                      return (
                        <button
                          key={btn.key}
                          type="button"
                          onClick={() => setSingleStatus(student.siswaId, btn.key)}
                          className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs font-semibold border transition-all touch-manipulation flex items-center justify-center ${
                            isSelected
                              ? `${btn.color} shadow-sm scale-[1.02]`
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5 mr-1 shrink-0" />}
                          <span>{btn.label}</span>
                        </button>
                      )
                    }                    )}

                    {/* Individual Save Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const result = await inputAbsensiSingle({
                            siswaId: student.siswaId,
                            kelasId: selectedKelasId,
                            periodeAjaranId: "periode-aktif",
                            tanggal: selectedTanggal,
                            status: attendance[student.siswaId] || "HADIR",
                          })
                          if (result.success) {
                            toast({ title: "Tersimpan", description: `${student.nama}: ${attendance[student.siswaId] || "HADIR"}` })
                          } else {
                            toast({ variant: "destructive", title: "Gagal", description: result.message })
                          }
                        } catch {
                          toast({ variant: "destructive", title: "Gagal", description: "Gagal menyimpan absensi." })
                        }
                      }}
                      className="min-h-[44px] min-w-[44px] px-2 text-[10px] font-bold rounded-lg bg-yellow-50 text-yellow-600 border-yellow-200 hover:bg-yellow-100"
                    >
                      Simpan
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Rekap Kehadiran Section */}
          {showRekap && (
            <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <CardHeader className="p-5 pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-slate-800">
                  Rekap Kehadiran Kelas
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Persentase kehadiran per siswa dalam periode yang dipilih
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {rekapData && rekapData.length > 0 ? (
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-600">
                        <tr>
                          <th className="p-4 pl-6">Nama Santri</th>
                          <th className="p-4 text-center">Total Hari</th>
                          <th className="p-4 text-center">Hadir</th>
                          <th className="p-4 text-center">Izin</th>
                          <th className="p-4 text-center">Sakit</th>
                          <th className="p-4 text-center">Alpa</th>
                          <th className="p-4 text-center pr-6">Persentase</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rekapData.map((r) => (
                          <tr key={r.siswaId} className="hover:bg-slate-50/80">
                            <td className="p-4 pl-6 font-bold text-slate-800">{r.nama}</td>
                            <td className="p-4 text-center text-slate-600">{r.totalHari}</td>
                            <td className="p-4 text-center text-yellow-600 font-semibold">{r.hadir}</td>
                            <td className="p-4 text-center text-amber-700 font-semibold">{r.izin}</td>
                            <td className="p-4 text-center text-sky-700 font-semibold">{r.sakit}</td>
                            <td className="p-4 text-center text-rose-700 font-semibold">{r.alpha}</td>
                            <td className="p-4 text-center pr-6">
                              <span className="font-extrabold text-sm text-yellow-600 bg-yellow-50 px-2.5 py-1 rounded-lg border border-yellow-200">
                                {r.persentaseKehadiran}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Belum ada data kehadiran untuk periode ini.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

/* ========================================================================= */
/* 2. SISWA ABSENSI VIEW (READ ONLY, REAL DATA)                              */
/* ========================================================================= */
function SiswaAbsensiView() {
  const [riwayatData, setRiwayatData] = React.useState<RiwayatData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchRiwayat() {
      setLoading(true)
      setError(null)
      try {
        const result = await getRiwayatKehadiranSiswa()
        if (result.success && result.data) {
          setRiwayatData(result.data as RiwayatData)
        } else {
          setError(result.message || "Gagal memuat riwayat kehadiran")
        }
      } catch {
        setError("Gagal memuat riwayat kehadiran")
      } finally {
        setLoading(false)
      }
    }
    fetchRiwayat()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        <span className="ml-3 text-sm text-slate-500">Memuat riwayat kehadiran...</span>
      </div>
    )
  }

  if (error) {
    return <EmptyState title="Gagal Memuat Data" description={error} />
  }

  if (!riwayatData || riwayatData.total === 0) {
    return <EmptyState title="Belum Ada Data Kehadiran" description="Belum ada catatan presensi untuk periode ini." />
  }

  const persentase = riwayatData.total > 0
    ? ((riwayatData.ringkasan.HADIR / riwayatData.total) * 100).toFixed(1)
    : "0"

  return (
    <div className="space-y-6">
      {/* Kehadiran KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 text-center">
            <span className="text-xs text-slate-500 font-semibold uppercase">Persentase Hadir</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-1">{persentase}%</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 text-center">
            <span className="text-xs text-slate-500 font-semibold uppercase">Total Hadir</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-1">{riwayatData.ringkasan.HADIR} Hari</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 text-center">
            <span className="text-xs text-slate-500 font-semibold uppercase">Izin / Sakit</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-1">{riwayatData.ringkasan.IZIN + riwayatData.ringkasan.SAKIT} Hari</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 text-center">
            <span className="text-xs text-slate-500 font-semibold uppercase">Alpa</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-1">{riwayatData.ringkasan.ALPHA} Hari</div>
          </CardContent>
        </Card>
      </div>

      {/* Riwayat Absensi Table */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-800">
            Log Riwayat Kehadiran Harian
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Catatan presensi yang diinput oleh wali kelas &amp; pengajar
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 divide-y divide-slate-100">
          {riwayatData.riwayat.map((log) => (
            <div key={log.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="font-bold text-slate-800 text-sm">
                  {new Date(log.tanggal).toLocaleDateString("id-ID")}
                </div>
                {log.periode && (
                  <div className="text-xs text-slate-500">{log.periode}</div>
                )}
                {log.keterangan && <div className="text-xs text-slate-400 italic">{log.keterangan}</div>}
              </div>
              <StatusBadge status={log.status as "HADIR" | "IZIN" | "SAKIT" | "ALPHA"} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

/* ========================================================================= */
/* 3. ORANG TUA ABSENSI VIEW (READ ONLY, REAL DATA)                          */
/* ========================================================================= */
function OrangTuaAbsensiView({ selectedChild }: { selectedChild: { id: string; nama: string } }) {
  const [riwayatData, setRiwayatData] = React.useState<RiwayatData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchRiwayat() {
      setLoading(true)
      setError(null)
      try {
        const result = await getRiwayatKehadiranAnak({ siswaId: selectedChild.id })
        if (result.success && result.data) {
          setRiwayatData(result.data as RiwayatData)
        } else {
          setError(result.message || "Gagal memuat riwayat kehadiran anak")
        }
      } catch {
        setError("Gagal memuat riwayat kehadiran anak")
      } finally {
        setLoading(false)
      }
    }
    fetchRiwayat()
  }, [selectedChild.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        <span className="ml-3 text-sm text-slate-500">Memuat riwayat kehadiran...</span>
      </div>
    )
  }

  if (error) {
    return <EmptyState title="Gagal Memuat Data" description={error} />
  }

  if (!riwayatData || riwayatData.total === 0) {
    return <EmptyState title="Belum Ada Data Kehadiran" description="Belum ada catatan presensi untuk anak ini." />
  }

  const persentase = riwayatData.total > 0
    ? ((riwayatData.ringkasan.HADIR / riwayatData.total) * 100).toFixed(1)
    : "0"

  return (
    <div className="space-y-6">
      {/* Kehadiran KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 text-center">
            <span className="text-xs text-slate-500 font-semibold uppercase">Persentase Hadir</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-1">{persentase}%</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 text-center">
            <span className="text-xs text-slate-500 font-semibold uppercase">Total Hadir</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-1">{riwayatData.ringkasan.HADIR} Hari</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 text-center">
            <span className="text-xs text-slate-500 font-semibold uppercase">Izin / Sakit</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-1">{riwayatData.ringkasan.IZIN + riwayatData.ringkasan.SAKIT} Hari</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 text-center">
            <span className="text-xs text-slate-500 font-semibold uppercase">Alpa</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-1">{riwayatData.ringkasan.ALPHA} Hari</div>
          </CardContent>
        </Card>
      </div>

      {/* Riwayat Absensi Table */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-800">
            Log Riwayat Kehadiran: {selectedChild.nama}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Catatan presensi yang diinput oleh wali kelas &amp; pengajar
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 divide-y divide-slate-100">
          {riwayatData.riwayat.map((log) => (
            <div key={log.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="font-bold text-slate-800 text-sm">
                  {new Date(log.tanggal).toLocaleDateString("id-ID")}
                </div>
                {log.periode && (
                  <div className="text-xs text-slate-500">{log.periode}</div>
                )}
                {log.keterangan && <div className="text-xs text-slate-400 italic">{log.keterangan}</div>}
              </div>
              <StatusBadge status={log.status as "HADIR" | "IZIN" | "SAKIT" | "ALPHA"} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
