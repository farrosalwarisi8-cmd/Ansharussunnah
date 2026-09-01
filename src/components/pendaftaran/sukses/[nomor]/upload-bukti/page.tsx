// src/app/pendaftaran/[nomor]/upload-bukti/page.tsx

"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { uploadFileToStorage } from "@/lib/storage"
import { uploadBuktiTransferPendaftaran } from "@/actions/bukti-transfer"
import { Button } from "@/components/ui/button"
import { FileUpload } from "@/components/ui/file-upload"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Upload, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function UploadBuktiPage() {
  const params = useParams()
  const router = useRouter()
  const nomorPendaftaran = params.nomor as string

  const [files, setFiles] = React.useState<File[]>([])
  const [isUploading, setIsUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Silakan pilih file bukti transfer terlebih dahulu")
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      // 1. Upload file ke Supabase Storage
      const file = files[0]
      const folder = `transfer/${nomorPendaftaran}`
      const uploadResult = await uploadFileToStorage(
        "bukti-transfer",
        folder,
        file
      )

      if (uploadResult.error) {
        setError(uploadResult.error)
        setIsUploading(false)
        return
      }

      // 2. Simpan path ke database via server action
      const formData = new FormData()
      formData.append("nomorPendaftaran", nomorPendaftaran)
      formData.append("urlFile", uploadResult.path)
      formData.append("namaFile", file.name)
      formData.append("ukuranFile", file.size.toString())

      const result = await uploadBuktiTransferPendaftaran(formData)

      if (result.success) {
        setSuccess(true)
        setTimeout(() => {
          router.push("/cek-pendaftaran")
        }, 3000)
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
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-blue-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4 text-center">
          <CardContent className="p-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-success/10 rounded-full mb-4">
              <Upload className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Bukti Transfer Berhasil Diupload!
            </h2>
            <p className="text-gray-500 text-sm">
              Pendaftaran Anda sedang dalam proses verifikasi. Anda akan
              diarahkan ke halaman cek status.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-bold text-gray-900">Upload Bukti Transfer</span>
          <Link
            href={`/pendaftaran/sukses?nomor=${nomorPendaftaran}`}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-1">Nomor Pendaftaran</p>
          <p className="text-xl font-bold font-mono text-primary">
            {nomorPendaftaran}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload Bukti Transfer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 text-sm">
                {error}
              </div>
            )}

            <FileUpload
              label="Bukti Transfer"
              description="Screenshot/foto bukti transfer"
              files={files}
              onFilesChange={setFiles}
              accept="image/*,.pdf"
            />

            <Button
              onClick={handleUpload}
              disabled={isUploading || files.length === 0}
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
                  Upload Bukti Transfer
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}