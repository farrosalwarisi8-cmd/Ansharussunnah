// src/app/dashboard/loading.tsx
// Hanya menampilkan placeholder area konten — sidebar & nav dipertahankan oleh
// layout (Router Cache), sehingga navigasi antar halaman dashboard terasa
// mulus seperti SPA tanpa "flash" reload halaman penuh.
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="mb-6 sm:mb-8">
        <Skeleton className="h-8 w-48 rounded-xl mb-2" />
        <Skeleton className="h-4 w-72 rounded-lg" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 sm:mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24 rounded-lg" />
              <Skeleton className="w-10 h-10 rounded-xl" />
            </div>
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-3 w-32 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {[1, 2].map((col) => (
          <div key={col} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <Skeleton className="h-5 w-36 rounded-lg mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4 rounded-lg" />
                    <Skeleton className="h-2.5 w-1/2 rounded-lg" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
