# Alur Pendaftaran Santri Baru (PPDB)

Dokumen ini menjelaskan alur pendaftaran dari pengisian formulir sampai akun
siswa terbentuk, **seperti yang benar-benar berjalan di kode**. Kalau ada
perbedaan antara dokumen ini dan kode, kodalah yang benar.

Semua nama file di bawah merujuk ke repository ini.

---

## 1. Ringkasan alur

```
   PUBLIK, TANPA LOGIN                     PUBLIK, TANPA LOGIN
   (publik, tanpa login)      │            (publik, tanpa login)
                             │                          │
                             ▼                          ▼
                             │              ┌───────────────────────┐
                             │              │  KIRIM OTP 6 DIGIT    │
                             │              │  ke email orang tua   │
                             │              └───────────┬───────────┘
                             │                          │ masukkan OTP
                             │                          ▼
                             │              ┌───────────────────────┐
                             │              │  VERIFIKASI EMAIL     │
                             │              │  bukti OTP tersimpan  │
                             │              └───────────┬───────────┘
                             │                          │
                             ▼                          ▼
                             │              ┌───────────────────────┐
                             │              │  TRANSFER BANK        │
                             │              │  (rekening di-snapshot)│
                             │                          │
                             │                          ▼
                             │              ┌───────────────────────┐
                             │              │  UNGGAH BUKTI TRANSFER│
                             │              └───────────┬───────────┘
                             │                          │
                             │                          ▼
   ┌─────────────────────────┴──────────────────────────┴──────────┐
   │  PANITIA: /dashboard/verifikasi-pendaftaran                    │
   │    • Lihat berkas + bukti                                      │
   │    • Tandai email terverifikasi (opsional, dengan alasan)       │
   │    • Setujui (DITERIMA)  atau  Tolak (DITOLAK)                 │
   │      ↑ DITERIMA ditolak kalau email belum terverifikasi        │
   └─────────────────────────┬──────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
        DITERIMA                        DITOLAK
   akun ortu + akun siswa      orang tua boleh unggah bukti
   dokumen disalin ke          ulang (status kembali
   bucket berkas-siswa         MENUNGGU_VERIFIKASI)
```

Status pendaftaran (`enum StatusPendaftaran` di `prisma/schema.prisma`):

| Status                | Arti                                            | Siapa yang mengubahnya  |
| --------------------- | ----------------------------------------------- | ----------------------- |
| `MENUNGGU_PEMBAYARAN` | Baru dibuat, belum ada bukti transfer           | `createPendaftaran`     |
| `MENUNGGU_VERIFIKASI` | Bukti transfer sudah diunggah, menunggu panitia | `uploadBuktiTransfer`   |
| `DITERIMA`            | Disetujui, akun sudah dibuat                    | `verifikasiPendaftaran` |
| `DITOLAK`             | Ditolak, ada `alasanPenolakan`                  | `verifikasiPendaftaran` |

Pendaftaran **tidak pernah** kembali ke `MENUNGGU_PEMBAYARAN` setelah
dibuat. Satu-satunya jalan keluar dari `DITOLAK` adalah mengunggah bukti
transfer ulang, yang langsung mengubahnya ke `MENUNGGU_VERIFIKASI`.

---

## 2. Kredensial: ada dua, dan keduanya berbeda

Ini sumber kebingungan paling sering di alur ini. Pendaftaran punya **dua**
kredensial yang berbeda untuk tujuan berbeda:

| Kredensial                                  | Svara                                           | Untuk apa                                        | Perlu orang tua?   |
| ------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ | ------------------ |
| **Nomor pendaftaran** (`REG-2026-00001`)    | Ditampilkan di halaman sukses, dikirim di email | Mengecek status, membuka halaman upload          | Tidak              |
| **Token akses** (32 karakter, `nanoid(32)`) | Ditampilkan sekali di halaman sukses            | Membuktikan "> ini benar-benar saya yang daftar" | Ya, harus disimpan |

Nomor pendaftaran **publik dan bukan rahasia** — orang bisa menebaknya, dan
itulah sebabnya semua halaman upload selalu minta token akses juga.

Token akses **tidak pernah disimpan di database dalam bentuk aslinya**.
Yang disimpan hanya `sha256(token)` di kolom `Pendaftaran.tokenAksesHash`.
Kalau ada yang berhasil mendump isi database, mereka tetap tidak punya
kredensial upload yang berlaku.

Token disimpan di sisi klien (`localStorage`/`sessionStorage` lewat
`src/lib/pendaftaran-token-client.ts`) supaya pengguna tidak perlu mengetik
ulang di halaman berikutnya.

