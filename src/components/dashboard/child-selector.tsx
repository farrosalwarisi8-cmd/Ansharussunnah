// src/components/dashboard/child-selector.tsx

"use client"

import * as React from "react"
import { useDashboard } from "./dashboard-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Users, ChevronDown, Check, GraduationCap } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Role } from "@prisma/client"

export function ChildSelector() {
  const { user, selectedChild, setSelectedChild } = useDashboard()

  if (user.role !== Role.ORANG_TUA || !user.children || user.children.length === 0) {
    return null
  }

  const children = user.children

  return (
    <div className="bg-emerald-800/10 border border-emerald-500/20 rounded-2xl p-3 sm:p-4 mb-6 transition-all shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Memantau Data Santri / Anak
            </span>
            <p className="text-xs text-slate-500">
              {children.length > 1
                ? `Tersedia ${children.length} anak terdaftar. Klik untuk beralih.`
                : "Data otomatis tersinkronisasi untuk anak Anda."}
            </p>
          </div>
        </div>

        {/* Dropdown Selector or Active Child Card */}
        {children.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-between gap-3 bg-white px-3.5 py-2.5 rounded-xl border border-emerald-200 shadow-sm hover:border-emerald-300 hover:shadow transition-all text-left w-full sm:w-auto min-h-[48px] touch-manipulation"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 border border-emerald-300 ring-2 ring-emerald-50">
                    <AvatarImage src={selectedChild?.avatar || ""} />
                    <AvatarFallback className="bg-emerald-700 text-white font-bold text-xs">
                      {selectedChild?.nama
                        ?.split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("") || "AN"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-bold text-slate-900 line-clamp-1">
                      {selectedChild?.nama}
                    </div>
                    <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" />
                      <span>{selectedChild?.jenjangNama} - {selectedChild?.kelasNama}</span>
                    </div>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[300px] p-1.5 rounded-2xl shadow-xl border-emerald-100">
              <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Pilih Anak yang Dipantau:
              </div>
              {children.map((child) => {
                const isSelected = selectedChild?.id === child.id
                return (
                  <DropdownMenuItem
                    key={child.id}
                    onClick={() => setSelectedChild(child)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={child.avatar || ""} />
                        <AvatarFallback className="bg-emerald-100 text-emerald-800 text-xs font-bold">
                          {child.nama
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {child.nama}
                        </div>
                        <div className="text-xs text-slate-500">
                          {child.jenjangNama} • {child.kelasNama}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-emerald-600 font-bold" />}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-3 bg-white px-3.5 py-2 rounded-xl border border-emerald-200 shadow-sm w-full sm:w-auto">
            <Avatar className="h-9 w-9 border border-emerald-300 ring-2 ring-emerald-50">
              <AvatarImage src={selectedChild?.avatar || ""} />
              <AvatarFallback className="bg-emerald-700 text-white font-bold text-xs">
                {selectedChild?.nama
                  ?.split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("") || "AN"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-bold text-slate-900">
                {selectedChild?.nama}
              </div>
              <div className="text-xs text-emerald-700 font-medium">
                {selectedChild?.jenjangNama} - {selectedChild?.kelasNama}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
