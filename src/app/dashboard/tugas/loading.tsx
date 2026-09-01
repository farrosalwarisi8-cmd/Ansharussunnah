// src/app/dashboard/tugas/loading.tsx

import { Skeleton } from "@/components/ui/skeleton"

export default function TugasLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-24 rounded-xl mb-2" />
          <Skeleton className="h-4 w-48 rounded-lg" />
        </div>
        <Skeleton className="h-11 w-32 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-full rounded-lg" />
            <Skeleton className="h-3.5 w-3/4 rounded-lg" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-3 w-28 rounded-lg" />
              <Skeleton className="h-3 w-20 rounded-lg" />
            </div>
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}
