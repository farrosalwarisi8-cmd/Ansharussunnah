"use client";

import * as React from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  getPendaftaranList,
  getPendaftaranDetail,
  verifikasiPendaftaran,
} from "@/actions/verifikasi";
import {
  konfirmasiKontakWali,
  batalkanKonfirmasiKontakWali,
  METODE_KONFIRMASI,
  type MetodeKonfirmasi,
} from "@/actions/konfirmasi-kontak-wali";
import { hitungStatusBerkas, LABEL_BERKAS_UTAMA } from "@/lib/status-berkas";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import dynamic from "next/dynamic";
const Dialog = dynamic(
  () => import("@/components/ui/dialog").then((m) => m.Dialog),
  { ssr: false },
);
const DialogContent = dynamic(
  () => import("@/components/ui/dialog").then((m) => m.DialogContent),
  { ssr: false },
);
const DialogHeader = dynamic(
  () => import("@/components/ui/dialog").then((m) => m.DialogHeader),
  { ssr: false },
);
const DialogTitle = dynamic(
  () => import("@/components/ui/dialog").then((m) => m.DialogTitle),
  { ssr: false },
);
const DialogDescription = dynamic(
  () => import("@/components/ui/dialog").then((m) => m.DialogDescription),
  { ssr: false },
);
const DialogFooter = dynamic(
  () => import("@/components/ui/dialog").then((m) => m.DialogFooter),
  { ssr: false },
);
const ConfirmDialog = dynamic(
  () => import("@/components/ui/confirm-dialog").then((m) => m.ConfirmDialog),
  { ssr: false },
);
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  Search,
  RefreshCw,
  FileX,
  ArrowUpDown,
  Printer,
  PhoneCall,
  UserCheck,
} from "lucide-react";
import type { PendaftaranWithRelations } from "@/types";

/**
 * Badge status konfirmasi kontak wali — SATU-SATUNYA gerbang sebelum
 * pendaftaran boleh DITERIMA.
 *
 * Alur pendaftaran tidak pernah mengirim OTP email lagi, jadi tidak ada bukti
 * otomatis "orang ini menguasai kontak yang dicantumkan". Penggantinya adalah
 * pemeriksaan manual panitia yang dicatat di `kontakWaliDikonfirmasiAt`
 * (lihat src/actions/konfirmasi-kontak-wali.ts).
 *
 * Bedakan dua keadaan, karena artinya bagi panitia berbeda:
 *
 *   belum dikonfirmasi → pendaftaran TIDAK bisa disetujui. Menahan di sini
 *                        lebih baik daripada approval yang gagal belakangan,
 *                        setelah akun frantically terlanjur dibuat.
 *   sudah dikonfirmasi → ada jejak siapa/kapan/lewat apa. Boleh disetujui.
 *
 * Kolom `emailOrangTuaTerverifikasiAt` yang lama TIDAK dipakai lagi di sini:
 * isinya jejak OTP masa lalu, dan memakainya sebagai gerbang akan mencampur
 * makna audit dengan jejak konfirmasi kontak yang aktif.
 */
function KontakWaliBadge({
  konfirmasiAt,
  namaAdmin,
}: {
  konfirmasiAt?: Date | string | null;
  namaAdmin?: string | null;
}) {
  if (!konfirmasiAt) {
    return (
      <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 rounded-lg px-1.5 py-0.5">
        <PhoneCall className="h-3 w-3" />
        Kontak wali belum dikonfirmasi
      </div>
    );
  }

  return (
    <div
      className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-1.5 py-0.5"
      title={`Dikonfirmasi oleh ${namaAdmin || "panitia"} pada ${new Date(
        konfirmasiAt,
      ).toLocaleString("id-ID")}`}
    >
      <UserCheck className="h-3 w-3" />
      Kontak wali dikonfirmasi
    </div>
  );
}

/** Label bahasa-indonesia untuk metode konfirmasi kontak wali. */
const LABEL_METODE_KONFIRMASI: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  TELEPON: "Telepon",
  LANGSUNG: "Datang Langsung",
};

// Helper: Format label from enum value
function formatStatusOrangTua(val?: string | null): string {  if (!val) return "-";
  const map: Record<string, string> = {
    MASIH_HIDUP: "Masih Hidup",
    SUDAH_MENINGGAL: "Sudah Meninggal",
    TIDAK_DIKETAHUI: "Tidak Diketahui",
  };
  return map[val] || val;
}

function formatStatusWali(val?: string | null): string {
  if (!val) return "-";
  const map: Record<string, string> = {
    SAMA_DENGAN_AYAH: "Sama dengan Ayah",
    SAMA_DENGAN_IBU: "Sama dengan Ibu",
    LAINNYA: "Lainnya",
  };
  return map[val] || val;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type PendaftaranDetail = PendaftaranWithRelations;

type DetailData = {
  pendaftaran: PendaftaranWithRelations;
  signedUrls: {
    kartuKeluarga?: string | null;
    akteLahir?: string | null;
    foto?: string | null;
    buktiTransfer: Array<{ id: string; url: string | null }>;
  };
};

const STATUS_FILTERS = [
  { value: "ALL", label: "Semua" },
  { value: "MENUNGGU_VERIFIKASI", label: "Menunggu Verifikasi" },
  { value: "DITERIMA", label: "Diterima" },
  { value: "DITOLAK", label: "Ditolak" },
] as const;

function statusText(status?: string | null): string {
  const map: Record<string, string> = {
    MENUNGGU_PEMBAYARAN: "Menunggu Pembayaran",
    MENUNGGU_VERIFIKASI: "Menunggu Verifikasi",
    DITERIMA: "Diterima",
    DITOLAK: "Ditolak",
  };
  return (status && map[status]) || status || "-";
}

// Style sel tabel untuk dokumen cetak.
const cellStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "8px 10px",
  verticalAlign: "top",
};

// Ikutkan print CSS (body.print-mode) lalu bersihkan setelah dialog print ditutup.
function cleanupPrintMode() {
  document.body.classList.remove("print-mode");
}

