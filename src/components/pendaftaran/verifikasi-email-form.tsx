// src/components/pendaftaran/verifikasi-email-form.tsx

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, MailCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTokenAkses, setTokenAkses } from "@/lib/pendaftaran-token-client";
import {
  requestOtpVerifikasiEmail,
  verifyOtpVerifikasiEmail,
} from "@/actions/verifikasi-email";

// Kotak OTP verifikasi kepemilikan email orang tua.
//
// Token akses selalu dibutuhkan untuk meminta kode, karena nomor pendaftaran
// itu publik: tanpa token, siapa pun yang tahu nomornya bisa memicu email ke
// alamat orang lain. Token dibaca dari sessionStorage dan otomatis terisi
// kalau orang tua mendaftar di perangkat ini. Kalau tidak ada (mendaftar di
// perangkat lain, atau sessionStorage sudah terhapus saat tab ditutup), token
// bisa diketik manual di bawah dan ikut tersimpan supaya tidak perlu diulang
// di halaman upload berikutnya.
//
// Catatan: "Kirim ulang kode" sengaja memakai aksi yang sama dengan "Kirim
// Kode Verifikasi" — server menolak resend sebelum cooldown 60 detik habis.
export function VerifikasiEmailForm({
  nomor,
  wajib,
}: {
  nomor: string;
  /**
   * true  = gerbang masih tertutup. Verifikasi WAJIB, dan selama belum selesai
   *         seluruh instruksi pembayaran & tombol upload tidak dirender.
   * false = gerbang sudah terbuka (grandfathering), tapi belum ada bukti OTP.
   *         Verifikasi OPSIONAL: hanya memperbarui bukti, tidak membuka
   *         apa pun yang belum terbuka.
   */
  wajib: boolean;
}) {
  const router = useRouter();
  const [token, setToken] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [terkirim, setTerkirim] = React.useState(false);
  const [sibuk, setSibuk] = React.useState(false);
  const [pesan, setPesan] = React.useState<{
    ok: boolean;
    teks: string;
  } | null>(null);

  React.useEffect(() => {
    setToken(getTokenAkses(nomor));
  }, [nomor]);

  // Token diketik manual ikut disimpan ke sessionStorage supaya tidak perlu
  // diketik ulang di halaman upload berikutnya.
  const handleTokenChange = (nilai: string) => {
    const bersih = nilai.trim();
    setToken(bersih);
    setTokenAkses(nomor, bersih);
    setTerkirim(false);
  };

  const kirimKode = async () => {
    setSibuk(true);
    setPesan(null);
    const hasil = await requestOtpVerifikasiEmail(nomor, token);
    setSibuk(false);
    setPesan({ ok: hasil.success, teks: hasil.message });
    if (hasil.success) setTerkirim(true);
  };

  const verifikasi = async (e: React.FormEvent) => {
    e.preventDefault();
    setSibuk(true);
    setPesan(null);
    const hasil = await verifyOtpVerifikasiEmail(nomor, token, otp);
    setSibuk(false);
    if (hasil.success) {
      setOtp("");
      // Server component perlu render ulang supaya status verifikasi terbaru
      // dipakai untuk membuka tautan upload.
      router.refresh();
    } else {
      setPesan({ ok: false, teks: hasil.message });
    }
  };

  return (
    <Card
      className={
        wajib
          ? "mb-6 border-amber-200 bg-amber-50/50"
          : "mb-6 border-slate-200 bg-white"
      }
    >
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {wajib ? (
            <ShieldAlert className="h-5 w-5 text-amber-600" />
          ) : (
            <BadgeCheck className="h-5 w-5 text-emerald-600" />
          )}
          {wajib ? "Verifikasi Email Orang Tua" : "Verifikasi Email Anda"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {wajib ? (
          <p className="text-sm text-gray-700">
            Pendaftaran baru harus dikonfirmasi bahwa email orang tua
            benar-benar bisa diakses. Kami mengirim kode 6 digit ke email
            tersebut; setelah kode dimasukkan, halaman upload dokumen dan bukti
            transfer akan terbuka.
          </p>
        ) : (
          <p className="text-sm text-gray-700">
            Pendaftaran Anda sudah aktif dan bisa diunggah seperti biasa. Email
            ini <strong>belum pernah diverifikasi</strong> — status itu warisan
            dari saat fitur ini dipasang, bukan bukti milik Anda sendiri.
            Verifikasi sekarang adalah pilihan, tapi membuat catatan Committee
            jauh lebih bisa dipercaya.
          </p>
        )}

        {/* Token akses wajib: tanpa itu siapa pun yang tahu nomor (publik)
            bisa memicu email ke alamat orang lain. Kalau sessionStorage sudah
            kosong — mis. pengguna mendaftar di tab lain/perangkat lain —
            token bisa diketik di sini, sama seperti di halaman upload. */}
        <div className="space-y-1.5">
          <label
            htmlFor="token-verifikasi-email"
            className="block text-sm font-medium text-gray-700"
          >
            Token Akses Pendaftaran
          </label>
          <input
            id="token-verifikasi-email"
            type="text"
            value={token}
            onChange={(e) => handleTokenChange(e.target.value)}
            placeholder="Otomatis terisi jika mendaftar di perangkat ini"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <p className="text-xs text-gray-500 m-0">
            Ada di halaman &quot;Pendaftaran Berhasil&quot;. Diperlukan agar
            kode verifikasi hanya bisa diminta oleh pemilik pendaftaran.
          </p>
        </div>

        {!token && (
          <p className="text-sm m-0 text-amber-800 bg-amber-100 border border-amber-200 rounded-lg px-3 py-2">
            Isi token akses dulu di atas untuk meminta kode. Nomor pendaftaran
            saja tidak cukup karena nomornya bisa dilihat orang lain.
          </p>
        )}

        {token && !terkirim && (
          <Button
            type="button"
            onClick={kirimKode}
            disabled={sibuk}
            className="w-full"
          >
            <MailCheck className="mr-2 h-4 w-4" />
            {sibuk ? "Mengirim..." : "Kirim Kode Verifikasi"}
          </Button>
        )}

        <form onSubmit={verifikasi} className="space-y-3">
          <div>
            <label
              htmlFor="otp-verifikasi-email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Kode 6 digit dari email
            </label>
            <input
              id="otp-verifikasi-email"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              disabled={!terkirim}
              placeholder={terkirim ? "000000" : "Kirim kode dulu di atas"}
              aria-describedby="otp-verifikasi-email-help"
              className="w-full text-center text-2xl font-mono tracking-[0.5em] rounded-lg border border-gray-300 px-3 py-3 disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p
              id="otp-verifikasi-email-help"
              className="text-xs text-gray-500 m-0 mt-1.5"
            >
              {terkirim
                ? "Masukkan kode dari email yang baru saja dikirim. Berlaku 10 menit."
                : "Kirim kode verifikasi dulu, lalu kodenya akan diketik di sini."}
            </p>
          </div>
          <Button
            type="submit"
            disabled={sibuk || !terkirim || otp.length !== 6}
            className="w-full"
          >
            {sibuk ? "Memverifikasi..." : "Verifikasi Email"}
          </Button>
          {terkirim && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={kirimKode}
              disabled={sibuk}
              className="w-full"
            >
              Kirim ulang kode
            </Button>
          )}
        </form>

        {pesan && (
          <p
            className={`text-sm m-0 ${pesan.ok ? "text-green-700" : "text-red-700"}`}
            role="status"
          >
            {pesan.teks}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
