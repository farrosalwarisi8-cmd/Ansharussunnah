/**
 * scripts/cleanup-data-uji-coba.ts
 *
 * 🧹 PEMBERSIHAN DATA UJI COBA — sebelum go-live.
 *
 * DUA MODE (dikontrol via argumen command line):
 *   Preview (default) :
 *     npx tsx scripts/cleanup-data-uji-coba.ts
 *     → Hanya menghitung & menampilkan apa yang AKAN dihapus. TIDAK mengubah
 *       data apapun.
 *   Eksekusi :
 *     npx tsx scripts/cleanup-data-uji-coba.ts --eksekusi
 *     → Menampilkan preview, meminta konfirmasi ketik "HAPUS", lalu menjalankan
 *       seluruh penghapusan di dalam SATU Prisma transaction (rollback penuh
 *       bila ada langkah gagal). Setelah DB berhasil, akun Supabase Auth
 *       terkait dihapus di luar transaction (per-gagal dicatat, tidak menghentikan).
 *
 * YANG DIHAPUS (data uji coba):
 *   - Pendaftaran + BuktiTransferPendaftaran
 *   - Siswa + seluruh turunan (NilaiRapor, Absensi, PengumpulanTugas +
 *     RiwayatPengumpulanTugas, PengerjaanUjian + JawabanSiswa, CatatanRapor,
 *     TagihanSiswa + PembayaranSiswa, RiwayatKelasSiswa, AnggotaEkskul,
 *     ParentStudent) + akun Supabase Auth siswanya
 *   - OrangTua yang TIDAK punya relasi ke siswa manapun setelah siswa dihapus
 *     + akun Supabase Auth-nya (kecuali authId dipakai bersama akun yang selamat)
 *   - Ujian + SoalUjian + OpsiJawaban; Tugas; MateriPembelajaran
 *   - MataPelajaran (SEMUA) + GuruKelas + MapelKelas yang terhubung
 *
 * 🛡️ YANG TIDAK PERNAH DIHAPUS (Pengaman HARDCODED):
 *   - SEMUA User role = GURU DAN isAdmin = true (Guru Admin / Admin Akademik)
 *   - SEMUA User role = ADMIN_KEUANGAN
 *   - SEMUA User role = SUPER_ADMIN dan ADMIN_AKADEMIK
 *   Penutupannya struktural: query deleteMany User memakai klausa where yang
 *   hanya bisa mencocokkan role SISWA/ORANG_TUA dengan isAdmin = false — lihat
 *   konstanta PENGAMAN_USER dibawah. Tidak ada cuma komentar.
 *
 * ⚠️ PENGECUALIAN DISETUJUI USER (hardcoded eksplisit):
 *   - GURU non-admin tertentu YANG SECARA EKSPLISIT disetujui pemilik untuk
 *     dihapus, didaftarkan satu-persatu di konstanta GURU_DISETUJUI_DIHAPUS.
 *     Query penghapusannya memakai filter struktural (email persis tersbut +
 *     role=GURU + isAdmin=false), sehingga GURU+isAdmin=true TETAP tidak bisa.
 *     Saat ini yang disetujui: "nehan new" <habdill606@gmail.com>.
 *
 * YANG DIPERTAHANKAN:
 *   Jenjang, Kelas (beserta waliKelasId), PeriodeAjaran, SEMUA akun GURU
 *   (kecuali yang terdaftar di GURU_DISETUJUI_DIHAPUS), SEMUA akun
 *   ADMIN_KEUANGAN, SEMUA SUPER_ADMIN/ADMIN_AKADEMIK, Ekstrakurikuler,
 *   KategoriTransaksi & TransaksiKeuangan, pengumuman & notifikasi milik akun
 *   yang dipertahankan.
 */

import { PrismaClient, Prisma, Role } from "@prisma/client"
import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import * as readline from "readline"

dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

const MODE_EKSEKUSI = process.argv.slice(2).includes("--eksekusi")

// ✅ Pola yang dipakai script lain: prefer DATABASE_URL (pooler) → fallback DIRECT_URL.
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || process.env.DIRECT_URL,
    },
  },
})

// ════════════════════════════════════════════════════════════════════════════
// 🛡️ PENGAMAN HARDCODED #1 — filter query penghapusan User.
//
// Struktur ini TIDAK BOLEH DIHAPUS/DIPERLUAS. Setiap query yang menghapus row
// User (deleteMany) WAJIB memakai const ini, sehingga secara struktural TIDAK
// MUNGKIN menghapus baris dengan role = GURU AND isAdmin = true, ataupun
// role = ADMIN_KEUANGAN, serta user ber-role admin lain / ber-flag isAdmin.
// ════════════════════════════════════════════════════════════════════════════
const PENGAMAN_USER: Prisma.UserWhereInput = {
  // Hanya role siswa / orang tua yang boleh diproses script ini:
  role: { in: [Role.SISWA, Role.ORANG_TUA] },
  // Dan tidak boleh ber-flag admin sama sekali:
  isAdmin: false,
  // Lapis ekstra — redundansi eksplisit dari aturan user:
  NOT: {
    OR: [
      { role: Role.GURU, isAdmin: true },
      { role: Role.ADMIN_KEUANGAN },
      { role: Role.SUPER_ADMIN },
      { role: Role.ADMIN_AKADEMIK },
    ],
  },
}

