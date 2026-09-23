// src/app/dashboard/biaya-ppdb/page.tsx
//
// Halaman pengaturan biaya PPDB: hanya admin (guru admin / super admin /
// admin akademik / admin keuangan). Data di-fetch server-side lalu diteruskan
// ke client component agar render awal cepat (tanpa waterfall klien).

import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser, isAcademicAdminRole } from "@/lib/auth"
import { Role } from "@prisma/client"
import { getBiayaPPDBAdmin } from "@/actions/biaya-ppdb"
import { BiayaPPDBClient } from "@/components/dashboard/biaya-ppdb-client"

export const metadata: Metadata = {
  title: "Biaya PPDB — Anshorussunnah",
  description: "Atur biaya pendaftaran, uang gedung, dan sarpras per jenjang serta rekening tujuan transfer.",
}

export default async function BiayaPPDBPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const bolehAkses =
    isAcademicAdminRole(user.role) ||
    user.role === Role.GURU ||
    user.role === Role.ADMIN_KEUANGAN
  if (!bolehAkses || (user.role === Role.GURU && !user.isAdmin)) {
    redirect("/dashboard")
  }

  // Data awal server-side; panel masih bisa refresh manual dari klien.
  let initialData: Awaited<ReturnType<typeof getBiayaPPDBAdmin>>["data"] = undefined
  try {
    const res = await getBiayaPPDBAdmin()
    if (res.success && res.data) initialData = res.data
  } catch {
    // Client menampilkan error state + tombol muat ulang
  }

  return (
    <BiayaPPDBClient
      initialData={initialData ?? null}
      initialError={!initialData}
    />
  )
}