**Masalah yang sudah pernah terjadi:** `sessionStorage` hilang saat tab
ditutup. Pendaftar yang kembali keesokan hari atau dari perangkat lain tidak
lagi punya token. Karena itu ketiga halaman publik
(`upload-dokumen`, `upload-bukti`, dan `VerifikasiEmailForm`) sekarang
menyediakan input token yang bisa diketik manual, dan **token yang diketik
manual ikut disimpan** supaya tidak perlu diketik ulang di halaman berikutnya.

Masa berlaku token: **90 hari** sejak pendaftaran dibuat
(`hitungTokenAksesExpiraAt`). Lewat itu, alur publik mengunci dan pemilik
diarahkan menghubungi panitia.

Token kedaluwarsa menutup **seluruh** alur publik, termasuk verifikasi email
lewat OTP. `verifyOtpVerifikasiEmail` dan `requestOtpVerifikasiEmail` keduanya
menegakkan expiry, sama seperti upload bukti dan upload dokumen — keempatnya
memakai pesan yang sama persis, jadi tidak ada langkah yang menjawab berbeda
untuk token yang sama. Halaman `/pendaftaran/sukses` juga menyembunyikan
form OTP dan menampilkan arahan ke panitia, supaya orang tua tidak dikirim ke
kotak email untuk kode yang pasti ditolak.

---

## 3. Tahap 1 — Mengisi formulir

Halaman: `/pendaftaran`
Komponen: `src/components/pendaftaran/pendaftaran-form.tsx`

Formulir 5 langkah (`const STEPS`, baris 48):

| #   | Label            | Isi                                                                   |
| --- | ---------------- | --------------------------------------------------------------------- |
| 1   | Data Santri      | Nama, tempat/tanggal lahir, jenis kelamin, agama, alamat, NISN, no HP |
| 2   | Orang Tua & Wali | Nama/nohp/email orang tua, ayah kandung, ibu kandung, wali            |
| 3   | Data Tambahan    | Kewarganegaraan, KITAS, asal negara                                   |
| 4   | Jenjang & Kelas  | Jenjang tujuan, opsional pilih kelas                                  |
| 5   | Dokumen          | Unggah KK, akta lahir, pas foto, maks. 3 dokumen tambahan             |

Tombol submit dikunci `isSubmitting` selama request berjalan, jadi klik ganda
tidak menghasilkan dua pendaftaran (lihat bagian 11).

---

## 4. Tahap 2 — Validasi di server

Action: `createPdaughteran` di `src/actions/pendaftaran.ts`

Pemeriksaan berjalan **berurutan**, dan yang gagal pertama langsung
menghentikan proses. Urutannya penting karena beberapa cek cukup mahal
(query database) sehingga tidak dijalankan kalau sudah ada alasan gagal
yang lebih murah.

**4.1 Rate limit per IP** — 30 pendaftaran / 10 menit.
Sengaja longgar: satu IP publik sering dipakai bersama (WiFi sekolah, asrama,
rumah orang tua) dan musim PPDB bisa memicu gelombang pendaftaran sah dari
jaringan yang sama. IP yang tidak bisa ditentukan (`unknown`) **tidak** di-rate
limit.

**4.2 Rate limit per email penerima** — 10 pendaftaran / 24 jam.
Ini batas yang benar-benar menahan dampak, bukan batas per IP. Setiap
pendaftaran yang berhasil memicu satu email ke `emailOrangTua`, jadi penyerang
yang berganti IP tetap bisa membanjiri satu alamat korban dengan email
(harassment / pemborosan kuota email sekolah).

**4.3 Validasi skema** — `pendaftaranSchema.safeParse`
(`src/lib/validations/pendaftaran.ts`). `emailOrangTua` wajib dan harus format
email valid. Error dikembalikan per-field ke formulir.

**4.4 Jenjang dan kelas**

- Jenjang harus ada.
- Kalau kelas dipilih, kelas harus benar-benar milik jenjang itu.
- Gender calon siswa harus cocok dengan kelas khusus (kelas Ikhwan/Akhwat).
- Kelas tidak boleh penuh (`kapasitas > 0 && siswa >= kapasitas`).

**4.5 Cegah duplikasi pendaftaran aktif** — satu email orang tua per jenjang
hanya boleh punya **satu** pendaftaran yang belum final. Pendaftaran
`DITERIMA`/`DITOLAK` tidak memblokir karena sudah keluar dari antrean.
Selengkapnya di bagian 11.

**4.6 Validasi NISN** (bila diisi) — dicek sekaligus terhadap:

