// src/components/dashboard/dashboard-nav.tsx

"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  Bell,
  ChevronDown,
  ChevronsLeft,
  Home,
  CalendarCheck2,
  GraduationCap,
  FileCheck2,
  BookOpen,
  Award,
  CreditCard,
  FileText,
  Users2,
  Layers,
  BookMarked,
  ArrowUpRight,
  UserCheck,
  DollarSign,
  CalendarDays,
  Wallet,
  User,
  LogOut,
  Menu,
  Sparkles,
  RefreshCw,
  BarChart3,
  ShieldCheck,
  KeyRound,
  Mail,
  type LucideIcon,
} from "lucide-react"
import { useDashboard } from "./dashboard-context"
import { Role } from "@/lib/roles"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { logout } from "@/actions/auth"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GantiAkunDialog } from "./ganti-akun-dialog"

export interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  badge?: string
  isPrimaryMobile?: boolean
  adminOnly?: boolean
  /** Label pendek untuk bottom-nav mobile (mencegah teks terpotong). */
  mobileTitle?: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

const SIDEBAR_EXPANDED = "16rem"
const SIDEBAR_COLLAPSED = "4.75rem"
const SIDEBAR_STORAGE_KEY = "dashboard:sidebar-collapsed"

/** Label halaman untuk header & breadcrumb, diturunkan dari pathname. */
const PAGE_META: Record<string, { title: string; section?: string }> = {
  "/dashboard": { title: "Beranda" },
  "/dashboard/profil": { title: "Profil Pengguna", section: "Pengaturan" },
  "/dashboard/absensi": { title: "Absensi", section: "Akademik" },
  "/dashboard/tugas": { title: "Tugas", section: "Akademik" },
  "/dashboard/tugas/buat": { title: "Buat Tugas", section: "Akademik" },
  "/dashboard/ujian": { title: "Ujian", section: "Akademik" },
  "/dashboard/ujian/buat": { title: "Buat Ujian", section: "Akademik" },
  "/dashboard/materi": { title: "Materi Pembelajaran", section: "Akademik" },
  "/dashboard/rekap-nilai": { title: "Rekap Nilai", section: "Akademik" },
  "/dashboard/rapor": { title: "Rapor", section: "Akademik" },
  "/dashboard/kelas": { title: "Kelas", section: "Siswa & Sekolah" },
  "/dashboard/siswa": { title: "Data Siswa", section: "Siswa & Sekolah" },
  "/dashboard/guru": { title: "Guru", section: "Siswa & Sekolah" },
  "/dashboard/mapel": { title: "Mata Pelajaran", section: "Siswa & Sekolah" },
  "/dashboard/periode-ajaran": {
    title: "Periode Ajaran",
    section: "Siswa & Sekolah",
  },
  "/dashboard/kenaikan-kelas": {
    title: "Kenaikan Kelas",
    section: "Siswa & Sekolah",
  },
  "/dashboard/verifikasi-pendaftaran": {
    title: "Verifikasi Pendaftaran",
    section: "Pendaftaran",
  },
  "/dashboard/biaya-ppdb": { title: "Biaya PPDB", section: "Pendaftaran" },
  "/dashboard/berkas": { title: "Berkas Santri", section: "Pendaftaran" },
  "/dashboard/keuangan": { title: "Keuangan", section: "Keuangan" },
  "/dashboard/tagihan": { title: "Tagihan", section: "Keuangan" },
  "/dashboard/daftar-siswa": { title: "Daftar Siswa", section: "Keuangan" },
  "/dashboard/kelola-akun-keuangan": {
    title: "Kelola Akun Keuangan",
    section: "Keuangan",
  },
  "/dashboard/email-outbox": { title: "Email Outbox", section: "Sistem" },
}

const ROLE_LABEL: Record<Role, string> = {
  [Role.SUPER_ADMIN]: "Super Admin",
  [Role.ADMIN_AKADEMIK]: "Admin Akademik",
  [Role.ADMIN_KEUANGAN]: "Admin Keuangan",
  [Role.GURU]: "Guru Pengajar",
  [Role.SISWA]: "Santri / Siswa",
  [Role.ORANG_TUA]: "Wali Santri",
}

