-- AlterTable: Add jenjangId column to mata_pelajarans
ALTER TABLE "mata_pelajarans" ADD COLUMN "jenjang_id" TEXT;

-- CreateTable: Create mapel_kelas join table
CREATE TABLE "mapel_kelas" (
    "id" TEXT NOT NULL,
    "mapel_id" TEXT NOT NULL,
    "kelas_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mapel_kelas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on mapel_id + kelas_id
CREATE UNIQUE INDEX "mapel_kelas_mapel_id_kelas_id_key" ON "mapel_kelas"("mapel_id", "kelas_id");

-- CreateIndex: Index on kelas_id for fast lookups
CREATE INDEX "mapel_kelas_kelas_id_idx" ON "mapel_kelas"("kelas_id");

-- CreateIndex: Index on mapel_id for fast lookups
CREATE INDEX "mapel_kelas_mapel_id_idx" ON "mapel_kelas"("mapel_id");

-- CreateIndex: Index on jenjang_id for fast filtering
CREATE INDEX "mata_pelajarans_jenjang_id_idx" ON "mata_pelajarans"("jenjang_id");

-- AddForeignKey: Link jenjang_id to jenjangs
ALTER TABLE "mata_pelajarans" ADD CONSTRAINT "mata_pelajarans_jenjang_id_fkey" FOREIGN KEY ("jenjang_id") REFERENCES "jenjangs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Link mapel_id to mata_pelajarans
ALTER TABLE "mapel_kelas" ADD CONSTRAINT "mapel_kelas_mapel_id_fkey" FOREIGN KEY ("mapel_id") REFERENCES "mata_pelajarans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Link kelas_id to kelas
ALTER TABLE "mapel_kelas" ADD CONSTRAINT "mapel_kelas_kelas_id_fkey" FOREIGN KEY ("kelas_id") REFERENCES "kelas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
