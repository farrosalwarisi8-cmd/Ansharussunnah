// src/app/dashboard/verifikasi-pendaftaran/loading.tsx

import { Skeleton } from "@/components/ui/skeleton"

export default function VerifikasiLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48 rounded-xl mb-2" />
        <Skeleton className="h-4 w-64 rounded-lg" />
      </div>

      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-full" />
        ))}
      </div>

      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32 rounded-lg" />
                  <Skeleton className="h-3 w-24 rounded-lg" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-3 w-28 rounded-lg" />
              <Skeleton className="h-3 w-24 rounded-lg" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28 rounded-xl" />
              <Skeleton className="h-9 w-28 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