const HOME: NavItem = {
  title: "Beranda",
  href: "/dashboard",
  icon: Home,
  isPrimaryMobile: true,
}

/**
 * Daftar menu per role.
 * PENTING: daftar href di sini sama persis dengan versi sebelumnya — redesign
 * tidak boleh menambah/menghapus akses menu, hanya mengelompokkannya.
 */
export function getNavItems(role: Role, isAdmin: boolean): NavItem[] {
  switch (role) {
    case Role.GURU: {
      const guruItems: NavItem[] = [
        HOME,
        { title: "Absensi", href: "/dashboard/absensi", icon: CalendarCheck2, isPrimaryMobile: true },
        { title: "Ujian", href: "/dashboard/ujian", icon: Award, isPrimaryMobile: true },
        { title: "Tugas", href: "/dashboard/tugas", icon: FileCheck2, isPrimaryMobile: true },
        { title: "Materi", href: "/dashboard/materi", icon: BookOpen },
        { title: "Rekap Nilai", href: "/dashboard/rekap-nilai", icon: BarChart3 },
        { title: "Rapor", href: "/dashboard/rapor", icon: GraduationCap },
      ]
      if (isAdmin) {
        guruItems.push(
          { title: "Kelola Siswa", href: "/dashboard/siswa", icon: GraduationCap, adminOnly: true },
          { title: "Kelola Guru", href: "/dashboard/guru", icon: Users2, adminOnly: true },
          { title: "Kelola Kelas", href: "/dashboard/kelas", icon: Layers, adminOnly: true },
          { title: "Mata Pelajaran", href: "/dashboard/mapel", icon: BookMarked, adminOnly: true },
          { title: "Periode Ajaran", href: "/dashboard/periode-ajaran", icon: CalendarDays, adminOnly: true },
          { title: "Kenaikan Kelas", href: "/dashboard/kenaikan-kelas", icon: ArrowUpRight, adminOnly: true },
          { title: "Verifikasi Pendaftar", href: "/dashboard/verifikasi-pendaftaran", icon: UserCheck, adminOnly: true },
          { title: "Biaya PPDB", href: "/dashboard/biaya-ppdb", icon: Wallet, adminOnly: true },
          { title: "Kelola Akun Keuangan", href: "/dashboard/kelola-akun-keuangan", icon: Wallet, adminOnly: true }
        )
      }
      return guruItems
    }

    case Role.SISWA:
      return [
        HOME,
        { title: "Absensi Saya", href: "/dashboard/absensi", icon: CalendarCheck2, isPrimaryMobile: true, mobileTitle: "Absensi" },
        { title: "Ujian", href: "/dashboard/ujian", icon: Award, isPrimaryMobile: true },
        { title: "Tugas", href: "/dashboard/tugas", icon: FileCheck2, isPrimaryMobile: true },
        { title: "Materi", href: "/dashboard/materi", icon: BookOpen },
        { title: "Rapor Saya", href: "/dashboard/rapor", icon: GraduationCap },
      ]

    case Role.ORANG_TUA:
      return [
        HOME,
        { title: "Absensi Anak", href: "/dashboard/absensi", icon: CalendarCheck2, isPrimaryMobile: true, mobileTitle: "Absensi" },
        { title: "Ujian Anak", href: "/dashboard/ujian", icon: Award, isPrimaryMobile: true, mobileTitle: "Ujian" },
        { title: "Tagihan SPP", href: "/dashboard/tagihan", icon: CreditCard, isPrimaryMobile: true, mobileTitle: "Tagihan" },
        { title: "Berkas Santri", href: "/dashboard/berkas", icon: FileText },
        { title: "Rapor Anak", href: "/dashboard/rapor", icon: GraduationCap },
        { title: "Tugas Anak", href: "/dashboard/tugas", icon: FileCheck2 },
        { title: "Materi Belajar", href: "/dashboard/materi", icon: BookOpen },
      ]

    case Role.ADMIN_KEUANGAN:
      return [
        HOME,
        { title: "Kelola Keuangan", href: "/dashboard/keuangan", icon: DollarSign, isPrimaryMobile: true, mobileTitle: "Keuangan" },
        { title: "Tagihan Siswa", href: "/dashboard/tagihan", icon: CreditCard, isPrimaryMobile: true, mobileTitle: "Tagihan" },
        { title: "Daftar Siswa", href: "/dashboard/daftar-siswa", icon: Users2, isPrimaryMobile: true, mobileTitle: "Siswa" },
        { title: "Biaya PPDB", href: "/dashboard/biaya-ppdb", icon: Wallet },
        { title: "Email Outbox", href: "/dashboard/email-outbox", icon: Mail, adminOnly: true },
      ]

    case Role.SUPER_ADMIN:
    case Role.ADMIN_AKADEMIK:
    default:
      return [
        HOME,
        { title: "Absensi", href: "/dashboard/absensi", icon: CalendarCheck2, isPrimaryMobile: true },
        { title: "Ujian", href: "/dashboard/ujian", icon: Award, isPrimaryMobile: true },
        { title: "Tugas", href: "/dashboard/tugas", icon: FileCheck2, isPrimaryMobile: true },
        { title: "Materi", href: "/dashboard/materi", icon: BookOpen },
        { title: "Rekap Nilai", href: "/dashboard/rekap-nilai", icon: BarChart3 },
        { title: "Rapor", href: "/dashboard/rapor", icon: GraduationCap },
        { title: "Keuangan", href: "/dashboard/keuangan", icon: DollarSign },
        { title: "Kelola Siswa", href: "/dashboard/siswa", icon: GraduationCap },
        { title: "Kelola Guru", href: "/dashboard/guru", icon: Users2 },
        { title: "Kelola Kelas", href: "/dashboard/kelas", icon: Layers },
        { title: "Mata Pelajaran", href: "/dashboard/mapel", icon: BookMarked },
        { title: "Periode Ajaran", href: "/dashboard/periode-ajaran", icon: CalendarDays },
        { title: "Kenaikan Kelas", href: "/dashboard/kenaikan-kelas", icon: ArrowUpRight },
        { title: "Verifikasi Pendaftar", href: "/dashboard/verifikasi-pendaftaran", icon: UserCheck },
        { title: "Biaya PPDB", href: "/dashboard/biaya-ppdb", icon: Wallet },
        { title: "Kelola Akun Keuangan", href: "/dashboard/kelola-akun-keuangan", icon: Wallet },
        { title: "Email Outbox", href: "/dashboard/email-outbox", icon: Mail, adminOnly: true },
      ]
  }
}