// Rol yang dianggap "admin sistem" — tidak boleh pernah tersentuh.
const WHERE_USER_DILINDUNGI: Prisma.UserWhereInput = {
  OR: [
    { role: Role.GURU, isAdmin: true },      // Guru Admin / Admin Akademik
    { role: Role.ADMIN_KEUANGAN },
    { role: Role.SUPER_ADMIN },
    { role: Role.ADMIN_AKADEMIK },
  ],
}

// ════════════════════════════════════════════════════════════════════════════
// ⚠️ PENGECUALIAN DISETUJUI USER — GURU non-admin yang boleh dihapus.
//
// Daftar ini DIISI MANUAL oleh pemilik project (user). Setiap entry wajib
// dipastikan: role = GURU DAN isAdmin = false. Query penghapusan guru memakai
// filter struktural (email persis ini + role GURU + isAdmin=false), sehingga
// GURU+isAdmin=true, ADMIN_KEUANGAN, SUPER_ADMIN, dan ADMIN_AKADEMIK tetap
// TIDAK MUNGKIN ikut terhapus dari jalur ini.
// ════════════════════════════════════════════════════════════════════════════
const GURU_DISETUJUI_DIHAPUS: Array<{ email: string }> = [
  { email: "habdill606@gmail.com" }, // "nehan new" — disetujui hapus oleh user
]

// Keyword heuristik untuk MEMPERKIRAKAN akun guru testing (HANYA rekomendasi
// tinjauan manual — tidak pernah dihapus otomatis).
const KEYWORD_TERDUGA_UJI = [
  "nehan", "test", "coba", "uji", "dummy", "sample", "contoh", "placeholder",
  "xyz", "abcd", "lorem", "sampel",
]

// ────────────────────────────────────────────────────────────────────────────
// TIPE DATA
// ────────────────────────────────────────────────────────────────────────────

type DaftarSiswa = Array<{
  id: string
  userId: string
  nisn: string | null
  nama: string
  email: string
  kelasNama: string | ""
}>

type DaftarOrtu = Array<{
  id: string
  userId: string
  nama: string
  email: string
  linkedSiswaId: string[]
}>

type InfoUserDihapus = Array<{
  id: string
  authId: string
  email: string
  role: string
  isAdmin: boolean
}>

type GuruTerdugaUji = Array<{
  id: string
  nama: string
  email: string
  isAdmin: boolean
  alasan: string
}>

interface DataPreview {
  siswa: DaftarSiswa
  siswaIds: string[]
  ortu: DaftarOrtu
  ortuIdTerhapus: string[]
  guruDisetujui: Array<{ id: string; nama: string; email: string; isAdmin: boolean }>
  guruIdsDihapus: string[]
  userDihapus: InfoUserDihapus
  authInfoToDelete: Array<{ email: string; authId: string }>
  authSharedKept: Array<{ email: string; authId: string }>
  counts: Record<string, number>
  guruTerdugaUji: GuruTerdugaUji
  dipertahankan: {
    jenjang: number
    kelas: number
    periodeAjaran: number
    guruTotal: number
    guruWhitelist: number
    adminKeuangan: number
    superAdminAkademik: number
    ekstrakurikuler: number
  }
}

// ────────────────────────────────────────────────────────────────────────────
// DETEXSI GURU TERDUGA UJI (read-only, hanya rekomendasi)
// ────────────────────────────────────────────────────────────────────────────

function deteksiNamaTerdugaUji(nama: string, email: string): string | null {
  const haystack = `${nama} ${email}`.toLowerCase()
  for (const kw of KEYWORD_TERDUGA_UJI) {
    if (haystack.includes(kw.toLowerCase())) return `mengandung "${kw}"`
  }
  // email local-part berbentuk guru1@ / user12@ / admin3@ → pola placeholder
  const lokal = (email.split("@")[0] ?? "").toLowerCase()
  if (/^(guru|user|siswa|admin|ortu|tester|test)\d+$/i.test(lokal)) {
    return `email terlihat seperti placeholder (${lokal})`
  }
  return null
}

// ────────────────────────────────────────────────────────────────────────────
// KUMPULKAN DATA (read-only)
// ────────────────────────────────────────────────────────────────────────────

