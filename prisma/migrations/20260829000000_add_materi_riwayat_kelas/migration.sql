-- CreateTable
CREATE TABLE "materi_pembelajarans" (
    "id" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "deskripsi" TEXT,
    "mata_pelajaran" TEXT NOT NULL,
    "url_file" TEXT,
    "url_link" TEXT,
    "kelas_id" TEXT NOT NULL,
    "periode_ajaran_id" TEXT NOT NULL,
    "diunggah_oleh_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materi_pembelajarans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riwayat_kelas_siswas" (
    "id" TEXT NOT NULL,
    "siswa_id" TEXT NOT NULL,
    "kelas_id" TEXT NOT NULL,
    "periode_ajaran_id" TEXT NOT NULL,
    "kelas_asal_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riwayat_kelas_siswas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "materi_pembelajarans_kelas_id_mata_pelajaran_idx" ON "materi_pembelajarans"("kelas_id", "mata_pelajaran");

-- CreateIndex
CREATE INDEX "materi_pembelajarans_periode_ajaran_id_idx" ON "materi_pembelajarans"("periode_ajaran_id");

-- CreateIndex
CREATE UNIQUE INDEX "riwayat_kelas_siswas_siswa_id_periode_ajaran_id_key" ON "riwayat_kelas_siswas"("siswa_id", "periode_ajaran_id");

-- CreateIndex
CREATE INDEX "riwayat_kelas_siswas_kelas_id_idx" ON "riwayat_kelas_siswas"("kelas_id");

-- CreateIndex
CREATE INDEX "riwayat_kelas_siswas_periode_ajaran_id_idx" ON "riwayat_kelas_siswas"("periode_ajaran_id");

-- AddForeignKey
ALTER TABLE "materi_pembelajarans" ADD CONSTRAINT "materi_pembelajarans_kelas_id_fkey" FOREIGN KEY ("kelas_id") REFERENCES "kelas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materi_pembelajarans" ADD CONSTRAINT "materi_pembelajarans_periode_ajaran_id_fkey" FOREIGN KEY ("periode_ajaran_id") REFERENCES "periode_ajarans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materi_pembelajarans" ADD CONSTRAINT "materi_pembelajarans_diunggah_oleh_id_fkey" FOREIGN KEY ("diunggah_oleh_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_kelas_siswas" ADD CONSTRAINT "riwayat_kelas_siswas_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "siswas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_kelas_siswas" ADD CONSTRAINT "riwayat_kelas_siswas_kelas_id_fkey" FOREIGN KEY ("kelas_id") REFERENCES "kelas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_kelas_siswas" ADD CONSTRAINT "riwayat_kelas_siswas_kelas_asal_id_fkey" FOREIGN KEY ("kelas_asal_id") REFERENCES "kelas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_kelas_siswas" ADD CONSTRAINT "riwayat_kelas_siswas_periode_ajaran_id_fkey" FOREIGN KEY ("periode_ajaran_id") REFERENCES "periode_ajarans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
