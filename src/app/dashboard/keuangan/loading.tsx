// src/app/dashboard/keuangan/loading.tsx

import { Skeleton } from "@/components/ui/skeleton"

export default function KeuanganLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-36 rounded-xl mb-2" />
        <Skeleton className="h-4 w-48 rounded-lg" />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
            <Skeleton className="h-4 w-28 rounded-lg" />
            <Skeleton className="h-8 w-36 rounded-lg" />
            <Skeleton className="h-3 w-20 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 border-b border-slate-50 flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-36 rounded-lg" />
              <Skeleton className="h-3 w-24 rounded-lg" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
