"use client"

import * as React from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  getDaftarEmailOutbox,
  retryEmailOutbox,
  type DaftarEmailOutbox,
  type EmailOutboxItem,
} from "@/actions/email-outbox"
import { Mail, RefreshCw, Send } from "lucide-react"

const PAGE_SIZE = 25

const FILTERS = [
  { value: "SEMUA", label: "Semua" },
  { value: "PENDING", label: "Menunggu" },
  { value: "SENT", label: "Terkirim" },
  { value: "FAILED", label: "Gagal" },
] as const

function formatWaktu(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function StatusPill({ status }: { status: EmailOutboxItem["status"] }) {
  // Warna + teks (bukan warna saja) — memenuhi aksesibilitas.
  const map: Record<EmailOutboxItem["status"], string> = {
    PENDING: "border-amber-300 bg-amber-50 text-amber-800",
    SENT: "border-emerald-300 bg-emerald-50 text-emerald-800",
    FAILED: "border-rose-300 bg-rose-50 text-rose-800",
  }
  const label: Record<EmailOutboxItem["status"], string> = {
    // Label untuk data outbox LAMA. Email baru tidak pernah berstatus ini —
    // pengiriman langsung dilaporkan sebagai "Terkirim langsung" / "Gagal
    // dikirim" pada pesan hasil aksi masing-masing.
    PENDING: "Menunggu (lama)",
    SENT: "Terkirim",
    FAILED: "Gagal",
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${map[status]}`}
    >
      {label[status]}
    </span>
  )
}

export function EmailOutboxPageClient({
  initialData,
  initialError,
}: {
  initialData: DaftarEmailOutbox | null
  initialError: boolean
}) {
  const { toast } = useToast()
  const [data, setData] = React.useState<DaftarEmailOutbox | null>(initialData)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(
    initialError ? "Gagal memuat data awal. Silakan coba muat ulang." : null,
  )
  const [status, setStatus] = React.useState<(typeof FILTERS)[number]["value"]>("SEMUA")
  const [page, setPage] = React.useState(1)
  const [retryingId, setRetryingId] = React.useState<string | null>(null)

  const load = React.useCallback(
    async (nextStatus = status, nextPage = page) => {
      setLoading(true)
      setError(null)
      try {
        const res = await getDaftarEmailOutbox({
          status: nextStatus,
          page: nextPage,
          pageSize: PAGE_SIZE,
        })
        if (res.success && res.data) {
          setData(res.data)
        } else {
          setError(res.message || "Gagal memuat daftar email outbox")
        }
      } catch {
        setError("Gagal memuat daftar email outbox")
      } finally {
        setLoading(false)
      }
    },
    [status, page],
  )

  const handleFilter = (value: (typeof FILTERS)[number]["value"]) => {
    setStatus(value)
    setPage(1)
    void load(value, 1)
  }

  const handlePage = (next: number) => {
    setPage(next)
    void load(status, next)
  }

  const handleRetry = async (item: EmailOutboxItem) => {
    setRetryingId(item.id)
    try {
      const res = await retryEmailOutbox(item.id)
      toast({
        variant: res.success ? undefined : "destructive",
        title: res.success ? "Email dikirim ulang" : "Gagal mengirim ulang",
        description: res.message,
      })
      await load(status, page)
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal mengirim ulang",
        description: "Terjadi kesalahan. Silakan coba lagi.",
      })
    } finally {
      setRetryingId(null)
    }
  }

  const items = data?.items ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeader
        title="Email Outbox (Riwayat)"
        subtitle="Riwayat email outbox lama beserta status kirim ulangnya. Email baru tidak masuk ke sini — semua email baru dikirim langsung melalui provider (Resend) tanpa antrean."
      />

      {/* Ringkasan status */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            ["Menunggu", data?.ringkasan.pending ?? 0, "text-amber-700"],
            ["Terkirim", data?.ringkasan.sent ?? 0, "text-emerald-700"],
            ["Gagal", data?.ringkasan.failed ?? 0, "text-rose-700"],
          ] as const
        ).map(([label, value, cls]) => (
          <Card key={label} className="rounded-2xl border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className={`mt-1 text-2xl font-black ${cls}`}>{value}</p>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter status email">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={status === f.value}
            onClick={() => handleFilter(f.value)}
            className={`min-h-[40px] rounded-xl border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              status === f.value
                ? "border-yellow-400 bg-yellow-50 text-yellow-800"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {f.label}
          </button>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => void load(status, page)}
          className="ml-auto min-h-[40px] rounded-xl"
        >
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Muat ulang
        </Button>
      </div>

      {loading && !data && <PageSkeleton label="Memuat email outbox..." />}

      {error && (
        <Card className="rounded-2xl border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-medium text-rose-700">{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void load(status, page)}
            className="mt-3 min-h-[40px] rounded-xl"
          >
            Coba lagi
          </Button>
        </Card>
      )}

      {!error && items.length === 0 && !loading && (
        <EmptyState
          title="Tidak ada email"
          description="Belum ada email outbox lama pada filter ini. Halaman ini hanya menampilkan riwayat email outbox lama — email baru dikirim langsung melalui provider dan tidak masuk antrean."
        />
      )}

      {!error && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="rounded-2xl border-slate-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={item.status} />
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      {item.jenisEmail}
                    </span>
                  </div>
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {item.subject}
                  </p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {item.recipient}
                  </p>
                  <p className="text-xs text-slate-500">
                    Percobaan: <strong>{item.attempts}</strong> · Dibuat:{" "}
                    {formatWaktu(item.createdAt)}
                    {item.sentAt ? ` · Terkirim: ${formatWaktu(item.sentAt)}` : ""}
                    {item.nextRetryAt && item.status === "PENDING"
                      ? ` · Retry: ${formatWaktu(item.nextRetryAt)}`
                      : ""}
                  </p>
                  {item.lastError && (
                    <p className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
                      {item.lastError}
                    </p>
                  )}
                </div>

                {item.status !== "SENT" && (
                  <Button
                    type="button"
                    onClick={() => void handleRetry(item)}
                    disabled={retryingId === item.id}
                    className="min-h-[44px] shrink-0 rounded-xl"
                  >
                    <Send className="mr-1.5 h-4 w-4" />
                    {retryingId === item.id ? "Mengirim..." : "Kirim ulang"}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Halaman {data.page} dari {data.totalPages} · {data.total} email
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={data.page <= 1 || loading}
              onClick={() => handlePage(data.page - 1)}
              className="min-h-[44px] rounded-xl"
            >
              Sebelumnya
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={data.page >= data.totalPages || loading}
              onClick={() => handlePage(data.page + 1)}
              className="min-h-[44px] rounded-xl"
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