/**
 * Pengelompokan menu untuk tampilan. Hanya mengubah PRESENTASI —
 * himpunan item persis sama dengan `getNavItems`.
 */
export function getNavSections(role: Role, isAdmin: boolean): NavSection[] {
  const items = getNavItems(role, isAdmin)
  const find = (href: string) => items.find((i) => i.href === href)

  const sections: NavSection[] = []
  const beranda = find("/dashboard")
  if (beranda) sections.push({ title: "Beranda", items: [beranda] })

  const akademik = items.filter((i) =>
    [
      "/dashboard/absensi",
      "/dashboard/tugas",
      "/dashboard/ujian",
      "/dashboard/materi",
      "/dashboard/rekap-nilai",
      "/dashboard/rapor",
    ].some((base) => i.href === base || i.href.startsWith(base + "/"))
  )
  if (akademik.length) sections.push({ title: "Akademik", items: akademik })

  const pendaftaran = items.filter((i) =>
    ["/dashboard/verifikasi-pendaftaran", "/dashboard/biaya-ppdb", "/dashboard/berkas"].some(
      (base) => i.href === base || i.href.startsWith(base + "/")
    )
  )
  if (pendaftaran.length) sections.push({ title: "Pendaftaran", items: pendaftaran })

  const siswa = items.filter((i) =>
    [
      "/dashboard/siswa",
      "/dashboard/guru",
      "/dashboard/kelas",
      "/dashboard/mapel",
      "/dashboard/periode-ajaran",
      "/dashboard/kenaikan-kelas",
      "/dashboard/daftar-siswa",
    ].some((base) => i.href === base || i.href.startsWith(base + "/"))
  )
  if (siswa.length) sections.push({ title: "Siswa & Sekolah", items: siswa })

  const keuangan = items.filter((i) =>
    ["/dashboard/keuangan", "/dashboard/tagihan", "/dashboard/kelola-akun-keuangan"].some(
      (base) => i.href === base || i.href.startsWith(base + "/")
    )
  )
  if (keuangan.length) sections.push({ title: "Keuangan", items: keuangan })

  const sistem = items.filter((i) => i.href === "/dashboard/email-outbox")
  if (sistem.length) sections.push({ title: "Sistem", items: sistem })

  sections.push({
    title: "Pengaturan",
    items: [{ title: "Profil Pengguna", href: "/dashboard/profil", icon: User }],
  })

  return sections
}

