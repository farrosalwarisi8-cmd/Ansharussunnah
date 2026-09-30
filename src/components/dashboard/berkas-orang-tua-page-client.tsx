// src/components/dashboard/berkas-orang-tua-page-client.tsx

"use client"

import * as React from "react"
import {
  getBerkasAnak,
  uploadBerkasAnak,
  hapusBerkasAnak,
  type BerkasSiswaData,
} from "@/actions/berkas-orang-tua"
import { useDashboard } from "@/components/dashboard/dashboard-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChildSelector } from "@/components/dashboard/child-selector"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  UploadCloud,
  Loader2,
  Trash2,
  FileText,
  User,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"

const ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"

function isPdfUrl(url?: string | null): boolean {
  return !!url && /\.pdf(\?|#|$)/i.test(url)
}

function DokumenPreview({ label, url }: { label: string; url?: string | null }) {
  if (!url) {
    return (
      <div className="h-28 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 text-xs gap-1">
        <FileText className="h-5 w-5" />
        Belum ada berkas
      </div>
    )
  }

  return isPdfUrl(url) ? (
    <iframe
      src={url}
      title={label}
      className="w-full h-28 rounded-lg border border-slate-200 bg-slate-100"
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={label}
      className="h-28 w-auto rounded-lg border border-slate-200 object-contain bg-slate-100"
    />
  )
}

export default function BerkasOrangTuaPage() {
  const { selectedChild } = useDashboard()
  const { toast } = useToast()
  const [data, setData] = React.useState<BerkasSiswaData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [busy, setBusy] = React.useState<string | null>(null)
  const fileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({})
  const lainnyaRef = React.useRef<HTMLInputElement | null>(null)

  const siswaId = selectedChild?.id ?? null

  const reload = React.useCallback(async () => {
    if (!siswaId) {
      setData(null)
      return
    }
    setLoading(true)
    const res = await getBerkasAnak(siswaId)
    setLoading(false)
    if (res.success && res.data) {
      setData(res.data)
    } else {
      setData(null)
      toast({ variant: "destructive", title: "Gagal memuat berkas", description: res.message })
    }
  }, [siswaId, toast])

  React.useEffect(() => {
    setData(null)
    reload()
  }, [reload])

  async function handleFile(kategori: string, file: File | null) {
    if (!file || !siswaId) return
    setBusy(kategori)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await uploadBerkasAnak(siswaId, kategori, fd)
      if (res.success) {
        toast({ title: "Berkas Diunggah", description: res.message })
        await reload()
      } else {
        toast({ variant: "destructive", title: "Gagal", description: res.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Terjadi kesalahan saat mengunggah berkas." })
    } finally {
      setBusy(null)
      if (fileInputRefs.current[kategori]) fileInputRefs.current[kategori]!.value = ""
      if (lainnyaRef.current) lainnyaRef.current.value = ""
    }
  }

  async function handleDelete(kategori: string, path?: string) {
    if (!siswaId) return
    const key = kategori + (path || "")
    setBusy(key)
    try {
      const res = await hapusBerkasAnak(siswaId, kategori, path)
      if (res.success) {
        toast({ title: "Berkas Dihapus", description: res.message })
        await reload()
      } else {
        toast({ variant: "destructive", title: "Gagal", description: res.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Terjadi kesalahan saat menghapus berkas." })
    } finally {
      setBusy(null)
    }
  }

  if (!selectedChild) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <DashboardHeader
          title="Berkas Santri"
          subtitle="Lengkapi dan periksa berkas pendukung anak Anda."
        />
        <Card>
          <CardContent className="p-10 text-center text-sm text-slate-500">
            Pilih anak terlebih dahulu untuk melihat berkasnya.
          </CardContent>
        </Card>
      </div>
    )
  }

  const s = data?.siswa
  const rows = [
    { kategori: "kartuKeluarga", label: "Kartu Keluarga (KK)", url: data?.berkas.kartuKeluarga },
    { kategori: "akteLahir", label: "Akta Kelahiran", url: data?.berkas.akteLahir },
    { kategori: "foto", label: "Pas Foto 3x4", url: data?.berkas.foto },
  ] as const

  // Angka "berapa berkas yang sudah lengkap" DIHITUNG OLEH HELPER YANG SAMA
  // dengan halaman cek status, upload dokumen, dan panel verifikasi admin.
  //
  // Sebelumnya dihitung dari `Boolean(r.url)` + jumlah dokumen lain. Itu
  // kebiasaan yang salah: kelengkapan berkas adalah fakta "path-nya tercatat di
  // database", sedangkan `url` hanya hasil penandatanganan sementara. Berkas
  // yang tercatat tapi gagal ditandatangani akan terlihat belum ada di sini,
  // padahal sudah lengkap di panel panitia — dua layar menghitung
  // data yang sama dengan aturan berbeda.
  const statusBerkas = data?.statusBerkas
  const jumlahLengkap = statusBerkas
    ? statusBerkas.jumlahLengkap + statusBerkas.lainnya
    : 0

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <DashboardHeader
        title="Berkas Santri"
        subtitle="Lengkapi berkas yang kurang. Berkas di sini yang dipakai panitia dan guru."
      />

      <ChildSelector />

      <Card>
        <CardContent className="p-4 sm:p-5 space-y-5">
          {s && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <User className="h-4 w-4 text-slate-400" /> {s.nama}
              </p>
              <p className="text-slate-600">
                {s.jenjangNama} {s.kelasNama}
              </p>
              {s.nisn && (
                <p className="text-xs text-slate-500 font-mono">NISN: {s.nisn}</p>
              )}
            </div>
          )}

          {!loading && data && (
            <div
              className={`flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed ${
                jumlahLengkap === 0
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
              }`}
            >
              {jumlahLengkap === 0 ? (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <p>
                {jumlahLengkap === 0
                  ? "Belum ada berkas sama sekali. Silakan unggah minimal Kartu Keluarga dan Akta Kelahiran agar proses verfikasinya tidak tertunda."
                  : `${statusBerkas?.jumlahLengkap ?? 0} dari 3 berkas utama sudah tersimpan${statusBerkas?.lainnya ? `, ditambah ${statusBerkas.lainnya} dokumen tambahan` : ""}. Pastikan semua berkas terbaca jelas dan tidak terpotong.`}
              </p>
            </div>
          )}

          {loading && !data ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Memuat berkas...
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {rows.map((row) => (
                  <div
                    key={row.kategori}
                    className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="text-sm font-bold text-slate-800">{row.label}</p>
                      <DokumenPreview label={row.label} url={row.url} />
                    </div>
                    <div className="flex flex-col sm:items-end gap-2">
                      <label className="w-full sm:w-auto">
                        <input
                          ref={(el) => {
                            fileInputRefs.current[row.kategori] = el
                          }}
                          type="file"
                          accept={ACCEPT}
                          className="hidden"
                          onChange={(e) => handleFile(row.kategori, e.target.files?.[0] ?? null)}
                        />
                        <Button
                          asChild
                          size="sm"
                          variant={row.url ? "outline" : "default"}
                          disabled={busy === row.kategori}
                          className="w-full sm:w-auto rounded-xl text-xs font-semibold"
                        >
                          <span>
                            {busy === row.kategori ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <UploadCloud className="h-3 w-3 mr-1" />
                            )}
                            {row.url ? "Ganti Berkas" : "Unggah Berkas"}
                          </span>
                        </Button>
                      </label>
                      {row.url && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy === row.kategori}
                          onClick={() => handleDelete(row.kategori)}
                          className="w-full sm:w-auto rounded-xl text-xs font-semibold"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          {busy === row.kategori ? "Menghapus..." : "Hapus"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-slate-400" /> Dokumen Lain
                </p>
                {data?.berkas.lainnya.length ? (
                  <ul className="space-y-3 mb-2">
                    {data.berkas.lainnya.map((item, idx) => (
                      <li
                        key={item.path}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-slate-200 p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-slate-500 mb-1">
                            Dokumen {idx + 1}
                          </p>
                          {item.url ? (
                            isPdfUrl(item.url) ? (
                              <iframe
                                src={item.url}
                                title={`Dokumen Lain ${idx + 1}`}
                                className="w-full h-28 rounded-lg border border-slate-200 bg-slate-100"
                              />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.url}
                                alt={`Dokumen Lain ${idx + 1}`}
                                className="h-28 w-auto rounded-lg border border-slate-200 object-contain bg-slate-100"
                              />
                            )
                          ) : (
                            <p className="text-xs text-slate-400">
                              Pratinjau tidak tersedia.
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy === `lainnya${item.path}`}
                          onClick={() => handleDelete("lainnya", item.path)}
                          className="rounded-xl text-xs font-semibold"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          {busy === `lainnya${item.path}` ? "Menghapus..." : "Hapus"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 mb-2">Belum ada dokumen tambahan.</p>
                )}
                <label className="inline-block">
                  <input
                    ref={lainnyaRef}
                    type="file"
                    accept={ACCEPT}
                    className="hidden"
                    onChange={(e) => handleFile("lainnya", e.target.files?.[0] ?? null)}
                  />
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    disabled={busy === "lainnya"}
                    className="rounded-xl text-xs font-semibold"
                  >
                    <span>
                      {busy === "lainnya" ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <UploadCloud className="h-3 w-3 mr-1" />
                      )}
                      Tambah Dokumen Lain
                    </span>
                  </Button>
                </label>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
