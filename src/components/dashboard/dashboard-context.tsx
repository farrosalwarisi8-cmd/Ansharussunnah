// src/components/dashboard/dashboard-context.tsx

"use client"

import * as React from "react"
import { Role } from "@prisma/client"

export interface ChildStudent {
  id: string
  userId: string
  nama: string
  nisn?: string | null
  nis?: string | null
  kelasNama: string
  jenjangNama: string
  avatar?: string | null
}

export interface DashboardUser {
  id: string
  nama: string
  email: string
  role: Role
  isAdmin: boolean
  avatar?: string | null
  kelas?: {
    id: string
    nama: string
    jenjang: { id: string; nama: string }
  } | null
  children?: ChildStudent[]
}

interface DashboardContextType {
  user: DashboardUser
  selectedChild: ChildStudent | null
  setSelectedChild: (child: ChildStudent) => void
  isMobileMenuOpen: boolean
  setIsMobileMenuOpen: (open: boolean) => void
}

const DashboardContext = React.createContext<DashboardContextType | undefined>(undefined)

export function DashboardProvider({
  user,
  children,
}: {
  user: DashboardUser
  children: React.ReactNode
}) {
  const [selectedChild, setSelectedChild] = React.useState<ChildStudent | null>(() => {
    if (user.role === Role.ORANG_TUA && user.children && user.children.length > 0) {
      return user.children[0]
    }
    return null
  })

  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)

  return (
    <DashboardContext.Provider
      value={{
        user,
        selectedChild,
        setSelectedChild,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
      }}
    >
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const context = React.useContext(DashboardContext)
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider")
  }
  return context
}
