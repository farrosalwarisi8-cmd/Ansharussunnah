import * as dotenv from "dotenv";
import * as fs from "fs";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

// .env.local berisi placeholder (re_xxx) yang menimpa kunci asli di .env.
// Coba kunci dari .env.local dulu, bila invalid ganti dengan kunci asli dari .env.
const keyOf = (file: string): string | null => {
  try {
    const m = fs
      .readFileSync(file, "utf-8")
      .match(/^RESEND_API_KEY=(.*)$/m);
    return m ? m[1].replace(/^["']|["']$/g, "").trim() : null;
  } catch {
    return null;
  }
};

const CANDIDATES = [
  process.env.RESEND_API_KEY,
  keyOf(".env.local"),
  keyOf(".env"),
].filter((k): k is string => !!k);
const UNIQ = [...new Set(CANDIDATES)];
console.log(`mencoba ${UNIQ.length} kunci Resend`);

const BASE = "https://api.resend.com/v1";
let API_KEY = UNIQ[0];

async function api(path: string): Promise<any> {
  let res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  // Bila kunci invalid, coba kunci lain yang tersedia
  if (res.status === 400 || res.status === 401) {
    for (const k of UNIQ.slice(1)) {
      const res2 = await fetch(`${BASE}${path}`, {
        headers: { Authorization: `Bearer ${k}` },
      });
      if (res2.status !== 400 && res2.status !== 401) {
        res = res2;
        API_KEY = k;
        console.log("kunci valid ditemukan (bukan kunci pertama)");
        break;
      }
    }
  }
  const body = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(body);
  } catch {
    /* bukan JSON */
  }
  return { status: res.status, json, body: body.slice(0, 500) };
}

async function main() {
  // 1. List email terbaru
  const list = await api("/emails?limit=50");
  console.log("GET /emails →", list.status);
  if (list.status !== 200) {
    console.log("body:", list.body);
    return;
  }

  const emails = list.json?.data ?? [];
  console.log(`total email terkirim: ${emails.length}`);

  // 2. Filter yang menyebut pendaftaran / REG-
  const terkait = emails.filter((e: any) => {
    const hay = `${e.subject ?? ""} ${e.to_email ?? ""} ${e.html ?? ""} ${
      e.text ?? ""
    }`;
    return /REG-2026|pendaftaran|PPDB/i.test(hay);
  });
  console.log(`\nemail terkait pendaftaran: ${terkait.length}`);
  for (const e of terkait) {
    console.log(
      `  ${e.created_at} | ke: ${e.to_email} | subjek: ${e.subject}`
    );
  }

  // 3. Ambil isi lengkap untuk yang subjeknya menyebut REG- atau pendaftaran
  for (const e of terkait.slice(0, 20)) {
    const detail = await api(`/emails/${e.id}`);
    if (detail.status === 200) {
      const d = detail.json?.data ?? detail.json ?? {};
      const text: string = d.text ?? d.html ?? "";
      const match = (text.match(/REG-2026-\d{5}(?:-[A-Z0-9]{4})?/g) ?? []);
      console.log(
        `\n--- ${e.subject} → ${e.to_email} (${e.created_at})`
      );
      console.log(`    nomor ditemukan: ${[...new Set(match)].join(", ") || "-"}`);
    }
  }
}

main().catch((e) => {
  console.error("GAGAL:", e);
  process.exit(1);
});
