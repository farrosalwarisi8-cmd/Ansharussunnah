"use client"



import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  siswaManualSchema,
  type SiswaManualFormValues,
} from "@/lib/validations/siswa-manual"
import {
  createSiswaManual,
  resetPasswordSiswaManual,
  resetPasswordOrangTuaManual,
  getDaftarSiswaManual,
  getKelasList,
} from "@/actions/siswa-manual"
import { useToast } from "@/hooks/use-toast"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import dynamic from "next/dynamic"
const Dialog = dynamic(() => import("@/components/ui/dialog").then(m => m.Dialog), { ssr: false })
const DialogContent = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogContent), { ssr: false })
const DialogHeader = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogHeader), { ssr: false })
const DialogTitle = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogTitle), { ssr: false })
const DialogFooter = dynamic(() => import("@/components/ui/dialog").then(m => m.DialogFooter), { ssr: false })
const ConfirmDialog = dynamic(() => import("@/components/ui/confirm-dialog").then(m => m.ConfirmDialog), { ssr: false })
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Plus,
  Loader2,
  User,
  Users,
  Globe,
  School,
  Key,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Search,
  UserCheck,
} from "lucide-react"

// ============================================
// STEP DEFINITIONS
// ============================================

const STEPS = [
  { id: 1, label: "Data Siswa", icon: User },
  { id: 2, label: "Orang Tua & Wali", icon: Users },
  { id: 3, label: "Data Tambahan", icon: Globe },
  { id: 4, label: "Kelas Tujuan", icon: School },
  { id: 5, label: "Password", icon: Key },
] as const

// ============================================
// TYPES
// ============================================

type SiswaListItem = {
  id: string
  userId: string
  nama: string
  email: string
  nisn: string | null
  nis: string | null
  kelasNama: string | null
  jenjangNama: string | null
  aktif: boolean
  createdAt: string
  orangTua: Array<{
    id: string
    userId: string
    nama: string
    email: string
    noHp: string | null
  }>
}

type KelasItem = {
  id: string
  nama: string
  jenjangNama: string
  kapasitas: number
  jumlahSiswa: number
}

type PasswordDisplay = {
  passwordSiswa?: string
  passwordOrangTua?: string
  namaSiswa: string
  namaOrangTua?: string
}

// ============================================
// CARD-BASED RADIO BUTTON (Mobile-friendly)
// ============================================

function CardRadioGroup({
  options,
  value,
  onChange,
  name,
}: {
  options: Array<{ value: string; label: string }>
  value?: string
  onChange: (val: string) => void
  name: string
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={
            "relative flex items-center justify-center rounded-xl border-2 p-3 text-center " +
            "transition-all duration-200 cursor-pointer min-h-[48px] " +
            (value === opt.value
              ? "border-primary bg-primary/5 text-primary shadow-sm"
              : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-accent")
          }
          aria-checked={value === opt.value}
          role="radio"
          name={name}
        >
          <span className="text-sm font-medium">{opt.label}</span>
          {value === opt.value && (
            <div className="absolute top-1.5 right-1.5">
              <div className="bg-primary text-primary-foreground rounded-full p-0.5">
                <Check className="h-3 w-3" />
              </div>
            </div>
          )}
        </button>
      ))}
    </div>
  )
}

// ============================================
// NIK INPUT WITH DIGIT COUNTER
// ============================================