async function kumpulkanData(): Promise<DataPreview> {
  const [siswaRows, ortuRows, semuaUser] = await Promise.all([
    prisma.siswa.findMany({
      select: {
        id: true,
        userId: true,
        nisn: true,
        user: { select: { nama: true, email: true, role: true, isAdmin: true } },
        kelas: { select: { nama: true } },
      },
    }),
    prisma.orangTua.findMany({
      select: {
        id: true,
        userId: true,
        user: { select: { nama: true, email: true, role: true, isAdmin: true } },
        // Relasi `siswa` pada OrangTua adalah ParentStudent[] — ambil FK siswaId.
        siswa: { select: { siswaId: true } },
      },
    }),
    prisma.user.findMany({ select: { id: true, authId: true, email: true, nama: true, role: true, isAdmin: true } }),
  ])

  const siswaIds = siswaRows.map((s) => s.id)

  // Daftar siswa untuk laporan
  const daftarSiswa: DaftarSiswa = siswaRows.map((s) => ({
    id: s.id,
    userId: s.userId,
    nisn: s.nisn,
    nama: s.user.nama,
    email: s.user.email,
    kelasNama: s.kelas?.nama ?? "",
  }))

  // Daftar orang tua + relasi siswa (via ParentStudent)
  const daftarOrtu: DaftarOrtu = ortuRows.map((o) => ({
    id: o.id,
    userId: o.userId,
    nama: o.user.nama,
    email: o.user.email,
    linkedSiswaId: o.siswa.map((s) => s.siswaId),
  }))

  // OrangTua yang DIHAPUS = seluruh siswa yang terhubung ikut terhapus.
  // (Karena SEMUA siswa dihapus, hampir pasti semua orang tua terhapus;
  //  kondisi `every` di bawah masih berlaku sebagai pengaman struktural.)
  const ortuIdTerhapus = daftarOrtu
    .filter((o) => o.linkedSiswaId.every((sid) => siswaIds.includes(sid)))
    .map((o) => o.id)

  // ID User yang berpotensi ikut terhapus: siswa + orang tua yang dihapus.
  const userIdKandidat = new Set<string>()
  for (const s of siswaRows) userIdKandidat.add(s.userId)
  for (const o of daftarOrtu) if (ortuIdTerhapus.includes(o.id)) userIdKandidat.add(o.userId)

  // 🛡️ GURU yang SECARA EKSPLISIT disetujui USER untuk dihapus — lihat konstanta
  // GURU_DISETUJUI_DIHAPUS. Hanya email persis tsb, role wajib GURU, isAdmin=false,
  // dan bukan role admin manapun.
  const setGuruDisetujui = new Set(
    GURU_DISETUJUI_DIHAPUS.map((g) => g.email.toLowerCase().trim())
  )
  const approvedGuruUserIds = new Set<string>()
  for (const u of semuaUser) {
    if (u.role !== Role.GURU) continue
    if (!setGuruDisetujui.has(u.email.toLowerCase().trim())) continue
    if (u.isAdmin === true) continue // GURU+isAdmin=true tetap dilarang
    approvedGuruUserIds.add(u.id)
  }
  for (const id of approvedGuruUserIds) userIdKandidat.add(id)

  // Profil Guru untuk guru yang disetujui (row di tabel gurus — ikut dihapus).
  const guruIdsDihapus = (
    await prisma.guru.findMany({
      where: { userId: { in: [...approvedGuruUserIds] } },
      select: { id: true },
    })
  ).map((g) => g.id)

  // Ambil user yang benar-benar akan dihapus — WAJIB lewat filter aman:
  //   - siswa / orang tua  → lewat PENGAMAN_USER
  //   - guru yang disetujui → daftar eksplisit + isAdmin=false
  const userDihapusAll = semuaUser.filter((u) => {
    if (!userIdKandidat.has(u.id)) return false
    if (approvedGuruUserIds.has(u.id)) return true
    const okRole = u.role === Role.SISWA || u.role === Role.ORANG_TUA
    const okIsAdmin = u.isAdmin === false
    const okLindungi = !(
      (u.role === Role.GURU && u.isAdmin === true) ||
      u.role === Role.ADMIN_KEUANGAN ||
      u.role === Role.SUPER_ADMIN ||
      u.role === Role.ADMIN_AKADEMIK
    )
    return okRole && okIsAdmin && okLindungi
  })

  const userDihapus: InfoUserDihapus = userDihapusAll.map((u) => ({
    id: u.id,
    authId: u.authId,
    email: u.email,
    role: u.role,
    isAdmin: u.isAdmin,
  }))
  const userDihapusIds = new Set(userDihapus.map((u) => u.id))

  // authId yang dipakai BERSAMA akun yang SELAMAT (multi-role: mis. orang tua
  // yang juga guru) → TIDAK boleh dihapus dari Supabase Auth.
  const survivorAuthIds = new Set(
    semuaUser.filter((u) => !userDihapusIds.has(u.id)).map((u) => u.authId)
  )
  const authInfoToDelete: Array<{ email: string; authId: string }> = []
  const authSharedKept: Array<{ email: string; authId: string }> = []
  const seenAuth = new Set<string>()
  for (const u of userDihapus) {
    if (seenAuth.has(u.authId)) continue
    seenAuth.add(u.authId)
    if (survivorAuthIds.has(u.authId)) {
      authSharedKept.push({ email: u.email, authId: u.authId })
    } else {
      authInfoToDelete.push({ email: u.email, authId: u.authId })
    }
  }

  // ── Hitung jumlah per kategori (read-only) ──
  const [
    nPendaftaran, nBukti,
    nSiswa, nParentStudent,
    nUjian, nSoal, nOpsi, nPengerjaan, nJawaban,
    nTugas, nPengumpulan, nRiwayatPengumpulan,
    nMateri, nMapel, nGuruKelas, nMapelKelas,
    nAbsensi, nCatatanRapor, nNilaiRapor, nRiwayatKelas, nTagihan, nPembayaran, nAnggotaEkskul,
    nJenjang, nKelas, nPeriode, nAdminKeuangan, nEkstrakurikuler,
  ] = await Promise.all([
    prisma.pendaftaran.count(),
    prisma.buktiTransferPendaftaran.count(),
    prisma.siswa.count(),
    prisma.parentStudent.count(),
    prisma.ujian.count(),
    prisma.soalUjian.count(),
    prisma.opsiJawaban.count(),
    prisma.pengerjaanUjian.count(),
    prisma.jawabanSiswa.count(),
    prisma.tugas.count(),
    prisma.pengumpulanTugas.count(),
    prisma.riwayatPengumpulanTugas.count(),
    prisma.materiPembelajaran.count(),
    prisma.mataPelajaran.count(),
    prisma.guruKelas.count(),
    prisma.mapelKelas.count(),
    prisma.absensi.count(),
    prisma.catatanRapor.count(),
    prisma.nilaiRapor.count(),
    prisma.riwayatKelasSiswa.count(),
    prisma.tagihanSiswa.count(),
    prisma.pembayaranSiswa.count(),
    prisma.anggotaEkskul.count(),
    prisma.jenjang.count(),
    prisma.kelas.count(),
    prisma.periodeAjaran.count(),
    prisma.user.count({ where: { role: Role.ADMIN_KEUANGAN } }),
    prisma.ekstrakurikuler.count(),
  ])

  // ── Guru yang dipertahankan + deteksi terduga uji ──
  const guruUserSemua = semuaUser.filter((u) => u.role === Role.GURU)
  const guruUser = guruUserSemua.filter((g) => !approvedGuruUserIds.has(g.id))
  const guruDisetujui = guruUserSemua
    .filter((g) => approvedGuruUserIds.has(g.id))
    .map((g) => ({ id: g.id, nama: g.nama, email: g.email, isAdmin: g.isAdmin }))
  const guruTerdugaUji: GuruTerdugaUji = []
  for (const g of guruUser) {
    const alasan = deteksiNamaTerdugaUji(g.nama, g.email)
    if (alasan) {
      guruTerdugaUji.push({
        id: g.id,
        nama: g.nama,
        email: g.email,
        isAdmin: g.isAdmin,
        alasan,
      })
    }
  }

  const counts: Record<string, number> = {
    "BuktiTransferPendaftaran": nBukti,
    "Pendaftaran": nPendaftaran,
    "Siswa": nSiswa,
    "ParentStudent": nParentStudent,
    "AnggotaEkskul": nAnggotaEkskul,
    "Absensi": nAbsensi,
    "CatatanRapor": nCatatanRapor,
    "NilaiRapor": nNilaiRapor,
    "RiwayatKelasSiswa": nRiwayatKelas,
    "TagihanSiswa": nTagihan,
    "PembayaranSiswa": nPembayaran,
    "PengumpulanTugas": nPengumpulan,
    "RiwayatPengumpulanTugas": nRiwayatPengumpulan,
    "PengerjaanUjian": nPengerjaan,
    "JawabanSiswa": nJawaban,
    "Ujian": nUjian,
    "SoalUjian": nSoal,
    "OpsiJawaban": nOpsi,
    "Tugas": nTugas,
    "MateriPembelajaran": nMateri,
    "GuruKelas": nGuruKelas,
    "MapelKelas": nMapelKelas,
    "MataPelajaran": nMapel,
    "User-dihapus": userDihapus.length,
    "Guru-disetujui": approvedGuruUserIds.size,
    "GuruProfile-dihapus": guruIdsDihapus.length,
    "AuthSupabase-dihapus": authInfoToDelete.length,
    "AuthSupabase-disendalkan": authSharedKept.length,
    "OrangTua-terhapus": ortuIdTerhapus.length,
  }

  const nGuruWhitelist = guruUser.filter((g) => g.isAdmin === true).length
  const nSuperAdminAkademik = semuaUser.filter(
    (u) => u.role === Role.SUPER_ADMIN || u.role === Role.ADMIN_AKADEMIK
  ).length

  return {
    siswa: daftarSiswa,
    siswaIds,
    ortu: daftarOrtu,
    ortuIdTerhapus,
    guruDisetujui,
    guruIdsDihapus,
    userDihapus,
    authInfoToDelete,
    authSharedKept,
    counts,
    guruTerdugaUji,
    dipertahankan: {
      jenjang: nJenjang,
      kelas: nKelas,
      periodeAjaran: nPeriode,
      guruTotal: guruUser.length,
      guruWhitelist: nGuruWhitelist,
      adminKeuangan: nAdminKeuangan,
      superAdminAkademik: nSuperAdminAkademik,
      ekstrakurikuler: nEkstrakurikuler,
    },
  }
}