- `Siswa.nisn` (sudah jadi siswa) → ditolak, sebut nama pemiliknya.
- Pendaftaran aktif lain dengan NISN sama → ditolak, sebut nomor & statusnya.

Kolom `Siswa.nisn` itu `@unique` di database. Tanpa cek di sini, error
`P2002` akan muncul mentah di layar saat panitia menekan approve.

**4.7 Validasi path dokumen** — `isValidDokumenPath`
Semua path harus benar-benar hasil unggahan form pendaftaran (folder temp).
Menolak path dari bucket lain, URL eksternal, atau alur lain. Maksimal 3
dokumen tambahan.

**4.8 Snapshot biaya** — ketiga komponen biaya + data rekening/kontak WA
diambil dari pengaturan **saat pendaftaran dibuat** dan disimpan ke record.
Perubahan harga atau rekening setelah tanggal itu tidak mengubah
pendaftaran yang sudah ada. Total-biaya selalu dihitung di server, tidak
percaya nilai dari klien.

---

## 5. Tahap 3 — Penyimpanan

`generateNomorPendaftaran()` → `nanoid(32)` untuk token →
`hitungTokenAksesExpiraAt()` → `prisma.pendaftaran.create`.

Field yang ditulis eksplisit:

- `tokenAksesHash: hashTokenAkses(tokenAkses)` — hanya hash
- `emailOrangTuaTerverifikasiAt: null` — **eksplisit**, bukan mengandalkan
  default kolom. Pendaftaran baru selalu belum terverifikasi sampai OTP
  berhasil dimasukkan, sehingga alur publik terkunci sejak detik pertama.
- `emailOrangTuaDiverifikasiOtpAt: null` — lihat bagian "Dua timestamp"
  di bawah.
- `status: "MENUNGGU_PEMBAYARAN"`

Pembuatan dibungkus retry (`MAX_RETRY`) untuk `generateNomorPendaftaran`
yang menghasilkan nomor unik — kalau bentrok, nomor di-generate ulang.

**Respons** hanya mengembalikan `nomorPendaftaran` dan `tokenAkses` asli.
Keduanya tidak pernah disimpan plaintext.

**Email konfirmasi** dikirim lewat `runAfterResponse` — ditunda sampai
response terkirim ke klien, supaya email yang lambat/gagal tidak menunda atau
menggagalkan pendaftaran, tapi juga tidak hilang begitu response terkirim.

---

## 6. Tahap 4 — Verifikasi email orang tua

Halaman: `/pendaftaran/sukses?nomor=REG-...`
Komponen: `src/components/pendaftaran/verifikasi-email-form.tsx`
Action: `src/actions/verifikasi-email.ts`

**Kenapa ini ada:** tanpa verifikasi, siapa pun yang tahu nomor pendaftaran
bisa memicu email ke alamat orang lain, dan pendaftaran fiktif bisa
menghasilkan transaksi palsu yang hanya membuang waktu panitia.

**Syarat request OTP:** `nomorPendaftaran` **dan** `tokenAkses` yang valid.
Nomor saja tidak cukup.

**Aturan OTP:**

| Aturan                | Nilai                                    |
| --------------------- | ---------------------------------------- |
| Panjang kode          | 6 digit                                  |
| Masa berlaku          | 10 menit (`OTP_EXPIRY_MINUTES`)          |
| Cooldown resend       | 60 detik (`OTP_RESEND_COOLDOWN_SECONDS`) |
| Maks. percobaan gagal | 3 (`OTP_MAX_ATTEMPTS`)                   |
| Penyimpanan           | bcrypt hash, bukan plaintext             |
| Rate limit            | per IP                                   |

Alur `requestOtpVerifikasiEmail` berjalan seperti ini:

1. Cari pendaftaran, bandingkan token dengan `timingSafeEqual`.
2. Tolak bila cooldown belum habis.
3. Hapus OTP kedaluwarsa milik pendaftaran tersebut, lalu tandai OTP lama
   sebagai dipakai supaya hanya ada satu yang berlaku.
4. Buat OTP baru (bcrypt hash), kirim email.

**Short-circuit**: kalau `emailOrangTuaDiverifikasiOtpAt` sudah terisi,
request langsung ditolak — tidak ada OTP kedua yang dikirim ke email yang
sudah dibuktikan pemiliknya.

OTP yang sudah dipakai atau kedaluwarsa ditolak tanpa membocorkan bedanya.

**Setelah verifikasi berhasil**, `emailOrangTuaDiverifikasiOtpAt` terisi dan
`emailOrangTuaTerverifikasiAt` juga terisi, lalu halaman sukses membuka:
instruksi pembayaran, tombol unggah dokumen, dan tombol unggah bukti transfer.

