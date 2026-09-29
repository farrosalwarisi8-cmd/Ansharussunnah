/**
 * Apa yang masih boleh dilakukan pada tiap status pendaftaran.
 *
 * Ini cermin dari gate di `src/actions/bukti-transfer.ts` (`bolehBukti`) dan
 * `src/actions/upload-dokumen.ts` (`bolehBerkas`). Dua gerbang itu sengaja
 * TIDAK simetris, dan itu bukan ketidaktelitian:
 *
 *   MENUNGGU_PEMBAYARAN  bukti ya, berkas ya  — baru daftar, belum bayar
 *   MENUNGGU_VERIFIKASI  bukti no, berkas ya  — bayarannya sudah diterima
 *   DITOLAK              bukti ya, berkas no  — bisa bayar ulang untuk banding
 *   DITERIMA             keduanya no           — pindah ke dashboard wali
 *
 * Yang paling sering disalahpbaiki adalah MENUNGGU_VERIFIKASI: menunggu
 * verifikasi tidak mematikan semua aksi. Pembayarannya sudah masuk, jadi
 * tombol bukti pembayaran hilang — tapi berkas yang kurang masih boleh
 * dilengkapi. Menyingkirkan semua tombol di status ini akan membuat orang
 * tua mengira daftar file-nya sudah final.
 *
 * Kalau tabel ini diubah, gate di kedua action itu WAJIB diubah juga, kalau
 * tidak halaman cek pendaftaran akan menawarkan tombol yang pasti ditolak
 * server. Test di `kemampuan-status.test.ts` menjaga kedua sisinya tetap sama.
 */

export type KemampuanStatus = {
  bolehBukti: boolean;
  bolehBerkas: boolean;
  judul: string;
  penjelasan: string;
  panelClass: string;
};

export const KEMAMPUAN_BY_STATUS: Record<string, KemampuanStatus> = {
  MENUNGGU_PEMBAYARAN: {
    bolehBukti: true,
    bolehBerkas: true,
    judul: "Menunggu Pembayaran",
    penjelasan:
      "Lakukan pembayaran di rekening yang tertera, lalu unggah bukti transfer di bawah.",
    panelClass: "bg-amber-50 border-amber-200 text-amber-900",
  },
  MENUNGGU_VERIFIKASI: {
    bolehBukti: false,
    bolehBerkas: true,
    judul: "Menunggu Verifikasi Panitia",
    penjelasan:
      "Bukti transfer Anda sudah diterima dan sedang diperiksa panitia, jadi tidak perlu mengunggah pembayaran lagi. Berkas yang kurang masih bisa dilengkapi.",
    panelClass: "bg-sky-50 border-sky-200 text-sky-900",
  },
  DITOLAK: {
    bolehBukti: true,
    bolehBerkas: false,
    judul: "Pendaftaran Ditolak",
    penjelasan:
      "Perbaiki sesuai catatan panitia, lalu unggah ulang bukti transfer untuk pengajuan ulang. Berkas pendukung tidak diunggah ulang lewat halaman ini.",
    panelClass: "bg-rose-50 border-rose-200 text-rose-900",
  },
  DITERIMA: {
    bolehBukti: false,
    bolehBerkas: false,
    judul: "Pendaftaran Diterima",
    penjelasan:
      "Selamat, pendaftaran sudah disetujui. Akun orang tua dan anak sudah dibuat, dan kredensialnya dikirim ke email orang tua. Kelengkapan berkas dilanjutkan dari dashboard wali.",
    panelClass: "bg-emerald-50 border-emerald-200 text-emerald-900",
  },
};
