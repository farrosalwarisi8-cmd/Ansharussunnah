// src/lib/status-berkas.test.ts
//
// Helper ini adalah satu sumber kebenaran status berkas untuk API publik,
// halaman cek status, panel admin, dan dashboard wali. Test menjaga perilaku
// null/kosong/array agar semua halaman PASTI menampilkan status yang sama.

import { describe, it, expect } from "vitest"
import { hitungStatusBerkas } from "@/lib/status-berkas"

describe("hitungStatusBerkas", () => {
  it("record lengkap: semua true dan jumlah 3", () => {
    const hasil = hitungStatusBerkas({
      dokKartuKeluarga: "dokumen-pendaftaran/pendaftaran/p1/kk.jpg",
      dokAkteLahir: "dokumen-pendaftaran/pendaftaran/p1/akte.pdf",
      dokFoto: "dokumen-pendaftaran/pendaftaran/p1/foto.png",
      dokLainnya: ["dokumen-pendaftaran/pendaftaran/p1/surat.pdf"],
    })

    expect(hasil).toEqual({
      kartuKeluarga: true,
      akteLahir: true,
      foto: true,
      lainnya: 1,
      jumlahLengkap: 3,
    })
  })

  it("null diperlakukan sebagai belum ada", () => {
    const hasil = hitungStatusBerkas({
      dokKartuKeluarga: null,
      dokAkteLahir: null,
      dokFoto: null,
      dokLainnya: [],
    })

    expect(hasil).toEqual({
      kartuKeluarga: false,
      akteLahir: false,
      foto: false,
      lainnya: 0,
      jumlahLengkap: 0,
    })
  })

  it("string kosong / whitespace dianggap belum ada", () => {
    const hasil = hitungStatusBerkas({
      dokKartuKeluarga: "",
      dokAkteLahir: "   ",
      dokFoto: "dokumen-pendaftaran/pendaftaran/p1/foto.png",
      dokLainnya: null,
    })

    expect(hasil.kartuKeluarga).toBe(false)
    expect(hasil.akteLahir).toBe(false)
    expect(hasil.foto).toBe(true)
    expect(hasil.jumlahLengkap).toBe(1)
  })

  it("record null/undefined (pendaftaran belum dimuat) tidak melempar", () => {
    expect(hitungStatusBerkas(null)).toEqual({
      kartuKeluarga: false,
      akteLahir: false,
      foto: false,
      lainnya: 0,
      jumlahLengkap: 0,
    })
    expect(hitungStatusBerkas(undefined).jumlahLengkap).toBe(0)
  })

  it("dokLainnya dihitung jumlahnya, path-nya tidak pernah ikut", () => {
    const hasil = hitungStatusBerkas({
      dokLainnya: ["a.pdf", "b.pdf", "", "c.pdf"],
    })

    // String kosong di dalam array tidak dihitung.
    expect(hasil.lainnya).toBe(3)
  })

  it("dokLainnya berupa nilai non-array tidak melempar", () => {
    const hasil = hitungStatusBerkas({
      dokLainnya: null as unknown as string[],
    })
    expect(hasil.lainnya).toBe(0)
  })

  it("kombinasi parsial: 2 dari 3 berkas utama", () => {
    const hasil = hitungStatusBerkas({
      dokKartuKeluarga: "x/kk.jpg",
      dokAkteLahir: null,
      dokFoto: "x/foto.png",
      dokLainnya: [],
    })

    expect(hasil.jumlahLengkap).toBe(2)
    expect(hasil.akteLahir).toBe(false)
  })
})
