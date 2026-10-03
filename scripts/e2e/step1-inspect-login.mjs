// step1: buka halaman login di Chrome headless, dump field & screenshot.
import { launch, connect, init, navigate, evalJs, shot, sleep } from "./cdp.mjs"

const BASE = process.env.E2E_BASE || "http://localhost:3100"

const chrome = await launch()
try {
  const ws = await connect()
  await init(ws)

  await navigate(ws, `${BASE}/login`)
  await sleep(1500)

  const info = await evalJs(
    ws,
    `JSON.stringify({
      url: location.href,
      title: document.title,
      inputs: [...document.querySelectorAll("input")].map(i => ({ id: i.id, name: i.name, type: i.type, placeholder: i.placeholder, autocomplete: i.autocomplete })),
      buttons: [...document.querySelectorAll("button")].map(b => (b.innerText || "").trim()).filter(Boolean),
      h1: [...document.querySelectorAll("h1,h2")].map(h => h.innerText.trim()).slice(0,5),
      bodySnippet: document.body.innerText.slice(0, 500),
    }, null, 1)`,
  )
  console.log(info)

  const file = await shot(ws, ".tmp-e2e/01-login.png")
  console.log("screenshot:", file)

  ws.close()
} finally {
  chrome.kill()
}