// ────────────────────────────────────────────────────────────────────────────
// PENGAMAN HARDCODED #2 — verifikasi tegas sebelum eksekusi
// ────────────────────────────────────────────────────────────────────────────

function verifikasiPengaman(data: DataPreview): void {
  // Semua user di daftar hapus WAJIB lolos aturan berikut; guard ini menjaga
  // agar script TIDAK PERNAH berjalan bila ada user admin yang nyasar ke
  // daftar hapus. GURU non-admin (isAdmin=false) boleh lewat HANYA bila memang
  // terdaftar eksplisit di GURU_DISETUJUI_DIHAPUS (dicek di kumpulkanData).
  const masukDaftar = data.userDihapus.filter(
    (u) =>
      (u.role === Role.GURU && u.isAdmin === true) ||
      u.role === Role.ADMIN_KEUANGAN ||
      u.role === Role.SUPER_ADMIN ||
      u.role === Role.ADMIN_AKADEMIK
  )
  if (masukDaftar.length > 0) {
    throw new Error(
      "❌ PENGAMAN HARDCODED: terdeteksi user ber-flag admin dalam daftar hapus. " +
        "Proses dihentikan. Ini TIDAK boleh terjadi."
    )
  }
}

// ────────────────────────────────────────────────────────────────────────────
// TAMPILAN PREVIEW
// ────────────────────────────────────────────────────────────────────────────