### Dua timestamp, kenapa dibedakan

| Kolom                            | Arti                                                                                               | Diisi oleh                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `emailOrangTuaTerverifikasiAt`   | **Gerbang.** Apakah gerbang upload/approval boleh dibuka.                                          | OTP berhasil, atau grandfathering, atau verifikasi manual committee |
| `emailOrangTuaDiverifikasiOtpAt` | **Bukti.** Apakah ada bukti nyata (kode 6 digit) bahwa pemilik email mengonfirmasi kepemilikannya. | **Hanya** OTP berhasil. Tidak pernah diisi otomatis.                |

Menyatukan keduanya jadi satu kolom akan menghapus satu informasi yang
dipakai ambil keputusan: committee perlu tahu mana yang terverifikasi lewat
bukti dan mana yang warisan. Pendaftaran lama punya gerbang tapi tidak punya
bukti — itu memang berbeda risikonya, dan tidak boleh disamarkan.

Konsekuensi di UI (`/pendaftaran/sukses` → `verifikasi-email-form.tsx`):

- Gerbang kosong → form **wajib** masuk. Tanpa ini tidak ada upload.
- Gerbang terisi, bukti kosong → form **opsional** ("upgrade"). Tidak
  membuka apa pun yang belum terbuka, hanya menambah bukti.
- Bukti terisi → form **hilang permanen**.

---

## 7. Tahap 5 — Transfer bank

Rekening yang tampil adalah **snapshot** dari saat pendaftaran dibuat
(`bankNama`, `bankNoRekening`, `bankAtasNama`, `kontakWa`), bukan pembacaan
langsung ke pengaturan saat ini. Kalau kolom snapshot kosong (pendaftaran
lama), halaman jatuh ke pengaturan yang berlaku.

Pengguna diminta menulis nomor pendaftaran sebagai keterangan transfer, lalu
konfirmasi ke WhatsApp panitia.

---

## 8. Tahap 6 — Mengunggah bukti transfer

Halaman: `/pendaftaran/{nomor}/upload-bukti`
Komponen: `src/components/pendaftaran/upload-bukti-form.tsx`
Action: `src/actions/bukti-transfer.ts`

Gerbang yang harus dilalui, **berurutan**:

1. Pendaftaran ada dan tidak dihapus.
2. Token akses cocok (timing-safe, pesan generik).
3. Status adalah `MENUNGGU_PEMBAYARAN` **atau** `DITOLAK`.
4. Token belum kedaluwarsa (90 hari).
5. `emailOrangTuaTerverifikasiAt` terisi.

Baris 5 dicek **sesudah** token, bukan sebelum, supaya penyerang tanpa
token tetap mendapat pesan kredensial yang sama dan tidak bisa memetakan
status pendaftaran.

Alasannya adalah "mencegah pendaftaran fiktif menghasilkan transaksi
palsu bagi panitia".

Berhasil → status berubah ke `MENUNGGU_VERIFIKASI` dan `alasanPenolakan`
dikosongkan. Bila penulisan DB gagal, file yang barusan diunggah **dihapus**
supaya tidak jadi berkas yatim.

---

## 9. Tahap 7 — Verifikasi oleh panitia

Dashboard: `/dashboard/verifikasi-pendaftaran`
Action: `verifikasiPendaftaran` di `src/actions/verifikasi.ts`

**DITERIMA** — **gerbang email dicek lebih dulu.** Bila
`emailOrangTuaTerverifikasiAt` masih kosong, approval ditolak dan tidak ada
akun yang dibuat. Alasannya: approval membuat akun orang tua + siswa lalu
mengirim kredensial ke alamat email itu. Tanpa cek, satu klik panitia
membypass seluruh tujuan OTP.

Yang dicek adalah kolom **gerbang**, bukan kolom **bukti OTP** — supaya
pendaftaran lama yang hanya punya grandfathering tidak terkunci selamanya di
kepala committee. Penolakan (**DITOLAK**) tidak melewati gerbang ini, karena
menolak tidak membuat akun apa pun dan harus selalu bisa dilakukan.

Baru setelah gerbang lolos, sisanya berjalan dalam satu transaksi Prisma
(`timeout: 15000, maxWait: 5000`):

1. Cari/buat user **ORANG_TUA** di `auth.users`.
2. Cari/buat record `OrangTua`.
3. Cari/buat user **SISWA** + record `Siswa`.
4. Pasang relasi `ParentStudent`.
5. Tandai bukti transfer terakhir sebagai `DITERIMA`.
6. Ubah pendaftaran jadi `DITERIMA`, catat admin, kelas tujuan, siapa yang
   memverifikasi, dan kapan.

