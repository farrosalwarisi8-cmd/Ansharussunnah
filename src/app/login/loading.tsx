// src/app/login/loading.tsx

import { Skeleton } from "@/components/ui/skeleton"

export default function LoginLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-yellow-900 to-slate-800 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md relative z-10">
        <Skeleton className="h-4 w-32 rounded-lg bg-white/10 mb-6" />

        <div className="border border-slate-700 bg-slate-800/90 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden p-8 space-y-6">
          <div className="text-center space-y-3">
            <Skeleton className="w-14 h-14 rounded-2xl mx-auto bg-white/10" />
            <Skeleton className="h-6 w-36 mx-auto rounded-lg bg-white/10" />
            <Skeleton className="h-4 w-56 mx-auto rounded-lg bg-white/10" />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20 rounded-lg bg-white/10" />
              <Skeleton className="h-11 w-full rounded-xl bg-white/10" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20 rounded-lg bg-white/10" />
              <Skeleton className="h-11 w-full rounded-xl bg-white/10" />
            </div>
            <Skeleton className="h-11 w-full rounded-xl bg-yellow-500/30" />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          <Skeleton className="h-4 w-4 rounded bg-white/10" />
          <Skeleton className="h-3 w-48 rounded-lg bg-white/10" />
        </div>
      </div>
    </div>
  )
}
