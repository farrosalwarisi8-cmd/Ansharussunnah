// src/app/pendaftaran/[nomor]/upload-dokumen/page.tsx

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { isTokenAksesBelumKedaluwarsa } from "@/lib/pendaftaran-token";
import { UploadDokumenForm } from "@/components/pendaftaran/upload-dokumen-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface UploadDokumenPageProps {
  params: Promise<{ nomor: string }>;
}

export default async function UploadDokumenPage({
  params,
}: UploadDokumenPageProps) {
  const { nomor } = await params;

  const pendaftaran = await prisma.pendaftaran.findUnique({
    where: { nomorPendaftaran: nomor, deleted_at: null },
    select: {
      nomorPendaftaran: true,
      status: true,
      tokenAksesExpiraAt: true,
      emailOrangTuaTerverifikasiAt: true,
      dokKartuKeluarga: true,
      dokAkteLahir: true,
      dokFoto: true,
    },
  });

  if (!pendaftaran) {
    notFound();
  }

  const statusBolehUpload =
    pendaftaran.status === "MENUNGGU_PEMBAYARAN" ||
    pendaftaran.status === "MENUNGGU_VERIFIKASI";
  const tokenMasihBerlaku = isTokenAksesBelumKedaluwarsa(
    pendaftaran.tokenAksesExpiraAt,
  );
  // OTP email dihapus dari alur: gerbang upload = status + masa berlaku token,
  // sama persis dengan server action uploadDokumenPendaftaran. Penegakan
  // sebenarnya tetap di server; cek di sini murni UX.
  const uploadTerbuka = statusBolehUpload && tokenMasihBerlaku;

  // Alur publik hanya terbuka selagi pendaftaran belum diterima dan token
  // (berlaku 90 hari) belum habis. Setelah itu, pemilik memakai dashboard
  // wali — sehingga di sini cukup tampilkan petunjuk, bukan form.
  const pesanTerkunci = statusBolehUpload
    ? "Masa berlaku akses pendaftaran sudah habis (90 hari). Silakan hubungi panitia PPDB untuk lebih lanjut."
    : "Pendaftaran sudah diproses panitia, jadi tidak lagi bisa diunggah lewat halaman ini. Jika ada berkas yang kurang, lengkapi dari dashboard wali setelah pendaftaran diterima.";

  return (
    <div className="min-h-screen batik-light">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden relative">
              <Image
                src="/ansharussunnah-logo.webp"
                alt="Logo Ansharussunnah"
                fill
                sizes="36px"
                className="object-contain"
                priority
              />
            </div>
            <span className="font-bold text-gray-900">
              Upload Dokumen Pendaftaran
            </span>
          </div>
          <Link
            href={`/pendaftaran/sukses?nomor=${pendaftaran.nomorPendaftaran}`}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-1">Nomor Pendaftaran</p>
          <p className="text-xl font-bold font-mono text-primary">
            {pendaftaran.nomorPendaftaran}
          </p>
        </div>

        {uploadTerbuka ? (
          <UploadDokumenForm
            nomorPendaftaran={pendaftaran.nomorPendaftaran}
            sudahAda={{
              kartuKeluarga: Boolean(pendaftaran.dokKartuKeluarga),
              akteLahir: Boolean(pendaftaran.dokAkteLahir),
              foto: Boolean(pendaftaran.dokFoto),
            }}
          />
        ) : (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 text-amber-600">
                <Lock className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                Unggah Dokumen Sudah Ditutup
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                {pesanTerkunci}
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link
                  href={`/pendaftaran/sukses?nomor=${pendaftaran.nomorPendaftaran}`}
                >
                  Kembali ke Halaman Pendaftaran
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
