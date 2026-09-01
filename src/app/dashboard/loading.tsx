// src/app/dashboard/loading.tsx

import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* Sidebar skeleton (desktop) */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 bg-slate-800 fixed inset-y-0 left-0 z-40 border-r border-slate-700">
        {/* Brand */}
        <div className="h-20 flex items-center px-6 border-b border-slate-700/80">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl bg-slate-800" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28 bg-slate-800" />
              <Skeleton className="h-2.5 w-20 bg-slate-800" />
            </div>
          </div>
        </div>
        {/* Nav items */}
        <div className="flex-1 px-3 py-4 space-y-1">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
              <Skeleton className="w-5 h-5 rounded bg-slate-800" />
              <Skeleton className="h-3.5 flex-1 rounded bg-slate-800" />
            </div>
          ))}
        </div>
        {/* User info */}
        <div className="px-4 py-4 border-t border-slate-700/80">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full bg-slate-800" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3.5 w-24 bg-slate-800" />
              <Skeleton className="h-2.5 w-16 bg-slate-800" />
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar skeleton */}
      <div className="lg:hidden sticky top-0 z-40 bg-slate-800/95 backdrop-blur-md border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-8 h-8 rounded-lg bg-slate-800" />
          <div className="space-y-1">
            <Skeleton className="h-3.5 w-20 bg-slate-800" />
            <Skeleton className="h-2.5 w-14 bg-slate-800" />
          </div>
        </div>
        <Skeleton className="w-8 h-8 rounded-lg bg-slate-800" />
      </div>

      {/* Main content skeleton */}
      <main className="flex-1 lg:ml-64 xl:ml-72 p-4 sm:p-6 lg:p-8">
        {/* Page header */}
        <div className="mb-6 sm:mb-8">
          <Skeleton className="h-8 w-48 rounded-xl mb-2" />
          <Skeleton className="h-4 w-72 rounded-lg" />
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 sm:mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24 rounded-lg" />
                <Skeleton className="w-10 h-10 rounded-xl" />
              </div>
              <Skeleton className="h-8 w-16 rounded-lg" />
              <Skeleton className="h-3 w-32 rounded-lg" />
            </div>
          ))}
        </div>

        {/* Content area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <Skeleton className="h-5 w-36 rounded-lg mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4 rounded-lg" />
                    <Skeleton className="h-2.5 w-1/2 rounded-lg" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <Skeleton className="h-5 w-36 rounded-lg mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4 rounded-lg" />
                    <Skeleton className="h-2.5 w-1/2 rounded-lg" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