function resolvePageMeta(pathname: string) {
  if (PAGE_META[pathname]) return { pathname, ...PAGE_META[pathname] }

  const match = Object.keys(PAGE_META)
    .filter((path) => pathname.startsWith(path + "/"))
    .sort((a, b) => b.length - a.length)[0]

  if (match) {
    const base = PAGE_META[match]
    const rest = pathname.slice(match.length + 1)
    return {
      pathname,
      title: base.title,
      section: base.section,
      detail: rest.replace(/-/g, " "),
    }
  }

  return { pathname, title: "Dashboard", section: undefined }
}

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = React.useState(false)

  React.useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1")
    } catch {
      // localStorage tidak tersedia (mis. mode privat) — tetap expanded.
    }
  }, [])

  const toggle = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0")
      } catch {
        // diabaikan
      }
      return next
    })
  }, [])

  React.useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-w",
      collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED
    )
  }, [collapsed])

  return { collapsed, toggle }
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon as LucideIcon

  return (
    <li className="relative">
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.title : undefined}
        className={`group relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${
          collapsed ? "justify-center px-0" : ""
        } ${
          active
            ? "bg-yellow-500/15 text-yellow-300 shadow-sm ring-1 ring-inset ring-yellow-500/30"
            : "text-slate-300 hover:bg-white/5 hover:text-white"
        }`}
      >
        {active && (
          <span
            className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-yellow-400"
            aria-hidden="true"
          />
        )}
        <Icon
          className={`h-[18px] w-[18px] shrink-0 transition-colors ${
            active ? "text-yellow-400" : "text-slate-400 group-hover:text-yellow-300"
          }`}
          aria-hidden="true"
        />
        {!collapsed && <span className="truncate">{item.title}</span>}
        {!collapsed && item.adminOnly && (
          <span className="ml-auto rounded-md border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-300">
            Admin
          </span>
        )}
      </Link>

      {/* Tooltip saat sidebar dic-fold — tetap terbaca meski label tersembunyi. */}
      {collapsed && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lifted transition-opacity group-hover:opacity-100 lg:block"
        >
          {item.title}
        </span>
      )}
    </li>
  )
}

