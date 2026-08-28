// src/app/dashboard/layout.tsx

import { enforcePasswordChange } from "@/lib/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Guard: Paksa user ganti password jika mustChangePassword = true
  await enforcePasswordChange("/dashboard")

  return (
    <div className="min-h-screen bg-gray-50">
      {/* TODO: Tambahkan Sidebar & Header Dashboard di sini */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}