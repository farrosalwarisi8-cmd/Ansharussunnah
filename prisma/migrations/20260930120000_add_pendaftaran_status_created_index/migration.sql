-- Index komposit untuk daftar pendaftaran: filter status + sort createdAt.
-- Dipakai query list di src/actions/verifikasi.ts (getPendaftaranList) yang
-- selalu memfilter deleted_at IS NULL + status (bila ada) lalu ORDER BY
-- created_at DESC/ASC. Tanpa index ini Postgres memakai idx_pendaftaran_status
-- lalu melakukan sort in-memory (atau sebaliknya) — mahal saat tabel tumbuh.
CREATE INDEX IF NOT EXISTS "idx_pendaftaran_status_created"
ON "pendaftarans" ("status", "created_at" DESC);

-- Index parsial untuk kartu "berkas belum lengkap" (getPendaftaranRincianStatus):
-- hanya baris yang sedang menunggu dan punya berkas kosong yang diindeks,
-- jadi count tetap cepat tanpa membesarkan index umum.
CREATE INDEX IF NOT EXISTS "idx_pendaftaran_menunggu_berkas_kurang"
ON "pendaftarans" ("status")
WHERE "deleted_at" IS NULL
  AND "status" IN ('MENUNGGU_PEMBAYARAN', 'MENUNGGU_VERIFIKASI')
  AND ("dok_kartu_keluarga" IS NULL OR "dok_kartu_keluarga" = ''
       OR "dok_akte_lahir" IS NULL OR "dok_akte_lahir" = ''
       OR "dok_foto" IS NULL OR "dok_foto" = '');
