// src/app/dashboard/kelola-akun-keuangan/page.tsx

import type { Metadata } from "next"
import { getDaftarAdminKeuangan } from "@/actions/admin-keuangan"
import { KelolaAkunKeuanganClient } from "@/components/dashboard/kelola-akun-keuangan-client"

export const metadata: Metadata = {
  title: "Kelola Akun Admin Keuangan — Ansharussunnah",
  description: "Manajemen akun kasir/admin keuangan yang mengelola SPP, verifikasi pembayaran, dan pencatatan keuangan.",
}

export default async function KelolaAkunKeuanganPage() {
  // Fetch data server-side — no client-side waterfall
  let adminList: {
    id: string
    nama: string
    email: string
    aktif: boolean
    mustChangePassword: boolean
    createdAt: string
  }[] = []

  try {
    const res = await getDaftarAdminKeuangan()
    if (res.success && Array.isArray(res.data)) {
      adminList = res.data as typeof adminList
    }
  } catch {
    // Fallback empty — client component handles empty state
  }

  return <KelolaAkunKeuanganClient initialAdminList={adminList} />
}
