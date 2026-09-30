// src/components/pendaftaran/upload-dokumen-form.tsx

"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { uploadDokumenPendaftaran } from "@/actions/upload-dokumen"
import { getTokenAkses, setTokenAkses } from "@/lib/pendaftaran-token-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  const [tokenAkses, setTokenAksesState] = React.useState("")
  const [isUploading, setIsUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    setTokenAksesState(getTokenAkses(nomorPendaftaran))
  }, [nomorPendaftaran])

  // Token yang diketik manual ikut disimpan ke sessionStorage. Tanpa ini,
  // pengguna yang mendaftar di perangkat lain harus mengetik ulang token yang
  // sama di halaman berikutnya (termasuk halaman verifikasi email), karena
  // halaman sukses tidak punya cara lain untuk mendapatkannya.
  const handleTokenChange = (nilai: string) => {
    const bersih = nilai.trim()
    setTokenAksesState(bersih)
    setTokenAkses(nomorPendaftaran, bersih)
  }

  const handleUpload = async () => {
    if (
      filesKK.length === 0 &&
      filesAkte.length === 0 &&
      filesFoto.length === 0
    ) {
      setError("Pilih minimal satu berkas untuk diunggah")
      return
    }

    if (!tokenAkses) {
      setError(
        "Token akses pendaftaran wajib diisi. Salin dari halaman 'Pendaftaran Berhasil'."
      )
      return
    }

    // Guard ukuran TOTAL sebelum mengirim: server action punya batas body
    // (lihat next.config.ts). Tanpa cek ini, payload yang melebihi batas
    // ditolak Next.js di luar action — pengguna hanya melihat error generik
    // "Terjadi kesalahan saat mengupload" tanpa tahu penyebabnya.
    const terpilih = [
      { label: "Kartu Keluarga (KK)", file: filesKK[0] },
      { label: "Akta Kelahiran", file: filesAkte[0] },
      { label: "Pas Foto 3x4", file: filesFoto[0] },
    ].filter((e): e is { label: string; file: File } => Boolean(e.file))
    const totalMB =
      terpilih.reduce((acc, e) => acc + e.file.size, 0) / 1024 / 1024
    if (totalMB > 23) {
      setError(
        "Total ukuran berkas terlalu besar (" +
          totalMB.toFixed(1) +
          " MB). Maksimal 23 MB per pengiriman — unggah berkas dalam dua tahap bila perlu."
      )
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      // File dikirim langsung ke server action — server yang mengunggahnya ke
      // storage dengan service role (kontrol path & validasi keamanan penuh).
      const formData = new FormData()
      formData.append("nomorPendaftaran", nomorPendaftaran)
      formData.append("tokenAkses", tokenAkses)
      if (filesKK.length > 0) formData.append("kartuKeluarga", filesKK[0])
      if (filesAkte.length > 0) formData.append("akteLahir", filesAkte[0])
      if (filesFoto.length > 0) formData.append("foto", filesFoto[0])

      const result = await uploadDokumenPendaftaran(formData)

      if (result.success) {
        setSuccess(true)
        setFilesKK([])
        setFilesAkte([])
        setFilesFoto([])
        // Status "sudah diupload" di form ini berasal dari server component
        // (props sudahAda). Refresh supaya prop terbaru terpakai saat pengguna
        // kembali ke form — tanpa ini indikator tetap "opsional" walau berkas
        // sudah tersimpan.
        router.refresh()
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
          <h2 className="text-xl font-bold text-slate-900">
            Dokumen Berhasil Diupload!
          </h2>
          <p className="text-sm leading-relaxed text-slate-500">
            Berkas pendaftaran Anda telah diperbarui dan siap diverifikasi
            panitia. Status terbaru dapat dilihat di halaman cek status.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Button asChild>
              <Link href={`/pendaftaran/${nomorPendaftaran}/upload-dokumen`}>
                Unggah Dokumen Lain
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/cek-pendaftaran">Lihat Status Pendaftaran</Link>
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
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700"
          >
            {error}
          </div>
        )}

        <p className="text-sm leading-relaxed text-slate-600">
          Unggah berkas pendukung yang dibutuhkan untuk melengkapi pendaftaran.
          Berkas yang sudah ada dapat diganti dengan mengunggah yang baru.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="token-akses">Token Akses Pendaftaran</Label>
          <Input
            id="token-akses"
            type="text"
            value={tokenAkses}
            onChange={(e) => handleTokenChange(e.target.value)}
            placeholder="Salin token akses dari halaman 'Pendaftaran Berhasil'"
            className="font-mono"
          />
          <p className="text-xs leading-relaxed text-slate-500">
            Token otomatis terisi jika Anda mengakses halaman ini langsung dari
            hasil pendaftaran. Diperlukan untuk memastikan berkas hanya bisa
            diunggah pemilik pendaftaran.
          </p>
        </div>

        <FileUpload
          label="Kartu Keluarga (KK)"
          description="opsional, bisa diupload nanti"
          uploaded={sudahAda.kartuKeluarga}
          files={filesKK}
          onFilesChange={setFilesKK}
          accept="image/*,.pdf"
          status={isUploading ? "uploading" : "idle"}
          disabled={isUploading}
        />
        <FileUpload
          label="Akta Kelahiran"
          description="opsional, bisa diupload nanti"
          uploaded={sudahAda.akteLahir}
          files={filesAkte}
          onFilesChange={setFilesAkte}
          accept="image/*,.pdf"
          status={isUploading ? "uploading" : "idle"}
          disabled={isUploading}
        />
        <FileUpload
          label="Pas Foto 3x4"
          description="opsional, bisa diupload nanti"
          uploaded={sudahAda.foto}
          files={filesFoto}
          onFilesChange={setFilesFoto}
          accept="image/*"
          status={isUploading ? "uploading" : "idle"}
          disabled={isUploading}
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