function DashboardNavInner() {
  const pathname = usePathname()
  const { user, isMobileMenuOpen, setIsMobileMenuOpen } = useDashboard()
  const navItems = getNavItems(user.role, user.isAdmin)
  const sections = getNavSections(user.role, user.isAdmin)
  const [gantiAkunOpen, setGantiAkunOpen] = React.useState(false)
  const { collapsed, toggle } = useSidebarCollapsed()

  const primaryMobileItems = navItems.slice(0, 4)
  const hasMoreItems = navItems.length > 4

  const isCurrentActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href)

  const roleLabel =
    user.role === Role.GURU && user.isAdmin
      ? "Guru Admin"
      : (ROLE_LABEL[user.role] ?? "Pengguna")

  const pageMeta = resolvePageMeta(pathname)
  const initials =
    user.nama
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"

  return (
    <>
      {/* ===================================================================== */}
      {/* DESKTOP SIDEBAR (>= 1024px) — bisa dic-fold                             */}
      {/* ===================================================================== */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col border-r border-slate-800 bg-slate-900 text-slate-200 shadow-sidebar transition-[width] duration-300 ease-out ${
          collapsed ? "w-sidebar-collapsed" : "w-sidebar"
        }`}
        aria-label="Navigasi utama"
      >
        {/* Brand */}
        <div
          className={`flex h-[72px] shrink-0 items-center border-b border-slate-800 ${
            collapsed ? "justify-center px-3" : "px-5"
          }`}
        >
          <Link
            href="/dashboard"
            className="group flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
          >
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white/95 shadow-gold-soft">
              <Image
                src="/anshorussunnah-logo.webp"
                alt="Logo Anshorussunnah"
                fill
                sizes="40px"
                className="object-contain"
              />
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-extrabold tracking-tight text-white">
                  Anshorussunnah
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                </span>
                <span className="block text-[11px] font-medium uppercase tracking-wider text-amber-400/90">
                  LMS &amp; Akademik
                </span>
              </span>
            )}
          </Link>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          {sections.map((section) => (
            <div key={section.title} className="mb-5 last:mb-0">
              {!collapsed && (
                <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {section.title}
                </p>
              )}
              {collapsed && section.title !== "Beranda" && (
                <div className="mx-auto mb-2 h-px w-8 bg-slate-800" aria-hidden="true" />
              )}
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    collapsed={collapsed}
                    active={isCurrentActive(item.href)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Collapse toggle + logout */}
        <div className="space-y-1 border-t border-slate-800 p-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Perlebar sidebar" : "Perkecil sidebar"}
            className={`flex min-h-[40px] w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <ChevronsLeft
              className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
            {!collapsed && <span>Perkecil menu</span>}
          </button>

          {!collapsed && (
            <form action={logout}>
              <button
                type="submit"
                className="flex min-h-[40px] w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/10 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Keluar</span>
              </button>
            </form>
          )}
        </div>
      </aside>

      {/* ===================================================================== */}
      {/* HEADER — sticky, dipakai desktop & mobile                               */}
      {/* ===================================================================== */}
      <header
        className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/90 backdrop-blur"
      >
        <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          {/* Mobile: menu + logo */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            aria-label="Buka menu navigasi"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 lg:hidden"
            aria-label="Beranda Anshorussunnah"
          >
            <span className="relative h-8 w-8 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
              <Image
                src="/anshorussunnah-logo.webp"
                alt=""
                fill
                sizes="32px"
                className="object-contain"
              />
            </span>
            <span className="hidden text-sm font-bold tracking-tight text-slate-900 sm:inline">
              Anshorussunnah
            </span>
          </Link>

          {/* Desktop: collapse toggle + judul halaman */}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Perlebar sidebar" : "Perkecil sidebar"}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"
          >
            <ChevronsLeft
              className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          <div className="hidden min-w-0 flex-1 lg:block">
            {pageMeta.section && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-yellow-700">
                {pageMeta.section}
              </p>
            )}
            <p className="truncate text-sm font-semibold text-slate-800 sm:text-base">
              {pageMeta.title}
              {pageMeta.detail ? (
                <span className="ml-1.5 text-sm font-normal capitalize text-slate-500">
                  {pageMeta.detail}
                </span>
              ) : null}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* Role aktif (desktop) */}
            <span className="hidden items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-semibold text-yellow-800 xl:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {roleLabel}
            </span>

            {/* Notifikasi — empty state yang jujur, tanpa data palsu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Notifikasi"
                >
                  <Bell className="h-5 w-5" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-2">
                <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold text-slate-800">
                  Notifikasi
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-3 py-6 text-center">
                  <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                    <Bell className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-medium text-slate-700">Belum ada notifikasi</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Pengumuman dari guru dan panitia akan tampil di sini.
                  </p>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile menu / role switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-xl p-1 pr-1.5 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-2.5 sm:pr-2"
                  aria-label="Menu profil"
                >
                  <Avatar className="h-9 w-9 ring-2 ring-yellow-200">
                    <AvatarImage src={user.avatar || ""} alt="" />
                    <AvatarFallback className="bg-yellow-100 text-xs font-bold text-yellow-800">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden min-w-0 text-left md:block">
                    <span className="block max-w-[10rem] truncate text-sm font-semibold text-slate-800">
                      {user.nama}
                    </span>
                    <span className="block text-xs text-slate-500">{roleLabel}</span>
                  </span>
                  <ChevronDown
                    className="hidden h-4 w-4 text-slate-400 md:block"
                    aria-hidden="true"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2">
                <DropdownMenuLabel className="px-3 py-2">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {user.nama}
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-normal text-slate-500">
                    {user.email}
                  </span>
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[11px] font-semibold text-yellow-800">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    {roleLabel}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/profil" className="min-h-[40px] gap-2.5">
                    <User className="h-4 w-4" aria-hidden="true" />
                    Profil Pengguna
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/ganti-password" className="min-h-[40px] gap-2.5">
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                    Ganti Password
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setGantiAkunOpen(true)}
                  className="min-h-[40px] gap-2.5"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Ganti Akun / Role
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action={logout}>
                  <button
                    type="submit"
                    className="flex min-h-[40px] w-full items-center gap-2.5 rounded-lg px-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Keluar
                  </button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MOBILE BOTTOM NAV                                                        */}
      {/* ===================================================================== */}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-1.5 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] backdrop-blur lg:hidden"
        aria-label="Navigasi utama"
      >
        <div className="mx-auto grid max-w-md auto-cols-fr grid-flow-col items-center gap-1">
          {primaryMobileItems.map((item) => {
            const active = isCurrentActive(item.href)
            const Icon = item.icon as LucideIcon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[48px] min-w-[44px] touch-manipulation flex-col items-center justify-center rounded-xl px-1 py-1.5 transition-all ${
                  active
                    ? "bg-yellow-50 font-bold text-yellow-700"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.75]"}`}
                  aria-hidden="true"
                />
                <span className="mt-1 max-w-[68px] truncate text-[10px] tracking-tight">
                  {item.mobileTitle ?? item.title}
                </span>
              </Link>
            )
          })}

          {hasMoreItems && (
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex min-h-[48px] min-w-[44px] touch-manipulation flex-col items-center justify-center rounded-xl px-1 py-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              <Menu className="h-5 w-5 stroke-[1.75]" aria-hidden="true" />
              <span className="mt-1 text-[10px] tracking-tight">Lainnya</span>
            </button>
          )}
        </div>
      </nav>

      {/* ===================================================================== */}
      {/* MOBILE DRAWER — daftar menu lengkap                                     */}
      {/* ===================================================================== */}
      <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <DialogContent className="sm:max-w-sm sm:translate-x-0 sm:translate-y-0 sm:left-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:rounded-none sm:border-y-0 sm:border-r-0 sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-slate-200 bg-white text-left">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0 ring-2 ring-yellow-200">
                <AvatarImage src={user.avatar || ""} alt="" />
                <AvatarFallback className="bg-yellow-100 text-xs font-bold text-yellow-800">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <DialogTitle className="truncate text-sm font-bold text-slate-900">
                  {user.nama}
                </DialogTitle>
                <span className="text-xs font-medium text-yellow-700">{roleLabel}</span>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[55vh] space-y-5 overflow-y-auto px-4 py-4 sm:max-h-none sm:flex-1">
            {sections.map((section) => (
              <div key={section.title}>
                <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {section.title}
                </p>
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      collapsed={false}
                      active={isCurrentActive(item.href)}
                      onNavigate={() => setIsMobileMenuOpen(false)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="space-y-1 border-t border-slate-200 bg-white px-4 py-4">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false)
                setGantiAkunOpen(true)
              }}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Ganti Akun / Role
            </button>
            <Link
              href="/ganti-password"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Ganti Password
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Keluar dari Akun
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <GantiAkunDialog open={gantiAkunOpen} onOpenChange={setGantiAkunOpen} />
    </>
  )
}

export const DashboardNav = React.memo(DashboardNavInner)
