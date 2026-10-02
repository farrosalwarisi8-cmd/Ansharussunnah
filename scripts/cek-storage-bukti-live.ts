import * as fs from "fs";
import { createSupabaseAdmin } from "../src/lib/supabase/admin";

function loadEnvFile(file: string) {
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // file tidak ada — abaikan
  }
}
loadEnvFile(".env");
loadEnvFile(".env.local");

const supabaseAdmin = createSupabaseAdmin();

async function listFolder(bucket: string, prefix: string) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });
  if (error) {
    console.log(`  [ERROR listing ${bucket}/${prefix}: ${error.message}]`);
    return [];
  }
  return data;
}

async function main() {
  console.log("=== bukti-transfer (path lengkap) ===");
  const roots = await listFolder("bukti-transfer", "transfer");
  for (const folder of roots) {
    const items = await listFolder("bukti-transfer", `transfer/${folder.name}`);
    for (const o of items) {
      const md = (o.metadata ?? {}) as { size?: number; mimetype?: string; eTag?: string };
      console.log(
        `  ${o.created_at} | transfer/${folder.name}/${o.name} | ${md.size ?? "?"} B | ${md.mimetype ?? "?"} | eTag ${(md.eTag ?? "").slice(0, 26)}`
      );
    }
  }

  console.log("\n=== dokumen-pendaftaran (path lengkap) ===");
  const dRoots = await listFolder("dokumen-pendaftaran", "dokumen-pendaftaran");
  for (const folder of dRoots) {
    const items = await listFolder(
      "dokumen-pendaftaran",
      `dokumen-pendaftaran/${folder.name}`
    );
    for (const o of items) {
      const md = (o.metadata ?? {}) as { size?: number; mimetype?: string; eTag?: string };
      console.log(
        `  ${o.created_at} | dokumen-pendaftaran/${folder.name}/${o.name} | ${md.size ?? "?"} B | ${md.mimetype ?? "?"} | eTag ${(md.eTag ?? "").slice(0, 26)}`
      );
    }
  }

  console.log("\n=== berkas-siswa ===");
  const berkas = await listFolder("berkas-siswa", "");
  for (const o of berkas) console.log(`  ${o.name}`);

  // bandingkan dengan ekspor forensik
  const ekspor = JSON.parse(
    fs.readFileSync("recovery/storage-objects.json", "utf8")
  ) as any[];
  console.log("\n=== EKSPOR FORENSIK (recovery/storage-objects.json) ===");
  const sorted = [...ekspor].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const o of sorted) {
    console.log(
      `  ${o.created_at} | ${o.bucket_id} :: ${o.name} | ${o.metadata.size} B | ${o.metadata.mimetype} | eTag ${(o.metadata.eTag ?? "").slice(0, 26)}`
    );
  }
}

main();
