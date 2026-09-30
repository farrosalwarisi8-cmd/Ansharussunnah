// src/components/pendaftaran/upload-bukti-form.tsx

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { uploadBuktiTransferPendaftaran } from "@/actions/bukti-transfer";
import { getTokenAkses, setTokenAkses } from "@/lib/pendaftaran-token-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/ui/file-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, ArrowLeft } from "lucide-react";
import Link from "next/link";

// Form upload bukti transfer.
//
// Halaman induknya (page.tsx) sudah lebih dulu menolak menampilkan form ini
// bila pendaftaran tidak lolos gerbang verifikasi email / status / masa
// berlaku token. Penegakan yang menentukan tetap di server action
// uploadBuktiTransferPendaftaran — pemeriksaan di sini hanya supaya pengguna
// tidak sampai mengisi form yang pasti ditolak.
export function UploadBuktiForm({
  nomorPendaftaran,
}: {
  nomorPendaftaran: string;
}) {
  const router = useRouter();

  const [files, setFiles] = React.useState<File[]>([]);
  const [tokenAkses, setTokenAksesState] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    setTokenAksesState(getTokenAkses(nomorPendaftaran));
  }, [nomorPendaftaran]);

  // Token yang diketik manual ikut disimpan ke sessionStorage (lihat catatan
  // di upload-dokumen-form.tsx).
  const handleTokenChange = (nilai: string) => {
    const bersih = nilai.trim();
    setTokenAksesState(bersih);
    setTokenAkses(nomorPendaftaran, bersih);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Silakan pilih file bukti transfer terlebih dahulu");
      return;
    }

    if (!tokenAkses) {
      setError(
        "Token akses pendaftaran wajib diisi. Salin dari halaman 'Pendaftaran Berhasil'.",
      );
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // File dikirim langsung ke server action — server yang mengunggahnya ke
      // storage dengan service role (kontrol path & validasi keamanan penuh).
      const formData = new FormData();
      formData.append("nomorPendaftaran", nomorPendaftaran);
      formData.append("tokenAkses", tokenAkses);
      formData.append("file", files[0]);

      const result = await uploadBuktiTransferPendaftaran(formData);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/cek-pendaftaran");
        }, 3000);
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Terjadi kesalahan saat mengupload. Silakan coba lagi.");
    } finally {
      setIsUploading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen batik-light flex items-center justify-center">
        <Card className="max-w-md w-full mx-4 text-center">
          <CardContent className="p-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-success/10 rounded-full mb-4">
              <Upload className="h-8 w-8 text-success" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-slate-900">
              Bukti Transfer Berhasil Diupload!
            </h2>
            <p className="text-sm leading-relaxed text-slate-500">
              Pendaftaran Anda sedang dalam proses verifikasi. Anda akan
              diarahkan ke halaman cek status.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen batik-light">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-bold text-slate-900">Upload Bukti Transfer</span>
          <Link
            href={`/pendaftaran/sukses?nomor=${nomorPendaftaran}`}
            className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-slate-500 hover:text-yellow-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <div className="mb-6">
          <p className="mb-1 text-sm text-slate-500">Nomor Pendaftaran</p>
          <p className="text-xl font-bold font-mono text-yellow-700">
            {nomorPendaftaran}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload Bukti Transfer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700"
              >
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="token-akses">Token Akses Pendaftaran</Label>
              <Input
                id="token-akses"
                type="text"
                value={tokenAkses}
                onChange={(e) => handleTokenChange(e.target.value)}
                placeholder="Salin token akses dari halaman 'Pendaftaran Berhasil'"
                className="font-mono"
              />
              <p className="text-xs leading-relaxed text-slate-500">
                Token otomatis terisi jika Anda datang dari halaman hasil
                pendaftaran. Diperlukan agar bukti transfer hanya bisa diunggah
                pemilik pendaftaran.
              </p>
            </div>

            <FileUpload
              label="Bukti Transfer"
              description="Screenshot/foto bukti transfer"
              files={files}
              onFilesChange={setFiles}
              accept="image/*,.pdf"
              status={isUploading ? "uploading" : "idle"}
              disabled={isUploading}
              helperText="Pastikan nominal, tanggal, dan nama pengirim terbaca jelas sebelum mengirim."
            />

            <Button
              onClick={handleUpload}
              disabled={isUploading || files.length === 0}
              className="w-full"
              size="lg"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mengupload...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Bukti Transfer
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