Kalau transaksi gagal, user auth yang **baru dibuat** dihapus kembali
(`cleanupAuthUsers`) supaya tidak ada akun yatim tanpa data siswa.

**Penyalinan dokumen** dilakukan **setelah** transaksi commit, bukan di
dalamnya:

- ID siswa baru hanya ada setelah commit, sedangkan path tujuan butuh
  `siswaId`.
- I/O storage di dalam transaksi menahan lock DB terlalu lama, dan rollback
  transaksi tidak akan membatalkan file yang sudah tercopy.

Dokumen disalin dari bucket `dokumen-pendaftaran` ke `berkas-siswa` dengan
format `berkas-siswa/{siswaId}/{kategori}/{nanoid}.{ext}`. Kegagalan satu
berkas tidak membatalkan approval — berkas gagal dibiarkan kosong agar wali
bisa mengunggah ulang dari dashboard.

Bila salin berhasil tapi penulisan path ke DB gagal, file yang sudah tercopy
**dihapus** supaya tidak menggantung sebagai arsip PII yang tidak tertaut.
Kegagalan penghapusan tidak membatalkan approval (statusnya sudah final).

**Email kredensial** dikirim setelah itu. Perbedaan penting:

- Akun ortu **baru** → kirim kredensial lengkap (ortu + siswa).
- Akun ortu **sudah ada** (anak kedua) → reuse `authId`, kirim kredensial
  siswa saja, tanpa password ortu yang baru.

**DITOLAK** — butuh `alasanPenolakan`, disimpan dan tampilkan di
`/cek-pendaftaran`. Pendaftaran yang ditolak masih boleh mengunggah bukti
transfer ulang.

Badge pada daftar panitia membedakan tiga kondisi, karena ketiganya berarti
hal berbeda:

| Kondisi                      | Arti                                          | Bisa disetujui           |
| ---------------------------- | --------------------------------------------- | ------------------------ |
| **Email belum diverifikasi** | Tidak ada bukti kepemilikan email sama sekali | Tidak                    |
| **Verifikasi warisan**       | Gerbang terbuka, tapi tanpa bukti OTP         | Ya, dengan kehati-hatian |
| (tanpa badge)                | Terverifikasi dengan bukti OTP                | Ya                       |

Pendaftaran yang emailnya belum terverifikasi tidak akan menggantung tanpa
keterahuan: badge terlihat di daftar, dan approval-nya ditolak dengan pesan
yang menyebutkan jalan keluarnya.

### Jalur keluar: verifikasi manual committee

`verifikasiPendaftaran` menolak, tapi bukan jalan buntu. Action
`tandaiEmailPendaftaranTerverifikasi` di
`src/actions/verifikasi-email-manual.ts` menyediakan jalur manual untuk
pendaftar yang kehilangan token aksesnya — committee mengonfirmasi langsung
ke orang tua (mis. telepon), lalu menekan tombol dengan **alasan wajib**
(min. 10 karakter).

**Tempatnya:** di dalam dialog detail berkas pada
`/dashboard/verifikasi-pendaftaran`. Panel amber "Email Belum Terverifikasi"
muncul saat status **bukan** `DITERIMA` dan email belum terverifikasi, dengan
tombol "Tandai Email Terverifikasi Manual".

Kondisi nyata yang ditangani tombol ini: pendaftaran yang tersangkut di
`MENUNGGU_PEMBAYARAN` karena pendaftar kehilangan token akses. Di sana tidak
ada jalan OTP sama sekali, jadi tanpa tombol ini pendaftaran itu buntu
permanen.

**Alurnya:**

1. Panitia membuka detail berkas yang tertahan.
2. Panel amber muncul: pendaftaran tidak bisa disetujui selama email belum
   terverifikasi.
3. Minta orang tua membuka email dan memasukkan OTP (jalur utama — hanya
   mungkin selama token aksesnya masih berlaku, yaitu 90 hari sejak
   pendaftaran dibuat).
4. Bila tidak memungkinkan, panitia menekan tombol tersebut, mengonfirmasi ke
   orang tua via telepon `{noHpOrangTua}`, lalu mengetik alasannya.
5. Tombol aktif hanya setelah alasan minimal 10 karakter; server juga
   menolak bila alasan kurang dari itu.
6. Gerbang terisi; badge berubah dari "Email belum diverifikasi" menjadi
   "Verifikasi warisan"; approval berikutnya bisa lewat.
