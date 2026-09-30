# Alur Pendaftaran Santri Baru (PPDB)

Dokumen ini menjelaskan alur pendaftaran dari pengisian formulir sampai akun
siswa terbentuk, **seperti yang benar-benar berjalan di kode**. Kalau ada
perbedaan antara dokumen ini dan kode, kodalah yang benar.

Semua nama file di bawah merujuk ke repository ini.

---

## 1. Ringkasan alur

```
   PUBLIK, TANPA LOGIN
   (publik, tanpa login)
          │
          │  isian form 5 langkah
          ▼
   ┌──────────────────────────────┐
   │  DRAFT OTOMATIS (hybrid)     │
   │  • localStorage (debounce    │
   │    800 ms) — selalu ada      │
   │  • draft server bertoken      │
   │    (TTL 30 hari)             │
   │  • Token Lanjutkan Draft     │
   │    untuk pindah perangkat    │
   └──────────────┬───────────────┘
                  │ submit (draftToken ikut terkirim)
                  ▼
   ┌──────────────────────────────┐
   │  createPendaftaran           │
   │  SATU TRANSAKSI DB:          │
   │  • buat record Pendaftaran   │
   │  • finalisasi draft          │
   │  (gagal salah satu →         │
   │   keduanya batal)            │
   └──────────────┬───────────────┘
                  │ status: MENUNGGU_PEMBAYARAN
                  │ email konfirmasi = NOTIFIKASI saja,
                  │   bukan gerbang apa pun
                  ▼
          TRANSFER BANK
          (rekening di-snapshot)
                  │
                  ▼
          UNGGAH BUKTI TRANSFER
                  │ status: MENUNGGU_VERIFIKASI
                  ▼
   ┌──────────────────────────────────────────────────────┐
   │  PANITIA: /dashboard/verifikasi-pendaftaran          │
   │    • Lihat berkas + bukti                            │
   │    • KONFIRMAKSI KONTAK WALI (WAJIB, diisi manual:   │
   │      kapan, siapa, lewat apa, catatan)                │
   │    • Setujui (DITERIMA) atau Tolak (DITOLAK)          │
   │      ↑ DITERIMA ditolak bila kontak wali belum       │
   │        dikonfirmasi                                  │
   └────────────────────────┬─────────────────────────────┘
                            │
             ┌──────────────┴──────────────┐
             ▼                             ▼
       DITERIMA                        DITOLAK
  akun ortu + akun siswa      orang tua boleh unggah bukti
  dokumen disalin ke          ulang (status kembali
  bucket berkas-siswa         MENUNGGU_VERIFIKASI)

  SETELAH DITERIMA: alur publik (upload via nomor + token)
  DITUTUP total. Pelengkapan berkas hanya lewat Dashboard Wali.
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

| Kredensial                                  | Sifat                                           | Untuk apa                                        | Perlu orang tua?   |
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
lagi punya token. Karena itu kedua halaman publik (`upload-dokumen` dan
`upload-bukti`) menyediakan input token yang bisa diketik manual, dan **token
yang diketik manual ikut disimpan** supaya tidak perlu diketik ulang di halaman
berikutnya.

Masa berlaku token: **90 hari** sejak pendaftaran dibuat
(`hitungTokenAksesExpiraAt`). Lewat itu, alur publik mengunci dan pemilik
diarahkan menghubungi panitia.

Token kedaluwarsa menutup **seluruh** alur publik: upload dokumen dan upload
bukti menolak dengan pesan yang sama. Halaman `/pendaftaran/sukses`
menampilkan arahan ke panitia, dan tidak ada lagi kotak masuk yang perlu dicek
— pemulihannya sekarang lewat **Token Lanjutkan Draft** (§6) atau lewat
permintaan ke panitia.

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
tidak menghasilkan dua pendaftaran (lihat bagian 11). Sisa isian disimpan
otomatis sebagai draft di dua lapisan, dan `draftToken` ikut terkirim saat
submit supaya draft bisa difinalisasi di transaksi yang sama (§5, §6).

---

## 4. Tahap 2 — Validasi di server

Action: `createPendaftaran` di `src/actions/pendaftaran.ts`

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

## 5. Tahap 3 — Penyimpanan (satu transaksi)

`generateNomorPendaftaran()` → `nanoid(32)` untuk token →
`hitungTokenAksesExpiraAt()` → lalu **satu** `prisma.$transaction`.

Di dalam transaksi, berurutan:

1. Kalau klien mengirim `draftToken`, **baca draft lewat `tx`** (bukan lewat
   `prisma` di luar transaksi):
   - sudah `finalizedAt` → kembalikan nomor yang sudah ada, **tanpa membuat
     baris baru dan tanpa token baru** (retry/submit ganda).
   - belum final → lanjut.
2. `tx.pendaftaran.create({ ... })`.
3. Kalau ada `draftToken`: `tx.pendaftaranDraft.updateMany({ where:
   { resumeTokenHash, finalizedAt: null }, ... })` dan **wajib** hasilnya tepat
   1 baris.

Field yang ditulis eksplisit:

- `tokenAksesHash: hashTokenAkses(tokenAkses)` — hanya hash.
- `emailOrangTuaTerverifikasiAt: null` — **eksplisit**, bukan mengandalkan
  default kolom. Kolom ini sudah legacy (lihat bagian "Kolom legacy") dan
  **tidak lagi jadi gerbang apa pun**; diisi `null` supaya baris baru tidak
  pernah menyamar punya verifikasi email.
- `status: "MENUNGGU_PEMBAYARAN"`

Pembuatan record dibungkus retry (`MAX_RETRY`) untuk
`generateNomorPendaftaran` yang menghasilkan nomor unik — kalau bentrok
(`P2002` pada `nomor_pendaftaran`), nomor di-generate ulang.

### Kenapa finalisasi draft harus satu transaksi

Kalau create dan finalisasi draft dua operasi terpisah, ada jeda di mana
pendaftaran sudah ada tapi draft belum ditandai final. Submit ulang dengan
token yang sama (klik ganda, koneksi putus lalu di-retry, dua tab) akan
lolos pengecekan "sudah final? belum" dan **membuat nomor pendaftaran kedua**
untuk anak yang sama.

Perbaikannya bukan "cek lagi lalu skip", tapi **membuat kondisi itu tidak
mungkin terjadi**:

- `updateMany` bersyarat `finalizedAt: null` berarti hanya satu transaksi
  yang bisa mem-finalisasi draft tersebut.
- Kalau hasilnya 0 row, berarti request lain sudah finalize duluan. Transaksi
  ini **dilempar sentinel `DraftFinalizedBersamaanError` → ROLLBACK**, jadi
  record pendaftaran yang barusan dibuat ikut hilang. Setelah rollback, action
  membaca nomor hasil finalisasi pertama dan mengembalikannya.

Jadi pada dua request paralel dengan `draftToken` sama, hasilnya: **satu nomor,
satu record Pendaftaran, dan tepat satu response yang membawa token akses**
(hanya ada pada response yang benar-benar membuat record).

Kalau `draftToken` tidak dikirim (mis. localStorage sudah dibersihkan), tidak
ada draft yang bisa difinalisasi, jadi pembuatan record berdiri sendiri;
idempotensi pada kasus itu berasal dari nomor unik + cek duplikat
email+jenjang di atas, bukan dari draft.

### Respons

**Respons** hanya mengembalikan `nomorPendaftaran` dan `tokenAkses` asli.
Keduanya tidak pernah disimpan plaintext.

**Email konfirmasi** dikirim lewat `runAfterResponse` — ditunda sampai
response terkirim ke klien, supaya email yang lambat/gagal tidak menunda atau
menggagalkan pendaftaran, tapi juga tidak hilang begitu response terkirim.

---

## 6. Tahap 4 — Tidak ada verifikasi email

Halaman: `/pendaftaran/sukses?nomor=REG-...`

Email orang tua pada alur pendaftaran baru **hanya data kontak**. Tidak ada
kode yang dikirim, tidak ada form kode, dan tidak ada gerbang upload/approval
yang bergantung padanya. Dulu ada OTP 6 digit; action
(`src/actions/verifikasi-email.ts`), form
(`src/components/pendaftaran/verifikasi-email-form.tsx`), dan jalur manual
committee-nya sudah dihapus.

Yang menggantikannya bukan klaim otomatis, melainkan **pemeriksaan manusia**:

| Yang dulu (OTP)                    | Sekarang                                       |
| ---------------------------------- | ---------------------------------------------- |
| masukkan kode 6 digit ke email     | panitia menghubungi wali, lalu mencatatnya    |
| bukti: `emailOrangTuaDiverifikasiOtpAt` | jejak: `kontakWaliDikonfirmasiAt` + `_OlehId` + `metodeKonfirmasiKontak` + `catatanKonfirmasiKontak` |
| gerbang upload dipindah ke OTP      | gerbang = status + token akses (90 hari)       |
| gerbang approval = email terverifikasi | gerbang approval = kontak wali terkonfirmasi |

Email konfirmasi pendaftaran tetap dikirim, tapi sifatnya **notifikasi**:
memuat nomor pendaftaran, nominal, rekening, dan instruksi. Email itu bukan
bukti kepemilikan, dan kegagalan mengirimnya tidak membatalkan
pendaftaran (dikirim lewat `runAfterResponse`).

### Draft otomatis (hybrid)

Supaya orang tua tidak kehilangan isi formulir, isian disimpan otomatis di dua
lapisan:

| Lapisan       | Isi                              | Batas                                  |
| ------------- | -------------------------------- | -------------------------------------- |
| `localStorage` | teks form + `lastStep` + metadata file | sampai draft dihapus/berhasil submit |
| draft server   | `payload` teks + `lastStep` + `expiresAt` | **TTL 30 hari**                    |

- Metadata file hanya `nama` + `ukuran` sebagai penanda "berkas ini pernah
  dipilih" — **isi file tidak pernah** masuk draft (tidak bisa diserialisasi).
  Setelah restore, berkas diminta dipilih ulang.
- Debounce lokal 800 ms. Pembuatan draft server dijaga dengan guard in-flight
  (`draftCreateRef`) supaya debounce yang menyalakan beberapa permintaan
  sebelum token pertama tiba **tidak** membuat draft server kedua yang tokennya
  menjadi yatim.
- Draft server yang lebih baru **dipulihkan dari payload server**, bukan dari
  salinan lokal. Bandingkan `draftLebihBaru()` memakai `lastSavedAt` lokal
  vs `updatedAt` server.
- **Pilihan A — pindah perangkat:** token draft ditampilkan di halaman dan
  bisa disalin ke kolom "Lanjutkan draft dengan token". Tidak ada email yang
  terlibat, jadi ini satu-satunya jalan pulih lintas perangkat.
- Setelah submit sukses, draft lokal dihapus dan draft server di-finalisasi
  (di dalam transaksi yang sama dengan pembuatan pendaftaran). Draft yang sudah
  final tidak bisa di-resume lagi.

Pembersihan oleh cron `src/app/api/cron/bersihkan-token/route.ts`:

| Data                            | Retensi                        |
| -------------------------------- | ------------------------------ |
| draft belum final (TTL lewat)   | 30 hari                         |
| draft sudah final               | 90 hari (untuk audit), lalu dibuang |
| OTP email legacy                | ikut dibersihkan (lihat legacy) |
| folder temp upload              | 7 hari                          |

### Kolom legacy (sengaja dibiarkan ada)

Kolom `email_orang_tua_terverifikasi_at`, `email_orang_tua_diverifikasi_otp_at`,
dan tabel `otp_verifikasi_email` **tidak dihapus**. Alasannya: penghapusan
kolom produksi yang masih dipakai laporan/riwayat data lama butuh migrasi data,
dan risikonya lebih besar daripada manfaatnya. Yang dijamin:

- Tidak dibaca sebagai gerbang di mana pun (cari `emailOrangTuaTerverifikasiAt`
  di kode non-test: sisanya hanya komentar).
- Tidak ditulis untuk pendaftaran baru (kecuali `null` eksplisit di create).
- Tidak ada UI yang memintanya.
- Ditandai deprecated di `prisma/schema.prisma`.
- Baris cron tetap membersihkannya supaya tidak tumbuh tanpa batas.

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

1. Rate limit per IP (10 upload/10 menit) dan per nomor pendaftaran (20/10 menit).
2. Berkas lolos validasi server-side: ukuran maksimal 5 MB dan magic bytes
   cocok, bukan sekadar ekstensi/ukuran yang dikirim klien.
3. Ekstensi termasuk `JPG`, `JPEG`, `PNG`, `WEBP`, atau `PDF`.
4. Pendaftaran ada dan tidak dihapus.
5. Token akses cocok (timing-safe, pesan generik).
6. Token belum kedaluwarsa (90 hari).
7. Status adalah `MENUNGGU_PEMBAYARAN` **atau** `DITOLAK`.

Tidak ada lagi gerbang email di sini. Jejak yang dulu dipakai
(`emailOrangTuaTerverifikasiAt`) adalah warisan OTP dan **bukan** syarat
upload: keaslian pendaftaran dijaga token akses + rate limit berlapis, sedangkan
pemeriksaan keabsahan kontak wali dipindah ke panitia sebelum approval (§9).

Baris token dicek **sesudah** validasi berkas, bukan sebelum, supaya penyerang
tanpa token tetap mendapat pesan generik dan tidak bisa memetakan status
pendaftaran.

Berhasil → status berubah ke `MENUNGGU_VERIFIKASI` dan `alasanPenolakan`
dikosongkan. Bila penulisan DB gagal, file yang barusan diunggah **dihapus**
supaya tidak jadi berkas yatim.

---

## 9. Tahap 7 — Verifikasi oleh panitia

Dashboard: `/dashboard/verifikasi-pendaftaran`
Action: `verifikasiPendaftaran` di `src/actions/verifikasi.ts`

**DITERIMA** — **gerbang konfirmasi kontak wali dicek lebih dulu.** Bila
`kontakWaliDikonfirmasiAt` masih kosong, approval ditolak dengan pesan yang
menyebut jalan keluarnya, dan tidak ada akun yang dibuat. Alasannya: approval
menandai bukti transfer `DITERIMA`, menutup seluruh gerbang unggah publik, dan
menjadikan email + nomor HP formulir sebagai dasar pembuatan akun. Pemeriksaan
manusia terhadap kontak itu satu-satunya bukti sebelum itu terjadi.

Penolakan (**DITOLAK**) tidak melewati gerbang ini, karena menolak tidak
membuat akun apa pun dan harus selalu bisa dilakukan.

Kolom yang dibaca adalah kolom **gerbang** (`kontakWaliDikonfirmasiAt`).
`emailOrangTuaTerverifikasiAt` yang lama **tidak** dipakai sebagai gerbang
approval: isinya jejak OTP/grandfathering pendaftaran lama, dan memakainya
untuk approval baru akan mencampur makna audit.

Gerbang yang sama juga menutup jalur unggah: `upload-dokumen.ts` menolak status
`DITERIMA`, dan `KEMAMPUAN_BY_STATUS` (§10) menutup kedua upload publik.

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

### Konfirmasi kontak wali (pengganti OTP)

Action: `konfirmasiKontakWali` / `batalkanKonfirmasiKontakWali` di
`src/actions/konfirmasi-kontak-wali.ts`.

**Tempatnya:** panel amber di dalam dialog detail berkas pada
`/dashboard/verifikasi-pendaftaran`. Panel muncul selama status belum final,
dan berubah dari "Konfirmasi Kontak Wali Belum Dicatat" (yang memuat nomor
WhatsApp wali untuk dihubungi) menjadi "Kontak Wali Sudah Dikonfirmasi"
(lengkap dengan siapa, kapan, lewat apa, dan catatannya).

**Alurnya:**

1. Panitia membuka detail berkas yang tertahan.
2. Panel amber muncul: pendaftaran tidak bisa disetujui selama kontak wali
   belum dikonfirmasi.
3. Panitia menghubungi orang tua/wali — WhatsApp, telepon, atau datang
   langsung — lalu menekan "Konfirmasi Kontak Wali".
4. Dialog meminta **metode** (`WHATSAPP` / `TELEPON` / `LANGSUNG`) dan
   catatan opsional (mis. nomor yang dihubungi).
5. Server menyimpan `kontakWaliDikonfirmasiAt`, `kontakWaliDikonfirmasiOlehId`,
   `metodeKonfirmasiKontak`, dan `catatanKonfirmasiKontak`.
6. Tombol "Terima" kini aktif, dengan badge konfirmasi di daftar/file.

Yang perlu diketahui soal action ini:

- Hanya untuk role admin committee (`requireGuruAdmin`).
- Kolom email yang lama **tidak** diisi ulang, dan baris lama yang masih punya
  `emailOrangTuaTerverifikasiAt` **tidak** otomatis dianggap terkonfirmasi:
  approval tetap menuntut `kontakWaliDikonfirmasiAt`. Jadi pemeriksaan kontak
  tidak bisa dilewati diam-diam dari sisi klien.
- Pembatalan tersedia (`Batalkan Konfirmasi`) untuk kasus salah input, hanya
  selama status belum `DITERIMA`/`DITOLAK`, dan mengosongkan keempat kolom
  sekaligus supaya tidak ada keadaan setengah tertinggal.

### Jejak konfirmasi yang kekal

`catatanAdmin` **ditimpa** oleh `verifikasiPendaftaran` saat approval, jadi
"kapan dan siapa mengonfirmasi" tidak boleh bergantung pada kolom itu.
Empat kolom khusus itu yang jadi sumber kebenaran, dan approval tidak
menyentuhnya:

| Kolom                          | Isi                                                       |
| ------------------------------ | --------------------------------------------------------- |
| `kontak_wali_dikonfirmasi_at`   | kapan konfirmasi dilakukan                              |
| `kontak_wali_dikonfirmasi_oleh_id` | akun admin yang menghubungi                          |
| `metode_konfirmasi_kontak`      | `WHATSAPP` / `TELEPON` / `LANGSUNG`                       |
| `catatan_konfirmasi_kontak`     | konteks (mis. nomor yang dihubungi)                      |

Migration `20260929100000_konfirmasi_kontak_wali_dan_draft` menambah kolom-
kolom itu beserta index `idx_pendaftaran_kontak_wali_oleh` dan foreign key ke
`User` dengan `onDelete: Restrict` — admin yang dihapus tidak boleh membuat
jejak yatim. Tidak di-backfill: pendaftaran lama tidak otomatis terkonfirmasi,
dan mengisinya tanpa manusia yang benar-benar menghubungi orang tua akan
mendistorsi laporan.

Keterbatasan yang tersisa: kolom ini **tidak** mencatat percakapan apa yang
sungguh terjadi, hanya klaim admin. Kalau suatu saat ditambah audit log
generik untuk aksi admin, keempat kolom ini sebaiknya jadi titik
integrasinya — bukan `catatanAdmin`.

---

## 10. Tahap 8 — Cek status

Halaman: `/cek-pendaftaran`
API: `src/app/api/cek-pendaftaran/route.ts` (`GET`, publik)

Rate limit berlapis: 5 request/menit per IP, plus 10 request/menit untuk
**satu nomor yang sama** (anti-probing yang memetakan status satu
nomor). Keluarannya 429 dengan header `Retry-After`.

Data yang dikembalikan sudah dipangkas demi privasi:

| Dikembalikan                                        | Tidak dikembalikan                    |
| --------------------------------------------------- | -------------------------------------- |
| Nomor pendaftaran                                   | Nama lengkap (**dimaskir**: `Ahmad F***`) |
| Status                                              | Alamat, no HP, email                  |
| Jenjang & kelas                                     | Path dokumen & signed URL             |
| Alasan penolakan (punya pendaftar sendiri)          | Timestamp verifikasi/OTP              |
| `dokumen` (boolean per kategori + `jumlahLengkap`)   | Jejak konfirmasi kontak wali          |
| Tanggal dibuat                                      | Kredensial, token akses                |

Isi `dokumen` berasal dari `hitungStatusBerkas` di `src/lib/status-berkas.ts` —
helper yang sama dipakai halaman upload, panel admin, dan Dashboard Wali, jadi
angka "berapa berkas yang sudah lengkap" tidak bisa berbeda antar halaman.
Path file tidak pernah diekspos: endpoint ini publik, dan yang dibutuhkan
pendaftar hanya tahu *sudah atau belum*.

`emailTerverifikasi` yang dulu dikembalikan sudah **dihapus** dari endpoint ini,
karena tidak lagi jadi gerbang apa pun.

### Peta status (state machine)

```
  (baru) ──createPendaftaran──▶ MENUNGGU_PEMBAYARAN
                                   │   bukti bayar + berkas boleh
                                   ▼
                           MENUNGGU_VERIFIKASI
                                   │   berkas boleh, bukti bayar sudah
                                   │   WAJIB: kontak wali terkonfirmasi
                        ┌──────────┴──────────┐
                        ▼                     ▼
                   DITERIMA               DITOLAK ──┐
                  (final)                     │       │ bukti
                                                └───────┘ upload ulang
                                                         ▼
                                                MENUNGGU_VERIFIKASI
