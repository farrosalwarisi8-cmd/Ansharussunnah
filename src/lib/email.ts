// src/lib/email.ts

import { Resend } from "resend"

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
  const ortuAccount = params.passwordOrangTua
    ? `
        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Akun Orang Tua:</strong></p>
          <p style="margin: 2px 0;">Email: <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${params.emailOrangTua}</code></p>
          <p style="margin: 2px 0;">Password: <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${params.passwordOrangTua}</code></p>
        </div>
      `
    : `
        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Akun Orang Tua:</strong></p>
          <p style="margin: 2px 0;">Email: <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${params.emailOrangTua}</code></p>
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
        <p>Halo <strong>${params.namaOrangTua}</strong>,</p>
        <p>Selamat! Pendaftaran siswa baru dengan nomor <strong>${params.nomorPendaftaran}</strong> atas nama <strong>${params.namaSiswa}</strong> telah <strong style="color: green;">DITERIMA</strong>.</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        
        <h3 style="color: #333;">🔐 Informasi Akun Login</h3>
        
        ${ortuAccount}
        
        <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Akun Siswa:</strong></p>
          <p style="margin: 2px 0;">Email: <code style="background: #dcfce7; padding: 2px 6px; border-radius: 4px;">${params.emailSiswa}</code></p>
          <p style="margin: 2px 0;">Password: <code style="background: #dcfce7; padding: 2px 6px; border-radius: 4px;">${params.passwordSiswa}</code></p>
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
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color: #1e40af; margin-top: 0;">🎉 Santri Baru Diterima!</h2>
        <p>Halo <strong>${params.namaOrangTua}</strong>,</p>
        <p>Selamat! Anak Anda dengan nomor pendaftaran <strong>${params.nomorPendaftaran}</strong> atas nama <strong>${params.namaSiswa}</strong> telah <strong style="color: green;">DITERIMA</strong>.</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        
        <h3 style="color: #333;">🔐 Akun Login Anak</h3>
        
        <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Akun Siswa:</strong></p>
          <p style="margin: 2px 0;">Email: <code style="background: #dcfce7; padding: 2px 6px; border-radius: 4px;">${params.emailSiswa}</code></p>
          <p style="margin: 2px 0;">Password: <code style="background: #dcfce7; padding: 2px 6px; border-radius: 4px;">${params.passwordSiswa}</code></p>
        </div>
        
        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 0 0 4px 0;"><strong>👤 Akun Orang Tua Anda:</strong></p>
          <p style="margin: 2px 0;">Email: <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${params.emailOrangTua}</code></p>
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
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color: #1e40af; margin-top: 0;">👩‍🏫 Akun Guru Baru — Ansharussunnah</h2>
        <p>Halo <strong>${params.nama}</strong>,</p>
        <p>Anda telah terdaftar sebagai guru di sistem LMS Ansharussunnah. Berikut adalah informasi akun Anda:</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        
        <h3 style="color: #333;">🔐 Informasi Akun Login</h3>
        
        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 2px 0;">Email: <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${params.email}</code></p>
          <p style="margin: 2px 0;">Password: <code style="background: #dbeafe; padding: 2px 6px; border-radius: 4px;">${params.password}</code></p>
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
 * Template email: OTP Lupa Password
 */
export function buildOtpEmail(params: {
  nama: string
  kodeOtp: string
  expiryMinutes: number
}): string {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color: #1e40af; margin-top: 0;">🔑 Kode Verifikasi Lupa Password</h2>
        <p>Halo <strong>${params.nama}</strong>,</p>
        <p>Kami menerima permintaan untuk mereset password akun Anda. Gunakan kode berikut:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <div style="background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px; display: inline-block;">
            <p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e40af; font-family: monospace;">${params.kodeOtp}</p>
          </div>
        </div>
        
        <p style="color: #666;">Kode ini berlaku selama <strong>${params.expiryMinutes} menit</strong>. Jangan bagikan kode ini kepada siapapun.</p>
        
        <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #991b1b;">🚨 Jika Anda <strong>TIDAK</strong> meminta reset password, abaikan email ini. Seseorang mungkin mencoba mengakses akun Anda.</p>
        </div>
      </div>
    </body>
    </html>
  `
}