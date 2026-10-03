-- Insiden wipe database 2026-10-02: seluruh row `siswas` hilang, sementara
-- akun `users` (role SISWA) berhasil dipulihkan dari ekspor auth.
-- Row siswa hasil rekonstruksi TIDAK punya sumber data gender (kolom aslinya
-- NOT NULL, isinya ikut hilang saat wipe), sehingga NOT NULL dilonggarkan agar
-- "belum diketahui" bisa direpresentasikan sebagai NULL — bukan nilai karangan.
--
-- Sifat: hanya melonggarkan constraint (DROP NOT NULL). Tidak ada data yang
-- dihapus atau diubah nilainya. Idempoten (DROP NOT NULL boleh diulang).
ALTER TABLE "siswas" ALTER COLUMN "jenis_kelamin" DROP NOT NULL;
