// src/app/cek-pendaftaran/loading.tsx

import { Skeleton } from "@/components/ui/skeleton"

export default function CekPendaftaranLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <Skeleton className="h-4 w-32 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-20 rounded-lg" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md p-8 rounded-3xl bg-white border border-slate-200/80 shadow-lg space-y-6 text-center">
          <Skeleton className="w-16 h-16 rounded-2xl mx-auto" />
          <Skeleton className="h-6 w-48 mx-auto rounded-lg" />
          <Skeleton className="h-4 w-64 mx-auto rounded-lg" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </main>

      <footer className="text-center py-6">
        <Skeleton className="h-3 w-48 mx-auto rounded-lg" />
      </footer>
    </div>
  )
}