7. Alasan tersimpan permanen di tiga kolom khusus (lihat bagian berikut), jadi
   tidak hilang saat pendaftaran disetujui. Badge berubah dari "Email belum
   diverifikasi" menjadi "Verifikasi manual".

Yang perlu diketahui soal action ini:

- Hanya untuk role admin committee.
- Alasan disimpan permanen di `catatanAdmin` bersama nama admin dan
  waktunya, jadi "mengapa ini diverifikasi" bisa diaudit.
- `emailOrangTuaDiverifikasiOtpAt` **tidak** diisi. Baris ini tetap
  tercatat sebagai "terverifikasi tanpa bukti OTP" dan badge **Verifikasi
  warisan** tetap muncul — jejaknya tidak hilang, dan manual vs OTP masih
  bisa dibedakan lewat isi `catatanAdmin`.
- Ditolak untuk pendaftaran yang sudah `DITERIMA`/`DITOLAK`, atau yang
  emailnya sudah terverifikasi.
- Catatan admin lama tidak ditimpa, dan hasilnya juga ditulis ke `catatanAdmin`
  supaya alasannya langsung terlihat di panel yang sedang dibaca. Tapi
  `catatanAdmin` **ditimpa** oleh `verifikasiPendaftaran` saat approval.

### Jejak manual yang kekal

Karena `catatanAdmin` bisa hilang, jejaknya disimpan di tiga kolom terpisah
yang tidak disentuh approval mana pun:

| Kolom | Isi |
|---|---|
| `email_orang_tua_diverifikasi_manual_at` | kapan diverifikasi |
| `email_orang_tua_diverifikasi_manual_oleh_id` | akun admin yang melakukan |
| `alasan_verifikasi_email_manual` | alasan yang diketik admin |

Migration `20260929010000_pisah_jejak_verifikasi_email_manual` menambah kolom
kolom itu beserta index dan `CHECK` constraint: ketiga kolom harus terisi
**semua** atau **tidak sama sekali**, jadi tidak mungkin ada keadaan setengah
("waktu ada tapi alasan kosong"). Tidak di-backfill — grandfathering bukan
verifikasi manual, dan mengisinya untuk data lama akan mendistorsi laporan.

Konsekuensinya, badge di panel sekarang bisa membedakan tiga kondisi yang
tadinya dua:

| Badge | Arti | Bukti |
|---|---|---|
| Email belum diverifikasi | gerbang tertutup | — |
| Verifikasi manual | ada admin yang konfirmasi langsung | kolom manual terisi |
| Verifikasi warisan | grandfathering, tanpa bukti & tanpa siapa | kolom manual kosong |

Keterbatasan yang tersisa: `catatanAdmin` masih perlu dibaca kalau ingin tahu
alasan **tepat saat** verifikasi manual dilakukan, karena setelah approval
kolom itu tergantikan. Sumber kebenaran yang bertahan adalah tiga kolom di
atas. Kalau suatu saat ditambah audit log generik untuk aksi admin, tiga kolom
ini sebaiknya jadi titik integrasinya, bukan `catatanAdmin`.

---

## 10. Tahap 8 — Cek status

Halaman: `/cek-pendaftaran`
API: `src/app/api/cek-pendaftaran/route.ts` (`GET`, publik)

Rate limit berlapis: 5 request/menit per IP, plus 10 request/menit untuk
**satu nomor yang sama** (anti-probing yang memetakan status satu
nomor). Keluarannya 429 dengan header `Retry-After`.

Data yang dikembalikan sudah dipangkas demi privasi:

| Dikembalikan                                    | Tidak dikembalikan                        |
| ----------------------------------------------- | ----------------------------------------- |
| Nomor pendaftaran                               | Nama lengkap (**dimaskir**: `Ahmad F***`) |
| Status                                          | Alamat, no HP, email                      |
| Jenjang & kelas                                 | Path dokumen                              |
| Alasan penolakan (punya pendaftar sendiri)      | Timestamp verifikasi email                |
| `emailTerverifikasi` (boolean, bukan timestamp) |                                           |
| Tanggal dibuat                                  |                                           |

`emailTerverifikasi` sengaja hanya boolean — endpoint ini publik dan tidak
perlu membocorkan kapan email diverifikasi. Nilainya hanya untuk menyembunyikan
link upload yang pasti ditolak server.

### Peta status (state machine)