function garis(jumlah = 70): string {
  return "═".repeat(jumlah)
}

function garisTipis(): string {
  return "─".repeat(70)
}

function tampilkanPreview(data: DataPreview): void {
  const { counts, dipertahankan } = data

  console.log("")
  console.log(garis())
  console.log(`  🧹 PEMBERSIHAN DATA UJI COBA — ${MODE_EKSEKUSI ? "MODE EKSEKUSI" : "MODE PREVIEW"}`)
  console.log(garis())

  console.log("\n⚠️  YANG AKAN DIHAPUS (ringkasan):\n")
  console.log("  ── Pendaftaran ──")
  console.log(`     BuktiTransferPendaftaran : ${counts["BuktiTransferPendaftaran"]}`)
  console.log(`     Pendaftaran              : ${counts["Pendaftaran"]}`)
  console.log("  ── Siswa + turunan ──")
  console.log(`     Siswa                    : ${counts["Siswa"]}`)
  console.log(`     ParentStudent            : ${counts["ParentStudent"]}`)
  console.log(`     Absensi                  : ${counts["Absensi"]}`)
  console.log(`     CatatanRapor             : ${counts["CatatanRapor"]}`)
  console.log(`     NilaiRapor               : ${counts["NilaiRapor"]}`)
  console.log(`     RiwayatKelasSiswa        : ${counts["RiwayatKelasSiswa"]}`)
  console.log(`     TagihanSiswa             : ${counts["TagihanSiswa"]}`)
  console.log(`     PembayaranSiswa          : ${counts["PembayaranSiswa"]}`)
  console.log(`     AnggotaEkskul            : ${counts["AnggotaEkskul"]}`)
  console.log("  ── Tugas / Ujian / Materi ──")
  console.log(`     Tugas                    : ${counts["Tugas"]}`)
  console.log(`     PengumpulanTugas         : ${counts["PengumpulanTugas"]}`)
  console.log(`     RiwayatPengumpulanTugas  : ${counts["RiwayatPengumpulanTugas"]}`)
  console.log(`     Ujian                    : ${counts["Ujian"]}`)
  console.log(`     SoalUjian                : ${counts["SoalUjian"]}`)
  console.log(`     OpsiJawaban              : ${counts["OpsiJawaban"]}`)
  console.log(`     PengerjaanUjian          : ${counts["PengerjaanUjian"]}`)
  console.log(`     JawabanSiswa             : ${counts["JawabanSiswa"]}`)
  console.log(`     MateriPembelajaran       : ${counts["MateriPembelajaran"]}`)
  console.log("  ── Mata Pelajaran (diinput ulang oleh admin kelak) ──")
  console.log(`     GuruKelas                : ${counts["GuruKelas"]}`)
  console.log(`     MapelKelas               : ${counts["MapelKelas"]}`)
  console.log(`     MataPelajaran            : ${counts["MataPelajaran"]}`)
  console.log("  ── Orang Tua ──")
  console.log(`     OrangTua yang terhapus   : ${counts["OrangTua-terhapus"]}`)
  console.log("  ── Akun User & Supabase Auth ──")
  console.log(`     User dihapus             : ${counts["User-dihapus"]}`)
  console.log(`     Auth Supabase dihapus    : ${counts["AuthSupabase-dihapus"]}`)
  console.log(`     Auth disendahkan (masih dipakai akun lain) : ${counts["AuthSupabase-disendalkan"]}`)
  console.log(`     Guru (disetujui hapus)   : ${counts["Guru-disetujui"]}  (+ ${counts["GuruProfile-dihapus"]} profil gurus)`)

  console.log(`\n${garisTipis()}`)
  console.log(`\n👤 DAFTAR SISWA YANG AKAN DIHAPUS (${data.siswa.length}):\n`)
  for (const s of data.siswa) {
    console.log(`   - ${s.nama}  <${s.email}>  NISN: ${s.nisn ?? "-"}  Kelas: ${s.kelasNama || "-"}`)
  }

  const daftarOrtuHapus = data.ortu.filter((o) => data.ortuIdTerhapus.includes(o.id))
  console.log(`\n${garisTipis()}`)
  console.log(`\n👪 DAFTAR ORANG TUA YANG AKAN DIHAPUS (${daftarOrtuHapus.length}):\n`)
  if (daftarOrtuHapus.length === 0) {
    console.log("   (tidak ada orang tua yang ikut terhapus)")
  }
  for (const o of daftarOrtuHapus) {
    console.log(`   - ${o.nama}  <${o.email}>  (${o.linkedSiswaId.length} anak terhubung)`)
  }

  console.log(`\n${garisTipis()}`)
  console.log(`\n🔒 AKUN SUPABASE AUTH YANG AKAN DIHAPUS (${data.authInfoToDelete.length}):\n`)
  if (data.authInfoToDelete.length === 0) {
    console.log("   (tidak ada akun auth yang perlu dihapus)")
  }
  for (const a of data.authInfoToDelete) {
    console.log(`   - ${a.email}  (authId: ${a.authId})`)
  }

  console.log(`\n${garisTipis()}`)
  console.log(`\n🔏 AKUN AUTH YANG DI-BYPASS (authId dipakai bersama akun yang DIHAPUS)\n   — TIDAK dihapus dari Supabase: ${data.authSharedKept.length} akun`)
  for (const a of data.authSharedKept) {
    console.log(`   - ${a.email}  (authId: ${a.authId})`)
  }

  console.log(`\n${garisTipis()}`)
  console.log(`\n🗑️  GURU YANG DISETUJUI DIHAPUS — ${data.guruDisetujui.length} akun (diinput manual oleh pemilik):`)
  console.log("   Dihapus beserta profil gurus, akun Supabase Auth, dan penugasan GuruKelas-nya.\n")
  if (data.guruDisetujui.length === 0) {
    console.log("   (tidak ada guru yang disetujui untuk dihapus)")
  }
  for (const g of data.guruDisetujui) {
    console.log(`   - [${g.isAdmin ? "isAdmin" : "guru"}] ${g.nama}  <${g.email}>`)
  }

  console.log(`\n${garisTipis()}`)
  console.log(`\n✅ YANG DIPERTAHANKAN (tidak dihapus):\n`)
  console.log(`   Jenjang               : ${dipertahankan.jenjang}`)
  console.log(`   Kelas (+waliKelasId)  : ${dipertahankan.kelas}`)
  console.log(`   PeriodeAjaran         : ${dipertahankan.periodeAjaran}`)
  console.log(`   Akun GURU total       : ${dipertahankan.guruTotal} (termasuk ${dipertahankan.guruWhitelist} Guru Admin isAdmin=true)`)
  console.log(`   Akun ADMIN_KEUANGAN   : ${dipertahankan.adminKeuangan}`)
  console.log(`   SUPER_ADMIN / ADMIN_AKADEMIK : ${dipertahankan.superAdminAkademik}`)
  console.log(`   Ekstrakurikuler       : ${dipertahankan.ekstrakurikuler}`)

  console.log(`\n${garisTipis()}`)
  console.log(`\n⚠️  REKOMENDASI TINJAUAN MANUAL — GURU yang tampak seperti data uji (${data.guruTerdugaUji.length}):\n`)
  console.log("   Akun berikut TIDAK dihapus otomatis oleh script ini. Silakan ditinjau")
  console.log("   dan diputuskan manual (hapus/pindahkan) oleh admin sekolah.\n")
  if (data.guruTerdugaUji.length === 0) {
    console.log("   (tidak ada guru yang terdeteksi)")
  }
  for (const g of data.guruTerdugaUji) {
    console.log(`   - [${g.isAdmin ? "isAdmin" : "guru"}] ${g.nama}  <${g.email}>  → ${g.alasan}`)
  }

  console.log(`\n${garis()}`)
}

