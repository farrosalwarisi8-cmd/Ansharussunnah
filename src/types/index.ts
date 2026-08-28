// src/types/index.ts

import type { Prisma } from "@prisma/client"

// Model Base Types dari Prisma
export type User = Prisma.UserGetPayload<Record<string, never>>
export type Guru = Prisma.GuruGetPayload<Record<string, never>>
export type Siswa = Prisma.SiswaGetPayload<Record<string, never>>
export type OrangTua = Prisma.OrangTuaGetPayload<Record<string, never>>
export type Jenjang = Prisma.JenjangGetPayload<Record<string, never>>
export type Kelas = Prisma.KelasGetPayload<Record<string, never>>
export type Pendaftaran = Prisma.PendaftaranGetPayload<Record<string, never>>
export type BuktiTransferPendaftaran = Prisma.BuktiTransferPendaftaranGetPayload<Record<string, never>>
export type ParentStudent = Prisma.ParentStudentGetPayload<Record<string, never>>

// User dengan relasi lengkap
export type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    guru: true
    siswa: {
      include: {
        kelas: {
          include: {
            jenjang: true
          }
        }
      }
    }
    orangTua: true
  }
}>

// Kelas dengan relasi jenjang dan wali kelas
export type KelasWithRelations = Prisma.KelasGetPayload<{
  include: {
    jenjang: true
    waliKelas: {
      include: {
        user: true
      }
    }
    _count: {
      select: {
        siswa: true
      }
    }
  }
}>

// Jenjang dengan daftar kelas
export type JenjangWithKelas = Prisma.JenjangGetPayload<{
  include: {
    kelas: {
      include: {
        waliKelas: {
          include: {
            user: true
          }
        }
        _count: {
          select: {
            siswa: true
          }
        }
      }
    }
  }
}>

// Pendaftaran dengan relasi
export type PendaftaranWithRelations = Prisma.PendaftaranGetPayload<{
  include: {
    jenjangTujuan: true
    kelasTujuan: true
    buktiTransfer: true
    diverifikasiOleh: true
  }
}>

// Response standard Server Action
export type ActionResponse<T = unknown> = {
  success: boolean
  message: string
  data?: T
  errors?: Record<string, string[]>
}