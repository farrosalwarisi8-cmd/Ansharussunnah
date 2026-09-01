"use client"

import Link from "next/link"
import {
  CalendarCheck2,
  Award,
  FileCheck2,
  CreditCard,
} from "lucide-react"
import { type ChildStudent } from "@/components/dashboard/dashboard-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"

export function OrangTuaDashboardHome({ selectedChild }: { selectedChild: ChildStudent | null }) {
  const childName = selectedChild?.nama || "Santri"
  const childClass = selectedChild ? `${selectedChild.jenjangNama} - ${selectedChild.kelasNama}` : "Kelas Santri"

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Kehadiran Santri</span>
              <CalendarCheck2 className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-2">
              98.5%
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Hadir aktif bulan ini</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Tugas Santri</span>
              <FileCheck2 className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-2">
              100%
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Semua tugas dikumpulkan</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Rata-rata Nilai</span>
              <Award className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-700 mt-2">
              88.4
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Predikat Sangat Baik (A)</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Tagihan SPP</span>
              <CreditCard className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 mt-2">
              Lunas
            </div>
            <span className="text-xs text-yellow-500 mt-1 block font-medium">Tidak ada tunggakan</span>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rapor & Nilai Terakhir */}
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-800">
                Perkembangan Belajar {childName.split(" ")[0]}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">{childClass}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-yellow-600">
              <Link href="/dashboard/rapor">Buka Rapor</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-5 space-y-3.5">
            {[
              { mapel: "Tahfidz Al-Qur'an", skor: "95", note: "Lancar juz 30 & Tajwid makharijul huruf baik" },
              { mapel: "Bahasa Arab", skor: "88", note: "Penguasaan kosa kata & muhadatsah aktif" },
              { mapel: "Fiqih Ibadah", skor: "90", note: "Praktik wudhu & shalat sangat tertib" },
            ].map((n, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-800 text-sm">{n.mapel}</div>
                  <div className="text-xs text-slate-500">{n.note}</div>
                </div>
                <div className="text-base font-extrabold text-yellow-600 bg-white px-3 py-1.5 rounded-xl border border-yellow-100 shadow-sm shrink-0">
                  {n.skor}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Tagihan & Pembayaran */}
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-800">
                Administrasi &amp; SPP
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">Status kewajiban SPP santri</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-yellow-600">
              <Link href="/dashboard/tagihan">Riwayat SPP</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="p-4 rounded-2xl bg-yellow-50 border border-yellow-200/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-yellow-700">SPP Bulan Ini</span>
                <div className="text-base font-extrabold text-yellow-800">Rp 500.000</div>
              </div>
              <StatusBadge status="LUNAS" />
            </div>

            <Button asChild className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-xl min-h-[44px]">
              <Link href="/dashboard/tagihan">
                <CreditCard className="h-4 w-4 mr-2" />
                Lihat Tagihan &amp; Upload Bukti Transfer
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
