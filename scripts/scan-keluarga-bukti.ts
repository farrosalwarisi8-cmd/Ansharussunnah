import * as fs from "fs";

const users = JSON.parse(fs.readFileSync("recovery/auth-users.json", "utf8")) as any[];
const kw = ["faros", "warisi", "lombakuy", "salim", "asep", "pagos"];

console.log("=== akun dengan kata kunci di email atau meta ===");
for (const u of users) {
  const meta = JSON.stringify(u.raw_user_meta_data ?? {});
  const hay = ((u.email ?? "") + " " + meta).toLowerCase();
  if (kw.some((k) => hay.includes(k))) {
    console.log(`${u.email} | ${meta} | created ${u.created_at}`);
  }
}
