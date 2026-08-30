// src/lib/validations/pendaftaran.test.ts

import { describe, it, expect } from "vitest"
import {
  pendaftaranSchema,
  uploadBuktiTransferSchema,
  verifikasiPendaftaranSchema,
} from "@/lib/validations/pendaftaran"

// ========================================================
// Helper: data valid minimum yang lolos semua validasi
// ========================================================
function validBase(overrides?: Record<string, unknown>) {
  return {
    namaLengkap: "Ahmad Fauzi",
    tempatLahir: "Jakarta",
    tanggalLahir: "2010-01-15",
    jenisKelamin: "LAKI_LAKI",
    alamatSiswa: "Jl. Mawar No. 10, RT 01/RW 02",
    namaOrangTua: "Budi Santoso",
    noHpOrangTua: "081234567890",
    emailOrangTua: "budi@example.com",
    jenjangTujuanId: "jenjang-1",
    ...overrides,
  }
}

// ========================================================
// 1. Validasi Field Dasar (tidak berubah dari sebelumnya)
// ========================================================
describe("pendaftaranSchema — Validasi Field Dasar", () => {
  it("harus lolos dengan data valid minimal", () => {
    const result = pendaftaranSchema.safeParse(validBase())
    expect(result.success).toBe(true)
  })

  it("harus gagal jika namaLengkap kurang dari 3 karakter", () => {
    const result = pendaftaranSchema.safeParse(validBase({ namaLengkap: "Ab" }))
    expect(result.success).toBe(false)
    if (!result.success) {
      const namaErrors = result.error.issues.filter(
        (i) => i.path[0] === "namaLengkap"
      )
      expect(namaErrors.length).toBeGreaterThan(0)
    }
  })

  it("harus gagal jika tempatLahir kurang dari 2 karakter", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({ tempatLahir: "A" })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.filter(
        (i) => i.path[0] === "tempatLahir"
      )
      expect(errors.length).toBeGreaterThan(0)
    }
  })

  it("harus gagal jika tanggalLahir tidak valid", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({ tanggalLahir: "bukan-tanggal" })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.filter(
        (i) => i.path[0] === "tanggalLahir"
      )
      expect(errors.length).toBeGreaterThan(0)
    }
  })

  it("harus gagal jika jenisKelamin bukan enum yang valid", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({ jenisKelamin: "LAINNYA" })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.filter(
        (i) => i.path[0] === "jenisKelamin"
      )
      expect(errors.length).toBeGreaterThan(0)
    }
  })

  it("harus gagal jika alamatSiswa kurang dari 10 karakter", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({ alamatSiswa: "Jl. Mawar" })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.filter(
        (i) => i.path[0] === "alamatSiswa"
      )
      expect(errors.length).toBeGreaterThan(0)
    }
  })

  it("harus gagal jika noHpOrangTua kurang dari 10 digit", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({ noHpOrangTua: "0812345" })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.filter(
        (i) => i.path[0] === "noHpOrangTua"
      )
      expect(errors.length).toBeGreaterThan(0)
    }
  })

  it("harus gagal jika emailOrangTua format tidak valid", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({ emailOrangTua: "bukan-email" })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.filter(
        (i) => i.path[0] === "emailOrangTua"
      )
      expect(errors.length).toBeGreaterThan(0)
    }
  })

  it("harus gagal jika jenjangTujuanId kosong", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({ jenjangTujuanId: "" })
    )
    expect(result.success).toBe(false)
  })
})

// ========================================================
// 2. Validasi NISN
// ========================================================
describe("pendaftaranSchema — NISN", () => {
  it("harus lolos jika NISN tidak diisi (opsional)", () => {
    const result = pendaftaranSchema.safeParse(validBase())
    expect(result.success).toBe(true)
  })

  it("harus lolos jika NISN tepat 10 digit angka", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({ nisn: "1234567890" })
    )
    expect(result.success).toBe(true)
  })

  it("harus gagal jika NISN kurang dari 10 digit", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({ nisn: "12345" })
    )
    expect(result.success).toBe(false)
  })

  it("harus gagal jika NISN mengandung huruf", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({ nisn: "123456789a" })
    )
    expect(result.success).toBe(false)
  })
})

