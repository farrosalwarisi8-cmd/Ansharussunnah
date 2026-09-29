import { describe, it, expect } from "vitest"
import { buildPendaftaranBerhasilEmail, buildPendaftaranDitolakEmail } from "@/lib/email"

describe("buildPendaftaranBerhasilEmail", () => {
  it("render tellerham tanp galat dan menolak injeksi HTML", () => {
    const html = buildPendaftaranBerhasilEmail({
      namaOrangTua: 'Budi "<script>alert(1)</script>"',
      namaSiswa: "Ahmad Fauzi",
      nomorPendaftaran: "REG-2026-00042-T7K2",
      jenjangNama: "MTs",
      biayaPendaftaran: 500000,
      biayaUangGedung: 750000,
      biayaSarpras: 250000,
      bankNama: "Bank Syariah Indonesia",
      bankNoRekening: "7700 8899 0011",
      bankAtasNama: "Yayasan Anshorussunnah",
      kontakWa: "6281234567890",
      namaKontakWa: "Admin PPDB",
      cekStatusUrl:
        "https://anshorussunnah.com/pendaftaran/sukses?nomor=REG-2026-00042-T7K2",
      sudahUploadKartuKeluarga: true,
      sudahUploadAkteLahir: false,
      sudahUploadPasFoto: false,
    })

    expect(html).toContain("REG-2026-00042-T7K2")
    expect(html).toContain("Rp 1.500.000")
    expect(html).toContain("7700 8899 0011")
    expect(html).toContain("wa.me/6281234567890")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")

    // Status dokumen harus mencerminkan flag yang dikirim server
    expect(html).toContain("Kartu Keluarga (KK) — <strong>sudah diunggah</strong>")
    expect(html).toContain("Akta Lahir — <strong>BELUM diunggah</strong>")
  })

  it("total biaya benar dan rincian komponen nol disembunyikan", () => {
    const html = buildPendaftaranBerhasilEmail({
      namaOrangTua: "Budi",
      namaSiswa: "Siti",
      nomorPendaftaran: "REG-2026-00001-AAAA",
      jenjangNama: "MA",
      biayaPendaftaran: 300000,
      biayaUangGedung: 0,
      biayaSarpras: 0,
      bankNama: "BSI",
      bankNoRekening: "7700 8899 0011",
      bankAtasNama: "Yayasan",
      kontakWa: "6281234567890",
      namaKontakWa: null,
      cekStatusUrl: "https://anshorussunnah.com/pendaftaran/sukses?nomor=X",
      sudahUploadKartuKeluarga: false,
      sudahUploadAkteLahir: false,
      sudahUploadPasFoto: false,
    })

    expect(html).toContain("Rp 300.000")
    expect(html).not.toContain("Uang Gedung")
    expect(html).not.toContain("Sarana Prasarana")
  })
})

describe("buildPendaftaranDitolakEmail", () => {
  const base = {
    namaOrangTua: "Budi Santoso",
    namaSiswa: "Ahmad Fauzi",
    nomorPendaftaran: "REG-2026-00042-T7K2",
    alasanPenolakan: "Kartu Keluarga tidak terbaca",
    kontakWa: "6281234567890",
    daftarUlangUrl: "https://anshorussunnah.com/pendaftaran",
  }

  it("memuat alasan penolakan, nomor pendaftaran, dan tautan daftar ulang", () => {
    const html = buildPendaftaranDitolakEmail({
      ...base,
      catatanAdmin: null,
    })

    expect(html).toContain("Kartu Keluarga tidak terbaca")
    expect(html).toContain("REG-2026-00042-T7K2")
    expect(html).toContain("https://anshorussunnah.com/pendaftaran")
    expect(html).toContain("wa.me/6281234567890")
    expect(html).toContain(
      "Tidak ada akun login yang dibuat untuk pendaftaran ini"
    )
    // Pendaftaran yang ditolak masih bisa diaktifkan ulang lewat upload ulang,
    // jadi email harus menyebut kedua jalur, bukan hanya daftar ulang.
    expect(html).toContain("ATAU daftarkan kembali")
    // Akun dari pendaftaran anak sebelumnya tetap berlaku — jangan sampai
    // kalimat email membuat orang tua berpikir akunnya rusak.
    expect(html).toContain("akun tersebut tetap berjalan seperti biasa")
  })

  it("menyertakan catatan admin hanya bila ada", () => {
    const tanpa = buildPendaftaranDitolakEmail({ ...base, catatanAdmin: null })
    const dengan = buildPendaftaranDitolakEmail({
      ...base,
      catatanAdmin: "Silakan foto ulang dengan pencahayaan baik",
    })

    expect(tanpa).not.toContain("Catatan Admin")
    expect(dengan).toContain("Catatan Admin")
    expect(dengan).toContain("Silakan foto ulang dengan pencahayaan baik")
  })

  it("meloloskan escaping pada alasan penolakan dan nama", () => {
    const html = buildPendaftaranDitolakEmail({
      ...base,
      namaOrangTua: '<b>Hack</b>',
      alasanPenolakan: 'pakai tanda kutip "kecil" & <b>tebal</b>',
      catatanAdmin: null,
    })

    expect(html).not.toContain("<b>")
    expect(html).toContain("&lt;b&gt;")
    expect(html).toContain("&amp;")
    expect(html).toContain("&quot;kecil&quot;")
  })
})