function tampilkanInstruksiEksekusi(): void {
  console.log("\nUntuk benar-benar menghapus data di atas, jalankan:")
  console.log("   npx tsx scripts/cleanup-data-uji-coba.ts --eksekusi\n")
  console.log("Mode preview ini TIDAK mengubah data apapun.\n")
}

// ────────────────────────────────────────────────────────────────────────────
// EKSEKUSI PENGHAPUSAN DB (SATU TRANSACTION)
// ────────────────────────────────────────────────────────────────────────────

interface HasilDb {
  tercapai: Record<string, number>
}

async function eksekusiDatabase(data: DataPreview): Promise<HasilDb> {
  const { siswaIds, ortuIdTerhapus, guruIdsDihapus } = data

  // Filter deleteMany User (siswa/ortu) memakai PENGAMAN_USER (pengaman hardcoded).
  const userIdsDihapus = data.userDihapus.map((u) => u.id)
  const whereUser: Prisma.UserWhereInput = {
    ...PENGAMAN_USER,
    id: { in: userIdsDihapus },
  }

  // ⚠️ GURU yang disetujui dihapus — query terpisah dengan filter struktural
  // sendiri: email persis di GURU_DISETUJUI_DIHAPUS + role wajib GURU +
  // isAdmin=false. GURU+isAdmin=true, ADMIN_KEUANGAN, SUPER_ADMIN, dan
  // ADMIN_AKADEMIK TIDAK MUNGKIN tertarik query ini (filter NOT + role persis).
  const whereGuruDisetujui: Prisma.UserWhereInput = {
    email: { in: GURU_DISETUJUI_DIHAPUS.map((g) => g.email) },
    role: Role.GURU,
    isAdmin: false,
    NOT: {
      OR: [
        { role: Role.GURU, isAdmin: true },
        { role: Role.ADMIN_KEUANGAN },
        { role: Role.SUPER_ADMIN },
        { role: Role.ADMIN_AKADEMIK },
      ],
    },
  }

  const hasil: Record<string, number> = {}

  // Informasi untuk memudahkan mengecek jumlah di preview (read-only inline).
  const mul = "deleteMany"

  await prisma.$transaction(
    async (tx) => {
      // ── 1. Turunan Ujian (soal/opsi/jawaban/pengerjaan) ──
      hasil["RiwayatPengumpulanTugas"] = (await tx.riwayatPengumpulanTugas[mul]({})).count
      hasil["JawabanSiswa"] = (await tx.jawabanSiswa[mul]({})).count
      hasil["OpsiJawaban"] = (await tx.opsiJawaban[mul]({})).count
      hasil["SoalUjian"] = (await tx.soalUjian[mul]({})).count

      // ── 2. Turunan (Siswa) — seluruh row terikat ke siswa/ujian/tugas yang dihapus ──
      hasil["PembayaranSiswa"] = (await tx.pembayaranSiswa[mul]({})).count
      hasil["RiwayatKelasSiswa"] = (await tx.riwayatKelasSiswa[mul]({ where: { siswaId: { in: siswaIds } } })).count
      hasil["NilaiRapor"] = (await tx.nilaiRapor[mul]({ where: { siswaId: { in: siswaIds } } })).count
      hasil["Absensi"] = (await tx.absensi[mul]({ where: { siswaId: { in: siswaIds } } })).count
      hasil["CatatanRapor"] = (await tx.catatanRapor[mul]({ where: { siswaId: { in: siswaIds } } })).count
      hasil["AnggotaEkskul"] = (await tx.anggotaEkskul[mul]({ where: { siswaId: { in: siswaIds } } })).count
      hasil["TagihanSiswa"] = (await tx.tagihanSiswa[mul]({ where: { siswaId: { in: siswaIds } } })).count
      hasil["PengumpulanTugas"] = (await tx.pengumpulanTugas[mul]({ where: { siswaId: { in: siswaIds } } })).count
      hasil["PengerjaanUjian"] = (await tx.pengerjaanUjian[mul]({ where: { siswaId: { in: siswaIds } } })).count

      // ── 3. Konten (Ujian/Tugas/Materi) — seluruh record ──
      hasil["Ujian"] = (await tx.ujian[mul]({})).count
      hasil["Tugas"] = (await tx.tugas[mul]({})).count
      hasil["MateriPembelajaran"] = (await tx.materiPembelajaran[mul]({})).count

      // ── 4. Pendaftaran ──
      hasil["BuktiTransferPendaftaran"] = (await tx.buktiTransferPendaftaran[mul]({})).count
      hasil["Pendaftaran"] = (await tx.pendaftaran[mul]({})).count

      // ── 5. Relasi Siswa ↔ OrangTua, lalu entitas induk ──
      hasil["ParentStudent"] = (await tx.parentStudent[mul]({ where: { siswaId: { in: siswaIds } } })).count
      hasil["Siswa"] = (await tx.siswa[mul]({ where: { id: { in: siswaIds } } })).count

      // OrangTua: HANYA yang tidak punya siswa tersisa (setelah link dihapus).
      // Filter `siswa: { none: {} }` = pengaman tambahan — tidak akan pernah
      // menghapus orang tua yang masih terhubung ke siswa yang dipertahankan.
      hasil["OrangTua"] = (await tx.orangTua[mul]({
        where: {
          id: { in: ortuIdTerhapus },
          siswa: { none: {} },
        },
      })).count

      // ── 6. Mata Pelajaran + relasi kelas/guru ──
      // MapelKelas & GuruKelas harus drop dulu sebelum MataPelajaran (FK restrict
      // dari sisi mapel), lalu semua MataPelajaran dihapus.
      hasil["MapelKelas"] = (await tx.mapelKelas[mul]({})).count
      hasil["GuruKelas"] = (await tx.guruKelas[mul]({})).count
      hasil["MataPelajaran"] = (await tx.mataPelajaran[mul]({})).count

      // ── 7. GURU yang disetujui user — profil gurus dulu, lalu row User-nya ──
      hasil["GuruProfile-dihapus"] = (await tx.guru.deleteMany({ where: { id: { in: guruIdsDihapus } } })).count
      hasil["Guru-disetujui"] = (await tx.user[mul]({ where: whereGuruDisetujui })).count

      // ── 8. TERAKHIR: User (siswa & orang tua) — memakai PENGAMAN_USER ──
      hasil["User-dihapus"] = (await tx.user[mul]({ where: whereUser })).count
    },
    { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )

  return { tercapai: hasil }
}

// ────────────────────────────────────────────────────────────────────────────
// PENGHAPUSAN AKUN SUPABASE AUTH (di luar transaction — panggilan API eksternal)
// ────────────────────────────────────────────────────────────────────────────

async function hapusAkunAuth(data: DataPreview): Promise<{ gagal: Array<{ email: string; alasan: string }> }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    const gagal = data.authInfoToDelete.map((a) => ({
      email: a.email,
      alasan: "env NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tidak tersedia",
    }))
    console.log("\n⚠️  SKIP penghapusan akun Supabase Auth: env service-role tidak tersedia.")
    return { gagal }
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const gagal: Array<{ email: string; alasan: string }> = []
  let berhasil = 0

  console.log(`\n🗑️  Menghapus ${data.authInfoToDelete.length} akun Supabase Auth (di luar transaction)...`)
  for (const a of data.authInfoToDelete) {
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(a.authId)
      if (error) {
        gagal.push({ email: a.email, alasan: error.message })
        console.log(`   ✗ ${a.email}  → ${error.message}`)
      } else {
        berhasil++
        console.log(`   ✔ ${a.email}`)
      }
    } catch (err) {
      const pesan = err instanceof Error ? err.message : String(err)
      gagal.push({ email: a.email, alasan: pesan })
      console.log(`   ✗ ${a.email}  → ${pesan}`)
    }
  }

  console.log(`\n✔ Akun Auth berhasil dihapus: ${berhasil}${gagal.length ? `\n✗ Gagal dihapus: ${gagal.length} (lihat daftar)` : ""}`)
  return { gagal }
}

