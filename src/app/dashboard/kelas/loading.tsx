// src/app/dashboard/kelas/loading.tsx

import { Skeleton } from "@/components/ui/skeleton"

export default function KelasLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-28 rounded-xl mb-2" />
          <Skeleton className="h-4 w-48 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-32 rounded-xl" />
          <Skeleton className="h-11 w-32 rounded-xl" />
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24 rounded-lg" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-20 rounded-lg" />
            <div className="flex gap-4">
              <Skeleton className="h-3 w-20 rounded-lg" />
              <Skeleton className="h-3 w-16 rounded-lg" />
            </div>
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
