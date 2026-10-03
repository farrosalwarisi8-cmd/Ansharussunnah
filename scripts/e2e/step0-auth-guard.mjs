// step0-auth-guard.mjs — uji tanpa login: akses /dashboard/siswa tanpa sesi
// harus dialihkan ke /login oleh middleware (bukan halaman dashboard kosong).
import { launch, connect, init, navigate, evalJs, shot, sleep } from "./cdp.mjs"

const BASE = process.env.E2E_BASE || "http://localhost:3100"

const chrome = await launch()
try {
  const ws = await connect()
  await init(ws)

  await navigate(ws, `${BASE}/dashboard/siswa`)
  await sleep(2500)

  const url = await evalJs(ws, "location.pathname + location.search")
  const adaFormLogin = await evalJs(ws, `!!document.querySelector("#email")`)
  const body = await evalJs(ws, "document.body.innerText.slice(0, 200)")

  console.log("URL akhir        :", url)
  console.log("form login ada   :", adaFormLogin)
  console.log("isi halaman      :", JSON.stringify(body))
  await shot(ws, ".tmp-e2e/00-auth-guard.png")

  const lolos = url.startsWith("/login") && adaFormLogin
  console.log(lolos ? "\nLULUS: halaman terproteksi, dialihkan ke /login" : "\nGAGAL: halaman terproteksi bisa diakses tanpa sesi")
  process.exitCode = lolos ? 0 : 1

  ws.close()
} finally {
  chrome.kill()
}
