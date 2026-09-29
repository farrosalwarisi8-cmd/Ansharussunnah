// src/lib/email.ts

import { Resend } from "resend"

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function createResend() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  try {
    return new Resend(apiKey)
  } catch {
    return null
  }
}

const resend = createResend()
const fromEmail = process.env.EMAIL_FROM || "Sistem Pendaftaran <onboarding@resend.dev>"
const replyTo = process.env.EMAIL_REPLY_TO || "admin@sekolahmu.sch.id"

interface SendEmailParams {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY belum dikonfigurasi. Email tidak terkirim."
    )
    return {
      success: false,
      error: "RESEND_API_KEY belum dikonfigurasi",
    }
  }
  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      replyTo,
      subject,
      html,
    })

    if (error) {
      console.error("Email send error:", error)
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id }
  } catch (error: unknown) {
    console.error("Email send exception:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

/**
 * Template email: Kredensial akun baru untuk orang tua & siswa
 */
export function buildKredensialEmail(params: {
  namaOrangTua: string
  emailOrangTua: string
  passwordOrangTua?: string
  namaSiswa: string
  emailSiswa: string
  passwordSiswa: string
  nomorPendaftaran: string
}): string {
  const namaOrangTua = escapeHtml(params.namaOrangTua)
  const emailOrangTua = escapeHtml(params.emailOrangTua)
  const namaSiswa = escapeHtml(params.namaSiswa)
  const emailSiswa = escapeHtml(params.emailSiswa)
  const passwordOrangTua = params.passwordOrangTua
    ? escapeHtml(params.passwordOrangTua)
    : undefined
  const passwordSiswa = escapeHtml(params.passwordSiswa)
  const nomorPendaftaran = escapeHtml(params.nomorPendaftaran)
  const ortuAccount = passwordOrangTua
    ? `
        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Akun Orang Tua:</strong></p>
          <p style="margin: 2px 0;">Email: <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${emailOrangTua}</code></p>
          <p style="margin: 2px 0;">Password: <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${passwordOrangTua}</code></p>
        </div>
      `
    : `
        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Akun Orang Tua:</strong></p>
          <p style="margin: 2px 0;">Email: <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${emailOrangTua}</code></p>
          <p style="margin: 2px 0; color: #475569;">Anda sudah memiliki akun orang tua — gunakan password yang sudah ada (tidak berubah).</p>
        </div>
      `
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color: #1e40af; margin-top: 0;">🎉 Pendaftaran Diterima!</h2>
        <p>Halo <strong>${namaOrangTua}</strong>,</p>
        <p>Selamat! Pendaftaran siswa baru dengan nomor <strong>${nomorPendaftaran}</strong> atas nama <strong>${namaSiswa}</strong> telah <strong style="color: green;">DITERIMA</strong>.</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        
        <h3 style="color: #333;">🔐 Informasi Akun Login</h3>
        
        ${ortuAccount}
        
        <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Akun Siswa:</strong></p>
          <p style="margin: 2px 0;">Email: <code style="background: #dcfce7; padding: 2px 6px; border-radius: 4px;">${emailSiswa}</code></p>
          <p style="margin: 2px 0;">Password: <code style="background: #dcfce7; padding: 2px 6px; border-radius: 4px;">${passwordSiswa}</code></p>
        </div>
        
        <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #92400e;">⚠️ <strong>PENTING:</strong> Saat pertama kali login, Anda akan diminta untuk mengganti password. Simpan informasi ini dengan aman dan jangan bagikan kepada siapapun.</p>
        </div>
        
        <p style="color: #666; font-size: 13px; margin-top: 24px;">
          Jika Anda tidak merasa mendaftar, abaikan email ini atau hubungi admin sekolah.
        </p>
      </div>
    </body>
    </html>
  `
}

/**
 * Template email: Kredensial anak baru untuk orang tua yang SUDAH punya akun
 * Hanya tampilkan kredensial anak, tanpa info akun orang tua.
 */
export function buildKredensialEmailAnakKedua(params: {
  namaOrangTua: string
  emailOrangTua: string
  namaSiswa: string
  emailSiswa: string
  passwordSiswa: string
  nomorPendaftaran: string
}): string {
  const namaOrangTua = escapeHtml(params.namaOrangTua)
  const emailOrangTua = escapeHtml(params.emailOrangTua)
  const namaSiswa = escapeHtml(params.namaSiswa)
  const emailSiswa = escapeHtml(params.emailSiswa)
  const passwordSiswa = escapeHtml(params.passwordSiswa)
  const nomorPendaftaran = escapeHtml(params.nomorPendaftaran)
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color: #1e40af; margin-top: 0;">🎉 Santri Baru Diterima!</h2>
        <p>Halo <strong>${namaOrangTua}</strong>,</p>
        <p>Selamat! Anak Anda dengan nomor pendaftaran <strong>${nomorPendaftaran}</strong> atas nama <strong>${namaSiswa}</strong> telah <strong style="color: green;">DITERIMA</strong>.</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        
        <h3 style="color: #333;">🔐 Akun Login Anak</h3>
        
        <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Akun Siswa:</strong></p>
          <p style="margin: 2px 0;">Email: <code style="background: #dcfce7; padding: 2px 6px; border-radius: 4px;">${emailSiswa}</code></p>
          <p style="margin: 2px 0;">Password: <code style="background: #dcfce7; padding: 2px 6px; border-radius: 4px;">${passwordSiswa}</code></p>
        </div>
        
        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 0 0 4px 0;"><strong>👤 Akun Orang Tua Anda:</strong></p>
          <p style="margin: 2px 0;">Email: <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${emailOrangTua}</code></p>
          <p style="margin: 6px 0 0 0; color: #475569; font-size: 13px;">Gunakan akun yang sama seperti sebelumnya untuk login. Password tidak berubah.</p>
        </div>
        
        <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #92400e;">⚠️ <strong>PENTING:</strong> Saat pertama kali login siswa, password akan diminta untuk diganti. Simpan informasi ini dengan aman.</p>
        </div>
        
        <p style="color: #666; font-size: 13px; margin-top: 24px;">
          Jika Anda tidak merasa mendaftar, abaikan email ini atau hubungi admin sekolah.
        </p>
      </div>
    </body>
    </html>
  `
}

/**
 * Template email: Kredensial Akun Guru Baru
 */
export function buildKredensialGuruEmail(params: {
  nama: string
  email: string
  password: string
}): string {
  const nama = escapeHtml(params.nama)
  const email = escapeHtml(params.email)
  const password = escapeHtml(params.password)
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color: #1e40af; margin-top: 0;">👩‍🏫 Akun Guru Baru — Anshorussunnah</h2>
        <p>Halo <strong>${nama}</strong>,</p>
        <p>Anda telah terdaftar sebagai guru di sistem LMS Anshorussunnah. Berikut adalah informasi akun Anda:</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        
        <h3 style="color: #333;">🔐 Informasi Akun Login</h3>
        
        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 2px 0;">Email: <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${email}</code></p>
          <p style="margin: 2px 0;">Password: <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${password}</code></p>
        </div>
        
        <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #92400e;">⚠️ <strong>PENTING:</strong> Saat pertama kali login, Anda akan diminta untuk mengganti password. Simpan informasi ini dengan aman dan jangan bagikan kepada siapapun.</p>
        </div>
        
        <p style="color: #666; font-size: 13px; margin-top: 24px;">
          Jika Anda tidak merasa mendaftar, abaikan email ini atau hubungi admin sekolah.
        </p>
      </div>
    </body>
    </html>
  `
}

/**
 * Template email: Pemberitahuan role baru ditambahkan ke akun yang SUDAH ADA.
 * Dipakai saat email sudah punya akun di role lain dan role baru di-link
 * (reuse authId). TIDAK ada password baru yang digenerate/dikirim.
 */
export function buildPemberitahuanRoleBaruEmail(params: {
  nama: string
  email: string
  roleBaru: string
}): string {
  const nama = escapeHtml(params.nama)
  const email = escapeHtml(params.email)
  const roleBaru = escapeHtml(params.roleBaru)
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color: #1e40af; margin-top: 0;">Akun ${roleBaru} Baru Ditambahkan — Ansharussunnah</h2>
        <p>Halo <strong>${nama}</strong>,</p>
        <p>Kami informasikan bahwa peran baru sebagai <strong>${roleBaru}</strong> telah ditambahkan ke akun Anda yang sudah terdaftar dengan email <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${email}</code>.</p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 0; color: #1e40af;"><strong>ℹ️ Cara Login:</strong> Anda <strong>TIDAK PERLU</strong> membuat akun baru atau mengingat password baru — silakan login menggunakan <strong>EMAIL dan PASSWORD yang SAMA</strong> seperti akun Anda sebelumnya.</p>
        </div>

        <p style="margin: 12px 0;">Setelah login, jika sistem menampilkan pilihan untuk berpindah peran (fitur "Ganti Akun"), Anda bisa memilih peran <strong>${roleBaru}</strong> ini kapan saja.</p>

        <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #92400e;">🔒 <strong>Keamanan:</strong> Jika Anda tidak merasa meminta penambahan role ini, segera hubungi admin sekolah.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * Template email: Pemberitahuan Tagihan SPP Bulanan (termasuk potongan/khusus).
 * Dikirim ke email siswa dan/atau orang tua/wali saat tagihan diterbitkan.
 */
export function buildTagihanSppEmail(params: {
  namaSiswa: string
  bulanLabel: string
  nominal: number
  jatuhTempo: Date
}): string {
  const namaSiswa = escapeHtml(params.namaSiswa)
  const bulanLabel = escapeHtml(params.bulanLabel)
  const nominal = params.nominal.toLocaleString("id-ID")
  const jatuhTempo = params.jatuhTempo.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color: #1e40af; margin-top: 0;">🧾 Tagihan SPP ${bulanLabel}</h2>
        <p>Assalamu&rsquo;alaikum Wr. Wb.,</p>
        <p>Yth. Orang Tua/Wali dan Santri,</p>
        <p>Kami informasikan bahwa tagihan syahriyah (SPP) untuk santri berikut telah diterbitkan:</p>

        <div style="background: #fef9c3; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 2px 0;"><strong>Nama Santri:</strong> ${namaSiswa}</p>
          <p style="margin: 2px 0;"><strong>Periode:</strong> ${bulanLabel}</p>
          <p style="margin: 2px 0;"><strong>Nominal Tagihan:</strong> <span style="font-size: 18px; font-weight: bold; color: #b45309;">Rp ${nominal}</span></p>
          <p style="margin: 2px 0;"><strong>Jatuh Tempo:</strong> ${jatuhTempo}</p>
        </div>

        <h3 style="color: #333;">💳 Nomor Rekening Resmi Pesantren Anshorussunnah</h3>
        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 2px 0; font-size: 20px; font-weight: bold; letter-spacing: 2px; font-family: monospace; color: #1e40af;">7700 8899 0011</p>
          <p style="margin: 2px 0; color: #475569; font-size: 13px;">Bank Syariah Indonesia (BSI) — a.n Yayasan Anshorussunnah</p>
        </div>

        <p>Silakan lakukan pembayaran sebelum tanggal jatuh tempo. Setelah transfer, upload bukti pembayaran melalui <strong>menu Tagihan SPP</strong> pada akun Login Pesantren Anshorussunnah agar segera diverifikasi oleh admin keuangan.</p>

        <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #92400e;">🔒 <strong>Keamanan:</strong> Jangan bagikan rincian tagihan ini kepada pihak yang tidak berwenang. Jika ada kendala, hubungi admin keuangan pesantren.</p>
        </div>

        <p style="color: #666; font-size: 13px; margin-top: 24px;">
          Wassalamu&rsquo;alaikum Wr. Wb.<br/>
          <strong>Yayasan Anshorussunnah Al-Islamy</strong>
        </p>
      </div>
    </body>
    </html>
  `
}

/**
 * Template email: Konfirmasi pendaftaran berhasil dibuat.
 * Dikirim ke email orang tua/wali saat pendaftaran pertama kali dibuat, berisi
 * nomor pendaftaran, rincian biaya, rekening tujuan, dan daftar langkah yang
 * WAJIB diselesaikan (bukti transfer + dokumen pendukung) agar bisa
 * diverifikasi admin.
 *
 * CATATAN KEAMANAN: token akses pendaftaran SENGAJA tidak disertakan. Token
 * adalah rahasia pemilik pendaftaran untuk mengunggah berkas; halaman sukses
 * menampilkannya dan menyimpannya di sessionStorage perangkat pendaftaran.
 */
export function buildPendaftaranBerhasilEmail(params: {
  namaOrangTua: string
  namaSiswa: string
  nomorPendaftaran: string
  jenjangNama: string
  biayaPendaftaran: number
  biayaUangGedung: number
  biayaSarpras: number
  bankNama: string
  bankNoRekening: string
  bankAtasNama: string
  kontakWa: string
  namaKontakWa: string | null
  cekStatusUrl: string
  sudahUploadKartuKeluarga: boolean
  sudahUploadAkteLahir: boolean
  sudahUploadPasFoto: boolean
}): string {
  const namaOrangTua = escapeHtml(params.namaOrangTua)
  const namaSiswa = escapeHtml(params.namaSiswa)
  const nomorPendaftaran = escapeHtml(params.nomorPendaftaran)
  const jenjangNama = escapeHtml(params.jenjangNama)
  const bankNama = escapeHtml(params.bankNama)
  const bankNoRekening = escapeHtml(params.bankNoRekening)
  const bankAtasNama = escapeHtml(params.bankAtasNama)
  const namaKontakWa = escapeHtml(params.namaKontakWa ?? "Admin PPDB")
  const cekStatusUrl = escapeHtml(params.cekStatusUrl)

  const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID")
  const totalBiaya =
    params.biayaPendaftaran + params.biayaUangGedung + params.biayaSarpras

  const rincianBiaya = [
    `<p style="margin: 2px 0; display: flex; justify-content: space-between; gap: 16px;"><span style="color: #475569;">Biaya Pendaftaran</span><span style="font-weight: bold;">${rupiah(params.biayaPendaftaran)}</span></p>`,
    params.biayaUangGedung > 0
      ? `<p style="margin: 2px 0; display: flex; justify-content: space-between; gap: 16px;"><span style="color: #475569;">Uang Gedung</span><span style="font-weight: bold;">${rupiah(params.biayaUangGedung)}</span></p>`
      : "",
    params.biayaSarpras > 0
      ? `<p style="margin: 2px 0; display: flex; justify-content: space-between; gap: 16px;"><span style="color: #475569;">Sarana Prasarana</span><span style="font-weight: bold;">${rupiah(params.biayaSarpras)}</span></p>`
      : "",
  ].join("")

  const waNomor = params.kontakWa.replace(/\D/g, "")
  const waLink = `https://wa.me/${waNomor}`

  // Status dokumen: dihitung server dari kolom snapshot di record pendaftaran.
  const ceklis = (label: string, selesai: boolean) =>
    `<p style="margin: 6px 0; color: ${selesai ? "#166534" : "#92400e"};">` +
    `${selesai ? "&#10004;" : "&#9679;"} ${escapeHtml(label)} — ` +
    `<strong>${selesai ? "sudah diunggah" : "BELUM diunggah"}</strong></p>`

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color: #1e40af; margin-top: 0;">Pendaftaran Berhasil Dicatat</h2>
        <p>Assalamu&rsquo;alaikum, <strong>${namaOrangTua}</strong>,</p>
        <p>Terima kasih. Data pendaftaran untuk <strong>${namaSiswa}</strong> (<strong>${jenjangNama}</strong>) telah kami terima dengan nomor:</p>

        <div style="background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
          <p style="margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 2px; color: #1e40af; font-family: monospace;">${nomorPendaftaran}</p>
        </div>
        <p style="font-size: 13px; color: #64748b; margin-top: -12px;">Simpan nomor ini — dipakai sebagai keterangan transfer dan untuk mengecek status pendaftaran.</p>

        <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 6px 0; color: #92400e;"><strong>&#9888; WAJIB DILENGKAPI:</strong></p>
          <p style="margin: 0; color: #92400e; font-size: 14px;">Pendaftaran Anda <strong>belum dapat diverifikasi</strong> admin sampai langkah-langkah di bawah ini selesai.</p>
        </div>

        <h3 style="color: #333; margin-bottom: 4px;">1&#41; Transfer biaya pendaftaran</h3>
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 0 0 8px 0; color: #475569; font-size: 14px;">Total yang harus ditransfer:</p>
          <p style="margin: 0 0 10px 0; font-size: 24px; font-weight: bold; color: #1e40af;">${rupiah(totalBiaya)}</p>
          ${rincianBiaya}
          <p style="margin: 12px 0 4px 0; border-top: 1px solid #e2e8f0; padding-top: 12px; color: #475569; font-size: 14px;">Transfer ke rekening:</p>
          <p style="margin: 2px 0; font-size: 18px; font-weight: bold; letter-spacing: 2px; font-family: monospace; color: #0f172a;">${bankNoRekening}</p>
          <p style="margin: 2px 0; color: #475569; font-size: 14px;">${bankNama} — a.n. ${bankAtasNama}</p>
          <p style="margin: 10px 0 0 0; color: #475569; font-size: 14px;">Cantumkan nomor pendaftaran <strong>${nomorPendaftaran}</strong> sebagai keterangan transfer.</p>
        </div>

        <h3 style="color: #333; margin-bottom: 4px;">2&#41; Unggah bukti transfer</h3>
        <p style="margin: 0 0 8px 0; color: #475569; font-size: 14px;">Screenshot atau foto bukti transfer (JPG/PNG/PDF, maks. 5 MB), lalu unggah di halaman &ldquo;Upload Bukti Transfer&rdquo; menggunakan nomor pendaftaran di atas.</p>

        <h3 style="color: #333; margin: 20px 0 4px 0;">3&#41; Lengkapi dokumen pendukung</h3>
        <p style="margin: 0 0 8px 0; color: #475569; font-size: 14px;">Status Berkas Anda saat ini:</p>
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 12px 0;">
          ${ceklis("Kartu Keluarga (KK)", params.sudahUploadKartuKeluarga)}
          ${ceklis("Akta Lahir", params.sudahUploadAkteLahir)}
          ${ceklis("Pas Foto", params.sudahUploadPasFoto)}
          <p style="margin: 10px 0 0 0; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
            Status berkas lengkap akan tertera di halaman cek status. Anda tetap bisa mengunggah berkas yang kurang kapan saja, termasuk setelah pendaftaran dinyatakan diterima.
          </p>
        </div>

        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; color: #1e40af;"><strong>&#128279; Buka Halaman Pendaftaran Anda</strong></p>
          <p style="margin: 0 0 12px 0; color: #1e3a8a; font-size: 14px;">Di halaman ini Anda dapat mengunggah bukti transfer &amp; dokumen, sekaligus memantau status verifikasi:</p>
          <p style="margin: 0; text-align: center;">
            <a href="${cekStatusUrl}" style="background: #1e40af; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Upload &amp; Cek Status</a>
          </p>
          <p style="margin: 12px 0 0 0; color: #475569; font-size: 13px;">Jika tautan tidak dapat dibuka, salin alamat ini ke browser Anda:<br/><code style="word-break: break-all;">${cekStatusUrl}</code></p>
        </div>

        <p style="margin: 16px 0; color: #475569; font-size: 14px;">Jika Anda sudah transfer namun belum mengunggah bukti, segera hubungi WhatsApp <a href="${waLink}" target="_blank" rel="noopener noreferrer" style="color: #16a34a; font-weight: bold;">${namaKontakWa}</a>.</p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 13px; margin-top: 0;">
          Wassalamu&rsquo;alaikum,<br/>
          <strong>Panitia PPDB — Pesantren Anshorussunnah</strong><br/>
          Pendaftaran Anda berstatus <strong>MENUNGGU PEMBAYARAN</strong> dan akan segera diperiksa admin setelah dokumen lengkap.
        </p>
        <p style="color: #94a3b8; font-size: 12px;">
          Email ini dikirim otomatis karena Anda melakukan pendaftaran di situs Anshorussunnah. Jika Anda tidak merasa mendaftar, abaikan email ini atau hubungi admin sekolah.
        </p>
      </div>
    </body>
    </html>
  `
}

/**
 * Template email: Pendaftaran DITOLAK oleh admin.
 * Dikirim ke email orang tua/wali berisi alasan penolakan, konfirmasi bahwa
 * akun login TIDAK dibuat, dan langkah tindak lanjut (perbaiki berkas lalu
 * daftar ulang, atau hubungi admin lewat WhatsApp).
 */
export function buildPendaftaranDitolakEmail(params: {
  namaOrangTua: string
  namaSiswa: string
  nomorPendaftaran: string
  alasanPenolakan: string
  catatanAdmin: string | null
  kontakWa: string
  daftarUlangUrl: string
}): string {
  const namaOrangTua = escapeHtml(params.namaOrangTua)
  const namaSiswa = escapeHtml(params.namaSiswa)
  const nomorPendaftaran = escapeHtml(params.nomorPendaftaran)
  const alasanPenolakan = escapeHtml(params.alasanPenolakan)
  const catatanAdmin = params.catatanAdmin
    ? escapeHtml(params.catatanAdmin)
    : null
  const daftarUlangUrl = escapeHtml(params.daftarUlangUrl)

  const waNomor = params.kontakWa.replace(/\D/g, "")
  const waLink = `https://wa.me/${waNomor}`

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color: #b91c1c; margin-top: 0;">Pendaftaran Belum Diterima</h2>
        <p>Assalamu&rsquo;alaikum, <strong>${namaOrangTua}</strong>,</p>
        <p>Kami informasikan bahwa pendaftaran untuk <strong>${namaSiswa}</strong> dengan nomor <strong>${nomorPendaftaran}</strong> <strong style="color: #b91c1c;">belum dapat diterima</strong> pada gelombang pendaftaran ini.</p>

        <div style="background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 6px 0; color: #991b1b;"><strong>Alasan Penolakan</strong></p>
          <p style="margin: 0; color: #7f1d1d;">${alasanPenolakan}</p>
        </div>

        ${
          catatanAdmin
            ? `<div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 6px 0; color: #334155;"><strong>Catatan Admin</strong></p>
          <p style="margin: 0; color: #475569;">${catatanAdmin}</p>
        </div>`
            : ""
        }

        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; color: #1e40af;"><strong>&#128274; Yang Perlu Anda Lakukan</strong></p>
          <p style="margin: 6px 0; color: #1e3a8a; font-size: 14px;">1. Perbaiki berkas atau data yang kurang sesuai dengan alasan di atas.</p>
          <p style="margin: 6px 0; color: #1e3a8a; font-size: 14px;">2. Kirim ulang bukti pembayaran &amp; berkas melalui halaman pendaftaran Anda, ATAU daftarkan kembali calon murid/santri baru.</p>
          <p style="margin: 6px 0; color: #1e3a8a; font-size: 14px;">3. Bila perlu penjelasan lebih lanjut, hubungi admin lewat WhatsApp.</p>
          <p style="margin: 14px 0 0 0; text-align: center;">
            <a href="${daftarUlangUrl}" style="background: #1e40af; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Daftar Ulang</a>
          </p>
        </div>

        <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;"><strong>&#9888; Penting:</strong> Tidak ada akun login yang dibuat untuk pendaftaran ini. Kalau Anda sudah memiliki akun dari pendaftaran anak sebelumnya, akun tersebut tetap berjalan seperti biasa. Kredensial baru hanya dikirim melalui email bila pendaftaran berikutnya dinyatakan diterima.</p>
        </div>

        <p style="margin: 16px 0; color: #475569; font-size: 14px;">Butuh bantuan? Hubungi WhatsApp <a href="${waLink}" target="_blank" rel="noopener noreferrer" style="color: #16a34a; font-weight: bold;">${waNomor}</a> dengan menyebut nomor pendaftaran <strong>${nomorPendaftaran}</strong>.</p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 13px; margin-top: 0;">
          Wassalamu&rsquo;alaikum,<br/>
          <strong>Panitia PPDB — Pesantren Anshorussunnah</strong>
        </p>
        <p style="color: #94a3b8; font-size: 12px;">
          Email ini dikirim otomatis karena ada pendaftaran atas nama Anda yang sedang diperiksa admin. Mohon abaikan email ini apabila Anda tidak mengenal pendaftaran tersebut.
        </p>
      </div>
    </body>
    </html>
  `
}

/**
 * Template email: OTP Lupa Password
 */
export function buildOtpEmail(params: {
  nama: string
  kodeOtp: string
  expiryMinutes: number
}): string {
  const nama = escapeHtml(params.nama)
  const kodeOtp = escapeHtml(params.kodeOtp)
  const expiryMinutes = params.expiryMinutes
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color: #1e40af; margin-top: 0;">🔑 Kode Verifikasi Lupa Password</h2>
        <p>Halo <strong>${nama}</strong>,</p>
        <p>Kami menerima permintaan untuk mereset password akun Anda. Gunakan kode berikut:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <div style="background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px; display: inline-block;">
            <p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e40af; font-family: monospace;">${kodeOtp}</p>
          </div>
        </div>
        
        <p style="color: #666;">Kode ini berlaku selama <strong>${expiryMinutes} menit</strong>. Jangan bagikan kode ini kepada siapapun.</p>
        
        <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #991b1b;">🚨 Jika Anda <strong>TIDAK</strong> meminta reset password, abaikan email ini. Seseorang mungkin mencoba mengakses akun Anda.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * Email OTP verifikasi kepemilikan email orang tua saat pendaftaran.
 *
 * Bedanya dari buildOtpEmail (reset password): ini bukan pemulihan akun,
 * melainkan bukti bahwa pengisi form benar-benar menguasai alamat email yang
 * dicantumkan. Karena itu email ini menyebut nama siswa & nomor pendaftaran,
 * sehingga penerima bisa menilai apakah pendaftaran memang miliknya.
 */
export function buildOtpVerifikasiPendaftaranEmail(params: {
  namaOrangTua: string
  namaSiswa: string
  nomorPendaftaran: string
  kodeOtp: string
  expiryMinutes: number
}): string {
  const namaOrangTua = escapeHtml(params.namaOrangTua)
  const namaSiswa = escapeHtml(params.namaSiswa)
  const nomorPendaftaran = escapeHtml(params.nomorPendaftaran)
  const kodeOtp = escapeHtml(params.kodeOtp)
  const expiryMinutes = params.expiryMinutes
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color: #1e40af; margin-top: 0;">📧 Verifikasi Email Pendaftaran</h2>
        <p>Halo <strong>${namaOrangTua}</strong>,</p>
        <p>
          Pendaftaran untuk <strong>${namaSiswa}</strong> dengan nomor
          <strong>${nomorPendaftaran}</strong> sudah kami terima. Untuk
          mengaktifkan pendaftaran, mohon konfirmasi bahwa Anda memang
          pemilik email ini dengan memasukkan kode berikut:
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <div style="background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px; display: inline-block;">
            <p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e40af; font-family: monospace;">${kodeOtp}</p>
          </div>
        </div>

        <p style="color: #666;">Kode ini berlaku selama <strong>${expiryMinutes} menit</strong> dan hanya bisa dipakai sekali. Jangan bagikan kode ini kepada siapapun.</p>

        <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #991b1b;">🚨 Jika Anda <strong>TIDAK</strong> recognise pendaftaran ini, abaikan email tersebut dan jangan bagikan kodenya kepada siapa pun. Silakan hubungi panitia PPDB.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

function getBaseUrl(): string {  return (
    process.env.NEXT_PUBLIC_APP_URL || "https://anshorussunnah.com"
  ).replace(/\/+$/, "")
}

/**
 * Kirim email konfirmasi pendaftaran + instruksi melengkapi dokumen.
 * Sengaja dipanggil TANPA await (fire-and-forget) dari server action
 * createPendaftaran: pendaftaran sudah tersimpan & nomor sudah dikembalikan ke
 * pengguna, sehingga kegagalan/keterlambatan email tidak boleh memblokir
 * proses pendaftaran. Info lengkap & nomor pendaftaran tersedia di
 * /pendaftaran/sukses, jadi tidak ada data hilang bila email gagal terkirim.
 */
export async function sendPendaftaranBerhasilEmail(params: {
  namaOrangTua: string
  emailOrangTua: string
  namaSiswa: string
  jenjangNama: string
  nomorPendaftaran: string
  biayaPendaftaran: number
  biayaUangGedung: number
  biayaSarpras: number
  bankNama: string
  bankNoRekening: string
  bankAtasNama: string
  kontakWa: string
  namaKontakWa: string | null
  sudahUploadKartuKeluarga: boolean
  sudahUploadAkteLahir: boolean
  sudahUploadPasFoto: boolean
}) {
  const { nomorPendaftaran, emailOrangTua, namaSiswa, ...rest } = params

  return sendEmail({
    to: emailOrangTua,
    subject: `Pendaftaran ${nomorPendaftaran} — ${namaSiswa} | Segera Lengkapi Pembayaran & Dokumen`,
    html: buildPendaftaranBerhasilEmail({
      ...rest,
      namaSiswa,
      nomorPendaftaran,
      // Halaman sukses memuat instruksi pembayaran, tautan upload bukti &
      // dokumen, serta token akses (rahasia) milik perangkat pendaftar.
      cekStatusUrl: `${getBaseUrl()}/pendaftaran/sukses?nomor=${encodeURIComponent(nomorPendaftaran)}`,
    }),
  })
}

/**
 * Kirim email pemberitahuan pendaftaran ditolak.
 * Di-await (konsisten dengan jalur DITERIMA di verifikasi.ts) karena status
 * penolakan sudah final di DB dan admin perlu yakin email sudah dicoba kirim.
 * sendEmail() sendiri tidak pernah melempar error, jadi kegagalan email tidak
 * akan mengubah hasil verifikasi.
 */
export async function sendPendaftaranDitolakEmail(params: {
  namaOrangTua: string
  emailOrangTua: string
  namaSiswa: string
  nomorPendaftaran: string
  alasanPenolakan: string
  catatanAdmin: string | null
  kontakWa: string
}) {
  const { nomorPendaftaran, emailOrangTua, namaSiswa, ...rest } = params

  return sendEmail({
    to: emailOrangTua,
    subject: `Pendaftaran ${nomorPendaftaran} Belum Diterima — ${namaSiswa}`,
    html: buildPendaftaranDitolakEmail({
      ...rest,
      namaSiswa,
      nomorPendaftaran,
      daftarUlangUrl: `${getBaseUrl()}/pendaftaran`,
    }),
  })
}