```
  (baru) ──createPendaftaran──▶ MENUNGGU_PEMBAYARAN
                                   │   gerbang: belum bisa bayar / unggah
                                   │   BUTUH gerbang email untuk lanjut
                                   ▼
                           MENUNGGU_VERIFIKASI
                                   │   bukti sudah masuk, berkas boleh
                                   │   PASTI punya gerbang email
                        ┌──────────┴──────────┐
                        ▼                     ▼
                   DITERIMA               DITOLAK ──┐
                  (final)                     │       │ bukti
                                                └───────┘ upload ulang
                                                         ▼
                                                MENUNGGU_VERIFIKASI
```

Hanya tiga action yang menulis status non-terminal:
`bukti-transfer.ts` (→ `MENUNGGU_VERIFIKASI`) dan `verifikasi.ts`
(→ `DITERIMA` / `DITOLAK`). `upload-dokumen.ts` hanya menulis path berkas.

**Konsekuensi yang penting:** `MENUNGGU_VERIFIKASI` hanya bisa dicapai lewat
`uploadBuktiTransfer`, dan action itu mewajibkan gerbang email. Maka **tidak
ada baris berstatus `MENUNGGU_VERIFIKASI` atau `DITERIMA` yang bisa punya
gerbang email tertutup** — bukan karena dioleh, tapi karena memang tidak
terjangkau secara struktural.

Dua hal yang folgt dari ini:

- Cek gerbang di `verifikasiPendaftaran` bersifat **defense-in-depth**, bukan
  sadari jalur yang bisa terpicu. Tetap dipertahankan karena biayanya nol dan
  melindungi kalau suatu saat ada action baru yang menulis `DITERIMA`.
- Satu-satunya state tempat orang tua **benar-benar tersangkut** adalah
  `MENUNGGU_PEMBAYARAN` dengan gerbang tertutup: tidak bisa membayar, karena
  `uploadBuktiTransfer` menolaknya. Di sinilah jalur verifikasi manual committee
  benar-benar dibutuhkan — panel amber di dashboard sengaja tidak dipatok di
  `MENUNGGU_VERIFIKASI` karena di sana mustahil muncul.

`alur-pendaftaran.e2e.test.ts` menjaga kedua kesimpulan ini.

### Apa yang ditampilkan per status

Tabel `KEMAMPUAN_BY_STATUS` di `src/app/cek-pendaftaran/kemampuan-status.ts`
adalah satu-satunya tempat yang menentukan tombol mana yang muncul. Isinya
cermin gate `bukti-transfer.ts` dan `upload-dokumen.ts`:

| Status                | Bukti bayar | Berkas | Alasan                                                     |
| --------------------- | ----------- | ------ | ---------------------------------------------------------- |
| `MENUNGGU_PEMBAYARAN` | ya          | ya     | baru daftar, belum bayar                                   |
| `MENUNGGU_VERIFIKASI` | **tidak**   | ya     | bayarannya sudah masuk, tapi berkas masih boleh dilengkapi |
| `DITOLAK`             | ya          | tidak  | bisa bayar ulang untuk banding                             |
| `DITERIMA`            | tidak       | tidak  | pindah ke dashboard wali                                   |

Dua hal yang mudah disalahpahami di sini:

- **`MENUNGGU_VERIFIKASI` tidak mematikan semua aksi.** Menunggu verifikasi
  bukan berarti berkas sudah final. Hanya tombol bukti pembayaran yang hilang,
  karena pembayarannya memang sudah diterima.
- **`DITERIMA` tidak sekadar disembunyikan**, tapi diberi tahu ke mana harus
  pergi: kredensial sudah dikirim, file dilanjutkan dari dashboard wali.
  Menyembunyikan tombol tanpa penjelasan hanya memunculkan pertanyaan "kalau
  tidak di sini, lalu di mana?".

`kemampuan-status.test.ts` membandingkan tabel ini dengan gate server secara
eksplisit, supaya keduanya tidak bisa melenceng diam-diam. Kalau salah satu
diubah, test itu harus ikut diperbarui — itu memang yang dikehendaki.

---

## 11. Batas yang diketahui dan sengaja dibiarkan

### 11.1 Duplikasi pendaftaran akibat request bersamaan

`createPendaftaran` melakukan `findFirst` lalu `create` — **check-then-act
tanpa constraint di database**. Dua request yang benar-benar bersamaan bisa
dua-duanya lolos, lalu sama-sama membuat baris.

- Jendelanya hanya beberapa milidetik.
- Tombol submit sudah dikunci `isSubmitting` di sisi klien, jadi klik ganda
  — pemicu paling umum — sudah tertutup.
- Yang masih bisa lolos: mengisi formulir di dua tab/perangkat, atau koneksi
  yang terputus lalu mengirim ulang.