// Menunggu pratinjau gambar/PDF di container print termuat sebelum memanggil
// window.print(). Konten .print-only disembunyikan (display:none) di layar,
// sehingga browser belum tentu selesai men-download berkas — tanpa penungguan
// ini pratinjau KK/akta/foto bisa tampil kosong saat di-print / Save as PDF.
async function activatePrintMode() {
  document.body.classList.add("print-mode");

  const printRoot = document.querySelector(".print-only");
  if (printRoot) {
    const resources = Array.from(
      printRoot.querySelectorAll("img, iframe"),
    ) as Array<HTMLImageElement | HTMLIFrameElement>;

    if (resources.length > 0) {
      await Promise.race([
        Promise.all(
          resources.map((el) => {
            const ready =
              el instanceof HTMLImageElement
                ? el.complete
                : el.contentDocument !== null || el.src.startsWith("about:");
            if (ready) return Promise.resolve();
            return new Promise<void>((resolve) => {
              el.addEventListener("load", () => resolve(), { once: true });
              el.addEventListener("error", () => resolve(), { once: true });
            });
          }),
        ),
        new Promise<void>((resolve) => setTimeout(resolve, 4000)),
      ]);
    }
  }

  window.addEventListener("afterprint", cleanupPrintMode, { once: true });
  window.print();
  window.setTimeout(cleanupPrintMode, 5000);
}

/* ========================================================================= */
/* PRINT HELPER COMPONENTS (digunakan dalam portal .print-only)              */
/* ========================================================================= */
function PrintSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}
      >
        <tbody>{children}</tbody>
      </table>
    </div>
  );
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
      <td
        style={{
          padding: "5px 0",
          fontWeight: 600,
          color: "#1e293b",
          verticalAlign: "top",
        }}
      >
        {value || "-"}
      </td>
    </tr>
  );
}

function isPdfUrl(url?: string | null): boolean {
  return !!url && /\.pdf(\?|#|$)/i.test(url);
}

// Pratinjau dokumen terlampir (KK, akta, pas foto, bukti transfer) di layout
// cetak. File gambar dirender sebagai <img>; file PDF dirender via <iframe>
// agar isinya ikut tercetak saat print / Save as PDF.
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
          <span style={{ color: "#94a3b8", fontWeight: 600 }}>Tidak ada</span>
        )}
      </td>
    </tr>
  );
}

function PrintHeader({
  subtitle,
  rightInfo,
}: {
  subtitle: string;
  rightInfo: React.ReactNode;
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
      <div className="text-right text-xs text-slate-600 space-y-0.5">
        {rightInfo}
      </div>
    </div>
  );
}

