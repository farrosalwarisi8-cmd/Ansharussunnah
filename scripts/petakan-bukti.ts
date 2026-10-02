/**
 * Petakan nomor pendaftaran (REG-...) dari file bukti transfer / dokumen pendaftaran
 * yang tersisa di storage ke akun auth.users yang selamat.
 *
 * Metode: korelasi waktu — cari akun auth yang dibuat dalam jendela waktu
 * di sekitar waktu upload file. Ini HANYA hipotesis/kandidat, bukan kepastian,
 * karena tabel pendaftarans sudah kosong.
 */
import * as fs from "fs";
import * as path from "path";

type StorageObject = {
  bucket_id: string;
  name: string;
  created_at: string;
  metadata: { size: number; mimetype: string; eTag: string };
  path_tokens: string[];
};

type AuthUser = {
  id: string;
  email: string | null;
  created_at: string;
  raw_user_meta_data?: { nama?: string; role?: string; [k: string]: unknown };
  email_confirmed_at?: string | null;
};

const WINDOW_HOURS = 12; // jendela korelasi (upload bisa terjadi setelah akun dibuat)

function loadJson(file: string): any[] {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), file), "utf8"));
}

function parseTs(ts: string): number {
  return new Date(ts).getTime();
}

function fmt(ts: string): string {
  return new Date(ts).toISOString().replace("T", " ").replace(".000Z", "Z").replace(".000", "");
}

function main() {
  const objects = loadJson("recovery/storage-objects.json") as StorageObject[];
  const users = loadJson("recovery/auth-users.json") as AuthUser[];

  // urutkan user berdasarkan created_at
  const sorted = [...users].sort(
    (a, b) => parseTs(a.created_at) - parseTs(b.created_at)
  );

  console.log("=== RINGKASAN AKUN AUTH MENURUT TANGGAL PEMBUATAN ===\n");
  const byDay = new Map<string, AuthUser[]>();
  for (const u of sorted) {
    const day = u.created_at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(u);
  }
  for (const [day, list] of [...byDay.entries()].sort()) {
    console.log(`\n--- ${day} (${list.length} akun) ---`);
    for (const u of list) {
      const meta = u.raw_user_meta_data ?? {};
      console.log(
        `  ${fmt(u.created_at)}  ${(u.email ?? "?").padEnd(38)} ${String(meta.nama ?? "-").padEnd(28)} ${meta.role ?? "-"}`
      );
    }
  }

  console.log("\n\n=== KORELASI: FILE STORAGE → KANDIDAT AKUN (±" + WINDOW_HOURS + " jam) ===\n");
  const windowMs = WINDOW_HOURS * 60 * 60 * 1000;

  // urutkan object berdasarkan created_at
  const sortedObjs = [...objects].sort((a, b) => parseTs(a.created_at) - parseTs(b.created_at));

  for (const obj of sortedObjs) {
    const t = parseTs(obj.created_at);
    const reg = obj.path_tokens[1] ?? "?";
    const bucket = obj.bucket_id;
    console.log(`\n### ${bucket} :: ${obj.name}`);
    console.log(`    REG: ${reg} | upload: ${fmt(obj.created_at)} | ${obj.metadata.size} B | ${obj.metadata.mimetype} | eTag ${obj.metadata.eTag.slice(0, 14)}`);

    // kandidat: akun yang dibuat dalam [t - window, t + 30menit]
    // (akun biasanya dibuat saat/calon siswa mendaftar; upload bukti bisa sedikit setelahnya)
    const candidates = sorted.filter((u) => {
      const ct = parseTs(u.created_at);
      return ct >= t - windowMs && ct <= t + 30 * 60 * 1000;
    });

    if (candidates.length === 0) {
      console.log("    (tidak ada akun auth dalam jendela)");
    } else {
      for (const c of candidates) {
        const meta = c.raw_user_meta_data ?? {};
        const deltaMin = Math.round((t - parseTs(c.created_at)) / 60000);
        console.log(
          `    → ${(c.email ?? "?").padEnd(38)} ${String(meta.nama ?? "-").padEnd(28)} ${meta.role ?? "-"} | dibuat ${fmt(c.created_at)} (${deltaMin >= 0 ? deltaMin + " menit sebelum upload" : -deltaMin + " menit SETELAH upload"})`
        );
      }
    }
  }
}

main();
