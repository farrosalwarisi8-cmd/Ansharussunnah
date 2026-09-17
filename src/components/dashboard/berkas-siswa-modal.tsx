"use client"

// src/components/dashboard/berkas-siswa-modal.tsx
// Modal kelola berkas siswa manual: unggah / ganti / hapus / pratinjau / cetak
// (KK, akta lahir, pas foto, dokumen lain). Meniru pola Verifikasi Pendaftaran.

import * as React from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import {
  getBerkasSiswa,
  uploadBerkasSiswa,
  hapusBerkasSiswa,
  type BerkasSiswaData,
} from "@/actions/berkas-siswa"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  UploadCloud,
  Loader2,
  Trash2,
  Printer,
  FileText,
  User,
} from "lucide-react"

// ============================================
// PRINT HELPERS (salinan pola verifikasi-pendaftaran)
// ============================================

function cleanupPrintMode() {
  document.body.classList.remove("print-mode")
}

async function activatePrintMode() {
  document.body.classList.add("print-mode")

  const printRoot = document.querySelector(".print-only")
  if (printRoot) {
    const resources = Array.from(
      printRoot.querySelectorAll("img, iframe")
    ) as Array<HTMLImageElement | HTMLIFrameElement>

    if (resources.length > 0) {
      await Promise.race([
        Promise.all(
          resources.map((el) => {
            const ready =
              el instanceof HTMLImageElement
                ? el.complete
                : el.contentDocument !== null || el.src.startsWith("about:")
            if (ready) return Promise.resolve()
            return new Promise<void>((resolve) => {
              el.addEventListener("load", () => resolve(), { once: true })
              el.addEventListener("error", () => resolve(), { once: true })
            })
          })
        ),
        new Promise<void>((resolve) => setTimeout(resolve, 4000)),
      ])
    }
  }

  window.addEventListener("afterprint", cleanupPrintMode, { once: true })
  window.print()
  window.setTimeout(cleanupPrintMode, 5000)
}

function PrintHeader({
  subtitle,
  rightInfo,
}: {
  subtitle: string
  rightInfo: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-6">
      <div className="flex items-center gap-4">
        <Image
          src="/anshorussunnah-logo.webp"
          alt="Anshorussunnah"
          width={64}
          height={64}
          className="object-contain"
        />
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight text-slate-900">
            Pondok Pesantren &amp; Sekolah Islam Terpadu Anshorussunnah
          </h1>
          <p className="text-sm font-semibold text-slate-700">{subtitle}</p>
        </div>
      </div>
      <div className="text-right text-xs text-slate-600 space-y-0.5">{rightInfo}</div>
    </div>
  )
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <h2
        style={{
          fontSize: "13px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#1e293b",
          borderBottom: "1px solid #cbd5e1",
          paddingBottom: "5px",
          marginBottom: "8px",
        }}
      >
        {title}
      </h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function PrintRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <tr>
      <td
        style={{
          width: "260px",
          padding: "5px 12px 5px 0",
          color: "#475569",
          verticalAlign: "top",
        }}
      >
        {label}
      </td>
      <td style={{ padding: "5px 0", fontWeight: 600, color: "#1e293b", verticalAlign: "top" }}>
        {value || "-"}
      </td>
    </tr>
  )
}