function NikInput({
  id,
  label,
  value,
  onChange,
  error,
  required = false,
}: {
  id: string
  label: string
  value?: string
  onChange: (val: string) => void
  error?: string
  required?: boolean
}) {
  const currentValue = value || ""
  const digitCount = currentValue.replace(/\D/g, "").length

  return (
    <div>
      <Label htmlFor={id}>
        {label}{" "}
        {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          placeholder="16 digit angka"
          maxLength={16}
          value={currentValue}
          onChange={(e) => {
            const filtered = e.target.value.replace(/\D/g, "").slice(0, 16)
            onChange(filtered)
          }}
          className={error ? "border-destructive focus-visible:ring-destructive" : ""}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          <span className={digitCount === 16 ? "text-yellow-500 font-medium" : ""}>
            {digitCount}
          </span>
          /16
        </div>
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  )
}

// ============================================
// ANIMATED FIELD WRAPPER
// ============================================

function AnimatedField({
  show,
  children,
}: {
  show: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={
        "overflow-hidden transition-all duration-300 ease-in-out " +
        (show ? "max-h-[500px] opacity-100 mt-4" : "max-h-0 opacity-0 mt-0")
      }
    >
      {children}
    </div>
  )
}

// ============================================
// COPY BUTTON
// ============================================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const textarea = document.createElement("textarea")
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-yellow-500" />
          Tersalin!
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Salin
        </>
      )}
    </button>
  )
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function KelolaSiswaPage() {
  const { toast } = useToast()

  // Data state
  const [siswaList, setSiswaList] = React.useState<SiswaListItem[]>([])
  const [kelasList, setKelasList] = React.useState<KelasItem[]>([])
  const [loadingData, setLoadingData] = React.useState(true)
  const [filterKelas, setFilterKelas] = React.useState<string>("ALL")
  const [searchQuery, setSearchQuery] = React.useState("")

  // Modal state
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [currentStep, setCurrentStep] = React.useState(1)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  // Password display state
  const [passwordDisplay, setPasswordDisplay] = React.useState<PasswordDisplay | null>(null)

  // Reset password state
  const [resetConfirm, setResetConfirm] = React.useState<{
    open: boolean
    userId: string
    nama: string
    type: "SISWA" | "ORANG_TUA"
  }>({ open: false, userId: "", nama: "", type: "SISWA" })
  const [resetLoading, setResetLoading] = React.useState(false)

  // Available kelas based on selected jenjang (not used directly here, kelasId is direct)
  const [availableKelas, setAvailableKelas] = React.useState<KelasItem[]>([])

  // Form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    reset,
    formState: { errors },
  } = useForm<SiswaManualFormValues>({
    resolver: zodResolver(siswaManualSchema),
    defaultValues: {
      jenisKelamin: undefined,
      kelasId: "",
      kewarganegaraan: "WNI",
      passwordManual: "",
      emailSiswa: "",
    },
  })

  const statusAyah = watch("statusAyahKandung")
  const statusIbu = watch("statusIbuKandung")
  const statusWali = watch("statusWali")
  const kewarganegaraan = watch("kewarganegaraan")
  const nikAyahValue = watch("nikAyah")
  const nikIbuValue = watch("nikIbu")
  const selectedKelasId = watch("kelasId")

  // Load data on mount
  React.useEffect(() => {
    async function loadData() {
      setLoadingData(true)
      try {
        const [siswaRes, kelasRes] = await Promise.all([
          getDaftarSiswaManual(),
          getKelasList(),
        ])
        if (siswaRes.success && siswaRes.data) {
          setSiswaList(siswaRes.data as unknown as SiswaListItem[])
        }
        if (kelasRes.success && kelasRes.data) {
          setKelasList(kelasRes.data)
          setAvailableKelas(kelasRes.data)
        }
      } catch {
        toast({ title: "Gagal memuat data", description: "Terjadi kesalahan saat memuat data siswa." })
      } finally {
        setLoadingData(false)
      }
    }
    loadData()
  }, [toast])

  // Step validation fields
  const stepFields: Record<number, (keyof SiswaManualFormValues)[]> = {
    1: ["namaLengkap", "tempatLahir", "tanggalLahir", "jenisKelamin", "alamatSiswa"],
    2: ["namaOrangTua", "emailOrangTua", "noHpOrangTua"],
    3: [],
    4: ["kelasId"],
    5: [],
  }

  const validateStep = async (step: number): Promise<boolean> => {
    const fields = stepFields[step]
    if (!fields || fields.length === 0) return true
    const valid = await trigger(fields)
    return valid
  }

  const goToNextStep = async () => {
    const valid = await validateStep(currentStep)
    if (valid && currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const goToPrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const openAddModal = () => {
    reset()
    setCurrentStep(1)
    setServerError(null)
    setIsAddOpen(true)
  }

  const onSubmit = async (data: SiswaManualFormValues) => {
    setIsSubmitting(true)
    setServerError(null)

    try {
      const result = await createSiswaManual(data)

      if (result.success && result.data) {
        setIsAddOpen(false)
        reset()

        // Tampilkan password
        setPasswordDisplay({
          passwordSiswa: result.data.passwordSiswa,
          passwordOrangTua: result.data.passwordOrangTua,
          namaSiswa: data.namaLengkap,
          namaOrangTua: data.namaOrangTua,
        })

        // Refresh data
        const siswaRes = await getDaftarSiswaManual()
        if (siswaRes.success && siswaRes.data) {
          setSiswaList(siswaRes.data as unknown as SiswaListItem[])
        }

        toast({
          title: "Akun Siswa Berhasil Dibuat! 🎉",
          description: `Akun untuk ${data.namaLengkap} telah terdaftar.`,
        })
      } else {
        setServerError(result.message || "Terjadi kesalahan. Silakan coba lagi.")
      }
    } catch (error) {
      console.error("Submit error:", error)
      setServerError("Terjadi kesalahan. Silakan coba lagi.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetConfirm.userId) return
    setResetLoading(true)

    try {
      let result
      if (resetConfirm.type === "SISWA") {
        result = await resetPasswordSiswaManual(resetConfirm.userId)
      } else {
        result = await resetPasswordOrangTuaManual(resetConfirm.userId)
      }

      if (result.success && result.data) {
        setResetConfirm({ open: false, userId: "", nama: "", type: "SISWA" })

        setPasswordDisplay({
          passwordSiswa: resetConfirm.type === "SISWA" ? result.data.newPassword : undefined,
          passwordOrangTua: resetConfirm.type === "ORANG_TUA" ? result.data.newPassword : undefined,
          namaSiswa: resetConfirm.type === "SISWA" ? resetConfirm.nama : "",
          namaOrangTua: resetConfirm.type === "ORANG_TUA" ? resetConfirm.nama : undefined,
        })

        toast({
          title: "Password Berhasil Direset! 🔑",
          description: `Password ${resetConfirm.type === "SISWA" ? "siswa" : "orang tua"} "${resetConfirm.nama}" telah direset.`,
        })
      } else {
        toast({
          title: "Gagal Reset Password",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Gagal Reset Password",
        description: "Terjadi kesalahan saat mereset password.",
        variant: "destructive",
      })
    } finally {
      setResetLoading(false)
    }
  }

  // Filter siswa list
  const filteredSiswa = React.useMemo(() => {
    let filtered = siswaList

    if (filterKelas !== "ALL") {
      filtered = filtered.filter((s) => s.kelasNama === filterKelas)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (s) =>
          s.nama.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.nisn && s.nisn.includes(q)) ||
          (s.nis && s.nis.includes(q))
      )
    }

    return filtered
  }, [siswaList, filterKelas, searchQuery])

  // Get unique kelas names for filter
  const kelasNames = React.useMemo(() => {
    const names = new Set(siswaList.map((s) => s.kelasNama).filter(Boolean))
    return Array.from(names) as string[]
  }, [siswaList])

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <DashboardHeader
        title="Kelola Siswa"
        subtitle="Manajemen akun siswa — tambahkan siswa lama langsung dari dashboard."
        action={
          <Button
            onClick={openAddModal}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-md min-h-[44px]"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Tambah Siswa Lama
          </Button>
        }
      />

      {/* Filter & Search Bar */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari nama, email, NISN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl text-sm"
            />
          </div>
          <Select value={filterKelas} onValueChange={setFilterKelas}>
            <SelectTrigger className="w-full sm:w-[200px] h-10 rounded-xl text-sm">
              <SelectValue placeholder="Semua Kelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Kelas</SelectItem>
              {kelasNames.map((nama) => (
                <SelectItem key={nama} value={nama}>
                  {nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Students Table / Card List */}
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Daftar Siswa ({filteredSiswa.length} Siswa)
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loadingData ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
              <span className="ml-2 text-sm text-slate-500">Memuat data...</span>
            </div>
          ) : filteredSiswa.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-12">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                <UserCheck className="h-7 w-7" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">
                Belum Ada Siswa
              </h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Klik &quot;Tambah Siswa Lama&quot; untuk menambahkan siswa baru ke dalam sistem.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-600">
                    <tr>
                      <th className="p-4 pl-6">Nama &amp; NIS/NISN</th>
                      <th className="p-4">Kelas</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Orang Tua</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 pr-6 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSiswa.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80">
                        <td className="p-4 pl-6">
                          <div className="font-bold text-slate-800">{s.nama}</div>
                          <div className="text-xs text-slate-400 font-mono">
                            {s.nisn && `NISN: ${s.nisn}`}
                            {s.nisn && s.nis && " | "}
                            {s.nis && `NIS: ${s.nis}`}
                            {!s.nisn && !s.nis && "—"}
                          </div>
                        </td>
                        <td className="p-4 text-xs font-semibold text-slate-700">
                          {s.kelasNama ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                              {s.jenjangNama && `${s.jenjangNama} `}
                              {s.kelasNama}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-4 text-xs text-slate-600">{s.email}</td>
                        <td className="p-4 text-xs text-slate-600">
                          {s.orangTua.length > 0 ? (
                            <div>
                              <div className="font-medium">{s.orangTua[0].nama}</div>
                              <div className="text-slate-400">{s.orangTua[0].email}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          <StatusBadge status={s.aktif ? "AKTIF" : "NONAKTIF"} />
                        </td>
                        <td className="p-4 pr-6 text-right space-x-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setResetConfirm({
                                open: true,
                                userId: s.userId,
                                nama: s.nama,
                                type: "SISWA",
                              })
                            }
                            className="rounded-xl text-xs font-semibold"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Reset PW
                          </Button>
                          {s.orangTua.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setResetConfirm({
                                  open: true,
                                  userId: s.orangTua[0].userId,
                                  nama: s.orangTua[0].nama,
                                  type: "ORANG_TUA",
                                })
                              }
                              className="rounded-xl text-xs font-semibold"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              PW Ortu
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden p-4 space-y-3">
                {filteredSiswa.map((s) => (
                  <div key={s.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{s.nama}</div>
                        <div className="text-xs text-slate-500">
                          {s.kelasNama
                            ? `${s.jenjangNama ? s.jenjangNama + " " : ""}${s.kelasNama}`
                            : "Belum ada kelas"}
                        </div>
                      </div>
                      <StatusBadge status={s.aktif ? "AKTIF" : "NONAKTIF"} size="sm" />
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 bg-white p-3 rounded-xl border border-slate-100">
                      <div>Email: <strong>{s.email}</strong></div>
                      {s.nisn && <div>NISN: {s.nisn}</div>}
                      {s.nis && <div>NIS: {s.nis}</div>}
                      {s.orangTua.length > 0 && (
                        <div>Orang Tua: <strong>{s.orangTua[0].nama}</strong></div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setResetConfirm({
                            open: true,
                            userId: s.userId,
                            nama: s.nama,
                            type: "SISWA",
                          })
                        }
                        className="flex-1 rounded-xl text-xs min-h-[40px]"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reset PW Siswa
                      </Button>
                      {s.orangTua.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setResetConfirm({
                              open: true,
                              userId: s.orangTua[0].userId,
                              nama: s.orangTua[0].nama,
                              type: "ORANG_TUA",
                            })
                          }
                          className="flex-1 rounded-xl text-xs min-h-[40px]"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          PW Orang Tua
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* MODAL: TAMBAH SISWA LAMA (MULTI-STEP FORM) */}
      {/* ============================================ */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">
              Tambah Siswa Lama
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Isi data siswa dan orang tua. Password akan ditampilkan sekali setelah pembuatan akun.
            </p>
          </DialogHeader>

          {/* Progress Indicator */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">
                Step {currentStep} dari {STEPS.length}
              </span>
              <span className="text-sm text-yellow-500 font-medium">
                {Math.round((currentStep / STEPS.length) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-yellow-500 rounded-full transition-all duration-500 ease-in-out"
                style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
              />
            </div>
            <div className="flex justify-between">
              {STEPS.map((step) => {
                const Icon = step.icon
                const isActive = step.id === currentStep
                const isCompleted = step.id < currentStep
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      if (step.id <= currentStep) {
                        setCurrentStep(step.id)
                      }
                    }}
                    className={
                      "flex flex-col items-center gap-1 transition-colors duration-200 " +
                      (isActive
                        ? "text-yellow-500"
                        : isCompleted
                          ? "text-yellow-500/70 cursor-pointer hover:text-yellow-500"
                          : "text-slate-400")
                    }
                    disabled={step.id > currentStep}
                  >
                    <div
                      className={
                        "rounded-full p-1.5 transition-all duration-200 " +
                        (isActive
                          ? "bg-yellow-500 text-white"
                          : isCompleted
                            ? "bg-yellow-200 text-yellow-600"
                            : "bg-slate-200 text-slate-400")
                      }
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <span className="text-xs font-medium hidden sm:block">
                      {step.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* STEP 1: DATA SISWA */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="lg:col-span-2">
                    <Label htmlFor="namaLengkap">
                      Nama Lengkap <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="namaLengkap"
                      placeholder="Nama lengkap sesuai akta lahir"
                      {...register("namaLengkap")}
                    />
                    {errors.namaLengkap && (
                      <p className="text-xs text-destructive mt-1">{errors.namaLengkap.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="tempatLahir">
                      Tempat Lahir <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="tempatLahir"
                      placeholder="Kota kelahiran"
                      {...register("tempatLahir")}
                    />
                    {errors.tempatLahir && (
                      <p className="text-xs text-destructive mt-1">{errors.tempatLahir.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="tanggalLahir">
                      Tanggal Lahir <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="tanggalLahir"
                      type="date"
                      {...register("tanggalLahir")}
                    />
                    {errors.tanggalLahir && (
                      <p className="text-xs text-destructive mt-1">{errors.tanggalLahir.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>
                      Jenis Kelamin <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      onValueChange={(value) =>
                        setValue("jenisKelamin", value as "LAKI_LAKI" | "PEREMPUAN")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jenis kelamin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LAKI_LAKI">Laki-laki</SelectItem>
                        <SelectItem value="PEREMPUAN">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.jenisKelamin && (
                      <p className="text-xs text-destructive mt-1">{errors.jenisKelamin.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="emailSiswa">Email Siswa (opsional)</Label>
                    <Input
                      id="emailSiswa"
                      type="email"
                      placeholder="Jika kosong, sistem generate otomatis"
                      {...register("emailSiswa")}
                    />
                    {errors.emailSiswa && (
                      <p className="text-xs text-destructive mt-1">{errors.emailSiswa.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="nisn">NISN (jika ada)</Label>
                    <Input
                      id="nisn"
                      placeholder="10 digit angka"
                      maxLength={10}
                      {...register("nisn")}
                    />
                    {errors.nisn && (
                      <p className="text-xs text-destructive mt-1">{errors.nisn.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="nis">NIS (jika ada)</Label>
                    <Input
                      id="nis"
                      placeholder="Nomor Induk Siswa Lokal"
                      {...register("nis")}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <Label htmlFor="alamatSiswa">
                      Alamat Lengkap <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="alamatSiswa"
                      placeholder="Alamat lengkap sesuai KK"
                      rows={3}
                      {...register("alamatSiswa")}
                    />
                    {errors.alamatSiswa && (
                      <p className="text-xs text-destructive mt-1">{errors.alamatSiswa.message}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: DATA ORANG TUA / WALI */}
            {currentStep === 2 && (
              <div className="space-y-6">
                {/* Data Kontak Orang Tua */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
                    Informasi Kontak Orang Tua
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="lg:col-span-2">
                      <Label htmlFor="namaOrangTua">
                        Nama Orang Tua/Wali <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="namaOrangTua"
                        placeholder="Nama lengkap orang tua/wali"
                        {...register("namaOrangTua")}
                      />
                      {errors.namaOrangTua && (
                        <p className="text-xs text-destructive mt-1">{errors.namaOrangTua.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="emailOrangTua">
                        Email Orang Tua <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="emailOrangTua"
                        type="email"
                        placeholder="email@contoh.com"
                        {...register("emailOrangTua")}
                      />
                      {errors.emailOrangTua && (
                        <p className="text-xs text-destructive mt-1">{errors.emailOrangTua.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="noHpOrangTua">
                        No. HP Orang Tua <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="noHpOrangTua"
                        type="tel"
                        placeholder="08xxxxxxxxxx"
                        {...register("noHpOrangTua")}
                      />
                      {errors.noHpOrangTua && (
                        <p className="text-xs text-destructive mt-1">{errors.noHpOrangTua.message}</p>
                      )}
                    </div>
                    <div className="lg:col-span-2">
                      <Label htmlFor="alamatOrangTua">Alamat Orang Tua (jika berbeda)</Label>
                      <Textarea
                        id="alamatOrangTua"
                        placeholder="Kosongkan jika sama dengan alamat siswa"
                        rows={2}
                        {...register("alamatOrangTua")}
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-slate-200" />

                {/* Data Ayah Kandung */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
                    Data Ayah Kandung
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="namaAyahKandung">Nama Ayah Kandung</Label>
                      <Input
                        id="namaAyahKandung"
                        placeholder="Nama lengkap ayah kandung"
                        {...register("namaAyahKandung")}
                      />
                    </div>
                    <div>
                      <Label>Status Ayah Kandung</Label>
                      <CardRadioGroup
                        name="statusAyahKandung"
                        value={statusAyah}
                        onChange={(val) =>
                          setValue(
                            "statusAyahKandung",
                            val as "MASIH_HIDUP" | "SUDAH_MENINGGAL" | "TIDAK_DIKETAHUI"
                          )
                        }
                        options={[
                          { value: "MASIH_HIDUP", label: "Masih Hidup" },
                          { value: "SUDAH_MENINGGAL", label: "Sudah Meninggal" },
                          { value: "TIDAK_DIKETAHUI", label: "Tidak Diketahui" },
                        ]}
                      />
                    </div>
                    <AnimatedField show={statusAyah === "MASIH_HIDUP"}>
                      <NikInput
                        id="nikAyah"
                        label="NIK Ayah"
                        value={nikAyahValue}
                        onChange={(val) => setValue("nikAyah", val)}
                        error={errors.nikAyah?.message}
                        required={statusAyah === "MASIH_HIDUP" && kewarganegaraan !== "WNA"}
                      />
                    </AnimatedField>
                  </div>
                </div>

                <hr className="border-slate-200" />

                {/* Data Ibu Kandung */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
                    Data Ibu Kandung
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="namaIbuKandung">Nama Ibu Kandung</Label>
                      <Input
                        id="namaIbuKandung"
                        placeholder="Nama lengkap ibu kandung"
                        {...register("namaIbuKandung")}
                      />
                    </div>
                    <div>
                      <Label>Status Ibu Kandung</Label>
                      <CardRadioGroup
                        name="statusIbuKandung"
                        value={statusIbu}
                        onChange={(val) =>
                          setValue(
                            "statusIbuKandung",
                            val as "MASIH_HIDUP" | "SUDAH_MENINGGAL" | "TIDAK_DIKETAHUI"
                          )
                        }
                        options={[
                          { value: "MASIH_HIDUP", label: "Masih Hidup" },
                          { value: "SUDAH_MENINGGAL", label: "Sudah Meninggal" },
                          { value: "TIDAK_DIKETAHUI", label: "Tidak Diketahui" },
                        ]}
                      />
                    </div>
                    <AnimatedField show={statusIbu === "MASIH_HIDUP"}>
                      <NikInput
                        id="nikIbu"
                        label="NIK Ibu"
                        value={nikIbuValue}
                        onChange={(val) => setValue("nikIbu", val)}
                        error={errors.nikIbu?.message}
                        required={statusIbu === "MASIH_HIDUP" && kewarganegaraan !== "WNA"}
                      />
                    </AnimatedField>
                  </div>
                </div>

                <hr className="border-slate-200" />

                {/* Data Wali */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
                    Data Wali
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <Label>Status Wali</Label>
                      <CardRadioGroup
                        name="statusWali"
                        value={statusWali}
                        onChange={(val) =>
                          setValue(
                            "statusWali",
                            val as "SAMA_DENGAN_AYAH" | "SAMA_DENGAN_IBU" | "LAINNYA"
                          )
                        }
                        options={[
                          { value: "SAMA_DENGAN_AYAH", label: "Sama dengan Ayah" },
                          { value: "SAMA_DENGAN_IBU", label: "Sama dengan Ibu" },
                          { value: "LAINNYA", label: "Lainnya" },
                        ]}
                      />
                    </div>
                    <AnimatedField show={statusWali === "LAINNYA"}>
                      <div>
                        <Label htmlFor="namaWali">
                          Nama Wali <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="namaWali"
                          placeholder="Nama lengkap wali"
                          {...register("namaWali")}
                        />
                        {errors.namaWali && (
                          <p className="text-xs text-destructive mt-1">{errors.namaWali.message}</p>
                        )}
                      </div>
                    </AnimatedField>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: DATA TAMBAHAN */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {/* Agama & No HP Siswa */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
                    Informasi Personal
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <Label>Agama</Label>
                      <Select onValueChange={(value) => setValue("agama", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih agama" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Islam">Islam</SelectItem>
                          <SelectItem value="Kristen Protestan">Kristen Protestan</SelectItem>
                          <SelectItem value="Katolik">Katolik</SelectItem>
                          <SelectItem value="Hindu">Hindu</SelectItem>
                          <SelectItem value="Buddha">Buddha</SelectItem>
                          <SelectItem value="Konghucu">Konghucu</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="noHpSiswa">No. HP Siswa</Label>
                      <Input
                        id="noHpSiswa"
                        type="tel"
                        placeholder="08xxxxxxxxxx (opsional)"
                        {...register("noHpSiswa")}
                      />
                      {errors.noHpSiswa && (
                        <p className="text-xs text-destructive mt-1">{errors.noHpSiswa.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <hr className="border-slate-200" />

                {/* Kewarganegaraan */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
                    Kewarganegaraan
                  </h3>
                  <div className="grid grid-cols-2 gap-2 max-w-xs">
                    <button
                      type="button"
                      onClick={() => setValue("kewarganegaraan", "WNI")}
                      className={
                        "flex items-center justify-center rounded-xl border-2 py-3 px-4 text-sm font-medium " +
                        "transition-all duration-200 cursor-pointer " +
                        (kewarganegaraan !== "WNA"
                          ? "border-yellow-500 bg-yellow-500 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-yellow-400")
                      }
                    >
                      🇮🇩 WNI
                    </button>
                    <button
                      type="button"
                      onClick={() => setValue("kewarganegaraan", "WNA")}
                      className={
                        "flex items-center justify-center rounded-xl border-2 py-3 px-4 text-sm font-medium " +
                        "transition-all duration-200 cursor-pointer " +
                        (kewarganegaraan === "WNA"
                          ? "border-yellow-500 bg-yellow-500 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-yellow-400")
                      }
                    >
                      🌍 WNA
                    </button>
                  </div>
                  <AnimatedField show={kewarganegaraan === "WNA"}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="kitas">
                          No. KITAS <span className="text-destructive">*</span>
                        </Label>
                        <Input id="kitas" placeholder="Nomor KITAS" {...register("kitas")} />
                        {errors.kitas && (
                          <p className="text-xs text-destructive mt-1">{errors.kitas.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="asalNegara">
                          Asal Negara <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="asalNegara"
                          placeholder="Contoh: Malaysia"
                          {...register("asalNegara")}
                        />
                        {errors.asalNegara && (
                          <p className="text-xs text-destructive mt-1">{errors.asalNegara.message}</p>
                        )}
                      </div>
                    </div>
                  </AnimatedField>
                </div>
              </div>
            )}

            {/* STEP 4: KELAS TUJUAN */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
                    Pilih Kelas Tujuan
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Siswa akan langsung dimasukkan ke kelas yang dipilih.
                  </p>
                  <Label>
                    Kelas <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedKelasId}
                    onValueChange={(value) => setValue("kelasId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableKelas.map((k) => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.jenjangNama} {k.nama} ({k.jumlahSiswa}/{k.kapasitas} siswa)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.kelasId && (
                    <p className="text-xs text-destructive mt-1">{errors.kelasId.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 5: PASSWORD */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
                    Pengaturan Password
                  </h3>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-800">
                        Password hanya ditampilkan <strong>sekali</strong> setelah akun dibuat.
                        Catat dan sampaikan ke siswa/orang tua secara langsung.
                        Tidak ada email yang dikirim.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="passwordManual">
                        Password Siswa (opsional)
                      </Label>
                      <Input
                        id="passwordManual"
                        type="text"
                        placeholder="Kosongkan untuk generate random"
                        {...register("passwordManual")}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Jika dikosongkan, sistem akan generate password random yang kuat.
                        Jika diisi, minimal 8 karakter.
                      </p>
                      {errors.passwordManual && (
                        <p className="text-xs text-destructive mt-1">{errors.passwordManual.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* NAVIGATION BUTTONS */}
            <div className="flex justify-between gap-4 pt-4 border-t border-slate-200">
              <div>
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goToPrevStep}
                    className="rounded-xl"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Sebelumnya
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-xl"
                >
                  Batal
                </Button>
                {currentStep < STEPS.length ? (
                  <Button
                    type="button"
                    onClick={goToNextStep}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl"
                  >
                    Selanjutnya
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        <UserCheck className="mr-2 h-4 w-4" />
                        Buat Akun Siswa
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* MODAL: TAMPILKAN PASSWORD (COPY & CATAT)     */}
      {/* ============================================ */}
      <Dialog open={!!passwordDisplay} onOpenChange={() => setPasswordDisplay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Key className="h-5 w-5 text-yellow-500" />
              Password Berhasil Dibuat!
            </DialogTitle>
          </DialogHeader>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <div className="text-xs text-red-800">
                <p className="font-bold mb-1">⚠️ PENTING — CATAT SEKARANG!</p>
                <p>Password ini <strong>TIDAK AKAN DITAMPILKAN LAGI</strong> setelah dialog ini ditutup. Catat dan sampaikan ke siswa/orang tua secara manual.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {passwordDisplay?.passwordSiswa && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Password Siswa — {passwordDisplay.namaSiswa}
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                  <code className="flex-1 text-sm font-mono font-bold text-slate-800 break-all">
                    {passwordDisplay.passwordSiswa}
                  </code>
                  <CopyButton text={passwordDisplay.passwordSiswa} />
                </div>
              </div>
            )}

            {passwordDisplay?.passwordOrangTua && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Password Orang Tua — {passwordDisplay.namaOrangTua}
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                  <code className="flex-1 text-sm font-mono font-bold text-slate-800 break-all">
                    {passwordDisplay.passwordOrangTua}
                  </code>
                  <CopyButton text={passwordDisplay.passwordOrangTua} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setPasswordDisplay(null)}
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl w-full"
            >
              <Check className="mr-2 h-4 w-4" />
              Saya sudah mencatat, Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* MODAL: KONFIRMASI RESET PASSWORD              */}
      {/* ============================================ */}
      <ConfirmDialog
        open={resetConfirm.open}
        onOpenChange={(open) => setResetConfirm((prev) => ({ ...prev, open }))}
        title={`Reset Password ${resetConfirm.type === "SISWA" ? "Siswa" : "Orang Tua"}?`}
        description={`Apakah Anda yakin ingin mereset password ${resetConfirm.type === "SISWA" ? "siswa" : "orang tua"} "${resetConfirm.nama}"? Password baru akan ditampilkan sekali setelah direset.`}
        confirmText={resetLoading ? "Memproses..." : "Reset Password"}
        variant="destructive"
        onConfirm={handleResetPassword}
      />
    </div>
  )
}
