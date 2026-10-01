// src/app/dashboard/email-outbox/page.tsx
//
// Halaman admin: status email outbox + tombol kirim ulang. Hanya untuk admin
// (super admin / admin akademik / admin keuangan). Data awal diambil
// server-side agar render pertama cepat.

import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { Role } from "@prisma/client"
import { getDaftarEmailOutbox } from "@/actions/email-outbox"
import { EmailOutboxPageClient } from "@/components/dashboard/email-outbox-page-client"

export const metadata: Metadata = {
  title: "Email Outbox — Anshorussunnah",
  description:
    "Pantau status dan kirim ulang email penting yang gagal terkirim.",
}

export default async function EmailOutboxPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const bolehAkses =
    user.role === Role.SUPER_ADMIN ||
    user.role === Role.ADMIN_AKADEMIK ||
    user.role === Role.ADMIN_KEUANGAN
  if (!bolehAkses) redirect("/dashboard")

  let initialData: Awaited<ReturnType<typeof getDaftarEmailOutbox>>["data"] = undefined
  try {
    const res = await getDaftarEmailOutbox({ status: "SEMUA", page: 1, pageSize: 25 })
    if (res.success && res.data) initialData = res.data
  } catch {
    // Client menampilkan error state + tombol muat ulang.
  }

  return (
    <EmailOutboxPageClient
      initialData={initialData ?? null}
      initialError={!initialData}
    />
  )
}
