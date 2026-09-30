"use client"

import * as React from "react"
import { inputAbsensiBulk, getSiswaByKelas } from "@/actions/absensi"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Save, UserCheck } from "lucide-react"
import dynamic from "next/dynamic"
import { toDateLocalValue } from "@/lib/datetime-local"

const Dialog = dynamic(() => import("@/components/ui/dialog").then((m) => m.Dialog), { ssr: false })
const DialogContent = dynamic(() => import("@/components/ui/dialog").then((m) => m.DialogContent), { ssr: false })
const DialogHeader = dynamic(() => import("@/components/ui/dialog").then((m) => m.DialogHeader), { ssr: false })
const DialogTitle = dynamic(() => import("@/components/ui/dialog").then((m) => m.DialogTitle), { ssr: false })
const DialogFooter = dynamic(() => import("@/components/ui/dialog").then((m) => m.DialogFooter), { ssr: false })

type StatusAbsensiType = "HADIR" | "IZIN" | "SAKIT" | "ALPHA"

type SiswaItem = {
  siswaId: string
  nama: string
  nisn?: string | null
  jenisKelamin?: "LAKI_LAKI" | "PEREMPUAN" | null
}

interface ModalAbsensiMapelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kelasId: string
  namaKelas?: string
  mataPelajaran: string
  mataPelajaranId?: string | null
  periodeAjaranId: string
  targetGender?: "LAKI_LAKI" | "PEREMPUAN" | null
}

export function ModalAbsensiMapel({
  open,
  onOpenChange,
  kelasId,
  namaKelas,
  mataPelajaran,
  mataPelajaranId,
  periodeAjaranId,
  targetGender,
}: ModalAbsensiMapelProps) {
  const { toast } = useToast()
  const [tanggal, setTanggal] = React.useState(toDateLocalValue(new Date()))
  const [students, setStudents] = React.useState<SiswaItem[]>([])
  const [loadingSiswa, setLoadingSiswa] = React.useState(false)
  const [attendance, setAttendance] = React.useState<Record<string, StatusAbsensiType>>({})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open || !kelasId) return

    async function fetchSiswa() {
      setLoadingSiswa(true)
      try {
        const res = await getSiswaByKelas(kelasId)
        if (res.success && res.data) {
          let list = res.data as SiswaItem[]
          if (targetGender) {
            list = list.filter((s) => s.jenisKelamin === targetGender)
          }
          setStudents(list)
          const initial: Record<string, StatusAbsensiType> = {}
          list.forEach((s) => {
            initial[s.siswaId] = "HADIR"
          })
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
  }, [open, kelasId, targetGender])

  const setAllStatus = (status: StatusAbsensiType) => {
    const updated: Record<string, StatusAbsensiType> = {}
    students.forEach((s) => {
      updated[s.siswaId] = status
    })
    setAttendance(updated)
  }

  const setSingleStatus = (siswaId: string, status: StatusAbsensiType) => {
    setAttendance((prev) => ({ ...prev, [siswaId]: status }))
  }

  const handleSave = async () => {
    if (students.length === 0) return
    setSaving(true)
    try {
      const res = await inputAbsensiBulk({
        kelasId,
        periodeAjaranId,
        mataPelajaran,
        mataPelajaranId: mataPelajaranId || undefined,
        tanggal,
        absensi: students.map((s) => ({
          siswaId: s.siswaId,
          status: attendance[s.siswaId] || "HADIR",
        })),
      })

      if (res.success) {
        toast({
          title: "Presensi Berhasil Disimpan! 🎉",
          description: `Presensi mapel ${mataPelajaran} pada tanggal ${tanggal} tersimpan.`,
        })
        onOpenChange(false)
      } else {
        toast({
          variant: "destructive",
          title: "Gagal Menyimpan",
          description: res.message || "Terjadi kesalahan.",
        })
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: "Terjadi kesalahan saat menyimpan presensi.",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
              {mataPelajaran}
            </span>
            {namaKelas && (
              <span className="text-xs font-semibold text-slate-500">
                {namaKelas}
              </span>
            )}
          </div>
          <DialogTitle className="text-lg font-bold text-slate-800">
            Input Presensi Mapel: {mataPelajaran}
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Catat kehadiran santri untuk sesi materi/pembelajaran mata pelajaran ini.
          </p>
        </DialogHeader>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Controls: Tanggal & Quick actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 uppercase">
                Tanggal:
              </label>
              <Input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="h-9 w-auto text-xs font-semibold rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAllStatus("HADIR")}
                className="text-xs font-bold text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border-yellow-200 rounded-xl h-9"
              >
                <UserCheck className="h-3.5 w-3.5 mr-1" />
                Semua Hadir
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl bg-yellow-50/60 border border-yellow-100 text-center">
              <span className="text-[10px] font-bold text-yellow-700 uppercase block">Hadir</span>
              <span className="text-lg font-extrabold text-yellow-700">{stats.hadir}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 text-center">
              <span className="text-[10px] font-bold text-blue-700 uppercase block">Izin</span>
              <span className="text-lg font-extrabold text-blue-700">{stats.izin}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100 text-center">
              <span className="text-[10px] font-bold text-amber-700 uppercase block">Sakit</span>
              <span className="text-lg font-extrabold text-amber-700">{stats.sakit}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100 text-center">
              <span className="text-[10px] font-bold text-rose-700 uppercase block">Alpha</span>
              <span className="text-lg font-extrabold text-rose-700">{stats.alpha}</span>
            </div>
          </div>

          {/* Student list */}
          {loadingSiswa ? (
            <div className="flex items-center justify-center p-8 text-slate-500 text-xs">
              <Loader2 className="h-5 w-5 animate-spin mr-2 text-yellow-600" />
              Memuat daftar santri...
            </div>
          ) : students.length === 0 ? (
            <div className="text-center p-6 text-xs text-slate-400">
              Tidak ada santri di kelas ini.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
              {students.map((s, idx) => {
                const currentStatus = attendance[s.siswaId] || "HADIR"
                return (
                  <div
                    key={s.siswaId}
                    className="p-3 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-800 truncate">
                        {idx + 1}. {s.nama}
                      </div>
                      {s.nisn && (
                        <div className="text-[11px] text-slate-400">
                          NISN: {s.nisn}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {(["HADIR", "IZIN", "SAKIT", "ALPHA"] as StatusAbsensiType[]).map((st) => {
                        const isSelected = currentStatus === st
                        let activeClass = ""
                        if (isSelected) {
                          if (st === "HADIR") activeClass = "bg-yellow-500 text-white font-bold shadow-sm"
                          else if (st === "IZIN") activeClass = "bg-blue-600 text-white font-bold shadow-sm"
                          else if (st === "SAKIT") activeClass = "bg-amber-500 text-white font-bold shadow-sm"
                          else if (st === "ALPHA") activeClass = "bg-rose-600 text-white font-bold shadow-sm"
                        } else {
                          activeClass = "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }

                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setSingleStatus(s.siswaId, st)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] transition-all ${activeClass}`}
                          >
                            {st === "HADIR" ? "H" : st === "IZIN" ? "I" : st === "SAKIT" ? "S" : "A"}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs font-semibold"
          >
            Batal
          </Button>

          <Button
            type="button"
            disabled={saving || loadingSiswa || students.length === 0}
            onClick={handleSave}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl text-xs px-5 shadow-sm"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Simpan Presensi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
