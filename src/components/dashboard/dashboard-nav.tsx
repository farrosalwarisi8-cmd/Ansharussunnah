// src/components/dashboard/dashboard-nav.tsx

"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useDashboard } from "./dashboard-context"
import { Role } from "@prisma/client"
import {
  Home,
  CalendarCheck2,
  GraduationCap,
  FileCheck2,
  BookOpen,
  Award,
  CreditCard,
  Users2,
  Layers,
  ArrowUpRight,
  UserCheck,
  DollarSign,
  User,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Sparkles,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { logout } from "@/actions/auth"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  badge?: string
  isPrimaryMobile?: boolean
  adminOnly?: boolean
}

export function getNavItems(role: Role, isAdmin: boolean): NavItem[] {
  switch (role) {
    case Role.GURU:
      const guruItems: NavItem[] = [
        { title: "Beranda", href: "/dashboard", icon: Home, isPrimaryMobile: true },
        { title: "Absensi", href: "/dashboard/absensi", icon: CalendarCheck2, isPrimaryMobile: true },
        { title: "Ujian", href: "/dashboard/ujian", icon: Award, isPrimaryMobile: true },
        { title: "Tugas", href: "/dashboard/tugas", icon: FileCheck2, isPrimaryMobile: true },
        { title: "Materi", href: "/dashboard/materi", icon: BookOpen },
        { title: "Rapor", href: "/dashboard/rapor", icon: GraduationCap },
      ]
      if (isAdmin) {
        guruItems.push(
          { title: "Kelola Guru", href: "/dashboard/guru", icon: Users2, adminOnly: true },
          { title: "Kelola Kelas", href: "/dashboard/kelas", icon: Layers, adminOnly: true },
          { title: "Kenaikan Kelas", href: "/dashboard/kenaikan-kelas", icon: ArrowUpRight, adminOnly: true },
          { title: "Verifikasi Pendaftar", href: "/dashboard/verifikasi-pendaftaran", icon: UserCheck, adminOnly: true }
        )
      }
      return guruItems

    case Role.SISWA:
      return [
        { title: "Beranda", href: "/dashboard", icon: Home, isPrimaryMobile: true },
        { title: "Absensi Saya", href: "/dashboard/absensi", icon: CalendarCheck2, isPrimaryMobile: true },
        { title: "Ujian", href: "/dashboard/ujian", icon: Award, isPrimaryMobile: true },
        { title: "Tugas", href: "/dashboard/tugas", icon: FileCheck2, isPrimaryMobile: true },
        { title: "Materi", href: "/dashboard/materi", icon: BookOpen },
        { title: "Rapor Saya", href: "/dashboard/rapor", icon: GraduationCap },
        { title: "Tagihan SPP", href: "/dashboard/tagihan", icon: CreditCard },
      ]

    case Role.ORANG_TUA:
      return [
        { title: "Beranda", href: "/dashboard", icon: Home, isPrimaryMobile: true },
        { title: "Absensi Anak", href: "/dashboard/absensi", icon: CalendarCheck2, isPrimaryMobile: true },
        { title: "Tagihan SPP", href: "/dashboard/tagihan", icon: CreditCard, isPrimaryMobile: true },
        { title: "Rapor Anak", href: "/dashboard/rapor", icon: GraduationCap, isPrimaryMobile: true },
        { title: "Tugas Anak", href: "/dashboard/tugas", icon: FileCheck2 },
        { title: "Materi Belajar", href: "/dashboard/materi", icon: BookOpen },
      ]

    case Role.ADMIN_KEUANGAN:
      return [
        { title: "Beranda", href: "/dashboard", icon: Home, isPrimaryMobile: true },
        { title: "Kelola Keuangan", href: "/dashboard/keuangan", icon: DollarSign, isPrimaryMobile: true },
        { title: "Tagihan Siswa", href: "/dashboard/tagihan", icon: CreditCard, isPrimaryMobile: true },
        { title: "Verifikasi Pendaftar", href: "/dashboard/verifikasi-pendaftaran", icon: UserCheck, isPrimaryMobile: true },
      ]

    case Role.SUPER_ADMIN:
    case Role.ADMIN_AKADEMIK:
    default:
      return [
        { title: "Beranda", href: "/dashboard", icon: Home, isPrimaryMobile: true },
        { title: "Absensi", href: "/dashboard/absensi", icon: CalendarCheck2, isPrimaryMobile: true },
        { title: "Ujian", href: "/dashboard/ujian", icon: Award, isPrimaryMobile: true },
        { title: "Tugas", href: "/dashboard/tugas", icon: FileCheck2, isPrimaryMobile: true },
        { title: "Materi", href: "/dashboard/materi", icon: BookOpen },
        { title: "Rapor", href: "/dashboard/rapor", icon: GraduationCap },
        { title: "Keuangan", href: "/dashboard/keuangan", icon: DollarSign },
        { title: "Kelola Guru", href: "/dashboard/guru", icon: Users2 },
        { title: "Kelola Kelas", href: "/dashboard/kelas", icon: Layers },
        { title: "Kenaikan Kelas", href: "/dashboard/kenaikan-kelas", icon: ArrowUpRight },
        { title: "Verifikasi Pendaftar", href: "/dashboard/verifikasi-pendaftaran", icon: UserCheck },
      ]
  }
}