// ========================================================
// 3. Validasi Agama
// ========================================================
describe("pendaftaranSchema — Agama", () => {
  it("harus lolos jika agama tidak diisi (opsional)", () => {
    const result = pendaftaranSchema.safeParse(validBase())
    expect(result.success).toBe(true)
  })

  it.each([
    "Islam",
    "Kristen Protestan",
    "Katolik",
    "Hindu",
    "Buddha",
    "Konghucu",
  ])('harus lolos jika agama = "%s"', (agama) => {
    const result = pendaftaranSchema.safeParse(validBase({ agama }))
    expect(result.success).toBe(true)
  })

  it("harus gagal jika agama bukan opsi yang valid", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({ agama: "Yahudi" })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.filter(
        (i) => i.path[0] === "agama"
      )
      expect(errors.length).toBeGreaterThan(0)
    }
  })
})

// ========================================================
// 4. Validasi No HP Siswa
// ========================================================
describe("pendaftaranSchema — No HP Siswa", () => {
  it("harus lolos jika tidak diisi (opsional)", () => {
    const result = pendaftaranSchema.safeParse(validBase())
    expect(result.success).toBe(true)
  })

  it("harus lolos jika 10-15 digit angka", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({ noHpSiswa: "0812345678" })
    )
    expect(result.success).toBe(true)
  })

  it("harus lolos jika 15 digit angka", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({ noHpSiswa: "081234567890123" })
    )
    expect(result.success).toBe(true)
  })

  it("harus gagal jika kurang dari 10 digit", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({ noHpSiswa: "0812345" })
    )
    expect(result.success).toBe(false)
  })

  it("harus gagal jika mengandung huruf", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({ noHpSiswa: "0812345abc" })
    )
    expect(result.success).toBe(false)
  })
})

// ========================================================
// 5. Validasi NIK Ayah (kondisional)
// ========================================================
describe("pendaftaranSchema — NIK Ayah (Kondisional)", () => {
  it("harus lolos jika statusAyahKandung tidak diisi", () => {
    const result = pendaftaranSchema.safeParse(validBase())
    expect(result.success).toBe(true)
  })

  it("harus lolos jika statusAyahKandung = SUDAH_MENINGGAL tanpa NIK", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        statusAyahKandung: "SUDAH_MENINGGAL",
        nikAyah: undefined,
      })
    )
    expect(result.success).toBe(true)
  })

  it("harus lolos jika statusAyahKandung = TIDAK_DIKETAHUI tanpa NIK", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        statusAyahKandung: "TIDAK_DIKETAHUI",
        nikAyah: undefined,
      })
    )
    expect(result.success).toBe(true)
  })

  it("harus MENOLAK jika statusAyahKandung = MASIH_HIDUP & WNI tapi NIK kosong", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        statusAyahKandung: "MASIH_HIDUP",
        kewarganegaraan: "WNI",
        nikAyah: undefined,
      })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.filter(
        (i) => i.path[0] === "nikAyah"
      )
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toContain("wajib diisi")
    }
  })

  it("harus MENOLAK jika NIK Ayah bukan 16 digit", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        statusAyahKandung: "MASIH_HIDUP",
        kewarganegaraan: "WNI",
        nikAyah: "12345678",
      })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.filter(
        (i) => i.path[0] === "nikAyah"
      )
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toContain("16 digit")
    }
  })

  it("harus MENOLAK jika NIK Ayah mengandung huruf", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        statusAyahKandung: "MASIH_HIDUP",
        kewarganegaraan: "WNI",
        nikAyah: "123456789012345a",
      })
    )
    expect(result.success).toBe(false)
  })

  it("harus lolos jika NIK Ayah tepat 16 digit angka", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        statusAyahKandung: "MASIH_HIDUP",
        kewarganegaraan: "WNI",
        nikAyah: "3201011501900001",
      })
    )
    expect(result.success).toBe(true)
  })

  it("harus lolos jika statusAyahKandung = MASIH_HIDUP tapi WNA (NIK tidak wajib)", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        statusAyahKandung: "MASIH_HIDUP",
        kewarganegaraan: "WNA",
        nikAyah: undefined,
        kitas: "KITAS123",
        asalNegara: "Malaysia",
      })
    )
    expect(result.success).toBe(true)
  })
})