export default function VerifikasiPendaftaranPage() {
  const { toast } = useToast();

  // List state
  const [pendaftaranList, setPendaftaranList] = React.useState<
    PendaftaranDetail[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [totalItems, setTotalItems] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);

  // Filter & search
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [sortBy, setSortBy] = React.useState<"newest" | "oldest">("newest");

  // Detail modal
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detailData, setDetailData] = React.useState<DetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  // Action states
  const [alasanPenolakan, setAlasanPenolakan] = React.useState(
    "Berkas Akta Kelahiran dan foto bukti transfer buram/tidak terbaca.",
  );
  const [isRejectDialogOpen, setIsRejectDialogOpen] = React.useState(false);
  // Konfirmasi kontak wali (pengganti OTP email) — wajib sebelum DITERIMA.
  const [isKonfirmasiDialogOpen, setIsKonfirmasiDialogOpen] =
    React.useState(false);
  const [metodeKonfirmasi, setMetodeKonfirmasi] =
    React.useState<MetodeKonfirmasi>("WHATSAPP");
  const [catatanKonfirmasi, setCatatanKonfirmasi] = React.useState("");
  const [isMemprosesKonfirmasi, setIsMemprosesKonfirmasi] =
    React.useState(false);
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [selectedKelasTujuanId, setSelectedKelasTujuanId] = React.useState("");

  // Hanya render portal print setelah mount di client (document.body belum ada saat SSR).
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch list
  const fetchList = React.useCallback(async () => {
    setLoading(true);
    try {
      const statusParam =
        statusFilter === "ALL"
          ? undefined
          : (statusFilter as "MENUNGGU_VERIFIKASI" | "DITERIMA" | "DITOLAK");
      const result = await getPendaftaranList({
        status: statusParam,
        search: debouncedSearch || undefined,
        page: currentPage,
        limit: 10,
        sortBy,
      });
      if (result.success && result.data) {
        setPendaftaranList(result.data.items);
        setTotalItems(result.data.total);
        setTotalPages(result.data.totalPages);
      } else {
        toast({
          title: "Gagal memuat data",
          description: result.message,
          variant: "destructive" as never,
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Gagal menghubungi server",
        variant: "destructive" as never,
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, currentPage, sortBy, toast]);

  React.useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Fetch detail when clicking "Periksa Berkas"
  const handleOpenDetail = async (id: string) => {
    setSelectedId(id);
    setLoadingDetail(true);
    setDetailData(null);
    setSelectedKelasTujuanId("");
    try {
      const result = await getPendaftaranDetail(id);
      if (result.success && result.data) {
        setDetailData(result.data);
      } else {
        toast({
          title: "Gagal memuat detail",
          description: result.message,
          variant: "destructive" as never,
        });
        setSelectedId(null);
      }
    } catch {
      toast({
        title: "Error",
        description: "Gagal menghubungi server",
        variant: "destructive" as never,
      });
      setSelectedId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedId(null);
    setDetailData(null);
  };

  // Approve
  const handleApprove = async () => {
    if (!detailData) return;
    setProcessing(true);
    try {
      const result = await verifikasiPendaftaran({
        pendaftaranId: detailData.pendaftaran.id,
        status: "DITERIMA",
        kelasTujuanId: selectedKelasTujuanId || undefined,
      });
      if (result.success) {
        toast({ title: "Pendaftaran Disetujui!", description: result.message });
      } else {
        toast({
          title: "Gagal",
          description: result.message,
          variant: "destructive" as never,
        });
      }
      handleCloseDetail();
      setIsApproveConfirmOpen(false);
      fetchList();
    } catch {
      toast({
        title: "Error",
        description: "Gagal memproses verifikasi",
        variant: "destructive" as never,
      });
    } finally {
      setProcessing(false);
    }
  };

  // Reject
  const handleReject = async () => {
    if (!detailData) return;
    setProcessing(true);
    try {
      const result = await verifikasiPendaftaran({
        pendaftaranId: detailData.pendaftaran.id,
        status: "DITOLAK",
        alasanPenolakan,
      });
      if (result.success) {
        toast({ title: "Pendaftaran Ditolak", description: result.message });
      } else {
        toast({
          title: "Gagal",
          description: result.message,
          variant: "destructive" as never,
        });
      }
      handleCloseDetail();
      setIsRejectDialogOpen(false);
      fetchList();
    } catch {
      toast({
        title: "Error",
        description: "Gagal memproses verifikasi",
        variant: "destructive" as never,
      });
    } finally {
      setProcessing(false);
    }
  };

  // Konfirmasi kontak wali (pengganti OTP email).
  //
  // Tombol ini muncul justru saat pendaftaran TERTAHAN: tanpa gerbang ini,
  // approval ditolak server (lihat verifikasiPendaftaran). Konfirmasi dulu ke
  // orang tua lewat WhatsApp/telepon, baru catat metode + waktunya di sini.
  const handleKonfirmasiKontak = async () => {
    if (!detailData) return;
    setIsMemprosesKonfirmasi(true);
    try {
      const result = await konfirmasiKontakWali(
        detailData.pendaftaran.id,
        metodeKonfirmasi,
        catatanKonfirmasi,
      );
      if (result.success) {
        toast({
          title: "Kontak Wali Dikonfirmasi",
          description: result.message,
        });
        setIsKonfirmasiDialogOpen(false);
        setCatatanKonfirmasi("");
        // Detail di-refresh supaya badge ikut berubah, dialog tetap terbuka.
        await handleOpenDetail(detailData.pendaftaran.id);
        fetchList();
      } else {
        toast({
          title: "Gagal",
          description: result.message,
          variant: "destructive" as never,
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Gagal menyimpan konfirmasi kontak wali",
        variant: "destructive" as never,
      });
    } finally {
      setIsMemprosesKonfirmasi(false);
    }
  };

  const handleBatalkanKonfirmasi = async () => {
    if (!detailData) return;
    setIsMemprosesKonfirmasi(true);
    try {
      const result = await batalkanKonfirmasiKontakWali(
        detailData.pendaftaran.id,
      );
      if (result.success) {
        toast({
          title: "Konfirmasi Dibatalkan",
          description: result.message,
        });
        await handleOpenDetail(detailData.pendaftaran.id);
        fetchList();
      } else {
        toast({
          title: "Gagal",
          description: result.message,
          variant: "destructive" as never,
        });
      }
    } finally {
      setIsMemprosesKonfirmasi(false);
    }
  };

  const pendaftar = detailData?.pendaftaran;
  const signedUrls = detailData?.signedUrls;

  // Status kelengkapan berkas dihitung DARI helper terpusat, sama dengan
  // halaman cek pendaftaran / halaman sukses / dashboard wali. Panel admin
  // tidak boleh punya cara hitung sendiri.
  const statusBerkas = hitungStatusBerkas(pendaftar);

  const statusFilterLabel =
    STATUS_FILTERS.find((f) => f.value === statusFilter)?.label || statusFilter;

  const buktiTransferPrintUrls = signedUrls?.buktiTransfer ?? [];

  // Kelas calon santri yang bisa dipilih saat approve (sesuai jenis kelamin),
  // dipakai ketika pendaftar mendaftar tanpa kelas tujuan.
  const kelasCocokPendaftar = React.useMemo(() => {
    if (!pendaftar) return [];
    return (pendaftar.jenjangTujuan?.kelas ?? []).filter(
      (k) =>
        !k.jenisKelamin ||
        !pendaftar.jenisKelamin ||
        k.jenisKelamin === pendaftar.jenisKelamin,
    );
  }, [pendaftar]);

  // DetailRow helper
  const DetailRow = ({
    label,
    value,
  }: {
    label: string;
    value?: string | null;
  }) => (
    <div>
      <span className="text-slate-400">{label}: </span>
      <strong className="text-slate-800">{value || "-"}</strong>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <DashboardHeader
        title="Verifikasi Penerimaan Santri Baru (PSB)"
        subtitle="Review berkas pendaftaran, bukti transfer biaya formulir, dan terbitkan status penerimaan santri."
      />

      {/* Filter Bar */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari nama atau nomor registrasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSortBy(sortBy === "newest" ? "oldest" : "newest")
                }
                className="rounded-xl gap-1.5"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {sortBy === "newest" ? "Terbaru" : "Terlama"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={activatePrintMode}
                className="rounded-xl gap-1.5"
                aria-label="Cetak / Download PDF"
              >
                <Printer className="h-3.5 w-3.5" />
                Cetak
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchList}
                className="rounded-xl"
                aria-label="Muat Ulang"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Muat Ulang
              </Button>
            </div>
            <div className="text-xs font-bold text-slate-600">
              Total: <strong>{totalItems}</strong> pendaftar
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatusFilter(f.value);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Pendaftar List / Table */}
      <Card className="overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-800">
            Antrean Calon Santri
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-sm text-slate-500">
                Memuat data pendaftaran...
              </span>
            </div>
          )}
          {!loading && pendaftaranList.length === 0 && (
            <div className="py-12">
              <EmptyState
                icon={FileX}
                title="Tidak ada data pendaftaran"
                description={
                  search
                    ? "Tidak ditemukan hasil pencarian. Coba kata kunci lain."
                    : "Belum ada pendaftaran yang masuk."
                }
              />
            </div>
          )}
          {!loading && pendaftaranList.length > 0 && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-600">
                    <tr>
                      <th className="p-4 pl-6">No. Pendaftaran</th>
                      <th className="p-4">Nama Calon Santri</th>
                      <th className="p-4">Jenjang Tujuan</th>
                      <th className="p-4">Orang Tua / Wali</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 pr-6 text-right">Aksi Verifikasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendaftaranList.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="p-4 pl-6 font-mono font-bold text-yellow-700 text-xs">
                          {p.nomorPendaftaran}
                          <div className="text-[10px] text-slate-400 font-sans font-normal">
                            {formatDate(p.createdAt)}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-800">
                            {p.namaLengkap}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            NISN: {p.nisn || "-"}
                          </div>
                        </td>
                        <td className="p-4 text-xs font-semibold text-slate-700">
                          {p.jenjangTujuan.nama}
                          {p.kelasTujuan && (
                            <span className="text-slate-400 font-normal">
                              {" "}
                              / {p.kelasTujuan.nama}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-xs text-slate-600">
                          <div className="font-bold text-slate-800">
                            {p.namaOrangTua}
                          </div>
                          <div className="text-slate-400">{p.noHpOrangTua}</div>
                        </td>
                        <td className="p-4">
                          <StatusBadge status={p.status} />
                          <KontakWaliBadge
                            konfirmasiAt={p.kontakWaliDikonfirmasiAt}
                            namaAdmin={p.kontakWaliDikonfirmasiOleh?.nama}
                          />
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <Button
                            size="sm"
                            onClick={() => handleOpenDetail(p.id)}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl min-h-[36px] text-xs font-bold"
                          >
                            Periksa Berkas
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden p-4 space-y-3">
                {pendaftaranList.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-yellow-700 block">
                          {p.nomorPendaftaran}
                        </span>
                        <div className="font-bold text-slate-800 text-sm mt-0.5">
                          {p.namaLengkap}
                        </div>
                      </div>
                      <StatusBadge status={p.status} size="sm" />
                    </div>
                    <KontakWaliBadge
                      konfirmasiAt={p.kontakWaliDikonfirmasiAt}
                      namaAdmin={p.kontakWaliDikonfirmasiOleh?.nama}
                    />
                    <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                      <div>
                        Jenjang: <strong>{p.jenjangTujuan.nama}</strong>
                      </div>
                      <div>
                        Orang Tua: <strong>{p.namaOrangTua}</strong> (
                        {p.noHpOrangTua})
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleOpenDetail(p.id)}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl min-h-[40px] text-xs font-bold"
                    >
                      Periksa Berkas
                    </Button>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((c) => Math.max(1, c - 1))}
                    disabled={currentPage === 1}
                    className="rounded-xl text-xs"
                  >
                    Sebelumnya
                  </Button>
                  <span className="text-xs text-slate-500">
                    Halaman {currentPage} dari {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((c) => Math.min(totalPages, c + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="rounded-xl text-xs"
                  >
                    Selanjutnya
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Review Berkas & Verifikasi */}
      <Dialog
        open={!!selectedId}
        onOpenChange={(open) => !open && handleCloseDetail()}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {loadingDetail && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-sm text-slate-500">
                Memuat detail berkas...
              </span>
            </div>
          )}

          {!loadingDetail && pendaftar && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-slate-800">
                  Detail Berkas: {pendaftar.namaLengkap}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-mono">
                  {pendaftar.nomorPendaftaran} • {pendaftar.jenjangTujuan.nama}
                  {pendaftar.kelasTujuan && " • " + pendaftar.kelasTujuan.nama}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs sm:text-sm">
                {/* ---- DATA CALON SISWA ---- */}
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-2">
                  <h3 className="font-bold text-blue-900 uppercase text-xs">
                    Data Calon Siswa
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                    <DetailRow
                      label="Nama Lengkap"
                      value={pendaftar.namaLengkap}
                    />
                    <DetailRow
                      label="Jenis Kelamin"
                      value={
                        pendaftar.jenisKelamin === "LAKI_LAKI"
                          ? "Laki-laki"
                          : "Perempuan"
                      }
                    />
                    <DetailRow
                      label="Tempat Lahir"
                      value={pendaftar.tempatLahir}
                    />
                    <DetailRow
                      label="Tanggal Lahir"
                      value={
                        pendaftar.tanggalLahir
                          ? formatDate(pendaftar.tanggalLahir)
                          : null
                      }
                    />
                    <DetailRow label="NISN" value={pendaftar.nisn} />
                    <DetailRow label="Agama" value={pendaftar.agama} />
                    <DetailRow
                      label="No. HP Siswa"
                      value={pendaftar.noHpSiswa}
                    />
                    <div className="col-span-2">
                      <DetailRow label="Alamat" value={pendaftar.alamatSiswa} />
                    </div>
                  </div>
                </div>

                {/* ---- DATA KONTAK ORANG TUA ---- */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <h3 className="font-bold text-slate-800 uppercase text-xs">
                    Data Kontak Orang Tua
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                    <DetailRow label="Nama" value={pendaftar.namaOrangTua} />
                    <DetailRow
                      label="No. HP / WA"
                      value={pendaftar.noHpOrangTua}
                    />
                    <div className="col-span-2">
                      <DetailRow
                        label="Email"
                        value={pendaftar.emailOrangTua}
                      />
                    </div>
                    {pendaftar.alamatOrangTua && (
                      <div className="col-span-2">
                        <DetailRow
                          label="Alamat"
                          value={pendaftar.alamatOrangTua}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* ---- DATA AYAH KANDUNG ---- */}
                {(pendaftar.namaAyahKandung || pendaftar.statusAyahKandung) && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                    <h3 className="font-bold text-amber-900 uppercase text-xs">
                      Data Ayah Kandung
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                      <DetailRow
                        label="Nama"
                        value={pendaftar.namaAyahKandung}
                      />
                      <DetailRow
                        label="Status"
                        value={formatStatusOrangTua(
                          pendaftar.statusAyahKandung,
                        )}
                      />
                      {pendaftar.statusAyahKandung === "MASIH_HIDUP" &&
                        pendaftar.nikAyah && (
                          <DetailRow label="NIK" value={pendaftar.nikAyah} />
                        )}
                    </div>
                  </div>
                )}

                {/* ---- DATA IBU KANDUNG ---- */}
                {(pendaftar.namaIbuKandung || pendaftar.statusIbuKandung) && (
                  <div className="p-4 rounded-2xl bg-pink-50 border border-pink-200 space-y-2">
                    <h3 className="font-bold text-pink-900 uppercase text-xs">
                      Data Ibu Kandung
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                      <DetailRow
                        label="Nama"
                        value={pendaftar.namaIbuKandung}
                      />
                      <DetailRow
                        label="Status"
                        value={formatStatusOrangTua(pendaftar.statusIbuKandung)}
                      />
                      {pendaftar.statusIbuKandung === "MASIH_HIDUP" &&
                        pendaftar.nikIbu && (
                          <DetailRow label="NIK" value={pendaftar.nikIbu} />
                        )}
                    </div>
                  </div>
                )}

                {/* ---- DATA WALI ---- */}
                {pendaftar.statusWali && (
                  <div className="p-4 rounded-2xl bg-violet-50 border border-violet-200 space-y-2">
                    <h3 className="font-bold text-violet-900 uppercase text-xs">
                      Data Wali
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                      <DetailRow
                        label="Status"
                        value={formatStatusWali(pendaftar.statusWali)}
                      />
                      {pendaftar.statusWali === "LAINNYA" &&
                        pendaftar.namaWali && (
                          <DetailRow
                            label="Nama Wali"
                            value={pendaftar.namaWali}
                          />
                        )}
                    </div>
                  </div>
                )}

                {/* ---- KEWARGANEGARAAN ---- */}
                {pendaftar.kewarganegaraan &&
                  pendaftar.kewarganegaraan !== "WNI" && (
                    <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 space-y-2">
                      <h3 className="font-bold text-teal-900 uppercase text-xs">
                        Kewarganegaraan
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                        <DetailRow
                          label="Kewarganegaraan"
                          value={pendaftar.kewarganegaraan}
                        />
                        {pendaftar.kitas && (
                          <DetailRow
                            label="No. KITAS"
                            value={pendaftar.kitas}
                          />
                        )}
                        {pendaftar.asalNegara && (
                          <DetailRow
                            label="Asal Negara"
                            value={pendaftar.asalNegara}
                          />
                        )}
                      </div>
                    </div>
                  )}

                {/* ---- DOKUMEN TERLAMPIR ---- */}
                <div className="space-y-2">
                  <h3 className="font-bold text-slate-800 uppercase text-xs">
                    Dokumen Terlampir:
                  </h3>

                  {/* Checklist kelengkapan berkas — SUMBER YANG SAMA dengan
                      halaman cek pendaftaran, halaman sukses, dan dashboard
                      wali (src/lib/status-berkas.ts). Panel admin tidak
                      menghitung sendiri; kalau cara hitungnya berbeda di satu
                      titik, panitia dan pendaftar melihat berkas yang
                      berbeda. */}
                  <ul className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1">
                    {(
                      [
                        ["kartuKeluarga", statusBerkas.kartuKeluarga],
                        ["akteLahir", statusBerkas.akteLahir],
                        ["foto", statusBerkas.foto],
                      ] as const
                    ).map(([key, ada]) => (
                      <li
                        key={key}
                        className={
                          "flex items-center justify-between gap-2 " +
                          (ada ? "text-emerald-700" : "text-amber-700")
                        }
                      >
                        <span>{LABEL_BERKAS_UTAMA[key]}</span>
                        <span className="font-semibold">
                          {ada ? "✔ sudah ada" : "● BELUM ada"}
                        </span>
                      </li>
                    ))}
                    <li className="flex items-center justify-between gap-2 text-slate-600 border-t border-slate-100 pt-1 mt-1">
                      <span>Dokumen tambahan</span>
                      <span className="font-semibold">
                        {statusBerkas.lainnya} berkas
                      </span>
                    </li>
                  </ul>
                  {statusBerkas.lainnya > 0 && (
                    <p className="m-0 text-[11px] text-slate-500">
                      Dokumen tambahan tidak bisa dibuka dari panel ini. Setelah
                      pendaftaran diterima, seluruh berkas (termasuk tambahan)
                      disalin ke berkas anak dan dapat dilihat di Dashboard
                      Wali.
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {signedUrls?.buktiTransfer?.map((bt) => (
                      <a
                        key={bt.id}
                        href={bt.url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 font-bold flex items-center justify-between hover:bg-yellow-100 transition-colors"
                      >
                        <span>Foto Bukti Transfer</span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ))}
                    {signedUrls?.kartuKeluarga && (
                      <a
                        href={signedUrls.kartuKeluarga}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold flex items-center justify-between hover:bg-slate-100 transition-colors"
                      >
                        <span>Dokumen Kartu Keluarga</span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    {signedUrls?.akteLahir && (
                      <a
                        href={signedUrls.akteLahir}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold flex items-center justify-between hover:bg-slate-100 transition-colors"
                      >
                        <span>Akta Kelahiran</span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    {signedUrls?.foto && (
                      <a
                        href={signedUrls.foto}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold flex items-center justify-between hover:bg-slate-100 transition-colors"
                      >
                        <span>Pas Foto</span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {!!pendaftar &&
                !pendaftar.kelasTujuan &&
                pendaftar.status === "MENUNGGU_VERIFIKASI" && (
                  <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-2">
                    <h3 className="font-bold text-sky-900 uppercase text-xs">
                      Kelas Tujuan
                    </h3>
                    <p className="text-xs text-slate-600">
                      Pendaftar ini mendaftar tanpa kelas tujuan. Pilih kelas
                      agar santri langsung masuk kelas saat diterima — atau
                      biarkan kosong dan pendaftaran tetap dapat diproses (kelas
                      diatur kemudian).
                    </p>
                    <Select
                      value={selectedKelasTujuanId || undefined}
                      onValueChange={setSelectedKelasTujuanId}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue
                          placeholder={
                            kelasCocokPendaftar.length === 0
                              ? "Belum ada kelas yang cocok — lanjutkan tanpa kelas"
                              : "Pilih kelas (opsional)"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {kelasCocokPendaftar.map((k) => (
                          <SelectItem key={k.id} value={k.id}>
                            {k.nama}
                            {k.jenisKelamin === "LAKI_LAKI"
                              ? " (Ikhwan)"
                              : k.jenisKelamin === "PEREMPUAN"
                                ? " (Akhwat)"
                                : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

              {/* ---- KONFIRMASI KONTAK WALI (gerbang approval) ---- */}
              {/*
                Pendaftaran tidak lagi lewat OTP email, jadi tidak ada bukti
                otomatis kepemilikan kontak. Penggantinya: panitia WAJIB
                menghubungi wali (WhatsApp/telepon/langsung) dan mencatatnya di
                sini sebelum menekan "Terima". Server menegakkan hal yang sama —
                `verifikasiPendaftaran` menolak DITERIMA bila
                `kontakWaliDikonfirmasiAt` masih kosong — jadi tombol di bawah
                bukan hiasan, tanpa ini approval mustahil berhasil.

                Ditampilkan selama belum final. DITOLAK ikut karena saat ini
                tidak terjangkau lewat alur normal, tapi kalau alurnya berubah
                panel ini sudah siap dan tidak diam-diam hilang.
              */}
              {!!pendaftar && pendaftar.status !== "DITERIMA" && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-3">
                  <div className="flex items-start gap-2">
                    <PhoneCall className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-bold text-amber-900 uppercase text-xs">
                        {pendaftar.kontakWaliDikonfirmasiAt
                          ? "Kontak Wali Sudah Dikonfirmasi"
                          : "Konfirmasi Kontak Wali Belum Dicatat"}
                      </h3>
                      {pendaftar.kontakWaliDikonfirmasiAt ? (
                        <div className="text-xs text-amber-900 mt-1 space-y-0.5">
                          <p className="m-0">
                            Dikonfirmasi oleh{" "}
                            <strong>
                              {pendaftar.kontakWaliDikonfirmasiOleh?.nama ||
                                "panitia"}
                            </strong>{" "}
                            pada{" "}
                            <strong>
                              {new Date(
                                pendaftar.kontakWaliDikonfirmasiAt,
                              ).toLocaleString("id-ID")}
                            </strong>{" "}
                            via{" "}
                            <strong>
                              {
                                LABEL_METODE_KONFIRMASI[
                                  pendaftar.metodeKonfirmasiKontak ?? ""
                                ] ?? pendaftar.metodeKonfirmasiKontak
                              }
                            </strong>
                            .
                          </p>
                          {pendaftar.catatanKonfirmasiKontak && (
                            <p className="m-0 text-amber-800">
                              Catatan: {pendaftar.catatanKonfirmasiKontak}
                            </p>
                          )}
                          <p className="m-0 text-amber-700">
                            Pendaftaran ini sekarang boleh disetujui.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-900 mt-1 m-0">
                          Pendaftaran ini <strong>tidak bisa disetujui</strong>{" "}
                          sampai kontak wali dikonfirmasi. Hubungi orang
                          tua/wali (WhatsApp/telepon/datang langsung), lalu
                          catat konfirmasinya di bawah. Nomor WhatsApp wali:{" "}
                          <span className="font-mono font-bold">
                            {pendaftar.noHpOrangTua}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  {pendaftar.kontakWaliDikonfirmasiAt ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isMemprosesKonfirmasi}
                      onClick={() => void handleBatalkanKonfirmasi()}
                      className="w-full rounded-xl border-amber-400 text-amber-900 hover:bg-amber-100 font-bold text-xs min-h-[40px]"
                    >
                      {isMemprosesKonfirmasi ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-1.5" />
                      )}
                      Batalkan Konfirmasi
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsKonfirmasiDialogOpen(true)}
                      className="w-full rounded-xl border-amber-400 text-amber-900 hover:bg-amber-100 font-bold text-xs min-h-[40px]"
                    >
                      <PhoneCall className="h-4 w-4 mr-1.5" />
                      Konfirmasi Kontak Wali
                    </Button>
                  )}
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={activatePrintMode}
                  className="rounded-xl min-h-[44px] text-xs font-bold"
                >
                  <Printer className="h-4 w-4 mr-1.5" />
                  Cetak / Download PDF
                </Button>
                {detailData?.pendaftaran.status === "MENUNGGU_VERIFIKASI" ? (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setIsRejectDialogOpen(true)}
                      className="rounded-xl min-h-[44px] text-xs font-bold"
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Tolak Pendaftaran
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setIsApproveConfirmOpen(true)}
                      // UI hanya menampilkan alasannya; PENEGAKANNYA di
                      // server (verifikasiPendaftaran menolak DITERIMA tanpa
                      // kontakWaliDikonfirmasiAt). Disable di sini supaya admin
                      // tidak knock-knock ke server untuk hal yang pasti ditolak.
                      disabled={!pendaftar?.kontakWaliDikonfirmasiAt}
                      title={
                        pendaftar?.kontakWaliDikonfirmasiAt
                          ? undefined
                          : "Konfirmasi kontak wali dulu sebelum menerima pendaftaran"
                      }
                      className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl min-h-[44px] text-xs px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Terima Santri &amp; Terbitkan Akun
                    </Button>
                  </>
                ) : (
                  <p className="text-xs font-medium text-slate-500 py-2">
                    Pendaftaran ini sudah berstatus{" "}
                    <StatusBadge
                      status={detailData?.pendaftaran.status ?? ""}
                    />{" "}
                    dan tidak dapat diverifikasi ulang.
                  </p>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Tolak Pendaftaran */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-700">
              Tolak Berkas Pendaftaration
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Tuliskan alasan penolakan secara jelas agar orang tua calon santri
              dapat memperbaiki berkas
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <label className="text-xs font-semibold text-slate-700">
              Alasan Penolakan:
            </label>
            <Input
              value={alasanPenolakan}
              onChange={(e) => setAlasanPenolakan(e.target.value)}
              className="h-11 rounded-xl text-sm"
              required
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsRejectDialogOpen(false)}
              className="rounded-xl min-h-[40px]"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing}
              className="rounded-xl min-h-[40px] font-bold"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Konfirmasi Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Kontak Wali (pengganti verifikasi email manual) */}
      <Dialog
        open={isKonfirmasiDialogOpen}
        onOpenChange={setIsKonfirmasiDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-amber-700">
              Konfirmasi Kontak Wali
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Catat bahwa Anda sudah menghubungi orang tua/wali untuk
              pendaftaran {pendaftar?.nomorPendaftaran} di{" "}
              {pendaftar?.noHpOrangTua}. Waktu, nama Anda, dan metode
              disimpan permanen di berkas pendaftaran.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-[11px] text-amber-900 m-0">
                Konfirmasi dulu ke orang tua — jangan tekan tombol ini sebelum
                benar-benar menghubungi. Ini satu-satunya pemeriksaan sebelum
                pendaftaran disetujui dan akun diterbitkan.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Metode konfirmasi:
              </label>
              <Select
                value={metodeKonfirmasi}
                onValueChange={(v) =>
                  setMetodeKonfirmasi(v as MetodeKonfirmasi)
                }
              >
                <SelectTrigger className="h-11 rounded-xl text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METODE_KONFIRMASI.map((m) => (
                    <SelectItem key={m} value={m}>
                      {LABEL_METODE_KONFIRMASI[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Catatan (opsional, maks 500 karakter):
              </label>
              <textarea
                value={catatanKonfirmasi}
                onChange={(e) => setCatatanKonfirmasi(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
                placeholder="mis. Dijawab wali 0812xxxx via telepon; nama penyebut cocok dengan nama ayah."
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsKonfirmasiDialogOpen(false)}
              className="rounded-xl min-h-[40px]"
            >
              Batal
            </Button>
            <Button
              onClick={() => void handleKonfirmasiKontak()}
              disabled={isMemprosesKonfirmasi}
              className="rounded-xl min-h-[40px] font-bold bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isMemprosesKonfirmasi ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <PhoneCall className="h-4 w-4 mr-1.5" />
              )}
              Simpan Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Approve Santri */}
      <ConfirmDialog
        open={isApproveConfirmOpen}
        onOpenChange={setIsApproveConfirmOpen}
        title="Terima Calon Santri Baru?"
        description={
          "Apakah Anda yakin ingin menyetujui pendaftaran " +
          (pendaftar?.namaLengkap || "") +
          "? Akun login santri dan orang tua akan otomatis di-generate oleh sistem."
        }
        confirmText="Ya, Terima Santri"
        variant="default"
        isLoading={processing}
        onConfirm={handleApprove}
      />

      {/* ===================================================================== */}
      {/* PRINT PORTAL: DATA SANTRI BARU (daftar/list)                          */}
      {/* Dirender via portal ke <body> agar aktif saat print, tapi tampil      */}
      {/* hanya ketika modal detail tertutup (tidak duplikat dengan berkas).    */}
      {/* ===================================================================== */}
      {mounted &&
        !selectedId &&
        createPortal(
          <div className="print-only">
            <div style={{ padding: "2.5rem 2rem", color: "#1e293b" }}>
              <PrintHeader
                subtitle="Data Pendaftaran Calon Santri Baru"
                rightInfo={
                  <>
                    <p>
                      <strong>Status:</strong> {statusFilterLabel}
                    </p>
                    <p>
                      <strong>Total:</strong> {totalItems} pendaftar
                    </p>
                    <p>
                      <strong>Dicetak:</strong> {formatDate(new Date())}
                    </p>
                  </>
                }
              />
              <p
                className="mb-3"
                style={{ fontSize: "13px", color: "#475569" }}
              >
                Menampilkan {pendaftaranList.length} data (halaman {currentPage}{" "}
                dari {totalPages}).
              </p>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "12px",
                }}
              >
                <thead>
                  <tr>
                    {[
                      "No.",
                      "No. Pendaftaran",
                      "Nama Calon Santri",
                      "NISN",
                      "Jenjang Tujuan",
                      "Orang Tua / Wali",
                      "Status",
                      "Tanggal Daftar",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          border: "1px solid #334155",
                          background: "#f1f5f9",
                          padding: "8px 10px",
                          textAlign: "left",
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "#1e293b",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendaftaranList.map((p, idx) => (
                    <tr key={p.id}>
                      <td style={cellStyle}>{idx + 1}</td>
                      <td
                        style={{
                          ...cellStyle,
                          fontFamily: "monospace",
                          fontSize: "11px",
                        }}
                      >
                        {p.nomorPendaftaran}
                      </td>
                      <td style={{ ...cellStyle, fontWeight: 600 }}>
                        {p.namaLengkap}
                      </td>
                      <td style={cellStyle}>{p.nisn || "-"}</td>
                      <td style={cellStyle}>
                        {p.jenjangTujuan?.nama || "-"}
                        {p.kelasTujuan ? ` / ${p.kelasTujuan.nama}` : ""}
                      </td>
                      <td style={cellStyle}>
                        <div>{p.namaOrangTua || "-"}</div>
                        <div style={{ fontSize: "11px", color: "#475569" }}>
                          {p.noHpOrangTua || ""}
                        </div>
                      </td>
                      <td style={cellStyle}>{statusText(p.status)}</td>
                      <td style={cellStyle}>{formatDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p
                style={{
                  marginTop: "1.25rem",
                  fontSize: "11px",
                  color: "#64748b",
                }}
              >
                Dokumen ini dicetak melalui sistem pendaftaran online Pondok
                Pesantren &amp; Sekolah Islam Terpadu Anshorussunnah.
              </p>
            </div>
          </div>,
          document.body,
        )}

      {/* ===================================================================== */}
      {/* PRINT PORTAL: DETAIL BERKAS SANTRI (modal "Periksa Berkas")           */}
      {/* ===================================================================== */}
      {mounted &&
        !!pendaftar &&
        createPortal(
          <div className="print-only">
            <div style={{ padding: "2.5rem 2rem", color: "#1e293b" }}>
              <PrintHeader
                subtitle="Detail Berkas Pendaftaran Santri Baru"
                rightInfo={
                  <>
                    <p>
                      <strong>No. Pendaftaran:</strong>{" "}
                      {pendaftar.nomorPendaftaran}
                    </p>
                    <p>
                      <strong>Status:</strong> {statusText(pendaftar.status)}
                    </p>
                    <p>
                      <strong>Dicetak:</strong> {formatDate(new Date())}
                    </p>
                  </>
                }
              />

              <PrintSection title="Data Calon Siswa">
                <PrintRow label="Nama Lengkap" value={pendaftar.namaLengkap} />
                <PrintRow
                  label="Jenis Kelamin"
                  value={
                    pendaftar.jenisKelamin === "LAKI_LAKI"
                      ? "Laki-laki"
                      : "Perempuan"
                  }
                />
                <PrintRow
                  label="Tempat, Tanggal Lahir"
                  value={`${pendaftar.tempatLahir || "-"}, ${pendaftar.tanggalLahir ? formatDate(pendaftar.tanggalLahir) : "-"}`}
                />
                <PrintRow label="NISN" value={pendaftar.nisn} />
                <PrintRow label="Agama" value={pendaftar.agama} />
                <PrintRow label="No. HP Siswa" value={pendaftar.noHpSiswa} />
                <PrintRow label="Alamat Siswa" value={pendaftar.alamatSiswa} />
              </PrintSection>

              <PrintSection title="Data Kontak Orang Tua">
                <PrintRow label="Nama" value={pendaftar.namaOrangTua} />
                <PrintRow label="No. HP / WA" value={pendaftar.noHpOrangTua} />
                <PrintRow label="Email" value={pendaftar.emailOrangTua} />
                <PrintRow label="Alamat" value={pendaftar.alamatOrangTua} />
              </PrintSection>

              {(pendaftar.namaAyahKandung || pendaftar.statusAyahKandung) && (
                <PrintSection title="Data Ayah Kandung">
                  <PrintRow label="Nama" value={pendaftar.namaAyahKandung} />
                  <PrintRow
                    label="Status"
                    value={formatStatusOrangTua(pendaftar.statusAyahKandung)}
                  />
                  {pendaftar.statusAyahKandung === "MASIH_HIDUP" && (
                    <PrintRow label="NIK" value={pendaftar.nikAyah} />
                  )}
                </PrintSection>
              )}

              {(pendaftar.namaIbuKandung || pendaftar.statusIbuKandung) && (
                <PrintSection title="Data Ibu Kandung">
                  <PrintRow label="Nama" value={pendaftar.namaIbuKandung} />
                  <PrintRow
                    label="Status"
                    value={formatStatusOrangTua(pendaftar.statusIbuKandung)}
                  />
                  {pendaftar.statusIbuKandung === "MASIH_HIDUP" && (
                    <PrintRow label="NIK" value={pendaftar.nikIbu} />
                  )}
                </PrintSection>
              )}

              {pendaftar.statusWali && (
                <PrintSection title="Data Wali">
                  <PrintRow
                    label="Status"
                    value={formatStatusWali(pendaftar.statusWali)}
                  />
                  {pendaftar.statusWali === "LAINNYA" && (
                    <PrintRow label="Nama Wali" value={pendaftar.namaWali} />
                  )}
                </PrintSection>
              )}

              {pendaftar.kewarganegaraan &&
                pendaftar.kewarganegaraan !== "WNI" && (
                  <PrintSection title="Kewarganegaraan">
                    <PrintRow
                      label="Kewarganegaraan"
                      value={pendaftar.kewarganegaraan}
                    />
                    <PrintRow label="No. KITAS" value={pendaftar.kitas} />
                    <PrintRow
                      label="Asal Negara"
                      value={pendaftar.asalNegara}
                    />
                  </PrintSection>
                )}

              <PrintSection title="Dokumen Terlampir">
                <PrintDocument
                  label="Kartu Keluarga (KK)"
                  url={signedUrls?.kartuKeluarga}
                />
                <PrintDocument
                  label="Akta Kelahiran"
                  url={signedUrls?.akteLahir}
                />
                <PrintDocument label="Pas Foto" url={signedUrls?.foto} />
                {buktiTransferPrintUrls.length > 0 ? (
                  buktiTransferPrintUrls.map((bt, idx) => (
                    <PrintDocument
                      key={bt.id}
                      label={
                        buktiTransferPrintUrls.length > 1
                          ? `Foto Bukti Transfer ${idx + 1}`
                          : "Foto Bukti Transfer"
                      }
                      url={bt.url}
                    />
                  ))
                ) : (
                  <PrintDocument label="Foto Bukti Transfer" url={null} />
                )}
              </PrintSection>

              {/* Jejak konfirmasi kontak wali. Dicetak bersama berkas karena
                  panitia sering butuh bukti "kontak ini benar-benar dikonfirmasi
                  manusia", dan alasan di catatan admin bisa sudah tertimpa
                  approval. */}
              {pendaftar.kontakWaliDikonfirmasiAt && (
                <PrintSection title="Konfirmasi Kontak Wali">
                  <PrintRow
                    label="Metode"
                    value={
                      LABEL_METODE_KONFIRMASI[
                        pendaftar.metodeKonfirmasiKontak ?? ""
                      ] ?? pendaftar.metodeKonfirmasiKontak
                    }
                  />
                  <PrintRow
                    label="Dikonfirmasi Oleh"
                    value={pendaftar.kontakWaliDikonfirmasiOleh?.nama}
                  />
                  <PrintRow
                    label="Waktu"
                    value={formatDate(pendaftar.kontakWaliDikonfirmasiAt)}
                  />
                  <PrintRow
                    label="Catatan"
                    value={pendaftar.catatanKonfirmasiKontak}
                  />
                </PrintSection>
              )}

              {(pendaftar.diverifikasiOleh || pendaftar.waktuVerifikasi) && (
                <PrintSection title="Info Verifikasi">
                  <PrintRow
                    label="Verifikator"
                    value={pendaftar.diverifikasiOleh?.nama}
                  />
                  <PrintRow
                    label="Waktu Verifikasi"
                    value={
                      pendaftar.waktuVerifikasi
                        ? formatDate(pendaftar.waktuVerifikasi)
                        : null
                    }
                  />
                </PrintSection>
              )}

              <p
                style={{
                  marginTop: "1.5rem",
                  fontSize: "11px",
                  color: "#64748b",
                }}
              >
                Dokumen ini dicetak melalui sistem pendaftaran online Pondok
                Pesantren &amp; Sekolah Islam Terpadu Anshorussunnah.
              </p>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
