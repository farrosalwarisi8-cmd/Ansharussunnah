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

// NEW: Akademik & Keuangan Models
export type PeriodeAjaran = Prisma.PeriodeAjaranGetPayload<Record<string, never>>
export type GuruKelas = Prisma.GuruKelasGetPayload<Record<string, never>>
export type Ujian = Prisma.UjianGetPayload<Record<string, never>>
export type SoalUjian = Prisma.SoalUjianGetPayload<Record<string, never>>
export type OpsiJawaban = Prisma.OpsiJawabanGetPayload<Record<string, never>>
export type PengerjaanUjian = Prisma.PengerjaanUjianGetPayload<Record<string, never>>
export type JawabanSiswa = Prisma.JawabanSiswaGetPayload<Record<string, never>>
export type Absensi = Prisma.AbsensiGetPayload<Record<string, never>>
export type Tugas = Prisma.TugasGetPayload<Record<string, never>>
export type PengumpulanTugas = Prisma.PengumpulanTugasGetPayload<Record<string, never>>
export type RiwayatPengumpulanTugas = Prisma.RiwayatPengumpulanTugasGetPayload<Record<string, never>>
export type CatatanRapor = Prisma.CatatanRaporGetPayload<Record<string, never>>
export type KategoriTransaksi = Prisma.KategoriTransaksiGetPayload<Record<string, never>>
export type TagihanSpp = Prisma.TagihanSppGetPayload<Record<string, never>>
export type PembayaranSpp = Prisma.PembayaranSppGetPayload<Record<string, never>>
export type TransaksiKeuangan = Prisma.TransaksiKeuanganGetPayload<Record<string, never>>

// ============================================
// COMPOSITE TYPES
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

export type UjianWithDetails = Prisma.UjianGetPayload<{
  include: {
    kelas: true
    periodeAjaran: true
    dibuatOleh: { select: { nama: true } }
    soal: {
      include: {
        opsi: true
      }
    }
    _count: {
      select: {
        pengerjaan: true
      }
    }
  }
}>

// ============================================
// API & ACTION RESPONSE TYPE
// ============================================

export type ActionResponse<T = unknown> = {
  success: boolean
  message: string
  data?: T
  errors?: Record<string, string[]>
}