// ========================================================
// 6. Validasi NIK Ibu (kondisional — mirip NIK Ayah)
// ========================================================
describe("pendaftaranSchema — NIK Ibu (Kondisional)", () => {
  it("harus lolos jika statusIbuKandung tidak diisi", () => {
    const result = pendaftaranSchema.safeParse(validBase())
    expect(result.success).toBe(true)
  })

  it("harus MENOLAK jika statusIbuKandung = MASIH_HIDUP & WNI tapi NIK kosong", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        statusIbuKandung: "MASIH_HIDUP",
        kewarganegaraan: "WNI",
        nikIbu: undefined,
      })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.filter(
        (i) => i.path[0] === "nikIbu"
      )
      expect(errors.length).toBeGreaterThan(0)
    }
  })

  it("harus MENOLAK jika NIK Ibu kurang dari 16 digit", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        statusIbuKandung: "MASIH_HIDUP",
        kewarganegaraan: "WNI",
        nikIbu: "123456789",
      })
    )
    expect(result.success).toBe(false)
  })

  it("harus lolos jika NIK Ibu tepat 16 digit angka", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        statusIbuKandung: "MASIH_HIDUP",
        kewarganegaraan: "WNI",
        nikIbu: "3201011501900002",
      })
    )
    expect(result.success).toBe(true)
  })

  it("harus lolos jika statusIbuKandung = SUDAH_MENINGGAL tanpa NIK", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        statusIbuKandung: "SUDAH_MENINGGAL",
        nikIbu: undefined,
      })
    )
    expect(result.success).toBe(true)
  })
})

// ========================================================
// 7. Validasi Wali (kondisional)
// ========================================================
describe("pendaftaranSchema — Data Wali (Kondisional)", () => {
  it("harus lolos jika statusWali tidak diisi", () => {
    const result = pendaftaranSchema.safeParse(validBase())
    expect(result.success).toBe(true)
  })

  it("harus lolos jika statusWali = SAMA_DENGAN_AYAH tanpa namaWali", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        statusWali: "SAMA_DENGAN_AYAH",
        namaWali: undefined,
      })
    )
    expect(result.success).toBe(true)
  })

  it("harus lolos jika statusWali = SAMA_DENGAN_IBU tanpa namaWali", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        statusWali: "SAMA_DENGAN_IBU",
        namaWali: undefined,
      })
    )
    expect(result.success).toBe(true)
  })

  it("harus MENOLAK jika statusWali = LAINNYA tapi namaWali kosong", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        statusWali: "LAINNYA",
        namaWali: undefined,
      })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.filter(
        (i) => i.path[0] === "namaWali"
      )
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toContain("wajib diisi")
    }
  })

  it("harus MENOLAK jika statusWali = LAINNYA tapi namaWali terlalu pendek (< 3)", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        statusWali: "LAINNYA",
        namaWali: "Ab",
      })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.filter(
        (i) => i.path[0] === "namaWali"
      )
      expect(errors.length).toBeGreaterThan(0)
    }
  })

  it("harus lolos jika statusWali = LAINNYA dengan namaWali valid", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        statusWali: "LAINNYA",
        namaWali: "Paman Ahmad",
      })
    )
    expect(result.success).toBe(true)
  })
})

