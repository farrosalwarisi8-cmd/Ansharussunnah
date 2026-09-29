// src/actions/pendaftaran.ts

"use server"

import prisma from "@/lib/prisma"
import { generateNomorPendaftaran } from "@/lib/registration-number"
import { siswaCocokKelas } from "@/lib/guru-kelas-gender"
import { pendaftaranSchema } from "@/lib/validations/pendaftaran"
import { rateLimitAsync, getClientIpFromHeaders } from "@/lib/rate-limit"
import { toUserFriendlyError } from "@/lib/prisma-error"
import type { ActionResponse } from "@/types"
import { Prisma, StatusPendaftaran } from "@prisma/client"
import { nanoid } from "nanoid"
import {
  getBiayaPPDBPerJenjang,
  resolveBiayaFromMap,
  getPengaturanPPDB,
} from "@/lib/biaya-ppdb-server"
import { sendPendaftaranBerhasilEmail } from "@/lib/email"
import { runAfterResponse } from "@/lib/after-response"
import { hitungTokenAksesExpiraAt, hashTokenAkses } from "@/lib/pendaftaran-token"
import { finalizeDraftRow } from "@/actions/pendaftaran-draft"
import { hashTokenAkses as hashResumeToken } from "@/lib/pendaftaran-token"

const MAX_RETRY = 5

// Segment folder di dalam bucket "dokumen-pendaftaran" (mis. "temp-<nanoid>").
const RE_DOKUMEN_SEGMENT = /^[A-Za-z0-9_-]{6,40}$/
// Nama file yang dihasilkan klien: nanoid + ekstensi yang diizinkan.
const RE_DOKUMEN_FILE = /^[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp|pdf)$/i

/**
 * KEAMANAN (M2): Path dokumen yang dikirim klien harus berbentuk persis hasil
 * upload form pendaftaran: dokumen-pendaftaran/pendaftaran/temp-<nanoid>/<file>.
 * Menolak URL eksternal, path bucket lain, path server (pendaftaran/<id>),
 * path traversal, atau format lain apa pun yang bukan milik flow pendaftaran.
 */
