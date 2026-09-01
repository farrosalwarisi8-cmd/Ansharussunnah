// src/app/dashboard/kenaikan-kelas/loading.tsx

import { Skeleton } from "@/components/ui/skeleton"

export default function KenaikanKelasLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-36 rounded-xl mb-2" />
        <Skeleton className="h-4 w-48 rounded-lg" />
      </div>

      <div className="flex gap-3">
        <Skeleton className="h-11 w-56 rounded-xl" />
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4">
          <Skeleton className="h-4 w-8 rounded-lg" />
          <Skeleton className="h-4 w-32 rounded-lg" />
          <Skeleton className="h-4 w-24 rounded-lg" />
          <Skeleton className="h-4 w-32 rounded-lg" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 border-b border-slate-50 flex gap-4 items-center">
            <Skeleton className="h-4 w-8 rounded-lg" />
            <Skeleton className="h-4 w-36 rounded-lg" />
            <Skeleton className="h-4 w-24 rounded-lg" />
            <Skeleton className="h-9 w-40 rounded-xl" />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Skeleton className="h-11 w-40 rounded-xl" />
      </div>
    </div>
  )
}
