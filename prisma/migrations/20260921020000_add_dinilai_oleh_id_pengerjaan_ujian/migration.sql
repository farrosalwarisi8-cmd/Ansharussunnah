-- AlterTable: Tambahkan kolom dinilai_oleh_id pada pengerjaan_ujians
-- Mencatat guru yang memberi nilai akhir (utama untuk input nilai manual ujian
-- offline) sebagai dasar proteksi re-grade: nilai yang sudah diinput guru lain
-- tidak bisa ditimpa diam-diam tanpa peran wali kelas/admin.
ALTER TABLE "pengerjaan_ujians" ADD COLUMN IF NOT EXISTS "dinilai_oleh_id" TEXT;

-- AddForeignKey
ALTER TABLE "pengerjaan_ujians" ADD CONSTRAINT "pengerjaan_ujians_dinilai_oleh_id_fkey" FOREIGN KEY ("dinilai_oleh_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pengerjaan_ujians_dinilai_oleh_id_idx" ON "pengerjaan_ujians"("dinilai_oleh_id");