function isPdfUrl(url?: string | null): boolean {
  return !!url && /\.pdf(\?|#|$)/i.test(url)
}

function PrintDocument({ label, url }: { label: string; url?: string | null }) {
  return (
    <tr>
      <td
        style={{
          width: "260px",
          padding: "6px 12px 6px 0",
          color: "#475569",
          verticalAlign: "top",
          fontWeight: 600,
          fontSize: "13px",
        }}
      >
        {label}
      </td>
      <td style={{ padding: "6px 0", verticalAlign: "top" }}>
        {isPdfUrl(url) ? (
          <iframe
            src={url as string}
            title={label}
            style={{
              width: "300px",
              height: "220px",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              background: "#f8fafc",
            }}
          />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            style={{
              maxWidth: "300px",
              maxHeight: "220px",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              objectFit: "contain",
              display: "block",
            }}
          />
        ) : (
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>Tidak ada berkas</span>
        )}
      </td>
    </tr>
  )
}

// ============================================
// MODAL
// ============================================

const ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"

function formatDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

export function BerkasSiswaModal({
  siswaId,
  nama,
  open,
  onClose,
  onChanged,
}: {
  siswaId: string
  nama: string
  open: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [data, setData] = React.useState<BerkasSiswaData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [uploading, setUploading] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState<string | null>(null)
  const fileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({})
  const lainnyaRef = React.useRef<HTMLInputElement | null>(null)

  const reload = React.useCallback(async () => {
    setLoading(true)
    const res = await getBerkasSiswa(siswaId)
    setLoading(false)
    if (res.success && res.data) {
      setData(res.data)
    } else {
      toast({ variant: "destructive", title: "Gagal memuat berkas", description: res.message })
    }
  }, [siswaId, toast])

  React.useEffect(() => {
    if (open) {
      setData(null)
      reload()
    }
  }, [open, reload])

  if (!open) return null

  const s = data?.siswa

  async function handleFile(kategori: string, file: File | null) {
    if (!file) return
    setUploading(kategori)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await uploadBerkasSiswa(siswaId, kategori, fd)
      if (res.success) {
        toast({ title: "Berkas Diunggah", description: res.message })
        onChanged()
        await reload()
      } else {
        toast({ variant: "destructive", title: "Gagal", description: res.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Terjadi kesalahan saat mengunggah berkas." })
    } finally {
      setUploading(null)
      if (fileInputRefs.current[kategori]) fileInputRefs.current[kategori]!.value = ""
      if (lainnyaRef.current) lainnyaRef.current.value = ""
    }
  }

  async function handleDelete(kategori: string, path?: string) {
    setDeleting(kategori + (path || ""))
    try {
      const res = await hapusBerkasSiswa(siswaId, kategori, path)
      if (res.success) {
        toast({ title: "Berkas Dihapus", description: res.message })
        onChanged()
        await reload()
      } else {
        toast({ variant: "destructive", title: "Gagal", description: res.message })
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Terjadi kesalahan saat menghapus berkas." })
    } finally {
      setDeleting(null)
    }
  }

  const kategoriRows = [
    { kategori: "kartuKeluarga", label: "Kartu Keluarga (KK)", url: data?.berkas.kartuKeluarga },
    { kategori: "akteLahir", label: "Akta Kelahiran", url: data?.berkas.akteLahir },
    { kategori: "foto", label: "Pas Foto 3x4", url: data?.berkas.foto },
  ] as const

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Berkas Siswa — {nama}</DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto pr-1 space-y-4 flex-1">
            {loading && !data ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Memuat berkas...
              </div>
            ) : (
              <>
                {s && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                      <User className="h-4 w-4 text-slate-400" /> {s.nama}
                    </p>
                    <p className="text-slate-600">{s.email}</p>
                    {(s.nisn || s.nis) && (
                      <p className="text-xs text-slate-500 font-mono">
                        NISN: {s.nisn || "—"} | NIS: {s.nis || "—"}
                      </p>
                    )}
                    {s.kelasNama && (
                      <p className="text-xs text-slate-500">
                        {s.jenisKelamin === "LAKI_LAKI" ? "Ikhwan" : s.jenisKelamin === "PEREMPUAN" ? "Akhwat" : "—"}{" "}
                        • {s.jenjangNama} {s.kelasNama}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  {kategoriRows.map((row) => (
                    <div
                      key={row.kategori}
                      className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 mb-1">{row.label}</p>
                        <div className="max-h-40 overflow-hidden">
                          {row.url ? (
                            isPdfUrl(row.url) ? (
                              <iframe
                                src={row.url}
                                title={row.label}
                                className="w-full max-h-40 rounded-lg border border-slate-200 bg-slate-100"
                              />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={row.url}
                                alt={row.label}
                                className="max-h-40 w-auto rounded-lg border border-slate-200 object-contain bg-slate-100"
                              />
                            )
                          ) : (
                            <p className="text-xs text-slate-400">Belum ada berkas.</p>
                          )}
                        </div>
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
                            disabled={uploading === row.kategori}
                            className="w-full sm:w-auto rounded-xl text-xs font-semibold"
                          >
                            <span>
                              {uploading === row.kategori ? (
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
                            disabled={deleting === row.kategori}
                            onClick={() => handleDelete(row.kategori)}
                            className="w-full sm:w-auto rounded-xl text-xs font-semibold"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            {deleting === row.kategori ? "Menghapus..." : "Hapus"}
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
                    <ul className="space-y-3">
                      {data.berkas.lainnya.map((item, idx) => (
                        <li
                          key={item.path}
                          className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-slate-200 p-3"
                        >
                          <div className="flex-1 min-w-0 max-h-40 overflow-hidden">
                            {item.url && (
                              isPdfUrl(item.url) ? (
                                <iframe
                                  src={item.url}
                                  title={`Dokumen Lain ${idx + 1}`}
                                  className="w-full max-h-40 rounded-lg border border-slate-200 bg-slate-100"
                                />
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.url}
                                  alt={`Dokumen Lain ${idx + 1}`}
                                  className="max-h-40 w-auto rounded-lg border border-slate-200 object-contain bg-slate-100"
                                />
                              )
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="font-mono">Dokumen {idx + 1}</span>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={deleting === `lainnya${item.path}`}
                              onClick={() => handleDelete("lainnya", item.path)}
                              className="rounded-xl text-xs font-semibold"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              {deleting === `lainnya${item.path}` ? "Menghapus..." : "Hapus"}
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400 mb-2">Belum ada dokumen tambahan.</p>
                  )}
                  <label className="mt-3 inline-block">
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
                      disabled={uploading === "lainnya"}
                      className="rounded-xl text-xs font-semibold"
                    >
                      <span>
                        {uploading === "lainnya" ? (
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
          </div>

          <DialogFooter className="flex flex-row items-center justify-between gap-2">
            <Button
              size="sm"
              variant="default"
              disabled={loading || !data}
              onClick={activatePrintMode}
              className="rounded-xl text-xs font-semibold"
            >
              <Printer className="h-3 w-3 mr-1" />
              Cetak / PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              className="rounded-xl text-xs font-semibold"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {data && data.siswa && typeof document !== "undefined"
        ? createPortal(
            <div className="print-only">
              <div style={{ padding: "2.5rem 2rem", color: "#1e293b" }}>
                <PrintHeader
                  subtitle="Detail Berkas Siswa"
                  rightInfo={
                    <>
                      <p>
                        <strong>Nama:</strong> {data.siswa.nama}
                      </p>
                      <p>
                        <strong>Dicetak:</strong> {formatDate(new Date())}
                      </p>
                    </>
                  }
                />

                <PrintSection title="Data Siswa">
                  <PrintRow label="Nama Lengkap" value={data.siswa.nama} />
                  <PrintRow
                    label="Jenis Kelamin"
                    value={
                      data.siswa.jenisKelamin === "LAKI_LAKI"
                        ? "Laki-laki"
                        : data.siswa.jenisKelamin === "PEREMPUAN"
                          ? "Perempuan"
                          : null
                    }
                  />
                  <PrintRow label="NISN" value={data.siswa.nisn} />
                  <PrintRow label="NIS" value={data.siswa.nis} />
                  <PrintRow label="Kelas" value={data.siswa.kelasNama ? `${data.siswa.jenjangNama || ""} ${data.siswa.kelasNama}` : null} />
                  <PrintRow label="Email" value={data.siswa.email} />
                </PrintSection>

                <PrintSection title="Dokumen Terlampir">
                  <PrintDocument label="Kartu Keluarga (KK)" url={data.berkas.kartuKeluarga} />
                  <PrintDocument label="Akta Kelahiran" url={data.berkas.akteLahir} />
                  <PrintDocument label="Pas Foto" url={data.berkas.foto} />
                  {data.berkas.lainnya.length > 0 ? (
                    data.berkas.lainnya.map((item, idx) => (
                      <PrintDocument
                        key={item.path}
                        label={`Dokumen Lain ${idx + 1}`}
                        url={item.url}
                      />
                    ))
                  ) : (
                    <PrintDocument label="Dokumen Lain" url={null} />
                  )}
                </PrintSection>

                <p style={{ marginTop: "1.5rem", fontSize: "11px", color: "#64748b" }}>
                  Dokumen ini dicetak melalui sistem pendaftaran online Pondok Pesantren &amp; Sekolah Islam Terpadu Anshorussunnah.
                </p>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}