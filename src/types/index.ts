// src/types/index.ts

import type { Prisma } from "@prisma/client"

// ============================================
// BASE MODEL TYPES
// ============================================

export type User = Prisma.UserGetPayload<Record<string, never>>
export type Guru = Prisma.GuruGetPayload<Record<string, never>>
export type Siswa = Prisma.SiswaGetPayload<Record<string, never>>
export type OrangTua = Prisma.OrangTuaGetPayload<Record<string, never>>
export type Jenjang = Prisma.JenjangGetPayload<Record<string, never>>
export type Kelas = Prisma.KelasGetPayload<Record<string, never>>
export type Pendaftaran = Prisma.PendaftaranGetPayload<Record<string, never>>
export type BuktiTransferPendaftaran = Prisma.BuktiTransferPendaftaranGetPayload<Record<string, never>>
export type ParentStudent = Prisma.ParentStudentGetPayload<Record<string, never>>
export type PasswordResetToken = Prisma.PasswordResetTokenGetPayload<Record<string, never>>

// ============================================
// COMPOSITE TYPES (WITH RELATIONS)
// ============================================

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

export type PendaftaranWithRelations = Prisma.PendaftaranGetPayload<{
  include: {
    jenjangTujuan: true
    kelasTujuan: true
    buktiTransfer: true
    diverifikasiOleh: true
  }
}>

// ============================================
// API RESPONSE TYPES
// ============================================

export type ActionResponse<T = unknown> = {
  success: boolean
  message: string
  data?: T
  errors?: Record<string, string[]>
}