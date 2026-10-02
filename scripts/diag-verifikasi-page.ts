// scripts/diag-verifikasi-page.ts
//
// Diagnostik: kenapa /dashboard/verifikasi-pendaftaran selalu gagal
// (error boundary "Terjadi Kesalahan").
//
// Client component merender `p.jenjangTujuan.nama` TANPA guard —
// bila ada baris pendaftaran aktif yang jenjangTujuanId-nya null
// atau menggantung (tidak ada di tabel Jenjang), Prisma mengembalikan
// relasi null → render throw TypeError → error boundary.
//
// Script ini memakai Prisma client (bukan $queryRawUnsafe) supaya
// tidak kena bug format SQL yang membuat diag sebelumnya salah.
import prisma from "../src/lib/prisma";

async function main() {
  console.log("=== DIAGNOSTIK HALAMAN VERIFIKASI PENDAFTARAN ===\n");

  // 1. Hitungan dasar
  const total = await prisma.pendaftaran.count();
  const aktif = await prisma.pendaftaran.count({
    where: { deleted_at: null },
  });
  console.log(`pendaftaran: total=${total}, aktif(deleted_at null)=${aktif}`);

  const jenjangCount = await prisma.jenjang.count();
  const kelasCount = await prisma.kelas.count();
  console.log(`jenjang=${jenjangCount}, kelas=${kelasCount}\n`);

  // 2. Ambil SEMUA pendaftaran aktif + relasinya persis seperti
  //    getPendaftaranList, lalu deteksi relasi null di sisi script.
  const items = await prisma.pendaftaran.findMany({
    where: { deleted_at: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    include: {
      jenjangTujuan: { include: { kelas: true } },
      kelasTujuan: true,
      buktiTransfer: { orderBy: { waktuUpload: "desc" } },
      diverifikasiOleh: true,
      kontakWaliDikonfirmasiOleh: true,
    },
  });

  console.log(`baris aktif diambil: ${items.length}`);

  const rusak = items.filter((p) => !p.jenjangTujuan);
  console.log(
    `baris dengan jenjangTujuan NULL/menggantung: ${rusak.length}`,
  );
  for (const p of rusak) {
    console.log(
      `  - id=${p.id} nomor=${p.nomorPendaftaran} nama=${p.namaLengkap} jenjangTujuanId=${String(p.jenjangTujuanId)} status=${p.status}`,
    );
  }

  const kelasRusak = items.filter(
    (p) => p.kelasTujuanId !== null && !p.kelasTujuan,
  );
  console.log(
    `baris dengan kelasTujuanId terisi tapi relasi null: ${kelasRusak.length}`,
  );
  for (const p of kelasRusak) {
    console.log(
      `  - id=${p.id} nomor=${p.nomorPendaftaran} kelasTujuanId=${String(p.kelasTujuanId)}`,
    );
  }

  const verRusak = items.filter(
    (p) => p.diverifikasiOlehId !== null && !p.diverifikasiOleh,
  );
  console.log(
    `baris diverifikasiOlehId menggantung: ${verRusak.length}`,
  );
  const konfRusak = items.filter(
    (p) =>
      p.kontakWaliDikonfirmasiOlehId !== null &&
      !p.kontakWaliDikonfirmasiOleh,
  );
  console.log(
    `baris kontakWaliDikonfirmasiOlehId menggantung: ${konfRusak.length}`,
  );

  // 3. Distribusi status (apa yang akan muncul di tab)
  const byStatus = items.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log("\ndistribusi status:", JSON.stringify(byStatus));

  // 4. Simulasi persis apa yang dilakukan UI: akses .nama tanpa guard
  let throwCount = 0;
  for (const p of items) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      p.jenjangTujuan.nama;
    } catch {
      throwCount++;
    }
  }
  console.log(
    `\nsimulasi render "p.jenjangTujuan.nama": ${throwCount} baris akan THROW`,
  );

  if (items.length === 0) {
    console.log(
      "\nDAFTAR KOSONG — render list tidak mungkin throw karena data.",
    );
    console.log(
      "Kalau error boundary tetap muncul, penyebabnya di luar data:",
    );
    console.log(
      " - modul client gagal dimuat, provider hilang, atau error saat",
    );
    console.log(
      "  server action dipanggil di luar try/catch. Cek console browser.",
    );
  } else if (throwCount > 0) {
    console.log(
      "\n*** PENYEBAB DITEMUKAN: ada baris pendaftaran aktif tanpa",
    );
    console.log(
      "    jenjangTujuan yang valid. UI mengakses p.jenjangTujuan.nama",
    );
    console.log(
      "    tanpa guard → TypeError saat render → error boundary.",
    );
  } else {
    console.log(
      "\nData tampil normal dari sisi relasi. Penyebab lain —",
    );
    console.log(
      "coba buka halaman dan baca error di console browser (F12).",
    );
  }
}

main()
  .catch((e) => {
    console.error("DIAG GAGAL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
