// src/app/pendaftaran/loading.tsx

import { Skeleton } from "@/components/ui/skeleton"

export default function PendaftaranLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header skeleton */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <Skeleton className="h-4 w-36 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-20 rounded-lg" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Title */}
        <div className="mb-8">
          <Skeleton className="h-9 w-56 rounded-xl mb-2" />
          <Skeleton className="h-4 w-80 rounded-lg" />
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-8 px-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-3 w-16 rounded-lg hidden sm:block" />
            </div>
          ))}
        </div>

        {/* Form card */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-6">
          <Skeleton className="h-6 w-40 rounded-lg" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24 rounded-lg" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Skeleton className="h-11 w-24 rounded-xl" />
            <Skeleton className="h-11 w-32 rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  )
}
