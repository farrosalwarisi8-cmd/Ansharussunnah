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
import { setTokenAkses } from "@/lib/pendaftaran-token-client"
import {
  bacaDraftLokal,
  simpanDraftLokal,
  hapusDraftLokal,
  draftLebihBaru,
  DRAFT_SCHEMA_VERSION,
  type LocalDraft,
} from "@/lib/pendaftaran-draft-client"
import {
  createPendaftaranDraft,
  savePendaftaranDraft,
  deletePendaftaranDraft,
  resumePendaftaranDraft,
} from "@/actions/pendaftaran-draft"
import { nanoid } from "nanoid"
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
import type { BiayaPPDB } from "@/lib/biaya-ppdb"
import { totalBiayaPPDB, formatRupiah } from "@/lib/biaya-ppdb"
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
  { id: 1, label: "Data Santri", icon: User },
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

/**
 * Bentuk draft lokal dari payload draft server.
 *
 * Payload server hanya berisi data TEKS (file binary tidak pernah ikut), jadi
 * bentuk hasilnya tetap LocalDraft supaya `restoreDraft` bisa dipakai untuk
 * kedua sumber tanpa percabangan. `fileMetaLokal` diteruskan apa adanya:
 * metadata nama berkas milik perangkat ini dan tidak ada di server — justru
 * itu yang membuat banner bisa menampilkan "berkas perlu dipilih ulang".
 */
function draftDariServer(input: {
  payload: unknown
  lastStep: number
  updatedAt: string
  resumeToken: string
  fileMetaLokal: LocalDraft["fileMeta"]
}): LocalDraft {
  const formValues: Record<string, string> = {}
  if (input.payload && typeof input.payload === "object") {
    for (const [k, v] of Object.entries(input.payload as Record<string, unknown>)) {
      if (typeof v === "string" && v.length > 0) formValues[k] = v
    }
  }

  return {
    version: DRAFT_SCHEMA_VERSION,
    draftId: formValues.emailOrangTua || "draft",
    resumeToken: input.resumeToken,
    lastStep: input.lastStep,
    formValues,
    fileMeta: input.fileMetaLokal,
    lastSavedAt: input.updatedAt,
  }
}

interface PendaftaranFormProps {
  jenjangList: Array<{
    id: string
    nama: string
    urutan: number
    kelas: Array<{
      id: string
      nama: string
      kapasitas: number
      jenisKelamin: "LAKI_LAKI" | "PEREMPUAN" | null
    }>
  }>
  /** Peta biaya PPDB per jenjang id — server menghitung total, form hanya menampilkan. */
  biayaPPDB?: Record<string, BiayaPPDB>
}

