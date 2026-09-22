// src/lib/roles.ts
// Konstanta & tipe role lokal untuk semua KOMPONEN CLIENT.
//
// Mengapa: meng-import `Role` dari "@prisma/client" di komponen client
// ("use client") ikut menyertakan modul Prisma client ke bundle browser
// (library runtime npm). Nilai enum Prisma hanyalah string literal, jadi
// kita definisikan sendiri di sini — identik nilainya, zero-cost di browser.
//
// Server (layout, actions, lib) TETAP memakai `Role` dari "@prisma/client"
// karena butuh tipe enum asli & tidak menambah bundle browser.

export const Role = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN_AKADEMIK: "ADMIN_AKADEMIK",
  ADMIN_KEUANGAN: "ADMIN_KEUANGAN",
  GURU: "GURU",
  SISWA: "SISWA",
  ORANG_TUA: "ORANG_TUA",
} as const

export type Role = (typeof Role)[keyof typeof Role]

export function isAcademicAdminRoleClient(role: Role): boolean {
  return role === Role.SUPER_ADMIN || role === Role.ADMIN_AKADEMIK
}