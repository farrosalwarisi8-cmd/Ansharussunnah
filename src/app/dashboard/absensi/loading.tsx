// src/app/dashboard/absensi/loading.tsx

import { Skeleton } from "@/components/ui/skeleton"

export default function AbsensiLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-40 rounded-xl mb-2" />
        <Skeleton className="h-4 w-64 rounded-lg" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Skeleton className="h-11 w-full sm:w-64 rounded-xl" />
        <Skeleton className="h-11 w-full sm:w-48 rounded-xl" />
        <Skeleton className="h-11 w-32 rounded-xl" />
      </div>

      {/* Student list */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm divide-y divide-slate-100">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32 rounded-lg" />
              <Skeleton className="h-3 w-20 rounded-lg" />
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="w-16 h-11 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>
    </div>
  )
}
