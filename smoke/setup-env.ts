// smoke/setup-env.ts — dipakai vitest.smoke.config.ts (setupFiles).
// Memuat env dengan precedence yang sama dengan scripts/cek-akun-uji.ts:
// .env.local dimuat lebih dulu sehingga menang atas .env.
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })
