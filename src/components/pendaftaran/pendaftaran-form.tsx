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
import { Loader2, User, Users, School, FileUp } from "lucide-react"

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
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  // File states
  const [filesKK, setFilesKK] = React.useState<File[]>([])
  const [filesAkte, setFilesAkte] = React.useState<File[]>([])
  const [filesFoto, setFilesFoto] = React.useState<File[]>([])

  // Kelas yang tersedia berdasarkan jenjang yang dipilih
  const [availableKelas, setAvailableKelas] = React.useState<
    Array<{ id: string; nama: string }>
  >([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PendaftaranFormValues>({
    resolver: zodResolver(pendaftaranSchema),
    defaultValues: {
      jenisKelamin: undefined,
      jenjangTujuanId: "",
      kelasTujuanId: "",
    },
  })

  const selectedJenjang = watch("jenjangTujuanId")

  // Update daftar kelas ketika jenjang berubah
  React.useEffect(() => {
    if (selectedJenjang) {
      const jenjang = jenjangList.find((j) => j.id === selectedJenjang)
      setAvailableKelas(jenjang?.kelas || [])
      setValue("kelasTujuanId", "")
    } else {
      setAvailableKelas([])
    }
  }, [selectedJenjang, jenjangList, setValue])

  const onSubmit = async (data: PendaftaranFormValues) => {
    setIsSubmitting(true)
    setServerError(null)

    try {
      // 1. Upload dokumen ke Supabase Storage terlebih dahulu
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

      // 2. Buat FormData untuk server action
      const formData = new FormData()
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          formData.append(key, value as string)
        }
      })

      // Tambahkan path dokumen
      if (dokKKPath) formData.append("dokKartuKeluarga", dokKKPath)
      if (dokAktePath) formData.append("dokAkteLahir", dokAktePath)
      if (dokFotoPath) formData.append("dokFoto", dokFotoPath)

      // 3. Kirim ke server action
      const result = await createPendaftaran(formData)

      if (result.success && result.data) {
        // Redirect ke halaman sukses
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

      {/* ========== DATA CALON SISWA ========== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            Data Calon Siswa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nama Lengkap */}
            <div className="md:col-span-2">
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

            {/* Tempat Lahir */}
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

            {/* Tanggal Lahir */}
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

            {/* Jenis Kelamin */}
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

            {/* NISN */}
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

            {/* Alamat */}
            <div className="md:col-span-2">
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

      {/* ========== DATA ORANG TUA / WALI ========== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Data Orang Tua / Wali
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
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
                No. HP <span className="text-destructive">*</span>
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

            <div className="md:col-span-2">
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
        </CardContent>
      </Card>

      {/* ========== JENJANG & KELAS TUJUAN ========== */}
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

      {/* ========== DOKUMEN PENDUKUNG ========== */}
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

      {/* ========== SUBMIT ========== */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push("/")}
        >
          Batal
        </Button>
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
      </div>
    </form>
  )
}