export function PendaftaranForm({ jenjangList, biayaPPDB }: PendaftaranFormProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = React.useState(1)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const [filesKK, setFilesKK] = React.useState<File[]>([])
  const [filesAkte, setFilesAkte] = React.useState<File[]>([])
  const [filesFoto, setFilesFoto] = React.useState<File[]>([])

  // ===================== DRAFT OTOMATIS (hybrid) =====================
  // Lapisan 1: localStorage (segera, debounce 800 ms).
  // Lapisan 2: server draft bertoken (ketahanan lintas perangkat).
  // File binary TIDAK ikut draft; hanya metadata penanda (lihat
  // pendaftaran-draft-client.ts) yang muncul sebagai "perlu dipilih ulang".
  // `draft` di banner SELALU draft yang benar-benar akan dipulihkan: kalau
  // versi server lebih baru, isinya payload server (bukan draft lokal).
  // `serverUpdatedAt`/`expiresAt` hanya informational untuk ditampilkan.
  const [draftBanner, setDraftBanner] = React.useState<
    | null
    | {
        jenis: "lokal" | "server"
        draft: LocalDraft
        resumeToken: string | null
        serverUpdatedAt: string | null
        expiresAt: string | null
      }
  >(null)
  const [draftResumeToken, setDraftResumeToken] = React.useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null)
  // Pilihan A: pindah perangkat tanpa email -> tempel "Token Lanjutkan Draft".
  const [tokenManual, setTokenManual] = React.useState("")
  const [tokenManualError, setTokenManualError] = React.useState<string | null>(null)
  const [tokenManualInfo, setTokenManualInfo] = React.useState<string | null>(null)
  const [memuatDraft, setMemuatDraft] = React.useState(false)
  const [panelTokenBuka, setPanelTokenBuka] = React.useState(false)
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftReadyRef = React.useRef(false)
  // Cermin token dalam ref. State bersifat async, jadi debounce bisa membaca
  // token yang belum sempat ter-set dan membuat draft server kedua sebelum
  // yang pertama selesai. Ref menutup celah itu.
  const draftTokenRef = React.useRef<string | null>(null)
  // Guard in-flight: hanya satu permintaan create draft pada satu waktu.
  const draftCreateRef = React.useRef<Promise<string | null> | null>(null)
  // =================== AKHIR STATE DRAFT (logic menyusul setelah useForm) ===================

  const [availableKelas, setAvailableKelas] = React.useState<
    Array<{
      id: string
      nama: string
      jenisKelamin: "LAKI_LAKI" | "PEREMPUAN" | null
      jenjangNama: string
    }>
  >([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    setError,
    clearErrors,
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

  // ===================== DRAFT OTOMATIS (hybrid) — logic =====================
  // 1) Saat mount: cek draft lokal + (jika ada resume token) draft server.
  React.useEffect(() => {
    let batal = false
    const lokal = bacaDraftLokal()
    if (!lokal) {
      draftReadyRef.current = true
      return
    }

    const tawarkanServer = async () => {
      if (!lokal.resumeToken) {
        setDraftBanner({ jenis: "lokal", draft: lokal, resumeToken: null, serverUpdatedAt: null, expiresAt: null })
        return
      }
      const res = await resumePendaftaranDraft(lokal.resumeToken)
      if (batal) return
      if (res.success && res.data) {
        const lebihBaru = draftLebihBaru(lokal, { updatedAt: res.data.updatedAt })
        if (lebihBaru === "server") {
          // Yang dipulihkan WAJIB payload server. Sebelumnya banner tetap
          // membawa draft lokal, sehingga "versi server lebih baru" cuma
          //tham-pesan: isinya tetap data lama yang ada di perangkat ini.
          setDraftBanner({
            jenis: "server",
            draft: draftDariServer({
              payload: res.data.payload,
              lastStep: res.data.lastStep,
              updatedAt: res.data.updatedAt,
              resumeToken: lokal.resumeToken,
              fileMetaLokal: lokal.fileMeta,
            }),
            resumeToken: lokal.resumeToken,
            serverUpdatedAt: res.data.updatedAt,
            expiresAt: res.data.expiresAt,
          })
        } else {
          setDraftBanner({
            jenis: "lokal",
            draft: lokal,
            resumeToken: lokal.resumeToken,
            serverUpdatedAt: res.data.updatedAt,
            expiresAt: res.data.expiresAt,
          })
        }
      } else {
        // Server tidak punya (expired/dihapus) — lokal tetap ditawarkan.
        setDraftBanner({ jenis: "lokal", draft: lokal, resumeToken: lokal.resumeToken, serverUpdatedAt: null, expiresAt: null })
      }
    }

    void tawarkanServer()
    return () => {
      batal = true
    }
  }, [])

  // 2) Autosave lokal (debounce 800 ms) + server tiap perubahan.
  const watchAll = watch()
  React.useEffect(() => {
    if (!draftReadyRef.current) return
    const values = watchAll as Record<string, unknown>
    const formValues: Record<string, string> = {}
    for (const [k, v] of Object.entries(values)) {
      if (typeof v === "string" && v.length > 0) formValues[k] = v
    }

    const fileMeta: LocalDraft["fileMeta"] = {
      kartuKeluarga: filesKK[0] ? { nama: filesKK[0].name, ukuran: filesKK[0].size } : null,
      akteLahir: filesAkte[0] ? { nama: filesAkte[0].name, ukuran: filesAkte[0].size } : null,
      foto: filesFoto[0] ? { nama: filesFoto[0].name, ukuran: filesFoto[0].size } : null,
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const draftId = formValues.emailOrangTua || "draft"
      const hasilLokal = simpanDraftLokal({
        draftId,
        resumeToken: draftResumeToken,
        lastStep: currentStep,
        formValues,
        fileMeta,
      })
      setLastSavedAt(hasilLokal.lastSavedAt)

      // Server draft: buat sekali, lalu update. Gagal senyap — lapisan lokal
      // tetap melindungi; banner hanya menampilkan info penyimpanan.
      //
      // Token dibaca dari ref, bukan state: debounce bisa berjalan lagi
      // sebelum state ter-update, dan tanpa guard itu tiap perubahan membuat satu
      // draft server orfa.
      const token = draftTokenRef.current
      if (!token) {
        void ensureDraftServer(formValues, currentStep)
      } else {
        void savePendaftaranDraft(token, formValues, currentStep)
      }
    }, 800)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [watchAll, currentStep, filesKK, filesAkte, filesFoto, draftResumeToken])

  /**
   * Buat draft server HANYA kalau belum ada. Beberapa debounce bisa menyalakan
   * permintaan create sebelum token yang pertama sampai; `draftCreateRef`
   * menyatukan semuanya ke satu promise sehingga tidak pernah ada dua draft
   * server untuk satu pengguna (token pertama akan jadi yatim).
   */
  const ensureDraftServer = async (
    formValues: Record<string, string>,
    step: number
  ): Promise<string | null> => {
    const berjalan = draftCreateRef.current
    if (berjalan) return berjalan

    const permintaan = createPendaftaranDraft(formValues, step)
      .then((res) => {
        if (res.success && res.data) {
          draftTokenRef.current = res.data.resumeToken
          setDraftResumeToken(res.data.resumeToken)
          return res.data.resumeToken
        }
        return null
      })
      .finally(() => {
        if (draftCreateRef.current === permintaan) draftCreateRef.current = null
      })

    draftCreateRef.current = permintaan
    return permintaan
  }

  // 3) Restore: isi form + kembali ke lastStep.
  const restoreDraft = (draft: LocalDraft) => {
    for (const [key, val] of Object.entries(draft.formValues)) {
      setValue(key as never, val as never, { shouldValidate: false })
    }
    setCurrentStep(Math.min(5, Math.max(1, draft.lastStep)))
    window.scrollTo({ top: 0, behavior: "smooth" })
    setDraftBanner(null)
    // Token ikut dipertahankan supaya submit berikutnya tetap idempoten dan
    // draft server yang sama bisa di-update lagi.
    draftTokenRef.current = draft.resumeToken
    setDraftResumeToken(draft.resumeToken)
    draftReadyRef.current = true
  }

  const mulaiBaruDariDraft = async () => {
    const lokal = bacaDraftLokal()
    const token = draftTokenRef.current ?? lokal?.resumeToken
    if (token) {
      await deletePendaftaranDraft(token)
    }
    hapusDraftLokal()
    draftTokenRef.current = null
    draftCreateRef.current = null
    setDraftResumeToken(null)
    setLastSavedAt(null)
    setDraftBanner(null)
    draftReadyRef.current = true
  }

  /**
   * Pilihan A: lanjutkan draft di perangkat lain. Pengguna menempel
   * "Token Lanjutkan Draft" (diberikan saat draft server dibuat); tidak ada
   * email yang dikirim, jadi ini satu-satunya jalan pulih lintas perangkat.
   */
  const lanjutkanDenganToken = async () => {
    const token = tokenManual.trim()
    setTokenManualError(null)
    setTokenManualInfo(null)

    if (!token) {
      setTokenManualError("Masukkan token draft terlebih dahulu.")
      return
    }

    setMemuatDraft(true)
    try {
      const res = await resumePendaftaranDraft(token)
      if (!res.success || !res.data) {
        setTokenManualError(res.message || "Draft tidak dapat dimuat.")
        return
      }

      const draft = draftDariServer({
        payload: res.data.payload,
        lastStep: res.data.lastStep,
        updatedAt: res.data.updatedAt,
        resumeToken: token,
        // Metadata berkas tidak ada di server: perangkat ini memang belum
        // pernah memilih berkas, jadi biarkan kosong.
        fileMetaLokal: {},
      })

      restoreDraft(draft)
      // Simpan juga ke lokal supaya refresh tidak kehilangan
      // akses ke draft yang sama.
      simpanDraftLokal({
        draftId: draft.draftId,
        resumeToken: token,
        lastStep: draft.lastStep,
        formValues: draft.formValues,
        fileMeta: draft.fileMeta,
      })
      setTokenManual("")
      setTokenManualInfo(
        `Draft dimuat dari ${new Date(res.data.updatedAt).toLocaleString("id-ID")}, berlaku sampai ${new Date(
          res.data.expiresAt
        ).toLocaleDateString("id-ID")}.`
      )
    } finally {
      setMemuatDraft(false)
    }
  }
  // =================== AKHIR DRAFT OTOMATIS ===================

  React.useEffect(() => {
    if (selectedJenjang) {
      const jenjang = jenjangList.find((j) => j.id === selectedJenjang)
      setAvailableKelas(
        (jenjang?.kelas || []).map((kk) => ({
          id: kk.id,
          nama: kk.nama,
          jenisKelamin: kk.jenisKelamin,
          jenjangNama: jenjang?.nama || "",
        }))
      )
      setValue("kelasTujuanId", "")
    } else {
      setAvailableKelas([])
    }
  }, [selectedJenjang, jenjangList, setValue])

  const jenisKelaminValue = watch("jenisKelamin")

  const jenjangTerpilih = jenjangList.find((j) => j.id === selectedJenjang)
  const biayaTerpilih = selectedJenjang ? biayaPPDB?.[selectedJenjang] : undefined

  // Kelas yang bisa dipilih dibatasi oleh jenis kelamin calon santri:
  // kelas khusus Ikhwan/Akhwat hanya muncul untuk gender yang cocok,
  // kelas Campuran (jenisKelamin null) muncul untuk semua gender.
  const kelasCocokGender = availableKelas.filter(
    (k) => !jenisKelaminValue || !k.jenisKelamin || k.jenisKelamin === jenisKelaminValue
  )

  // Jika jenis kelamin berubah setelah kelas terpilih, dan kelas tersebut
  // sekarang tidak cocok, kosongkan pilihan agar tidak ter-submit kelas salah.
  React.useEffect(() => {
    if (!jenisKelaminValue) return
    const terpilihKelas = watch("kelasTujuanId")
    if (!terpilihKelas) return
    const k = availableKelas.find((x) => x.id === terpilihKelas)
    if (k && k.jenisKelamin && k.jenisKelamin !== jenisKelaminValue) {
      setValue("kelasTujuanId", "")
    }
  }, [jenisKelaminValue, availableKelas, setValue, watch])

  const stepFields: Record<number, (keyof PendaftaranFormValues)[]> = {
    1: ["namaLengkap", "tempatLahir", "tanggalLahir", "jenisKelamin", "alamatSiswa"],
    2: ["namaOrangTua", "noHpOrangTua", "emailOrangTua"],
    3: [],
    4: ["jenjangTujuanId", "kelasTujuanId"],
    5: [],
  }

  const validateStep = async (step: number): Promise<boolean> => {
    const fields = stepFields[step]
    if (!fields || fields.length === 0) return true
    const valid = await trigger(fields)
    if (!valid) return false

    // Tahap 4: kelas tujuan wajib dipilih HANYA jika tersedia kelas yang cocok
    // gender. Jika jenjang tujuan tidak punya kelas yang sesuai (mis. jenjang
    // hanya punya kelas khusus Ikhwan dan pendaftar perempuan), pengguna boleh
    // lanjut tanpa kelas — kelas akan ditentukan panitia saat verifikasi.
    if (step === 4) {
      const kelasVal = watch("kelasTujuanId")
      if (kelasCocokGender.length > 0 && !kelasVal) {
        setError("kelasTujuanId", {
          type: "manual",
          message: "Pilih kelas tujuan",
        })
        return false
      }
      clearErrors("kelasTujuanId")
    }
    return true
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

  // Form submit NATIF (termasuk implicit submission via tombol Enter pada
  // field teks) DIPINDAH gerbangnya ke langkah terakhir. Tanpa ini, menekan
  // Enter di kolom teks mana pun akan menjalankan validasi SELURUH form dan
  // langsung membuat pendaftaran + pindah ke halaman sukses tanpa melewati
  // langkah 4 & 5 (dan tanpa menekan tombol "Daftar Sekarang").
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (currentStep < STEPS.length) {
      // Enter pada langkah selain terakhir diperlakukan seperti "Selanjutnya":
      // validasi langkah berjalan, tapi form TIDAK dikirim.
      void goToNextStep()
    } else {
      void handleSubmit(onSubmit)(e)
    }
  }

  const onSubmit = async (data: PendaftaranFormValues) => {
    setIsSubmitting(true)
    setServerError(null)

    // File yang berhasil diunggah ke temp — dibersihkan jika proses gagal
    // (best-effort; jika RLS bucket tidak mengizinkan delete, file yatim
    // akan dibersihkan oleh job retensi temp di luar form).
    const uploadedPaths: string[] = []

    const cleanupUploadedFiles = async () => {
      if (uploadedPaths.length === 0) return
      try {
        const { createSupabaseBrowserClient } = await import("@/lib/supabase/client")
        const supabase = createSupabaseBrowserClient()
        await supabase.storage.from("dokumen-pendaftaran").remove(uploadedPaths)
      } catch {
        // cleanup bersifat best-effort
      }
    }

    try {
      const tempFolder = `dokumen-pendaftaran/pendaftaran/temp-${nanoid(10)}`

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
          await cleanupUploadedFiles()
          return
        }
        dokKKPath = result.path
        uploadedPaths.push(result.path)
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
          await cleanupUploadedFiles()
          return
        }
        dokAktePath = result.path
        uploadedPaths.push(result.path)
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
          await cleanupUploadedFiles()
          return
        }
        dokFotoPath = result.path
        uploadedPaths.push(result.path)
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

      // Idempotensi finalisasi: draftToken membuat submit ganda / retry
      // mengembalikan nomor yang sama, bukan membuat pendaftaran kedua.
      if (draftResumeToken) formData.append("draftToken", draftResumeToken)

      const result = await createPendaftaran(formData)

      if (result.success && result.data) {
        // File dipertahankan (direferensikan oleh record pendaftaran)
        uploadedPaths.length = 0
        if (result.data.tokenAkses) {
          // Simpan token akses rahasia untuk alur upload dokumen/bukti transfer.
          // Pada retry yang mengembalikan nomor lama, tokenAkses kosong —
          // token dari percobaan pertama di sessionStorage tetap berlaku.
          setTokenAkses(result.data.nomorPendaftaran, result.data.tokenAkses)
        }
        // Final sukses: draft (lokal & server) dibersihkan — data sudah jadi
        // pendaftaran sungguhan, bukan draft lagi.
        if (draftResumeToken) {
          void deletePendaftaranDraft(draftResumeToken)
        }
        hapusDraftLokal()
        router.push(
          `/pendaftaran/sukses?nomor=${result.data.nomorPendaftaran}`
        )
      } else {
        setServerError(
          result.message || "Terjadi kesalahan. Silakan coba lagi."
        )
        await cleanupUploadedFiles()
      }
    } catch (error) {
      console.error("Submit error:", error)
      setServerError("Terjadi kesalahan. Silakan coba lagi.")
      await cleanupUploadedFiles()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {serverError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 text-sm">
          {serverError}
        </div>
      )}

      {/* Banner draft tersimpan: Lanjutkan atau Mulai Baru */}
      {draftBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm space-y-2">
          <p className="font-semibold text-amber-900 m-0">
            Ada draft pendaftaran tersimpan
          </p>
          <p className="text-amber-800 m-0">
            {draftBanner.jenis === "server" ? (
              <>
                Versi server lebih baru (disimpan{" "}
                {new Date(draftBanner.serverUpdatedAt ?? draftBanner.draft.lastSavedAt).toLocaleString(
                  "id-ID"
                )}
                ). Lanjutkan dari langkah {draftBanner.draft.lastStep}?
              </>
            ) : (
              <>
                Terakhir disimpan{" "}
                {new Date(draftBanner.draft.lastSavedAt).toLocaleString("id-ID")}.{" "}
                Lanjutkan dari langkah {draftBanner.draft.lastStep}?
              </>
            )}
          </p>
          {draftBanner.expiresAt && (
            <p className="text-xs text-amber-700 m-0">
              Draft server berlaku sampai{" "}
              {new Date(draftBanner.expiresAt).toLocaleDateString("id-ID")}. Setelah
              itu isinya tidak bisa dipulihkan lagi.
            </p>
          )}
          {draftBanner.resumeToken && (
            <p className="text-xs text-amber-700 m-0 break-all">
              Token Lanjutkan Draft:{" "}
              <code className="font-mono">{draftBanner.resumeToken}</code>
              <br />
              Simpan token ini kalau mau melanjutkan dari perangkat lain (tanpa
              email).
            </p>
          )}
          {Object.keys(draftBanner.draft.fileMeta).some(
            (k) => draftBanner.draft.fileMeta[k as keyof typeof draftBanner.draft.fileMeta]
          ) && (
            <p className="text-xs text-amber-700 m-0">
              Berkas yang dipilih sebelumnya perlu dipilih ulang — isinya tidak
              ikut tersimpan di draft.
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" size="sm" onClick={() => restoreDraft(draftBanner.draft)}>
              Lanjutkan Draft
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void mulaiBaruDariDraft()}>
              Mulai Baru
            </Button>
          </div>
        </div>
      )}

      {/* Indikator "tersimpan otomatis" + token untuk dipindah ke perangkat lain */}
      {lastSavedAt && !draftBanner && (
        <p className="text-xs text-muted-foreground text-right m-0">
          Draft tersimpan otomatis {new Date(lastSavedAt).toLocaleTimeString("id-ID")}
        </p>
      )}
      {draftResumeToken && !draftBanner && (
        <div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground space-y-1">
          <p className="m-0">
            Simpan <strong>Token Lanjutkan Draft</strong> ini kalau ingin
            melanjutkan pendaftaran dari perangkat lain:
          </p>
          <p className="m-0 font-mono break-all select-all">{draftResumeToken}</p>
        </div>
      )}

      {/* Lanjutkan draft di perangkat lain: tempel Token Lanjutkan Draft.
          Tidak ada email involved, jadi ini jalur pulih lintas perangkat yang
          resmi. */}
      <div className="border rounded-xl p-3 text-sm space-y-2">
        <button
          type="button"
          className="text-left font-medium m-0 p-0 border-0 bg-transparent cursor-pointer"
          onClick={() => setPanelTokenBuka((v) => !v)}
        >
          {panelTokenBuka
            ? "Sembunyikan" : "Pindah perangkat?"}{" "}
          Lanjutkan draft dengan token
        </button>

        {panelTokenBuka && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground m-0">
              Tempel token draft yang sudah kamu simpan. Data teks yang
              tersimpan akan dimuat ke form ini; berkas tetap perlu dipilih ulang.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={tokenManual}
                onChange={(e) => {
                  setTokenManual(e.target.value)
                  setTokenManualError(null)
                }}
                placeholder="Token Lanjutkan Draft"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void lanjutkanDenganToken()}
                disabled={memuatDraft}
                className="shrink-0"
              >
                {memuatDraft ? "Memuat..." : "Lanjutkan"}
              </Button>
            </div>
            {tokenManualError && (
              <p className="text-xs text-destructive m-0">{tokenManualError}</p>
            )}
            {tokenManualInfo && (
              <p className="text-xs text-muted-foreground m-0">{tokenManualInfo}</p>
            )}
          </div>
        )}
      </div>

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
                  // min 44px agar nyaman disentuh di mobile (label hanya tampil >=sm).
                  "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-xl px-1 transition-colors duration-200 touch-manipulation disabled:cursor-not-allowed disabled:opacity-45 " +
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
              Data Calon Santri
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
                    placeholder="Kosongkan jika sama dengan alamat santri"
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
            {/* Agama & No HP Santri */}
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
                  <Label htmlFor="noHpSantri">No. HP Santri</Label>
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
                <Label>
                  Kelas{" "}
                  {kelasCocokGender.length > 0 && (
                    <span className="text-destructive">*</span>
                  )}
                </Label>
                <Select
                  onValueChange={(value) => setValue("kelasTujuanId", value)}
                  disabled={kelasCocokGender.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        availableKelas.length === 0
                          ? "Pilih jenjang terlebih dahulu"
                          : kelasCocokGender.length === 0
                            ? "Kelas ditentukan panitia saat verifikasi"
                            : "Pilih kelas"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {kelasCocokGender.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.jenjangNama} - {k.nama}
                        {k.jenisKelamin === "LAKI_LAKI"
                          ? " (Ikhwan)"
                          : k.jenisKelamin === "PEREMPUAN"
                            ? " (Akhwat)"
                            : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {kelasCocokGender.length === 0 && availableKelas.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Di jenjang ini belum ada kelas yang sesuai dengan jenis kelamin calon santri.
                    Anda tetap dapat melanjutkan pendaftaran; kelas akan ditentukan oleh panitia saat verifikasi.
                  </p>
                )}
                {errors.kelasTujuanId && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.kelasTujuanId.message}
                  </p>
                )}
              </div>
            </div>

            {/* Rincian biaya sesuai jenjang terpilih (server-provided, hanya info) */}
            {biayaTerpilih && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Rincian Biaya Jenjang {jenjangTerpilih?.nama}
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Biaya Pendaftaran</span>
                    <span className="font-medium text-gray-700">
                      {formatRupiah(biayaTerpilih.biayaPendaftaran)}
                    </span>
                  </div>
                  {biayaTerpilih.biayaUangGedung > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Uang Gedung</span>
                      <span className="font-medium text-gray-700">
                        {formatRupiah(biayaTerpilih.biayaUangGedung)}
                      </span>
                    </div>
                  )}
                  {biayaTerpilih.biayaSarpras > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sarana Prasarana (Sarpras)</span>
                      <span className="font-medium text-gray-700">
                        {formatRupiah(biayaTerpilih.biayaSarpras)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-primary/20 pt-1.5 mt-1.5 flex justify-between">
                    <span className="font-semibold text-gray-700">Total</span>
                    <span className="font-bold text-primary">
                      {formatRupiah(totalBiayaPPDB(biayaTerpilih))}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  Nominal transfer akan dikonfirmasi ulang pada halaman setelah pendaftaran.
                </p>
              </div>
            )}
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