export function DashboardNav() {
  const pathname = usePathname()
  const { user, isMobileMenuOpen, setIsMobileMenuOpen } = useDashboard()
  const navItems = getNavItems(user.role, user.isAdmin)

  const primaryMobileItems = navItems.slice(0, 4)
  const hasMoreItems = navItems.length > 4

  const isCurrentActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    return pathname.startsWith(href)
  }

  const roleLabel = {
    [Role.SUPER_ADMIN]: "Super Admin",
    [Role.ADMIN_AKADEMIK]: "Admin Akademik",
    [Role.ADMIN_KEUANGAN]: "Admin Keuangan",
    [Role.GURU]: user.isAdmin ? "Guru Admin" : "Guru Pengajar",
    [Role.SISWA]: "Santri / Siswa",
    [Role.ORANG_TUA]: "Wali Santri",
  }[user.role]

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP PERMANENT SIDEBAR (>= 1024px)                                  */}
      {/* ========================================================================= */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 bg-slate-900 text-slate-200 fixed inset-y-0 left-0 z-40 border-r border-slate-800 selection:bg-emerald-500 selection:text-white">
        {/* Brand Header */}
        <div className="h-20 flex items-center px-6 border-b border-slate-800/80 bg-slate-950/40">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-900/30 group-hover:scale-105 transition-transform">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                <span>Ansharussunnah</span>
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <span className="text-[11px] font-medium text-emerald-400/90 tracking-wide uppercase">
                LMS & Akademik
              </span>
            </div>
          </Link>
        </div>

        {/* User Card Mini */}
        <div className="p-4 mx-3 my-3 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-emerald-500/40">
            <AvatarImage src={user.avatar || ""} />
            <AvatarFallback className="bg-emerald-800 text-emerald-100 font-bold text-xs">
              {user.nama
                ?.split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("") || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="overflow-hidden flex-1">
            <div className="font-semibold text-sm text-white truncate">
              {user.nama}
            </div>
            <div className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {roleLabel}
            </div>
          </div>
        </div>

        {/* Navigation Link List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Menu Utama
          </div>
          {navItems.map((item) => {
            const active = isCurrentActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all group ${
                  active
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/40 font-semibold"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                      active ? "text-white" : "text-slate-400 group-hover:text-emerald-400"
                    }`}
                  />
                  <span>{item.title}</span>
                </div>
                {item.adminOnly && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                    Admin
                  </span>
                )}
                {active && <ChevronRight className="h-4 w-4 text-emerald-200 ml-auto" />}
              </Link>
            )
          })}
        </div>

        {/* Bottom Profile & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/50 space-y-1">
          <Link
            href="/dashboard/profil"
            className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <User className="h-4 w-4" />
            <span>Profil & Pengaturan</span>
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-3.5 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors min-h-[38px]"
            >
              <LogOut className="h-4 w-4" />
              <span>Keluar (Logout)</span>
            </button>
          </form>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE TOP BAR (< 1024px)                                              */}
      {/* ========================================================================= */}
      <header className="lg:hidden sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-white leading-tight">Ansharussunnah</div>
            <div className="text-[10px] text-emerald-400 font-medium">{roleLabel}</div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/profil"
            className="p-1 rounded-full border border-slate-700 active:scale-95 transition-transform"
          >
            <Avatar className="h-7 w-7">
              <AvatarImage src={user.avatar || ""} />
              <AvatarFallback className="bg-emerald-800 text-white text-[10px] font-bold">
                {user.nama?.slice(0, 2).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </Link>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 min-w-[40px] min-h-[40px] flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Buka Menu Lengkap"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. MOBILE BOTTOM NAVIGATION BAR (< 1024px)                                */}
      {/* ========================================================================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] safe-bottom">
        <div className="grid grid-flow-col auto-cols-fr gap-1 items-center max-w-md mx-auto">
          {primaryMobileItems.map((item) => {
            const active = isCurrentActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all min-h-[48px] min-w-[44px] touch-manipulation ${
                  active
                    ? "text-emerald-700 font-bold bg-emerald-50/80"
                    : "text-slate-500 hover:text-slate-900 active:bg-slate-100"
                }`}
              >
                <div className="relative">
                  <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-600" />
                  )}
                </div>
                <span className="text-[10px] mt-1 tracking-tight truncate max-w-[68px]">
                  {item.title}
                </span>
              </Link>
            )
          })}

          {/* Menu Lainnya Button */}
          {hasMoreItems && (
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-slate-500 hover:text-slate-900 active:bg-slate-100 min-h-[48px] min-w-[44px] touch-manipulation"
            >
              <Menu className="h-5 w-5 stroke-[1.75]" />
              <span className="text-[10px] mt-1 tracking-tight">Lainnya</span>
            </button>
          )}
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 4. MOBILE DRAWER SHEET (FULL MENU)                                        */}
      {/* ========================================================================= */}
      <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <DialogContent className="p-0 overflow-hidden bg-slate-900 text-white border-slate-800 max-w-sm rounded-3xl">
          <DialogHeader className="p-5 border-b border-slate-800 bg-slate-950 flex flex-row items-center justify-between text-left">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-emerald-500/40">
                <AvatarImage src={user.avatar || ""} />
                <AvatarFallback className="bg-emerald-800 text-white font-bold text-xs">
                  {user.nama?.slice(0, 2).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-base font-bold text-white truncate max-w-[180px]">
                  {user.nama}
                </DialogTitle>
                <span className="text-xs text-emerald-400">{roleLabel}</span>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 max-h-[60vh] overflow-y-auto space-y-1.5">
            <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Semua Menu
            </div>
            {navItems.map((item) => {
              const active = isCurrentActive(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                    active
                      ? "bg-emerald-600 text-white font-semibold shadow-sm"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-slate-400" />
                    <span>{item.title}</span>
                  </div>
                  {item.adminOnly && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      Admin
                    </span>
                  )}
                </Link>
              )
            })}
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-950/80 space-y-2">
            <Link
              href="/dashboard/profil"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white min-h-[44px]"
            >
              <User className="h-4 w-4" />
              <span>Profil Pengguna</span>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-3 w-full p-3 rounded-xl text-sm font-semibold text-rose-400 hover:bg-rose-950/50 hover:text-rose-300 transition-colors min-h-[44px]"
              >
                <LogOut className="h-4 w-4" />
                <span>Keluar dari Akun</span>
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
