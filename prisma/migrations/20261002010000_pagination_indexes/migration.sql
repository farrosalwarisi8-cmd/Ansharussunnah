-- Index pendukung pagination daftar besar (filter + sort utama).
-- Semua IF NOT EXISTS agar aman dijalankan pada database kosong maupun existing.

-- Daftar siswa: filter deleted_at IS NULL, urut user.created_at (relasi).
-- Index pada deleted_at membantu penyaringan dasar.
CREATE INDEX IF NOT EXISTS "idx_siswas_deleted"
  ON "siswas" ("deleted_at");

-- Tagihan per siswa: daftar tagihan satu siswa diurutkan tahun desc, bulan desc.
CREATE INDEX IF NOT EXISTS "idx_tagihan_siswa_tahun_bulan"
  ON "tagihan_siswas" ("siswa_id", "tahun" DESC, "bulan" DESC);

-- Pembayaran pending admin: filter status PENDING, urut created_at asc.
CREATE INDEX IF NOT EXISTS "idx_pembayaran_status_created"
  ON "pembayaran_siswas" ("status_pembayaran", "created_at");

-- Riwayat absensi per siswa diurutkan tanggal desc.
CREATE INDEX IF NOT EXISTS "idx_absensi_siswa_tanggal_desc"
  ON "absensis" ("siswa_id", "tanggal" DESC);

-- Transaksi keuangan: filter deleted_at IS NULL, urut tanggal desc.
CREATE INDEX IF NOT EXISTS "idx_transaksi_deleted_tanggal"
  ON "transaksi_keuangans" ("deleted_at", "tanggal" DESC);
