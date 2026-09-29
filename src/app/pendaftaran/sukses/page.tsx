// src/app/pendaftaran/sukses/page.tsx

import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2,
  ArrowRight,
  FileText,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyNomorButton } from "@/components/pendaftaran/copy-nomor-button";
import { TokenAksesBox } from "@/components/pendaftaran/token-akses-box";
// Form OTP verifikasi email DIHAPUS dari alur pendaftaran (BAGIAN A).
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import prisma from "@/lib/prisma";
import { getPengaturanPPDB } from "@/lib/biaya-ppdb-server";
import { notFound } from "next/navigation";
import { hitungStatusBerkas } from "@/lib/status-berkas";

interface SuksesPageProps {
  searchParams: Promise<{ nomor?: string }>;
}

export default async function SuksesPage({ searchParams }: SuksesPageProps) {
  const params = await searchParams;
  const nomor = params.nomor;

  if (!nomor) {
    notFound();
  }

  const pendaftaran = await prisma.pendaftaran.findUnique({
    where: { nomorPendaftaran: nomor, deleted_at: null },
  });

  if (!pendaftaran) {
    notFound();
  }

  const biayaPendaftaran = parseFloat(pendaftaran.biayaPendaftaran.toString());
  const biayaUangGedung = parseFloat(pendaftaran.biayaUangGedung.toString());
  const biayaSarpras = parseFloat(pendaftaran.biayaSarpras.toString());
  const totalBiaya = biayaPendaftaran + biayaUangGedung + biayaSarpras;

  // Snapshot rekening & kontak WA saat pendaftaran dibuat; fallback ke
  // pengaturan yang berlaku bila kolom snapshot kosong (pendaftaran lama).
  const pengaturan = await getPengaturanPPDB();
  const bankNama = pendaftaran.bankNama ?? pengaturan.bankNama;
  const bankNoRekening =
    pendaftaran.bankNoRekening ?? pengaturan.bankNoRekening;
  const bankAtasNama = pendaftaran.bankAtasNama ?? pengaturan.bankAtasNama;
  const kontakWa = pendaftaran.kontakWa ?? pengaturan.kontakWa;
  const waLink = `https://wa.me/${kontakWa.replace(/\D/g, "")}`;
  const namaKontakWa = pengaturan.namaKontakWa;

  // OTP DIHAPUS dari alur: tidak ada form kode verifikasi, tidak ada syarat
  // "email terverifikasi" untuk melihat instruksi pembayaran atau mengunggah.
  // Keamanan tetap dijaga token akses rahasia (hash di DB, berlaku 90 hari);
  // pemeriksaan keabsahan kontak wali dilakukan panitia sebelum approval.

  // Status berkas dari field mentah via helper terpusat — sumber data yang
  // sama dengan halaman cek-pendaftaran & panel admin.
  const statusBerkas = hitungStatusBerkas(pendaftaran);
  const sudahDiterima = pendaftaran.status === "DITERIMA";

  return (
    <div className="min-h-screen batik-light">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden relative">
            <Image
              src="/anshorussunnah-logo.webp"
              alt="Logo Anshorussunnah"
              fill
              sizes="36px"
              className="object-contain"
              priority
            />
          </div>
          <span className="font-bold text-gray-900">
            Pendaftaran Santri Baru
          </span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-2xl">
        {/* Success Banner */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-success/10 rounded-full mb-4">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Pendaftaran Berhasil!
          </h1>
          <p className="text-gray-500">
            Data pendaftaran Anda telah kami terima. Silakan selesaikan
            pembayaran untuk melanjutkan proses verifikasi.
          </p>
        </div>

        {/* Nomor Pendaftaran */}
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-gray-500 mb-1">Nomor Pendaftaran Anda</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-bold font-mono text-primary tracking-wider">
                {pendaftaran.nomorPendaftaran}
              </span>
              <CopyNomorButton nomor={pendaftaran.nomorPendaftaran} />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Simpan nomor ini untuk mengecek status pendaftaran Anda
            </p>
          </CardContent>
        </Card>

        {/* Status */}
        <div className="flex justify-center mb-6">
          <Badge variant="warning" className="text-sm px-4 py-1.5">
            {pendaftaran.status.replace(/_/g, " ")}
          </Badge>
        </div>

        {/* Token Akses */}
        <div className="mb-6">
          <TokenAksesBox nomor={pendaftaran.nomorPendaftaran} />
        </div>

        {/* Instruksi penting token akses: pemilik harus menyimpannya dari
            halaman ini — token TIDAK dikirim via email dan dibutuhkan untuk
            semua unggahan selama pendaftaran belum selesai. */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-900 font-semibold mb-1">
            Simpan Token Akses Anda
          </p>
          <p className="text-sm text-blue-800 m-0">
            Token akses di atas diperlukan bersama nomor pendaftaran untuk
            mengunggah bukti transfer dan dokumen. Nomor pendaftaran saja tidak
            cukup. Simpan sebelum menutup halaman ini.
          </p>
        </div>

        {/* Instruksi pembayaran & dokumen: tanpa syarat OTP — instruksi
            pembayaran selalu tampil; tombol upload ditolak sendiri oleh
            halaman upload/server action bila status tidak mengizinkan. */}
        <>
          {/* Instruksi Pembayaran */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Instruksi Pembayaran</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-600 font-medium">
                      Total yang Harus Ditransfer
                    </span>
                    <span className="text-2xl font-bold text-primary">
                      {formatCurrency(totalBiaya)}
                    </span>
                  </div>

                  {/* Rincian per komponen (snapshot saat pendaftaran dibuat) */}
                  <div className="border-t border-blue-200 pt-3 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Biaya Pendaftaran</span>
                      <span className="font-medium text-gray-700">
                        {formatCurrency(biayaPendaftaran)}
                      </span>
                    </div>
                    {biayaUangGedung > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Uang Gedung</span>
                        <span className="font-medium text-gray-700">
                          {formatCurrency(biayaUangGedung)}
                        </span>
                      </div>
                    )}
                    {biayaSarpras > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">
                          Sarana Prasarana (Sarpras)
                        </span>
                        <span className="font-medium text-gray-700">
                          {formatCurrency(biayaSarpras)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-blue-200 pt-3 mt-3 space-y-2">
                    <p className="text-sm text-gray-600">
                      Transfer ke rekening berikut:
                    </p>
                    <div className="bg-white rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-sm">Bank</span>
                        <span className="font-semibold">{bankNama}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-sm">
                          No. Rekening
                        </span>
                        <span className="font-mono font-semibold">
                          {bankNoRekening}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-sm">Atas Nama</span>
                        <span className="font-semibold">{bankAtasNama}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">
                      Konfirmasi pembayaran ke WhatsApp {namaKontakWa}:{" "}
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-green-600 hover:text-green-700"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        wa.me/{kontakWa.replace(/\D/g, "")}
                      </a>
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-800 font-medium mb-1">
                    ⚠️ Penting:
                  </p>
                  <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                    <li>
                      Transfer sesuai nominal:{" "}
                      <strong>{formatCurrency(totalBiaya)}</strong>
                    </li>
                    <li>
                      Gunakan nomor pendaftaran{" "}
                      <strong>{pendaftaran.nomorPendaftaran}</strong> sebagai
                      keterangan transfer
                    </li>
                    <li>
                      Setelah transfer, segera upload bukti pembayaran di bawah
                      ini
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Dokumen Pendukung — pesan sesuai status (BAGIAN D): sebelum
                diterima, lengkapi via halaman publik; setelah diterima, hanya
                via Dashboard Wali. Status dihitung dari DB via helper terpusat. */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Dokumen Pendukung
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="text-sm space-y-1">
                  <li className={statusBerkas.kartuKeluarga ? "text-emerald-700" : "text-amber-700"}>
                    {statusBerkas.kartuKeluarga ? "\u2714" : "\u25CF"} Kartu Keluarga (KK) — {statusBerkas.kartuKeluarga ? "sudah diunggah" : "belum diunggah"}
                  </li>
                  <li className={statusBerkas.akteLahir ? "text-emerald-700" : "text-amber-700"}>
                    {statusBerkas.akteLahir ? "\u2714" : "\u25CF"} Akta Kelahiran — {statusBerkas.akteLahir ? "sudah diunggah" : "belum diunggah"}
                  </li>
                  <li className={statusBerkas.foto ? "text-emerald-700" : "text-amber-700"}>
                    {statusBerkas.foto ? "\u2714" : "\u25CF"} Pas Foto 3x4 — {statusBerkas.foto ? "sudah diunggah" : "belum diunggah"}
                  </li>
                </ul>
                {sudahDiterima ? (
                  <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    Pendaftaran sudah diterima. Berkas yang masih kurang hanya
                    dapat dilengkapi melalui <strong>Dashboard Wali</strong>.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-gray-500">
                      Berkas dapat dilengkapi melalui halaman upload pendaftaran
                      selama status masih mengizinkan ({statusBerkas.jumlahLengkap} dari 3 berkas utama tersedia).
                    </p>
                    <Link
                      href={`/pendaftaran/${pendaftaran.nomorPendaftaran}/upload-dokumen`}
                    >
                      <Button variant="outline" size="lg" className="w-full">
                        <FileText className="mr-2 h-4 w-4" />
                        Unggah / Lengkapi Dokumen
                      </Button>
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>
        </>

        {/* Action Buttons — tanpa gerbang OTP: upload bukti selalu ditawarkan
            selama pendaftaran belum diproses panitia; halaman upload-bukti dan
            server action yang menolak bila status tidak mengizinkan. */}
        <div className="flex flex-col sm:flex-row gap-3">
          {!sudahDiterima && (
            <Link
              href={`/pendaftaran/${pendaftaran.nomorPendaftaran}/upload-bukti`}
              className="flex-1"
            >
              <Button size="xl" className="w-full">
                Upload Bukti Transfer
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          )}
          <Link href="/cek-pendaftaran" className="flex-1">
            <Button variant="outline" size="xl" className="w-full">
              Cek Status Nanti
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
