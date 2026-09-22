-- Optimasi kecepatan pengambilan data rapor (src/actions/rapor.ts):
-- query memfilter siswa_id + status sekaligus. Indeks komposit mencegah
-- Postgres men-scan satu per satu lewat dua indeks terpisah.
CREATE INDEX IF NOT EXISTS "idx_pengerjaan_siswa_status" ON "pengerjaan_ujians"("siswa_id","status");

CREATE INDEX IF NOT EXISTS "idx_pengumpulan_siswa_status" ON "pengumpulan_tugas"("siswa_id","status");

CREATE INDEX IF NOT EXISTS "idx_absensi_siswa_periode" ON "absensis"("siswa_id","periode_ajaran_id");