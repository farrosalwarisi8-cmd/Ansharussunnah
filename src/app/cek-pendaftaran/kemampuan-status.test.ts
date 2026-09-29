// src/app/cek-pendaftaran/kemampuan-status.test.ts
import { describe, expect, it } from "vitest";

import { KEMAMPUAN_BY_STATUS } from "./kemampuan-status";

describe("KEMAMPUAN_BY_STATUS — cermin gate server", () => {
  // Gate ini disalin dari kode yang benar-benar dipakai server:
  //   src/actions/bukti-transfer.ts   -> bolehBukti
  //   src/actions/upload-dokumen.ts   -> bolehBerkas
  // Kalau salah satu berubah, test ini harus ikut gagal. Itu tujuannya: satu
  // sumber kebenaran, bukan dua tabel yang bisa melenceng diam-diam.
  const SERVER = {
    MENUNGGU_PEMBAYARAN: { bukti: true, berkas: true },
    MENUNGGU_VERIFIKASI: { bukti: false, berkas: true },
    DITOLAK: { bukti: true, berkas: false },
    DITERIMA: { bukti: false, berkas: false },
  } as const;

  it("mencakup semua status di server", () => {
    for (const status of Object.keys(SERVER)) {
      expect(KEMAMPUAN_BY_STATUS[status]).toBeDefined();
    }
  });

  it("kemampuannya identik dengan gate server", () => {
    for (const [status, expected] of Object.entries(SERVER)) {
      const k = KEMAMPUAN_BY_STATUS[status];
      expect(k.bolehBukti, `bolehBukti ${status}`).toBe(expected.bukti);
      expect(k.bolehBerkas, `bolehBerkas ${status}`).toBe(expected.berkas);
    }
  });

  it("DITERIMA tidak menawarkan apa pun — pemilik pindah ke dashboard wali", () => {
    const k = KEMAMPUAN_BY_STATUS.DITERIMA;
    expect(k.bolehBukti).toBe(false);
    expect(k.bolehBerkas).toBe(false);
  });

  it("MENUNGGU_VERIFIKASI tetap boleh melengkapi berkas", () => {
    // Ini yang sering disalahpahami: menunggu verifikasi bukan berarti semua
    // aksi mati. Pembayarannya sudah masuk, tapi berkas masih boleh dilengkapi.
    expect(KEMAMPUAN_BY_STATUS.MENUNGGU_VERIFIKASI.bolehBukti).toBe(false);
    expect(KEMAMPUAN_BY_STATUS.MENUNGGU_VERIFIKASI.bolehBerkas).toBe(true);
  });

  it("setiap status punya judul dan penjelasan yang terisi", () => {
    for (const [status, k] of Object.entries(KEMAMPUAN_BY_STATUS)) {
      expect(k.judul.length, `judul ${status}`).toBeGreaterThan(0);
      expect(k.penjelasan.length, `penjelasan ${status}`).toBeGreaterThan(10);
      expect(k.panelClass.length, `panelClass ${status}`).toBeGreaterThan(0);
    }
  });

  it("status tak dikenal tidak dijawab (UI menyembunyikan aksi, bukan crash)", () => {
    expect(KEMAMPUAN_BY_STATUS["MASA_DEPAN"]).toBeUndefined();
  });
});
