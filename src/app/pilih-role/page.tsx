// src/app/pilih-role/page.tsx

import { Suspense } from "react"
import PilihRoleClient from "./pilih-role-client"

export default function PilihRolePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-yellow-900 to-slate-800 flex flex-col justify-center items-center p-4 sm:p-6">
      <Suspense fallback={<div className="h-40 bg-slate-800 animate-pulse rounded-xl" />}>
        <PilihRoleClient />
      </Suspense>
    </div>
  )
}
