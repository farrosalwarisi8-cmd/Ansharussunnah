// src/components/ui/file-upload.tsx
//
// Komponen upload berkas seragam untuk seluruh alur (form pendaftaran,
// upload dokumen, upload bukti transfer). Didesain mobile-first:
//   - tombol besar (>=44px) untuk ibu jari,
//   - pilihan "Ambil Foto" (kamera) bila perangkat mendukung,
//   - format & batas ukuran ditampilkan sebelum memilih berkas,
//   - pratinjau gambar + nama & ukuran berkas,
//   - tombol "Ganti berkas" dan "Hapus" per berkas,
//   - status upload (mengunggah/berhasil/gagal) lewat prop `status`,
//   - error validasi tampil inline (role="alert"), bukan window.alert().

"use client"

import * as React from "react"
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Upload,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

export type UploadStatus = "idle" | "uploading" | "success" | "error"

interface FileUploadProps {
  label: string
  description?: string
  accept?: string
  multiple?: boolean
  maxSizeMB?: number
  files: File[]
  onFilesChange: (files: File[]) => void
  /** Error validasi dari induk form — ditampilkan inline di bawah dropzone. */
  error?: string
  disabled?: boolean
  /** Status proses pengiriman ke server (dikendalikan induk form). */
  status?: UploadStatus
  /** Progress 0-100. Jika tidak diisi, bar bergerak tanpa angka (indeterminat). */
  progress?: number
  /** Menandai berkas sudah pernah terunggah (chip hijau "Sudah terunggah"). */
  uploaded?: boolean
  /** Teks bantuan tambahan di bawah dropzone. */
  helperText?: React.ReactNode
  required?: boolean
}