// ────────────────────────────────────────────────────────────────────────────
// KONFIRMASI TERMINAL
// ────────────────────────────────────────────────────────────────────────────

function tanya(pertanyaan: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(pertanyaan, (jawaban) => {
      rl.close()
      resolve(jawaban)
    })
  })
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("⏳  Mengumpulkan data dari database (read-only)...")
  const data = await kumpulkanData()
  verifikasiPengaman(data)
  console.log(`✅ Pengaman hardcoded terverifikasi: ${data.userDihapus.length} user valid untuk dihapus`)

  // ── PREVIEW (default) ──
  if (!MODE_EKSEKUSI) {
    tampilkanPreview(data)
    tampilkanInstruksiEksekusi()
    await prisma.$disconnect()
    return
  }

  // ── EKSEKUSI ──
  tampilkanPreview(data)
  console.log("\n⚠️  ANDA AKAN MENGHAPUS PERMANEN data di atas dari database PRODUCTION.")
  console.log("    INI TIDAK BISA DIBATALKAN.\n")

  const konfirmasi = (await tanya("Ketik 'HAPUS' (huruf besar semua) untuk melanjutkan: ")).trim()
  if (konfirmasi !== "HAPUS") {
    console.log("\n❌ Konfirmasi gagal. Tidak ada data yang dihapus. Proses dibatalkan.")
    console.log('   (Perintah harus persis: HAPUS)\n')
    await prisma.$disconnect()
    process.exitCode = 1
    return
  }

  console.log("\n🚀 Menjalankan penghapusan database dalam SATU transaction (timeout 60 detik)...")
  let hasilDb: HasilDb
  try {
    hasilDb = await eksekusiDatabase(data)
  } catch (err) {
    console.error("\n❌ Transaction gagal — SEMUA di-rollback, tidak ada data yang terhapus.")
    console.error(err)
    await prisma.$disconnect()
    process.exitCode = 1
    return
  }

  console.log("\n" + garis())
  console.log("✅ PENGHAPUSAN DATABASE BERHASIL DIIRANSAKSI (rollback total bila ada error)")
  console.log(garis())
  const urutanUtama = [
    "BuktiTransferPendaftaran", "Pendaftaran",
    "RiwayatPengumpulanTugas", "JawabanSiswa", "OpsiJawaban", "SoalUjian",
    "PembayaranSiswa", "RiwayatKelasSiswa", "NilaiRapor", "Absensi",
    "CatatanRapor", "AnggotaEkskul", "TagihanSiswa", "PengumpulanTugas",
    "PengerjaanUjian", "Ujian", "Tugas", "MateriPembelajaran",
    "ParentStudent", "Siswa", "OrangTua",
    "MapelKelas", "GuruKelas", "MataPelajaran",
    "GuruProfile-dihapus", "Guru-disetujui", "User-dihapus",
  ]
  for (const k of urutanUtama) {
    const nilai = hasilDb.tercapai[k] ?? 0
    console.log(`   ${k.padEnd(26)} : ${String(nilai).padStart(4)}`)
  }
  console.log("")

  // Bandingkan dengan yang dipreview (warna peringatan bila beda).
  const perbedaan = urutanUtama.filter((k) => (hasilDb.tercapai[k] ?? 0) !== (data.counts[k] ?? 0))
  if (perbedaan.length > 0) {
    console.log(`⚠️  Ada perbedaan antara preview dan hasil eksekusi pada: ${perbedaan.join(", ")}`)
  }

  console.log("\n🗑️  Menghapus akun Supabase Auth terkait di luar transaction (kesalahan dicatat saja)...")
  const hasilAuth = await hapusAkunAuth(data)

  if (hasilAuth.gagal.length > 0) {
    console.log("\n" + garis())
    console.log("⚠️  AKUN AUTH GAGAL DIHAPUS — TINDAK LANJUT MANUAL:")
    console.log(garis())
    for (const g of hasilAuth.gagal) {
      console.log(`   - ${g.email}: ${g.alasan}`)
    }
    console.log("\n   Data database sudah terhapus. Akun di atas perlu dibersihkan manual")
    console.log("   lewat Supabase Dashboard (Authentication > Users).\n")
  } else {
    console.log("\n✅ SEMUA akun Supabase Auth terkait berhasil dihapus. Pembersihan selesai.\n")
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error("\n❌ Gagal menjalankan script pembersihan:", err)
  prisma.$disconnect()
  process.exit(1)
})