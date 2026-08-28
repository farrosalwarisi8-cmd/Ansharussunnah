// src/components/ui/file-upload.tsx

"use client"

import * as React from "react"
import { Upload, X, FileText, Image } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileUploadProps {
  label: string
  description?: string
  accept?: string
  multiple?: boolean
  maxSizeMB?: number
  files: File[]
  onFilesChange: (files: File[]) => void
  error?: string
  disabled?: boolean
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
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = React.useState(false)

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return
    const fileArray = Array.from(newFiles)

    // Validasi ukuran
    const validFiles = fileArray.filter((f) => {
      if (f.size > maxSizeMB * 1024 * 1024) {
        alert(`File "${f.name}" melebihi ${maxSizeMB} MB`)
        return false
      }
      return true
    })

    if (multiple) {
      onFilesChange([...files, ...validFiles])
    } else {
      onFilesChange(validFiles.slice(0, 1))
    }
  }

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    onFilesChange(newFiles)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {description && (
          <span className="ml-1 text-xs font-normal text-gray-400">
            ({description})
          </span>
        )}
      </label>

      {/* Drop Zone */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-gray-200 hover:border-gray-300",
          disabled && "opacity-50 cursor-not-allowed",
          error && "border-destructive"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
        <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-primary">Klik untuk upload</span>{" "}
          atau drag & drop
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {accept} (maks. {maxSizeMB} MB)
        </p>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* File Preview List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 bg-gray-50 rounded-lg p-3"
            >
              {file.type.startsWith("image/") ? (
                <Image className="h-5 w-5 text-gray-400" />
              ) : (
                <FileText className="h-5 w-5 text-gray-400" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-400">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(index)
                }}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}