function isValidDokumenPath(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false
  if (/^https?:\/\//i.test(value)) return false
  if (value.includes("\\") || value.includes("..")) return false

  const parts = value.split("/")
  if (parts.length !== 4) return false
  const [, folderPendaftaran, tempSegment, filePart] = parts
  return (
    parts[0] === "dokumen-pendaftaran" &&
    folderPendaftaran === "pendaftaran" &&
    tempSegment.startsWith("temp-") &&
    RE_DOKUMEN_SEGMENT.test(tempSegment) &&
    RE_DOKUMEN_FILE.test(filePart)
  )
}

export async function createPendaftaran(
  formData: FormData
): Promise<ActionResponse<{ nomorPendaftaran: string; tokenAkses: string }>> {
  try {
    // ✅ Rate Limiting: 30 pendaftaran / 10 menit per IP
    // Batas per-IP dibuat longgar karena satu IP publik sering dipakai bersama
    // (WiFi sekolah/asrama/orang tua) dan musim PPDB bisa memunculkan gelombang
    // pendaftaran sah dari jaringan yang sama dalam waktu singkat. IP yang tidak
    // bisa ditentukan ("unknown") tidak di-rate-limit — lihat rateLimitAsync().
    const ip = await getClientIpFromHeaders()
    const limiter = await rateLimitAsync(`create-pendaftaran:${ip}`, {
      maxRequests: 30,
      windowMs: 10 * 60 * 1000,
    })

    if (!limiter.success) {
      return {
        success: false,
        message: "Terlalu banyak permintaan pendaftaran. Silakan coba lagi dalam 10 menit.",
      }
    }

    const rawData = {
      namaLengkap: formData.get("namaLengkap") as string,
      tempatLahir: formData.get("tempatLahir") as string,
      tanggalLahir: formData.get("tanggalLahir") as string,
      jenisKelamin: formData.get("jenisKelamin") as string,
      agama: (formData.get("agama") as string) || undefined,
      alamatSiswa: formData.get("alamatSiswa") as string,
      nisn: (formData.get("nisn") as string) || undefined,
      noHpSiswa: (formData.get("noHpSiswa") as string) || undefined,
      namaOrangTua: formData.get("namaOrangTua") as string,
      noHpOrangTua: formData.get("noHpOrangTua") as string,
      emailOrangTua: formData.get("emailOrangTua") as string,
      alamatOrangTua: (formData.get("alamatOrangTua") as string) || undefined,
      namaAyahKandung: (formData.get("namaAyahKandung") as string) || undefined,
      statusAyahKandung: (formData.get("statusAyahKandung") as string) || undefined,
      nikAyah: (formData.get("nikAyah") as string) || undefined,
      namaIbuKandung: (formData.get("namaIbuKandung") as string) || undefined,
      statusIbuKandung: (formData.get("statusIbuKandung") as string) || undefined,
      nikIbu: (formData.get("nikIbu") as string) || undefined,
      statusWali: (formData.get("statusWali") as string) || undefined,
      namaWali: (formData.get("namaWali") as string) || undefined,
      kewarganegaraan: (formData.get("kewarganegaraan") as string) || undefined,
      kitas: (formData.get("kitas") as string) || undefined,
      asalNegara: (formData.get("asalNegara") as string) || undefined,
      jenjangTujuanId: formData.get("jenjangTujuanId") as string,
      kelasTujuanId: (formData.get("kelasTujuanId") as string) || undefined,
    }

    const validation = pendaftaranSchema.safeParse(rawData)
    if (!validation.success) {
      const errors: Record<string, string[]> = {}
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as string
        if (!errors[field]) errors[field] = []
        errors[field].push(issue.message)
      })
      return {
        success: false,
        message: "Data pendaftaran tidak valid",
        errors,
      }
    }

    const data = validation.data
    const emailOrtu = data.emailOrangTua.toLowerCase().trim()

    // ✅ Batas pendaftaran per EMAIL PENERIMA (bukan hanya per IP).
    // Setiap pendaftaran yang berhasil memicu satu email ke emailOrangTua.
    // Rate limit per-IP saja tidak cukup: penyerang cukup berganti IP untuk
    // membanjiri satu alamat korban dengan email (harassment / pemborosan kuota
    // email sekolah). Batas per-penerima inilah yang benar-benar menahan
    // dampaknya. Longgar agar keluarga dengan banyak anak tetap aman.
    const MAX_PENDAFTARAN_PER_EMAIL_PER_HARI = 10
    const limiterPerEmail = await rateLimitAsync(
      `create-pendaftaran-email:${emailOrtu}`,
      {
        maxRequests: MAX_PENDAFTARAN_PER_EMAIL_PER_HARI,
        windowMs: 24 * 60 * 60 * 1000,
      }
    )

    if (!limiterPerEmail.success) {
      return {
        success: false,
        message: `Terlalu banyak pendaftaran dari email ini dalam 24 jam terakhir (maksimal ${MAX_PENDAFTARAN_PER_EMAIL_PER_HARI}). Mohon hubungi admin sekolah jika Anda perlu mendaftar lebih dari itu.`,
      }
    }

    const jenjang = await prisma.jenjang.findUnique({
      where: { id: data.jenjangTujuanId },
    })
    if (!jenjang) {
      return { success: false, message: "Jenjang tujuan tidak ditemukan" }
    }

    if (data.kelasTujuanId) {
      const kelas = await prisma.kelas.findFirst({
        where: { id: data.kelasTujuanId, jenjangId: data.jenjangTujuanId },
        include: { _count: { select: { siswa: true } } },
      })
      if (!kelas) {
        return {
          success: false,
          message: "Kelas tujuan tidak valid untuk jenjang yang dipilih",
        }
      }

      // ✅ Validasi kecocokan gender calon siswa dengan kelas tujuan
      if (!siswaCocokKelas(data.jenisKelamin, kelas.jenisKelamin)) {
        const labelKelas = kelas.jenisKelamin === "LAKI_LAKI" ? "Ikhwan" : "Akhwat"
        return {
          success: false,
          message: `Kelas "${kelas.nama}" adalah kelas khusus ${labelKelas} dan hanya dapat diisi oleh calon santri ${labelKelas}. Pilih kelas yang sesuai jenis kelamin.`,
        }
      }

      // ✅ Validasi kapasitas kelas
      if (kelas.kapasitas > 0 && kelas._count.siswa >= kelas.kapasitas) {
        return {
          success: false,
          message: `Kelas "${kelas.nama}" sudah penuh (${kelas._count.siswa}/${kelas.kapasitas})`,
        }
      }
    }

    // ✅ Cegah duplikasi pendaftaran aktif: satu email orang tua per jenjang
    // hanya boleh memiliki SATU pendaftaran yang belum final (MENUNGGU_PEMBAYARAN
    // / MENUNGGU_VERIFIKASI). Melindungi dari submit ganda/retry yang membuat
    // banyak nomor pendaftaran untuk anak yang sama. Pendaftaran yang sudah
    // DITERIMA/DITOLAK tidak memblokir karena alurnya sudah keluar dari antrean.
    //
    // ⚠️ BATAS YANG DISENAIKAN — baca sebelum mengandalkan ini sebagai jaminan.
    //
    // Ini adalah check-then-act (findFirst lalu create) TANPA constraint di
    // database. Dua request yang benar-benar bersamaan bisa dua-duanya lolos
    // pemeriksaan ini, lalu sama-sama membuat baris. Jendelanya hanya
    // beberapa milidetik, dan tombol submit sudah dikunci `isSubmitting` di
    // sisi klien (src/components/pendaftaran/pendaftaran-form.tsx), sehingga
    // klik ganda — pemicu paling umum — sudah tertutup di lapisan itu.
    // Yang masih bisa lolos: mengisi formulir di dua tab/perangkat, atau
    // koneksi yang terputus lalu mengirim ulang.
    //
    // Kalau sampai terjadi, akibatnya: satu anak punya DUA nomor pendaftaran.
    // Bukan kebocoran data dan bukan kerusakan diam-diam — status tidak
    // berubah tanpa ada manusia yang menekan tombol di dashboard panitia.
    // Committee cukup menolak/menghapus baris berlebih — dua nama dengan
    // email sama berdampingan, jadi mudah dikenali.
    //
    // TAPI: kalau committee tidak menyadari dan menyetujui keduanya, dua record
    // Siswa terbentuk di bawah satu orang tua. `auth.users` sengaja dipakai
    // ulang antar anak (lihat catatan "Akun ortu SUDAH ADA / reuse authId"
    // di bawah), jadi approval kedua TIDAK akan gagal dengan error email
    // duplikat — keduanya benar-benar lolos.
    //
    // CATATAN: ini masih check-then-act tanpa constraint database, jadi dua
    // request yang benar-benar bersamaan bisa dua-duanya lolos. Rentangnya
    // hanya beberapa milidetik, dan tombol submit sudah dikunci
    // `isSubmitting` di klien, jadi pemicu paling umum (klik ganda) tertutup.
    //
    // Penutupannya yang rapi adalah partial unique index
    // (`WHERE deleted_at IS NULL AND status IN (...)`) yang enforcement-nya
    // di database. TAPI itu tidak bisa ditulis di prisma/schema.prisma:
    // Prisma 6.19 tidak mendukung klausa WHERE pada @@unique maupun @@index.
    //
    // Index yang dibuat lewat SQL mentah DIJEBAK Prisma: kalau tidak
    // direpresentasikan di schema, `migrate diff` menandainya sebagai drift
    // dan `migrate dev` akan mengusulkan DROP-nya. Ini sudah terbukti terjadi
    // di repo ini — `idx_pendaftarans_email_otp` dan
    // `pendaftaran_email_manual_idx` keduanya hampir terhapus sebelum keduanya
    // didaftarkan sebagai `@@index` biasa di schema.
    //
    // Jadi kalau suatu saat index parsial ditambahkan, `prisma migrate dev`
    // WAJIB diberi tahu indeks itu ada. Verifikasi cepat:
    //   npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
    //     --to-schema-datamodel prisma/schema.prisma --script
    // Harus keluar "This is an empty migration".
    const duplikatAktif = await prisma.pendaftaran.findFirst({
      where: {
        emailOrangTua: { equals: emailOrtu, mode: "insensitive" },
        jenjangTujuanId: data.jenjangTujuanId,
        deleted_at: null,
        status: {
          in: [StatusPendaftaran.MENUNGGU_PEMBAYARAN, StatusPendaftaran.MENUNGGU_VERIFIKASI],
        },
      },
      select: { nomorPendaftaran: true, status: true },
    })

    if (duplikatAktif) {
      const pesan =
        duplikatAktif.status === StatusPendaftaran.MENUNGGU_PEMBAYARAN
          ? `Sudah ada pendaftaran aktif untuk email ini yang menunggu pembayaran. Gunakan nomor pendaftaran yang diterima saat mendaftar untuk melanjutkan pembayaran dan upload bukti transfer.`
          : `Sudah ada pendaftaran aktif untuk email ini yang sedang diverifikasi admin. Gunakan nomor pendaftaran yang diterima saat mendaftar untuk mengecek status.`
      return { success: false, message: pesan }
    }

    // ✅ Validasi NISN: pastikan belum dipakai siswa yang sudah diterima ATAU
    // pendaftaran aktif lain. Kolom nisn di model Siswa @unique — tanpa cek ini,
    // error P2002 muncul mentah di layar (biasanya saat admin approve, tetapi
    // lebih baik dicek sejak awal agar calon pendaftar langsung tahu).
    // Satu NISN harus unik milik SATU siswa: tidak boleh ada dua pendaftaran
    // aktif (MENUNGGU_PEMBAYARAN/MENUNGGU_VERIFIKASI) yang memakai NISN sama.
    if (data.nisn) {
      const [nisnSiswa, nisnPendaftaran] = await Promise.all([
        prisma.siswa.findUnique({
          where: { nisn: data.nisn },
          select: { id: true, user: { select: { nama: true } } },
        }),
        prisma.pendaftaran.findFirst({
          where: {
            nisn: data.nisn,
            status: {
              in: [
                StatusPendaftaran.MENUNGGU_PEMBAYARAN,
                StatusPendaftaran.MENUNGGU_VERIFIKASI,
              ],
            },
          },
          select: {
            id: true,
            nomorPendaftaran: true,
            status: true,
            namaLengkap: true,
          },
        }),
      ])

      if (nisnSiswa) {
        return {
          success: false,
          message: `NISN "${data.nisn}" sudah terdaftar atas nama santri lain. Mohon gunakan NISN yang benar atau hubungi admin sekolah.`,
        }
      }

      if (nisnPendaftaran) {
        return {
          success: false,
          message: `NISN "${data.nisn}" sudah digunakan pada pendaftaran aktif lain yang sedang ${
            nisnPendaftaran.status === StatusPendaftaran.MENUNGGU_VERIFIKASI
              ? "diverifikasi admin"
              : "menunggu pembayaran"
          }. Satu NISN hanya boleh untuk satu calon siswa. Mohon periksa kembali atau hubungi admin sekolah.`,
        }
      }
    }

    const dokKK = formData.get("dokKartuKeluarga") as string | null
    const dokAkte = formData.get("dokAkteLahir") as string | null
    const dokFoto = formData.get("dokFoto") as string | null
    const dokLainnyaRaw = formData.getAll("dokLainnya") as string[]
    const dokLainnya = dokLainnyaRaw.filter(Boolean)

    // Idempotensi finalisasi draft: klien mengirim draftToken (resume token    // server draft). Dengan token ini, submit ganda / retry setelah timeout    // mengembalikan nomor pendaftaran yang SAMA, bukan membuat record kedua.    // Token dicek sebagai hash — plaintext tidak pernah disimpan.    const draftToken = (formData.get("draftToken") as string | null)?.trim() || null

    // KEAMANAN (M2): hanya izinkan path dokumen yang benar-benar dihasilkan
    // form pendaftaran (folder temp). Menolak path dari bucket/storage lain,
    // URL eksternal, atau alur lain — cegah record pendaftaran menunjuk ke
    // file di luar tempat yang seharusnya.
    const dokumenPaths = [dokKK, dokAkte, dokFoto, ...dokLainnya].filter(
      (p): p is string => !!p
    )
    for (const p of dokumenPaths) {
      if (!isValidDokumenPath(p)) {
        return {
          success: false,
          message: "File dokumen tidak valid. Silakan unggah ulang dokumen.",
        }
      }
    }
    if (dokLainnya.length > 3) {
      return {
        success: false,
        message: "Maksimal 3 dokumen tambahan yang dapat diunggah",
      }
    }

    // ✅ Biaya sesuai jenjang tujuan (diatur admin di /dashboard/biaya-ppdb).
    // Snapshot ketiga komponen + rekening/WA saat ini ke record pendaftaran,
    // sehingga perubahan harga/rekening setelahnya tidak memengaruhi
    // pendaftaran yang sudah ada. Total biaya dihitung SERVER, bukan klien.
    const [biayaMap, pengaturan] = await Promise.all([
      getBiayaPPDBPerJenjang(),
      getPengaturanPPDB(),
    ])
    const biayaJenjang = resolveBiayaFromMap(biayaMap, data.jenjangTujuanId, jenjang.nama)
    const biayaPendaftaran = biayaJenjang.biayaPendaftaran
    const biayaUangGedung = biayaJenjang.biayaUangGedung
    const biayaSarpras = biayaJenjang.biayaSarpras

    let lastError: Error | null = null

    // ✅ IDEMPOTENSI FINALISASI DRAFT: kalau draft ini sudah pernah difinalisasi    // (submit ganda / retry setelah response hilang), kembalikan nomor yang    // sudah ada — JANGAN membuat pendaftaran kedua.    if (draftToken) {
      const draftFinal = await prisma.pendaftaranDraft.findUnique({
        where: { resumeTokenHash: hashResumeToken(draftToken) },
        select: { nomorPendaftaran: true, finalizedAt: true },
      })
      if (draftFinal?.finalizedAt && draftFinal.nomorPendaftaran) {
        return {
          success: true,
          message: "Pendaftaran sudah dibuat sebelumnya",
          data: {
            nomorPendaftaran: draftFinal.nomorPendaftaran,
            // Token akses TIDAK bisa dikembalikan pada retry (hanya hash yang            // tersimpan). Pemilik memakai token dari percobaan pertama yang            // tersimpan di sessionStorage halaman sukses.
            tokenAkses: "",
          },
        }
      }
    }

    // ✅ Handle Race Condition dengan retry logic untuk record nomorPendaftaran unik    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        const nomorPendaftaran = await generateNomorPendaftaran()
        // Token akses rahasia: kredensial pemilik untuk upload dokumen/bukti
        // transfer. Hanya dikirim sekali ke klien pada saat pendaftaran dibuat
        // lalu disimpan klien di localStorage — TIDAK PERNAH disimpan di
        // database. Yang tersimpan hanya SHA-256-nya, sehingga bocornya dump
        // database tidak langsung berarti kredensial upload yang valid.
        const tokenAkses = nanoid(32)
        // Batas berlaku token akses publik: 90 hari sejak pendaftaran dibuat.
        const tokenAksesExpiraAt = hitungTokenAksesExpiraAt()

        const pendaftaran = await prisma.pendaftaran.create({
          data: {
            nomorPendaftaran,
            tokenAksesHash: hashTokenAkses(tokenAkses),
            tokenAksesExpiraAt,
            namaLengkap: data.namaLengkap,
            tempatLahir: data.tempatLahir,
            tanggalLahir: new Date(data.tanggalLahir),
            jenisKelamin: data.jenisKelamin as "LAKI_LAKI" | "PEREMPUAN",
            agama: data.agama || null,
            alamatSiswa: data.alamatSiswa,
            nisn: data.nisn,
            noHpSiswa: data.noHpSiswa || null,
            namaOrangTua: data.namaOrangTua,
            noHpOrangTua: data.noHpOrangTua,
            emailOrangTua: data.emailOrangTua,            // Eksplisit null: OTP sudah DIHAPUS dari alur pendaftaran baru.            // Kolom warisan ini dipertahankan untuk data lama, bukan gerbang.            // Gerbang penerimaan sekarang = konfirmasi kontak wali oleh panitia            // (lihat kontakWaliDikonfirmasiAt + verifikasiPendaftaran).            emailOrangTuaTerverifikasiAt: null,
            alamatOrangTua: data.alamatOrangTua,
            namaAyahKandung: data.namaAyahKandung || null,
            statusAyahKandung: (data.statusAyahKandung as "MASIH_HIDUP" | "SUDAH_MENINGGAL" | "TIDAK_DIKETAHUI") || null,
            nikAyah: data.nikAyah || null,
            namaIbuKandung: data.namaIbuKandung || null,
            statusIbuKandung: (data.statusIbuKandung as "MASIH_HIDUP" | "SUDAH_MENINGGAL" | "TIDAK_DIKETAHUI") || null,
            nikIbu: data.nikIbu || null,
            statusWali: (data.statusWali as "SAMA_DENGAN_AYAH" | "SAMA_DENGAN_IBU" | "LAINNYA") || null,
            namaWali: data.namaWali || null,
            kewarganegaraan: (data.kewarganegaraan as "WNI" | "WNA") || "WNI",
            kitas: data.kitas || null,
            asalNegara: data.asalNegara || null,
            jenjangTujuanId: data.jenjangTujuanId,
            kelasTujuanId: data.kelasTujuanId,
            dokKartuKeluarga: dokKK,
            dokAkteLahir: dokAkte,
            dokFoto: dokFoto,
            dokLainnya: dokLainnya,
            status: "MENUNGGU_PEMBAYARAN",
            biayaPendaftaran,
            biayaUangGedung,
            biayaSarpras,
            bankNama: pengaturan.bankNama,
            bankNoRekening: pengaturan.bankNoRekening,
            bankAtasNama: pengaturan.bankAtasNama,
            kontakWa: pengaturan.kontakWa,
          },
        })

        // Kirim email konfirmasi + instruksi melengkapi pembayaran & dokumen.
        // Ditunda ke setelah response (after): pendaftaran sudah tersimpan &
        // nomor sudah dikembalikan, sehingga email tidak boleh menunda atau
        // menggagalkan pendaftaran — tapi juga tidak boleh hilang begitu
        // response terkirim (lihat runAfterResponse).
        runAfterResponse(async () => {
          try {
            const hasil = await sendPendaftaranBerhasilEmail({
            namaOrangTua: data.namaOrangTua,
            emailOrangTua: data.emailOrangTua,
              namaSiswa: data.namaLengkap,
              jenjangNama: jenjang.nama,
              nomorPendaftaran: pendaftaran.nomorPendaftaran,
              biayaPendaftaran,
              biayaUangGedung,
              biayaSarpras,
              bankNama: pengaturan.bankNama,
              bankNoRekening: pengaturan.bankNoRekening,
              bankAtasNama: pengaturan.bankAtasNama,
              kontakWa: pengaturan.kontakWa,
              namaKontakWa: pengaturan.namaKontakWa ?? null,
              sudahUploadKartuKeluarga: Boolean(dokKK),
              sudahUploadAkteLahir: Boolean(dokAkte),
              sudahUploadPasFoto: Boolean(dokFoto),
            })
            if (!hasil.success) {
              console.error(
                `[email] Email konfirmasi pendaftaran ${pendaftaran.nomorPendaftaran} gagal:`,
                hasil.error
              )
            }
          } catch (error) {
            console.error("Gagal kirim email konfirmasi pendaftaran:", error)
          }
        })

        // Finalisasi draft: tandai finalized + nomor pendaftaran secara
        // atomik (updateMany dengan finalizedAt: null). Kegagalan di sini
        // TIDAK menggagalkan pendaftaran yang sudah dibuat — akibatnya hanya
        // retry tidak ter-idempoten-kan, bukan data hilang.
        if (draftToken) {
          await finalizeDraftRow(
            prisma as unknown as Parameters<typeof finalizeDraftRow>[0],
            draftToken,
            pendaftaran.nomorPendaftaran
          ).catch(() => false)
        }

        return {
          success: true,
          message: "Pendaftaran berhasil dibuat",
          data: {
            nomorPendaftaran: pendaftaran.nomorPendaftaran,
            // Token asli (bukan hasil hash) dikembalikan ke klien. Nilai ini
            // hanya hidup di memori server sebentar lalu disimpan di
            // localStorage pengguna; tidak pernah masuk ke email maupun log.
            tokenAkses,
          },
        }
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          (error.meta?.target as string[])?.includes("nomor_pendaftaran")
        ) {
          console.warn(`Nomor Pendaftaran bentrok, mencoba kembali (attempt ${attempt}/${MAX_RETRY})`)
          lastError = error
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt + Math.random() * 100))
          continue
        }
        throw error
      }
    }

    console.error("Gagal men-generate nomor pendaftaran yang unik:", lastError)
    return {
      success: false,
      message: "Sistem sedang padat. Silakan dicoba beberapa saat lagi.",
    }
  } catch (error) {
    console.error("Error createPendaftaran:", error)
    return {
      success: false,
      message: toUserFriendlyError(error, "Gagal memproses pendaftaran baru. Silakan coba lagi."),
    }
  }
}