Kalau terjadi, satu anak punya **dua nomor pendaftaran**. Bukan kebocoran data
dan bukan kerusakan diam-diam: status hanya berubah setelah ada manusia yang
menekan tombol di panitia. Committee cukup menolak/menghapus baris berlebih
— dua nama dengan email sama berdampingan, jadi mudah dikenali.

Tapi kalau committee tidak menyadari dan menyetujui keduanya, dua record
`Siswa` terbentuk di bawah satu orang tua. `auth.users` sengaja dipakai ulang
antar anak, jadi approval kedua **tidak** akan gagal dengan error email
duplikat — keduanya benar-benar lolos.

**Penutupannya yang rapi adalah partial unique index di database**, tapi itu
tidak bisa ditulis di `prisma/schema.prisma`: Prisma 6.19 tidak mendukung
klausa `WHERE` pada `@@unique`. Index harus dibuat lewat SQL mentah, dan
karena tidak bisa direpresentasikan di schema, Prisma akan menandainya sebagai
drift dan **drop** saat `prisma migrate dev` berikutnya. Itu jebakan senyap
untuk siapa pun yang menjalankan migrasi nanti.

Kalau suatu saat index itu ditambahkan, `prisma migrate dev` wajib diberi tahu
index tersebut ada supaya tidak terhapus diam-diam.

### 11.2 Tabel token tidak pernah dibersihkan

`otp_verifikasi_email` dan `password_reset_tokens` tidak punya cron
pembersih. `requestOtpVerifikasiEmail` membersihkan baris kedaluwarsa milik
pendaftaran yang sedang diproses, tapi pendaftaran yang ditinggalkan menyisakan
beberapa baris. Volumennya kecil dan konsisten dengan tabel yang sudah ada
sebelumnya, jadi cron baru dianggap berlebihan dibanding masalahnya.

### 11.3 Bukti OTP dan verifikasi manual tidak bisa dibedakan dari kolomnya

Kolom `emailOrangTuaTerverifikasiAt` adalah gerbang, `emailOrangTuaDiverifikasiOtpAt`
adalah bukti. Verifikasi manual committee mengisi gerbang saja — itu disengaja
supaya status "tanpa bukti OTP" tetap terbaca dan tidak ikut tertimpa.

Konsekuensinya, satu baris tidak bisa berstatus "terverifikasi manual" sekaligus
punya bukti OTP, dan laporan berapa yang manual vs berapa yang lewat OTP harus
dibaca dari `catatanAdmin`, bukan dari kolom.

---

## 12. Peta file

| Peran                               | File                                                              |
| ----------------------------------- | ----------------------------------------------------------------- |
| Action pembuatan                    | `src/actions/pendaftaran.ts`                                      |
| Skema validasi                      | `src/lib/validations/pendaftaran.ts`                              |
| Formulir 5 langkah                  | `src/components/pendaftaran/pendaftaran-form.tsx`                 |
| Halaman sukses                      | `src/app/pendaftaran/sukses/page.tsx`                             |
| Hash & validasi token               | `src/lib/pendaftaran-token.ts`                                    |
| Token sisi klien                    | `src/lib/pendaftaran-token-client.ts`                             |
| Action OTP email                    | `src/actions/verifikasi-email.ts`                                 |
| Verifikasi email manual (committee) | `src/actions/verifikasi-email-manual.ts`                          |
| Form OTP                            | `src/components/pendaftaran/verifikasi-email-form.tsx`            |
| Unggah dokumen                      | `src/actions/upload-dokumen.ts`                                   |
| Unggah bukti transfer               | `src/actions/bukti-transfer.ts`                                   |
| Halaman unggah (server gate)        | `src/app/pendaftaran/[nomor]/upload-{dokumen,bukti}/page.tsx`     |
| Form unggah                         | `src/components/pendaftaran/upload-{dokumen,bukti}-form.tsx`      |
| Verifikasi panitia                  | `src/actions/verifikasi.ts`                                       |
| Dashboard panitia                   | `src/components/dashboard/verifikasi-pendaftaran-page-client.tsx` |
| Cek status (API)                    | `src/app/api/cek-pendaftaran/route.ts`                            |
| Kemampuan per status (cek status)   | `src/app/cek-pendaftaran/kemampuan-status.ts`                     |
| Cek status (halaman)                | `src/app/cek-pendaftaran/page.tsx`                                |
| Biaya PPDB                          | `src/lib/biaya-ppdb-server.ts`                                    |
| Template email                      | `src/lib/email.ts`                                                |
| Rate limit                          | `src/lib/rate-limit.ts`                                           |
| Skema database                      | `prisma/schema.prisma`                                            |
