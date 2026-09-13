// src/components/pendaftaran/upload-dokumen-form.tsx

"use client"

import * as React from "react"
import { uploadDokumenPendaftaran } from "@/actions/upload-dokumen"
import { Button } from "@/components/ui/button"
import { FileUpload } from "@/components/ui/file-upload"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Upload, BadgeCheck, FileUp } from "lucide-react"
import Link from "next/link"

interface UploadDokumenFormProps {
  nomorPendaftaran: string
  sudahAda: {
    kartuKeluarga: boolean
    akteLahir: boolean
    foto: boolean
  }
}

export function UploadDokumenForm({
  nomorPendaftaran,
  sudahAda,
}: UploadDokumenFormProps) {
  const [filesKK, setFilesKK] = React.useState<File[]>([])
  const [filesAkte, setFilesAkte] = React.useState<File[]>([])
  const [filesFoto, setFilesFoto] = React.useState<File[]>([])
  const [isUploading, setIsUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  const handleUpload = async () => {
    if (
      filesKK.length === 0 &&
      filesAkte.length === 0 &&
      filesFoto.length === 0
    ) {
      setError("Pilih minimal satu berkas untuk diunggah")
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      // File dikirim langsung ke server action — server yang mengunggahnya ke
      // storage dengan service role (kontrol path & validasi keamanan penuh).
      const formData = new FormData()
      formData.append("nomorPendaftaran", nomorPendaftaran)
      if (filesKK.length > 0) formData.append("kartuKeluarga", filesKK[0])
      if (filesAkte.length > 0) formData.append("akteLahir", filesAkte[0])
      if (filesFoto.length > 0) formData.append("foto", filesFoto[0])

      const result = await uploadDokumenPendaftaran(formData)

      if (result.success) {
        setSuccess(true)
        setFilesKK([])
        setFilesAkte([])
        setFilesFoto([])
      } else {
        setError(result.message)
      }
    } catch (err) {
      console.error("Upload error:", err)
      setError("Terjadi kesalahan saat mengupload. Silakan coba lagi.")
    } finally {
      setIsUploading(false)
    }
  }

  if (success) {
    return (
      <Card className="max-w-md w-full mx-auto text-center">
        <CardContent className="p-8 space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-success/10 rounded-full mx-auto">
            <BadgeCheck className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            Dokumen Berhasil Diupload!
          </h2>
          <p className="text-gray-500 text-sm">
            Berkas pendaftaran Anda telah diperbarui dan siap diverifikasi
            panitia. Silakan ulangi halaman ini untuk mengunggah berkas lain.
          </p>
          <div className="pt-2">
            <Button asChild>
              <Link href={`/pendaftaran/${nomorPendaftaran}/upload-dokumen`}>
                Unggah Dokumen Lain
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileUp className="h-5 w-5 text-primary" />
          Dokumen Pendukung
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        <p className="text-sm text-gray-500">
          Unggah berkas pendukung yang dibutuhkan untuk melengkapi pendaftaran.
          Berkas yang sudah ada dapat diganti dengan mengunggah yang baru.
        </p>

        <FileUpload
          label="Kartu Keluarga (KK)"
          description={
            sudahAda.kartuKeluarga ? "sudah diupload" : "opsional, bisa diupload nanti"
          }
          files={filesKK}
          onFilesChange={setFilesKK}
          accept="image/*,.pdf"
        />
        <FileUpload
          label="Akta Kelahiran"
          description={
            sudahAda.akteLahir ? "sudah diupload" : "opsional, bisa diupload nanti"
          }
          files={filesAkte}
          onFilesChange={setFilesAkte}
          accept="image/*,.pdf"
        />
        <FileUpload
          label="Pas Foto 3x4"
          description={
            sudahAda.foto ? "sudah diupload" : "opsional, bisa diupload nanti"
          }
          files={filesFoto}
          onFilesChange={setFilesFoto}
          accept="image/*"
        />

        <Button
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full"
          size="lg"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Mengupload...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Dokumen
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}