```

Hanya tiga action yang menulis status non-terminal: `bukti-transfer.ts`
(→ `MENUNGGU_VERIFIKASI`) dan `verifikasi.ts` (→ `DITERIMA` / `DITOLAK`).
`upload-dokumen.ts` hanya menulis path berkas.

**Konsekuensi yang penting:** `MENUNGGU_VERIFIKASI` hanya bisa dicapai lewat
`uploadBuktiTransfer`, dan `DITERIMA` hanya bisa dicapai lewat
`verifikasiPendaftaran`. Maka **tidak ada baris berstatus `DITERIMA` tanpa
kontak wali terkonfirmasi** — bukan karena diverifikasi ulang saat approval,
tapi karena memang tidak terjangkau secara struktural.

Dua hal yang mengikuti:

- Cek `kontakWaliDikonfirmasiAt` di `verifikasiPendaftaran` bersifat
  **defense-in-depth**, bukan sadari jalur yang bisa terpicu. Tetap
  dipertahankan karena biayanya nol dan melindungi kalau suatu saat ada action
  baru yang menulis `DITERIMA`.
- Tidak ada lagi state tempat orang tua buntu karena email. Jalur publik yang
  tersisa hanya butuh **nomor pendaftaran + token akses (90 hari)**, dan token
  itu bisa dipulihkan lewat **Token Lanjutkan Draft** (§6) atau diminta ulang
  ke panitia. Tidak ada lagi "harus masukkan kode ke email yang sudah hilang".

`alur-pendaftaran.e2e.test.ts` menjaga kesimpulan ini.

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

Tiga hal yang mudah disalahpahami di sini:

- **`MENUNGGU_VERIFIKASI` tidak mematikan semua aksi.** Menunggu verifikasi
  bukan berarti berkas sudah final. Hanya tombol bukti pembayaran yang hilang,
  karena pembayarannya memang sudah diterima.
- **`DITERIMA` tidak sekadar menyembunyikan** tombol upload, tapi memberi tahu
  ke mana harus pergi: kredensial sudah dikirim, dan kelengkapan berkas
  dilanjutkan dari **Dashboard Wali**. Ini bukan sekadar UI —
  `upload-dokumen.ts` juga menolak `DITERIMA` di server, jadi tidak ada jalan
  publik untuk memasukkan berkas setelah approval.
- **Panel konfirmasi kontak tetap muncul selama status belum final**, karena di
  `MENUNGGU_VERIFIKASI` itulah bukti sudah masuk dan satu-satunya langkah yang
  tersisa sebelum approval.

`kemampuan-status.test.ts` membandingkan tabel ini dengan gate server secara
eksplisit, supaya keduanya tidak bisa melenceng diam-diam. Kalau salah satu
diubah, test itu harus ikut diperbarui — itu memang yang dikehendaki.

---

## 11. Batas yang diketahui dan sengaja dibiarkan

### 11.1 Submit ganda tanpa draft

Jendela "satu anak dapat dua nomor pendaftaran" sudah tertutup untuk jalur yang
paling sering terjadi: submit ulang dengan `draftToken` yang sama tidak bisa
membuat baris kedua, karena pembuatan record dan finalisasi draft berada dalam
satu transaksi, dan `updateMany({ finalizedAt: null })` bekerja sebagai
compare-and-swap (§5).

Yang masih terbuka adalah submit **tanpa** `draftToken` — localStorage sudah
dibersihkan, atau formulir dibuka di perangkat lain tanpa me-restore draft.
Jalur itu tidak punya idempotency key, jadi yang memagarkannya tinggal:

- cek duplikat email orang tua + jenjang tujuan untuk pendaftaran aktif
  (`MENUNGGU_PEMBAYARAN` / `MENUNGGU_VERIFIKASI`) — masih `findFirst` lalu
  `create`, yaitu **check-then-act tanpa constraint di database**;
- cek NISN sudah dipakai siswa diterima atau pendaftaran aktif lain.

Kalau dua request benar-benar bersamaan lolos keduanya, committee tetap melihat
dua nama dengan email sama berdampingan di daftar dan bisa menolak atau
menghapus baris berlebih. Yang tidak berubah sejak dulu: `auth.users` sengaja
dipakai ulang antar anak, jadi approval kedua **tidak** akan gagal dengan error
email duplikat — keduanya benar-benar bisa lolos kalau committee tidak
menyadari.

**Penutupannya yang rapi tetap partial unique index di database**, tapi itu
tidak bisa ditulis di `prisma/schema.prisma`: Prisma 6.19 tidak mendukung
klausa `WHERE` pada `@@unique`. Index harus dibuat lewat SQL mentah, dan karena
tidak bisa direpresentasikan di schema, Prisma akan menandainya sebagai drift
dan **drop** saat `prisma migrate dev` berikutnya. Kalau suatu saat index itu
ditambahkan, `prisma migrate dev` wajib diberi tahu index tersebut ada supaya
tidak terhapus diam-diam.

### 11.2 Draft server tidak ikut hilang saat create gagal

Kalau pembuatan `Pendaftaran` gagal (misalnya constraint database), transaksi
meng-rollback **termasuk** penandaan `finalizedAt` pada draft. Draft itu karena
itu tetap hidup dan bisa dicoba lagi lewat **Token Lanjutkan Draft** — bukan
ikut hilang bersama record yang gagal dibuat. Draft yang tidak pernah
difinalisasi dibuang cron setelah 30 hari; yang sudah final setelah 90 hari
(§6).

### 11.3 Konfirmasi kontak wali adalah klaim admin, bukan rekaman

Empat kolom `kontakWali*` mencatat bahwa seorang admin menyatakan sudah
menghubungi wali, kapan, dan lewat mana — **tidak** menyimpan isi percakapan
atau bukti. Kalau audit menuntut bukti, sumbernya tetap catatan di luar sistem
(log WhatsApp/telepon panitia). Kolom lama `emailOrangTuaTerverifikasiAt` tidak
lagi berperan apa pun dan tidak ditulis untuk pendaftaran baru.

### 11.4 Tabel token legacy

`otp_verifikasi_email` tidak lagi dipakai alur pendaftaran baru, tapi cron
`bersihkan-token` tetap membersihkannya (baris kedaluwarsa) supaya tabel
warisan tidak tumbuh tanpa batas. `password_reset_tokens` dibersihkan pada
cron yang sama.

---

## 12. Peta file

| Peran                                    | File                                                              |
| ---------------------------------------- | ----------------------------------------------------------------- |
| Action pembuatan (+ transaksi atomik)    | `src/actions/pendaftaran.ts`                                      |
| Skema validasi                           | `src/lib/validations/pendaftaran.ts`                              |
| Formulir 5 langkah + draft client        | `src/components/pendaftaran/pendaftaran-form.tsx`                 |
| State draft sisi klien                   | `src/lib/pendaftaran-draft-client.ts`                             |
| Action draft (create/save/resume/...)    | `src/actions/pendaftaran-draft.ts`                                |
| Halaman sukses                           | `src/app/pendaftaran/sukses/page.tsx`                             |
| Hash & validasi token                    | `src/lib/pendaftaran-token.ts`                                    |
| Token sisi klien                         | `src/lib/pendaftaran-token-client.ts`                             |
| Unggah dokumen                           | `src/actions/upload-dokumen.ts`                                   |
| Unggah bukti transfer                    | `src/actions/bukti-transfer.ts`                                   |
| Halaman unggah (server gate)             | `src/app/pendaftaran/[nomor]/upload-{dokumen,bukti}/page.tsx`     |
| Form unggah                              | `src/components/pendaftaran/upload-{dokumen,bukti}-form.tsx`      |
| Verifikasi panitia                       | `src/actions/verifikasi.ts`                                       |
| Konfirmasi kontak wali (gerbang approval) | `src/actions/konfirmasi-kontak-wali.ts`                          |
| Dashboard panitia                        | `src/components/dashboard/verifikasi-pendaftaran-page-client.tsx` |
| Dashboard wali (lengkapi berkas)          | `src/components/dashboard/berkas-orang-tua-page-client.tsx`      |
| Status kelengkapan berkas (sumber tunggal) | `src/lib/status-berkas.ts`                                       |
| Data berkas wali                         | `src/lib/berkas-siswa-service.ts`                                 |
| Cek status (API)                         | `src/app/api/cek-pendaftaran/route.ts`                            |
| Kemampuan per status (cek status)        | `src/app/cek-pendaftaran/kemampuan-status.ts`                     |
| Cek status (halaman)                     | `src/app/cek-pendaftaran/page.tsx`                                |
| Cron pembersihan token & draft           | `src/app/api/cron/bersihkan-token/route.ts`                       |
| Biaya PPDB                               | `src/lib/biaya-ppdb-server.ts`                                    |
| Template email                           | `src/lib/email.ts`                                                |
| Rate limit                               | `src/lib/rate-limit.ts`                                           |
| Skema database                           | `prisma/schema.prisma`                                            |
| Migrasi kontak wali + draft              | `prisma/migrations/20260929100000_konfirmasi_kontak_wali_dan_draft/` |
