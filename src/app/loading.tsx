// src/app/loading.tsx

import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar skeleton */}
      <div className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Skeleton className="h-10 w-20 rounded-xl hidden sm:block" />
            <Skeleton className="h-10 w-24 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Hero skeleton */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 bg-gradient-to-b from-yellow-900 via-slate-800 to-slate-800">
        <div className="container mx-auto px-4 sm:px-6 relative z-10 text-center max-w-4xl">
          <Skeleton className="h-8 w-64 mx-auto rounded-full bg-white/10 mb-8" />
          <Skeleton className="h-12 sm:h-16 w-3/4 mx-auto rounded-2xl bg-white/10 mb-4" />
          <Skeleton className="h-12 sm:h-16 w-1/2 mx-auto rounded-2xl bg-white/10 mb-6" />
          <Skeleton className="h-5 w-2/3 mx-auto rounded-xl bg-white/10 mb-10" />
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Skeleton className="h-14 w-full sm:w-56 rounded-2xl bg-amber-400/20" />
            <Skeleton className="h-14 w-full sm:w-56 rounded-2xl bg-white/10" />
          </div>
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                <Skeleton className="h-5 w-5 rounded bg-white/10 mb-2" />
                <Skeleton className="h-4 w-20 rounded bg-white/10 mb-1" />
                <Skeleton className="h-3 w-28 rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content skeleton */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-200/80">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <div className="text-center mb-14">
            <Skeleton className="h-6 w-36 mx-auto rounded-full mb-3" />
            <Skeleton className="h-10 w-72 mx-auto rounded-xl mb-2" />
            <Skeleton className="h-4 w-56 mx-auto rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-4">
                <Skeleton className="w-12 h-12 rounded-2xl" />
                <Skeleton className="h-5 w-24 rounded-lg" />
                <Skeleton className="h-3 w-full rounded-lg" />
                <Skeleton className="h-3 w-3/4 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
