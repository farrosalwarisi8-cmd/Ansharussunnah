-- Jejak verifikasi email manual committee, terpisah dari `catatan_admin`.
--
-- Latar: `catatan_admin` ditimpa setiap approval/penolakan
-- (`catatanAdmin: catatanAdmin || null`). Kalau jejak manual ikut menumpang
-- di sana, begitu panitia menyetujui pendaftaran, bukti bahwa email ini
-- diverifikasi manual hilang permanen dan tidak bisa direkonstruksi dari
-- kolom mana pun.
--
-- Tiga kolom, bukan satu: kapan (audit), siapa (akuntabilitas), alasan
-- (konteks). Ketiganya wajib isi bersamaan, jadi tidak ada keadaan setengah
-- seperti "waktu terisi tapi alasan kosong".
--
-- NULL = tidak diverifikasi manual (bisa via OTP, bisa belum sama sekali).
-- Tidak di-backfill: grandfathering bukan verifikasi manual, dan mengisi
-- kolom ini untuk data lama justru akan mendistorsi laporan.

-- Tanpa default: nilai harus datang dari action, bukan terisi diam-diam.
ALTER TABLE "pendaftarans"
  ADD COLUMN "email_orang_tua_diverifikasi_manual_at" TIMESTAMPTZ(3),
  ADD COLUMN "email_orang_tua_diverifikasi_manual_oleh_id" TEXT,
  ADD COLUMN "alasan_verifikasi_email_manual" TEXT;

-- Foreign key ke User, sama seperti `diverifikasi_oleh_id`. Tanpa ini kolomnya
-- cuma teks bebas: admin yang sudah dihapus pun masih bisa tercatat, dan tidak
-- ada yang bisa JOIN untuk menampilkan namanya.
--
-- ON DELETE RESTRICT, bukan SET NULL. `SET NULL` akan bentrok dengan CHECK
-- constraint di bawah: menghapus admin akan membuat `oleh_id` NULL sementara
-- dua kolom lain masih terisi, jadi CHECK menolaknya dan pesan errornya
-- membingungkan ("violates check constraint") bukan "akun ini punya riwayat".
--
-- RESTRICT memberi perilaku yang benar: akun yang pernah melakukan verifikasi
-- manual tidak bisa dihapus permanen, karena kolom `oleh_id`-nya adalah bukti
-- siapa yang melakukannya. `hapusGuru` sudah menolak lebih dulu dengan
-- pesan ramah; RESTRICT ini jaring pengaman kalau ada jalur lain.
ALTER TABLE "pendaftarans"
  ADD CONSTRAINT "pendaftarans_email_orang_tua_diverifikasi_manual_oleh_id_fkey"
  FOREIGN KEY ("email_orang_tua_diverifikasi_manual_oleh_id")
  REFERENCES "users"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- Dukungan query: "mana yang diverifikasi manual, dan kapan".
CREATE INDEX "pendaftaran_email_manual_idx"
  ON "pendaftarans" ("email_orang_tua_diverifikasi_manual_at");

-- Penjaga integritas: ketiga kolomnya adalah satu kesatuan. Kalau yang
-- terisi tidak boleh sebagian, database harus menolak — bukan cuma konvensi
-- aplikasi yang bisa dilanggar oleh skrip manual atau CRUD internal.
ALTER TABLE "pendaftarans"
  ADD CONSTRAINT "pendaftaran_verifikasi_manual_lengkap"
  CHECK (
    num_nonnulls(
      "email_orang_tua_diverifikasi_manual_at",
      "email_orang_tua_diverifikasi_manual_oleh_id",
      "alasan_verifikasi_email_manual"
    ) IN (0, 3)
  );