// ========================================================
// 8. Validasi Kewarganegaraan & WNA (kondisional)
// ========================================================
describe("pendaftaranSchema — Kewarganegaraan (Kondisional)", () => {
  it("harus lolos dengan default WNI tanpa field kewarganegaraan", () => {
    const result = pendaftaranSchema.safeParse(validBase())
    expect(result.success).toBe(true)
    if (result.success) {
      // default harus WNI
      expect(result.data.kewarganegaraan).toBeUndefined()
    }
  })

  it("harus lolos dengan kewarganegaraan = WNI", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({ kewarganegaraan: "WNI" })
    )
    expect(result.success).toBe(true)
  })

  it("harus MENOLAK jika kewarganegaraan = WNA tapi KITAS kosong", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        kewarganegaraan: "WNA",
        kitas: undefined,
        asalNegara: "Malaysia",
      })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.filter(
        (i) => i.path[0] === "kitas"
      )
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toContain("KITAS")
    }
  })

  it("harus MENOLAK jika kewarganegaraan = WNA tapi asalNegara kosong", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        kewarganegaraan: "WNA",
        kitas: "KITAS123456",
        asalNegara: undefined,
      })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.filter(
        (i) => i.path[0] === "asalNegara"
      )
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toContain("Asal negara")
    }
  })

  it("harus MENOLAK jika asalNegara mengandung angka", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        kewarganegaraan: "WNA",
        kitas: "KITAS123",
        asalNegara: "Singapura123",
      })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.filter(
        (i) => i.path[0] === "asalNegara"
      )
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toContain("huruf")
    }
  })

  it("harus MENOLAK jika asalNegara mengandung karakter khusus", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        kewarganegaraan: "WNA",
        kitas: "KITAS123",
        asalNegara: "Arab Saudi!",
      })
    )
    expect(result.success).toBe(false)
  })

  it("harus lolos jika asalNegara hanya huruf, spasi, dan tanda hubung", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        kewarganegaraan: "WNA",
        kitas: "KITAS123456",
        asalNegara: "Arab-Saudi",
      })
    )
    expect(result.success).toBe(true)
  })

  it("harus lolos jika asalNegara dengan spasi", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        kewarganegaraan: "WNA",
        kitas: "KITAS123456",
        asalNegara: "Korea Selatan",
      })
    )
    expect(result.success).toBe(true)
  })

  it("harus lolos data WNA lengkap dengan NIK ayah/ibu tidak wajib", () => {
    const result = pendaftaranSchema.safeParse(
      validBase({
        kewarganegaraan: "WNA",
        kitas: "KITAS998877",
        asalNegara: "Malaysia",
        statusAyahKandung: "MASIH_HIDUP",
        nikAyah: undefined, // Tidak wajib untuk WNA
        statusIbuKandung: "MASIH_HIDUP",
        nikIbu: undefined, // Tidak wajib untuk WNA
      })
    )
    expect(result.success).toBe(true)
  })
})

