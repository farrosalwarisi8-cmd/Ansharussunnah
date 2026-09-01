"use client"

import dynamic from "next/dynamic"

// Lazy-load Toaster — only JS bundle loaded on pages that actually trigger a toast
const Toaster = dynamic(
  () => import("@/components/ui/toaster").then((m) => m.Toaster),
  { ssr: false }
)

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  )
}