/** Terjemahkan atribut `accept` menjadi label yang dimengerti orang awam. */
function formatLabel(accept: string): string {
  const parts = accept
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const labels = parts.map((p) => {
    if (p === "image/*") return "Gambar (JPG/PNG/WEBP)"
    if (p === "application/pdf") return "PDF"
    if (p.startsWith(".")) return p.replace(".", "").toUpperCase()
    if (p.includes("/")) return p.split("/").pop()!.toUpperCase()
    return p
  })
  return Array.from(new Set(labels)).join(" • ")
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function FileUpload({
  label,
  description,
  accept = "image/*,.pdf",
  multiple = false,
  maxSizeMB = 5,
  files,
  onFilesChange,
  error,
  disabled = false,
  status = "idle",
  progress,
  uploaded = false,
  helperText,
  required = false,
}: FileUploadProps) {
  const inputId = React.useId()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)
  const replaceIndexRef = React.useRef<number | null>(null)
  const [dragActive, setDragActive] = React.useState(false)
  const [localError, setLocalError] = React.useState<string | null>(null)
  const [previewSrc, setPreviewSrc] = React.useState<string | null>(null)

  const canCamera = accept.includes("image")

  // Pratinjau gambar lokal (object URL) — dibuat saat file berubah,
  // dibersihkan saat komponen unmount / file berganti.
  const previews = React.useMemo(
    () => files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null)),
    [files]
  )
  React.useEffect(() => {
    return () => {
      previews.forEach((url) => url && URL.revokeObjectURL(url))
    }
  }, [previews])

  const commitFiles = (incoming: FileList | null, replaceIndex: number | null) => {
    if (!incoming || incoming.length === 0) return
    const rejected: string[] = []
    const valid: File[] = []
    Array.from(incoming).forEach((f) => {
      if (f.size > maxSizeMB * 1024 * 1024) {
        rejected.push(`${f.name} (${formatSize(f.size)})`)
      } else {
        valid.push(f)
      }
    })

    if (rejected.length > 0) {
      setLocalError(
        `Berkas melebihi batas ${maxSizeMB} MB: ${rejected.join(", ")}. Pilih berkas yang lebih kecil.`
      )
    } else {
      setLocalError(null)
    }

    if (valid.length === 0) return

    if (replaceIndex !== null) {
      const next = [...files]
      next[replaceIndex] = valid[0]
      onFilesChange(next)
      return
    }
    onFilesChange(multiple ? [...files, ...valid] : valid.slice(0, 1))
  }

  const openPicker = (replaceIndex: number | null = null, camera = false) => {
    if (disabled) return
    replaceIndexRef.current = replaceIndex
    const el = camera ? cameraInputRef.current : fileInputRef.current
    // Reset value agar memilih berkas yang sama pun tetap memicu onChange.
    if (el) {
      el.value = ""
      el.click()
    }
  }

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index))
    setLocalError(null)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    if (e.type === "dragleave" || e.type === "drop") setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (disabled) return
    commitFiles(e.dataTransfer.files, null)
  }

  const statusText: Record<UploadStatus, string | null> = {
    idle: null,
    uploading:
      progress !== undefined
        ? `Mengunggah… ${Math.round(progress)}%`
        : "Mengunggah berkas, mohon tunggu…",
    success: "Berkas berhasil diunggah.",
    error: "Berkas gagal diunggah. Silakan coba lagi.",
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-slate-700"
      >
        {label}
        {required && (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600">
            Wajib
          </span>
        )}
        {uploaded && (
          <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            Sudah terunggah
          </span>
        )}
        {description && (
          <span className="text-xs font-normal text-slate-500">({description})</span>
        )}
      </label>

      {/* Dropzone + tombol pilih */}
      <div
        className={cn(
          "relative rounded-2xl border-2 border-dashed bg-white px-4 py-5 text-center transition-colors sm:px-6",
          dragActive
            ? "border-yellow-400 bg-yellow-50/60"
            : "border-slate-300 hover:border-slate-400",
          (error || localError) && "border-rose-300 bg-rose-50/40",
          disabled && "cursor-not-allowed opacity-60"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            commitFiles(e.target.files, replaceIndexRef.current)
            replaceIndexRef.current = null
          }}
        />
        {canCamera && (
          <input
            ref={cameraInputRef}
            type="file"
            accept={accept}
            capture="environment"
            className="sr-only"
            disabled={disabled}
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              commitFiles(e.target.files, replaceIndexRef.current)
              replaceIndexRef.current = null
            }}
          />
        )}

        <span
          className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-yellow-200 bg-yellow-50 text-yellow-700"
          aria-hidden="true"
        >
          <Upload className="h-5 w-5" />
        </span>

        <p className="text-sm font-medium text-slate-700">
          Seret berkas ke sini, atau pilih dari perangkat
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Format: {formatLabel(accept)} • Maks. {maxSizeMB} MB per berkas
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            disabled={disabled}
            onClick={() => openPicker(null, false)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-yellow-500 px-5 text-sm font-bold text-slate-900 shadow-gold-soft transition-colors hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Pilih Berkas
          </button>
          {canCamera && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => openPicker(null, true)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              Ambil Foto
            </button>
          )}
        </div>
      </div>

      {helperText && <p className="text-xs leading-relaxed text-slate-500">{helperText}</p>}

      {(error || localError) && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-rose-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error || localError}
        </p>
      )}

      {/* Status pengiriman */}
      {status !== "idle" && (
        <div
          className={cn(
            "rounded-xl border px-3 py-2.5",
            status === "uploading" && "border-blue-200 bg-blue-50",
            status === "success" && "border-green-200 bg-green-50",
            status === "error" && "border-rose-200 bg-rose-50"
          )}
          role="status"
          aria-live="polite"
        >
          <p
            className={cn(
              "flex items-center gap-2 text-xs font-semibold",
              status === "uploading" && "text-blue-700",
              status === "success" && "text-green-700",
              status === "error" && "text-rose-700"
            )}
          >
            {status === "uploading" && (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            )}
            {status === "success" && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
            {status === "error" && <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />}
            {statusText[status]}
          </p>
          {status === "uploading" && (
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-100"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress !== undefined ? Math.round(progress) : undefined}
              aria-label="Progres unggah"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  progress !== undefined ? "bg-blue-500" : "w-1/3 animate-pulse bg-blue-400"
                )}
                style={progress !== undefined ? { width: `${Math.round(progress)}%` } : undefined}
              />
            </div>
          )}
        </div>
      )}

      {/* Daftar berkas terpilih */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-card"
            >
              <button
                type="button"
                onClick={() => previews[index] && setPreviewSrc(previews[index])}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-400",
                  previews[index] && "hover:ring-2 hover:ring-yellow-300"
                )}
                aria-label={
                  previews[index] ? `Pratinjau ${file.name}` : `Berkas ${file.name}`
                }
              >
                {previews[index] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL objek (blob:) dari file pilihan pengguna; next/image tidak mendukungnya
                  <img src={previews[index]!} alt="" className="h-full w-full object-cover" />
                ) : file.type === "application/pdf" ? (
                  <FileText className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <ImageIcon className="h-5 w-5" aria-hidden="true" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{file.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  <span>{formatSize(file.size)}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-medium text-yellow-700">Siap diunggah</span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => openPicker(index, false)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Ganti
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeFile(index)}
                  aria-label={`Hapus ${file.name}`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Pratinjau gambar ukuran penuh */}
      <Dialog open={previewSrc !== null} onOpenChange={(open) => !open && setPreviewSrc(null)}>
        <DialogContent className="max-w-2xl border-0 bg-transparent p-0 shadow-none sm:max-w-2xl">
          <DialogTitle className="sr-only">Pratinjau berkas</DialogTitle>
          {previewSrc && (
            // eslint-disable-next-line @next/next/no-img-element -- pratinjau blob: milik pengguna, bukan aset publik
            <img
              src={previewSrc}
              alt="Pratinjau berkas terpilih"
              className="max-h-[75vh] w-full rounded-2xl border border-white/20 bg-white object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