// ========================================================
// 9. Validasi Kombinasi (multi-field)
// ========================================================
describe("pendaftaranSchema — Validasi Kombinasi", () => {
  it("harus MENOLAK jika ada beberapa error sekaligus", () => {
    const result = pendaftaranSchema.safeParse({
      namaLengkap: "Ab", // terlalu pendek
      tempatLahir: "X", // terlalu pendek
      tanggalLahir: "invalid",
      jenisKelamin: "LAINNYA",
      alamatSiswa: "Jl", // terlalu pendek
      noHpOrangTua: "123", // terlalu pendek
      emailOrangTua: "bukan-email",
      jenjangTujuanId: "",
      // + field kondisional
      statusAyahKandung: "MASIH_HIDUP",
      kewarganegaraan: "WNI",
      // nikAyah kosong → error
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(3)
    }
  })

  it("harus lolos dengan data lengkap valid (semua field terisi)", () => {
    const result = pendaftaranSchema.safeParse({
      namaLengkap: "Ahmad Fauzi bin Budi",
      tempatLahir: "Bandung",
      tanggalLahir: "2008-05-20",
      jenisKelamin: "LAKI_LAKI",
      agama: "Islam",
      alamatSiswa: "Jl. Melati No. 5, RT 03/RW 01, Kel. Sukamaju",
      nisn: "0081234567",
      noHpSiswa: "081234567890",
      namaOrangTua: "Budi Santoso",
      noHpOrangTua: "081298765432",
      emailOrangTua: "budi.santoso@email.com",
      alamatOrangTua: "Jl. Melati No. 5",
      namaAyahKandung: "Budi Santoso",
      statusAyahKandung: "MASIH_HIDUP",
      nikAyah: "3201011501900001",
      namaIbuKandung: "Siti Rahmawati",
      statusIbuKandung: "MASIH_HIDUP",
      nikIbu: "3201011501900002",
      statusWali: "SAMA_DENGAN_AYAH",
      kewarganegaraan: "WNI",
      jenjangTujuanId: "jenjang-1",
      kelasTujuanId: "kelas-1",
    })
    expect(result.success).toBe(true)
  })

  it("harus lolos dengan data WNA lengkap", () => {
    const result = pendaftaranSchema.safeParse({
      namaLengkap: "Ahmad Al-Farisi",
      tempatLahir: "Kuala Lumpur",
      tanggalLahir: "2008-05-20",
      jenisKelamin: "LAKI_LAKI",
      agama: "Islam",
      alamatSiswa: "Jl. Internasional No. 10, Jakarta Selatan",
      namaOrangTua: "Mohammed Farisi",
      noHpOrangTua: "081234567890",
      emailOrangTua: "mohammed@email.com",
      kewarganegaraan: "WNA",
      kitas: "KITAS-2024-001",
      asalNegara: "Malaysia",
      jenjangTujuanId: "jenjang-1",
    })
    expect(result.success).toBe(true)
  })

  it("harus lolos dengan semua field opsional dikosongkan", () => {
    const result = pendaftaranSchema.safeParse({
      namaLengkap: "Siswa Baru",
      tempatLahir: "Surabaya",
      tanggalLahir: "2012-03-10",
      jenisKelamin: "PEREMPUAN",
      alamatSiswa: "Jl. Kenanga No. 20, RT 05/RW 03",
      namaOrangTua: "Orang Tua Siswa",
      noHpOrangTua: "085612345678",
      emailOrangTua: "ortu@contoh.com",
      jenjangTujuanId: "jenjang-2",
      // Semua field EMIS dikosongkan/tidak dikirim
    })
    expect(result.success).toBe(true)
  })
})

// ========================================================
// 10. Validasi uploadBuktiTransferSchema
// ========================================================
describe("uploadBuktiTransferSchema", () => {
  it("harus lolos dengan nomorPendaftaran valid", () => {
    const result = uploadBuktiTransferSchema.safeParse({
      nomorPendaftaran: "REG-2025-00001",
    })
    expect(result.success).toBe(true)
  })

  it("harus gagal jika nomorPendaftaran kosong", () => {
    const result = uploadBuktiTransferSchema.safeParse({
      nomorPendaftaran: "",
    })
    expect(result.success).toBe(false)
  })
})

// ========================================================
// 11. Validasi verifikasiPendaftaranSchema
// ========================================================
describe("verifikasiPendaftaranSchema", () => {
  it("harus lolos dengan status DITERIMA", () => {
    const result = verifikasiPendaftaranSchema.safeParse({
      pendaftaranId: "abc-123",
      status: "DITERIMA",
    })
    expect(result.success).toBe(true)
  })

  it("harus lolos dengan status DITOLAK + alasanPenolakan", () => {
    const result = verifikasiPendaftaranSchema.safeParse({
      pendaftaranId: "abc-123",
      status: "DITOLAK",
      alasanPenolakan: "Dokumen tidak lengkap",
    })
    expect(result.success).toBe(true)
  })

  it("harus gagal dengan status yang tidak valid", () => {
    const result = verifikasiPendaftaranSchema.safeParse({
      pendaftaranId: "abc-123",
      status: "MENUNGGU",
    })
    expect(result.success).toBe(false)
  })
})
