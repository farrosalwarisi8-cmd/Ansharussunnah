// src/components/pendaftaran/pendaftaran-form.tsx

"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  pendaftaranSchema,
  type PendaftaranFormValues,
} from "@/lib/validations/pendaftaran"
import { createPendaftaran } from "@/actions/pendaftaran"
import { uploadFileToStorage } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FileUpload } from "@/components/ui/file-upload"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Loader2,
  User,
  Users,
  School,
  FileUp,
  ChevronLeft,
  ChevronRight,
  Check,
  Globe,
} from "lucide-react"

// ============================================
// STEP DEFINITIONS
// ============================================

const STEPS = [
  { id: 1, label: "Data Siswa", icon: User },
  { id: 2, label: "Orang Tua & Wali", icon: Users },
  { id: 3, label: "Data Tambahan", icon: Globe },
  { id: 4, label: "Jenjang & Kelas", icon: School },
  { id: 5, label: "Dokumen", icon: FileUp },
] as const

// ============================================
// CARD-BASED RADIO BUTTON (Mobile-friendly)
// ============================================

interface CardRadioOption {
  value: string
  label: string
  description?: string
}

function CardRadioGroup({
  options,
  value,
  onChange,
  name,
}: {
  options: CardRadioOption[]
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
            "relative flex flex-col items-center justify-center rounded-xl border-2 p-3 text-center " +
            "transition-all duration-200 cursor-pointer min-h-[56px] " +
            (value === opt.value
              ? "border-primary bg-primary/5 text-primary shadow-sm"
              : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-accent")
          }
          aria-checked={value === opt.value}
          role="radio"
          name={name}
        >
          <span className="text-sm font-medium">{opt.label}</span>
          {opt.description && (
            <span className="text-xs text-muted-foreground mt-0.5">
              {opt.description}
            </span>
          )}
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
          <span className={digitCount === 16 ? "text-success font-medium" : ""}>
            {digitCount}
          </span>
          /16
        </div>
      </div>
      {error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}
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
// MAIN FORM COMPONENT
// ============================================

interface PendaftaranFormProps {
  jenjangList: Array<{
    id: string
    nama: string
    urutan: number
    kelas: Array<{
      id: string
      nama: string
      kapasitas: number
    }>
  }>
}

export function PendaftaranForm({ jenjangList }: PendaftaranFormProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = React.useState(1)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const [filesKK, setFilesKK] = React.useState<File[]>([])
  const [filesAkte, setFilesAkte] = React.useState<File[]>([])
  const [filesFoto, setFilesFoto] = React.useState<File[]>([])

  const [availableKelas, setAvailableKelas] = React.useState<
    Array<{ id: string; nama: string }>
  >([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<PendaftaranFormValues>({
    resolver: zodResolver(pendaftaranSchema),
    defaultValues: {
      jenisKelamin: undefined,
      jenjangTujuanId: "",
      kelasTujuanId: "",
      kewarganegaraan: "WNI",
    },
  })

  const selectedJenjang = watch("jenjangTujuanId")
  const statusAyah = watch("statusAyahKandung")
  const statusIbu = watch("statusIbuKandung")
  const statusWali = watch("statusWali")
  const kewarganegaraan = watch("kewarganegaraan")
  const nikAyahValue = watch("nikAyah")
  const nikIbuValue = watch("nikIbu")

  React.useEffect(() => {
    if (selectedJenjang) {
      const jenjang = jenjangList.find((j) => j.id === selectedJenjang)
      setAvailableKelas(jenjang?.kelas || [])
      setValue("kelasTujuanId", "")
    } else {
      setAvailableKelas([])
    }
  }, [selectedJenjang, jenjangList, setValue])

  const stepFields: Record<number, (keyof PendaftaranFormValues)[]> = {
    1: ["namaLengkap", "tempatLahir", "tanggalLahir", "jenisKelamin", "alamatSiswa"],
    2: ["namaOrangTua", "noHpOrangTua", "emailOrangTua"],
    3: [],
    4: ["jenjangTujuanId"],
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
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const goToPrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const onSubmit = async (data: PendaftaranFormValues) => {
    setIsSubmitting(true)
    setServerError(null)

    try {
      const timestamp = Date.now()
      const tempFolder = `pendaftaran/temp-${timestamp}`

      let dokKKPath = ""
      let dokAktePath = ""
      let dokFotoPath = ""

      if (filesKK.length > 0) {
        const result = await uploadFileToStorage(
          "dokumen-pendaftaran",
          tempFolder,
          filesKK[0]
        )
        if (result.error) {
          setServerError(result.error)
          setIsSubmitting(false)
          return
        }
        dokKKPath = result.path
      }

      if (filesAkte.length > 0) {
        const result = await uploadFileToStorage(
          "dokumen-pendaftaran",
          tempFolder,
          filesAkte[0]
        )
        if (result.error) {
          setServerError(result.error)
          setIsSubmitting(false)
          return
        }
        dokAktePath = result.path
      }

      if (filesFoto.length > 0) {
        const result = await uploadFileToStorage(
          "dokumen-pendaftaran",
          tempFolder,
          filesFoto[0]
        )
        if (result.error) {
          setServerError(result.error)
          setIsSubmitting(false)
          return
        }
        dokFotoPath = result.path
      }

      const formData = new FormData()
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          formData.append(key, value as string)
        }
      })

      if (dokKKPath) formData.append("dokKartuKeluarga", dokKKPath)
      if (dokAktePath) formData.append("dokAkteLahir", dokAktePath)
      if (dokFotoPath) formData.append("dokFoto", dokFotoPath)

      const result = await createPendaftaran(formData)

      if (result.success && result.data) {
        router.push(
          `/pendaftaran/sukses?nomor=${result.data.nomorPendaftaran}`
        )
      } else {
        setServerError(
          result.message || "Terjadi kesalahan. Silakan coba lagi."
        )
      }
    } catch (error) {
      console.error("Submit error:", error)
      setServerError("Terjadi kesalahan. Silakan coba lagi.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 text-sm">
          {serverError}
        </div>
      )}

      {/* PROGRESS INDICATOR */}
      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">
            Step {currentStep} dari {STEPS.length}
          </span>
          <span className="text-sm text-primary font-medium">
            {Math.round((currentStep / STEPS.length) * 100)}%
          </span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-in-out"
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
                    ? "text-primary"
                    : isCompleted
                      ? "text-primary/70 cursor-pointer hover:text-primary"
                      : "text-muted-foreground")
                }
                disabled={step.id > currentStep}
              >
                <div
                  className={
                    "rounded-full p-1.5 transition-all duration-200 " +
                    (isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground")
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

      {/* STEP 1: DATA CALON SISWA */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              Data Calon Siswa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  <p className="text-xs text-destructive mt-1">
                    {errors.namaLengkap.message}
                  </p>
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
                  <p className="text-xs text-destructive mt-1">
                    {errors.tempatLahir.message}
                  </p>
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
                  <p className="text-xs text-destructive mt-1">
                    {errors.tanggalLahir.message}
                  </p>
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
                  <p className="text-xs text-destructive mt-1">
                    {errors.jenisKelamin.message}
                  </p>
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
                  <p className="text-xs text-destructive mt-1">
                    {errors.nisn.message}
                  </p>
                )}
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
                  <p className="text-xs text-destructive mt-1">
                    {errors.alamatSiswa.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: DATA ORANG TUA / WALI */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Data Orang Tua & Wali
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sub-section: Data Kontak Orang Tua */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Informasi Kontak Orang Tua
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="lg:col-span-2">
                  <Label htmlFor="namaOrangTua">
                    Nama Orang Tua/Wali{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="namaOrangTua"
                    placeholder="Nama lengkap orang tua/wali"
                    {...register("namaOrangTua")}
                  />
                  {errors.namaOrangTua && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.namaOrangTua.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="noHpOrangTua">
                    No. HP Orang Tua{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="noHpOrangTua"
                    type="tel"
                    placeholder="08xxxxxxxxxx"
                    {...register("noHpOrangTua")}
                  />
                  {errors.noHpOrangTua && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.noHpOrangTua.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="emailOrangTua">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="emailOrangTua"
                    type="email"
                    placeholder="email@contoh.com"
                    {...register("emailOrangTua")}
                  />
                  {errors.emailOrangTua && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.emailOrangTua.message}
                    </p>
                  )}
                </div>
                <div className="lg:col-span-2">
                  <Label htmlFor="alamatOrangTua">
                    Alamat Orang Tua (jika berbeda)
                  </Label>
                  <Textarea
                    id="alamatOrangTua"
                    placeholder="Kosongkan jika sama dengan alamat siswa"
                    rows={2}
                    {...register("alamatOrangTua")}
                  />
                </div>
              </div>
            </div>

            <hr className="border-border" />

            {/* Sub-section: Data Ayah Kandung */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
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
                  {errors.namaAyahKandung && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.namaAyahKandung.message}
                    </p>
                  )}
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

            <hr className="border-border" />

            {/* Sub-section: Data Ibu Kandung */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
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
                  {errors.namaIbuKandung && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.namaIbuKandung.message}
                    </p>
                  )}
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

            <hr className="border-border" />

            {/* Sub-section: Data Wali */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
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
                      Nama Wali{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="namaWali"
                      placeholder="Nama lengkap wali"
                      {...register("namaWali")}
                    />
                    {errors.namaWali && (
                      <p className="text-xs text-destructive mt-1">
                        {errors.namaWali.message}
                      </p>
                    )}
                  </div>
                </AnimatedField>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: DATA TAMBAHAN */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5 text-primary" />
              Data Tambahan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Agama & No HP Siswa */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Informasi Personal
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <Label>Agama</Label>
                  <Select
                    onValueChange={(value) => setValue("agama", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih agama" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Islam">Islam</SelectItem>
                      <SelectItem value="Kristen Protestan">
                        Kristen Protestan
                      </SelectItem>
                      <SelectItem value="Katolik">Katolik</SelectItem>
                      <SelectItem value="Hindu">Hindu</SelectItem>
                      <SelectItem value="Buddha">Buddha</SelectItem>
                      <SelectItem value="Konghucu">Konghucu</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.agama && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.agama.message}
                    </p>
                  )}
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
                    <p className="text-xs text-destructive mt-1">
                      {errors.noHpSiswa.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <hr className="border-border" />

            {/* Kewarganegaraan */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
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
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40")
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
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40")
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
                    <Input
                      id="kitas"
                      placeholder="Nomor KITAS"
                      {...register("kitas")}
                    />
                    {errors.kitas && (
                      <p className="text-xs text-destructive mt-1">
                        {errors.kitas.message}
                      </p>
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
                      <p className="text-xs text-destructive mt-1">
                        {errors.asalNegara.message}
                      </p>
                    )}
                  </div>
                </div>
              </AnimatedField>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: JENJANG & KELAS TUJUAN */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <School className="h-5 w-5 text-primary" />
              Jenjang & Kelas Tujuan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>
                  Jenjang <span className="text-destructive">*</span>
                </Label>
                <Select
                  onValueChange={(value) => setValue("jenjangTujuanId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenjang" />
                  </SelectTrigger>
                  <SelectContent>
                    {jenjangList.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.jenjangTujuanId && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.jenjangTujuanId.message}
                  </p>
                )}
              </div>
              <div>
                <Label>Kelas (opsional)</Label>
                <Select
                  onValueChange={(value) => setValue("kelasTujuanId", value)}
                  disabled={availableKelas.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        availableKelas.length === 0
                          ? "Pilih jenjang terlebih dahulu"
                          : "Pilih kelas"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableKelas.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 5: DOKUMEN PENDUKUNG */}
      {currentStep === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileUp className="h-5 w-5 text-primary" />
              Dokumen Pendukung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FileUpload
              label="Kartu Keluarga (KK)"
              description="opsional, bisa diupload nanti"
              files={filesKK}
              onFilesChange={setFilesKK}
              accept="image/*,.pdf"
            />
            <FileUpload
              label="Akta Kelahiran"
              description="opsional, bisa diupload nanti"
              files={filesAkte}
              onFilesChange={setFilesAkte}
              accept="image/*,.pdf"
            />
            <FileUpload
              label="Pas Foto 3x4"
              description="opsional, bisa diupload nanti"
              files={filesFoto}
              onFilesChange={setFilesFoto}
              accept="image/*"
            />
          </CardContent>
        </Card>
      )}

      {/* NAVIGATION BUTTONS */}
      <div className="flex justify-between gap-4">
        <div>
          {currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={goToPrevStep}
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
            size="lg"
            onClick={() => router.push("/")}
          >
            Batal
          </Button>
          {currentStep < STEPS.length ? (
            <Button
              type="button"
              size="lg"
              onClick={goToNextStep}
            >
              Selanjutnya
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Daftar Sekarang"
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
