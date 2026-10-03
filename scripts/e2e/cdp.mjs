// scripts/e2e/cdp.mjs
//
// Driver Chrome DevTools Protocol (CDP) tanpa dependensi apa pun —
// Node >= 22 menyediakan global WebSocket & fetch. Dipakai untuk uji
// end-to-end alur dashboard di browser sungguhan (Chrome headless).
//
// Pemakaian:
//   import { launch, connect, navigate, evalJs, click, typeInto, shot } from "./cdp.mjs"
//
// Catatan: hanya untuk pengujian lokal/otomasi — bukan bagian dari aplikasi.

import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const CHROME =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe"

const DEBUG_PORT = Number(process.env.CDP_PORT || 9333)

/** Jalankan Chrome headless dengan port debugging. */
export async function launch() {
  const userDataDir = path.join(os.tmpdir(), `cdp-profile-${Date.now()}`)
  const child = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  )

  // Tunggu endpoint debugging siap.
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)
      if (res.ok) return child
    } catch {
      /* belum siap */
    }
    await sleep(250)
  }
  child.kill()
  throw new Error("Chrome debugging endpoint tidak siap")
}

/** Buat tab baru + koneksi WebSocket-nya. */
export async function connect() {
  const res = await fetch(
    `http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent("about:blank")}`,
    { method: "PUT" },
  )
  if (!res.ok) throw new Error(`Gagal membuat tab: ${res.status}`)
  const target = await res.json()
  return openSocket(target.webSocketDebuggerUrl)
}

export async function connectToExisting(url) {
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)
  const targets = await res.json()
  const page = targets.find((t) => t.type === "page")
  if (!page) throw new Error("Tidak ada tab halaman")
  const ws = openSocket(page.webSocketDebuggerUrl)
  return ws
}

function openSocket(wsUrl) {
  const ws = new WebSocket(wsUrl)
  const pending = new Map()
  const listeners = []
  let id = 0

  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(`${msg.error.message}`))
      else resolve(msg.result)
    } else if (msg.method) {
      listeners.forEach((fn) => fn(msg))
    }
  })

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true })
    ws.addEventListener("error", reject, { once: true })
  })

  const api = {
    ready,
    send(method, params = {}) {
      const msgId = ++id
      return new Promise((resolve, reject) => {
        pending.set(msgId, { resolve, reject })
        ws.send(JSON.stringify({ id: msgId, method, params }))
      })
    },
    on(fn) {
      listeners.push(fn)
    },
    close() {
      try {
        ws.close()
      } catch {
        /* noop */
      }
    },
  }
  return api
}

/** Aktifkan domain yang dibutuhkan. */
export async function init(ws) {
  await ws.ready
  await ws.send("Page.enable")
  await ws.send("Runtime.enable")
  await ws.send("Network.enable")
  await ws.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })
}

export async function navigate(ws, url, timeoutMs = 60000) {
  const loaded = new Promise((resolve) => {
    const onMsg = (msg) => {
      if (msg.method === "Page.loadEventFired") resolve()
    }
    ws.on(onMsg)
  })
  await ws.send("Page.navigate", { url })
  await Promise.race([loaded, sleep(timeoutMs)])
  await sleep(400) // beri waktu hydrate
}

/** Evaluasi JS di halaman; hasil dikembalikan sebagai value JSON. */
export async function evalJs(ws, expression) {
  const res = await ws.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (res.exceptionDetails) {
    throw new Error(
      `Eval error: ${res.exceptionDetails.exception?.description || "unknown"}`,
    )
  }
  return res.result?.value
}

/** Klik elemen berdasarkan selector (scroll + klik koordinat asli). */
export async function click(ws, selector, { index = 0 } = {}) {
  const box = await evalJs(
    ws,
    `(function(){
      const els = document.querySelectorAll(${JSON.stringify(selector)});
      const el = els[${index}];
      if (!el) return null;
      el.scrollIntoView({block: "center"});
      const r = el.getBoundingClientRect();
      return {x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height, tag: el.tagName, text: (el.innerText||"").slice(0,80)};
    })()`,
  )
  if (!box || box.w === 0) {
    throw new Error(`Elemen tidak ditemukan/klik: ${selector}`)
  }
  await ws.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: box.x,
    y: box.y,
    button: "left",
    clickCount: 1,
  })
  await ws.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: box.x,
    y: box.y,
    button: "left",
    clickCount: 1,
  })
  await sleep(350)
  return box
}

/** Klik teks persis pada elemen VISIBLE yang cocok (button/[role=option]/dst). */
export async function clickText(ws, text, selector = "button, [role='option'], a, [role='menuitem']") {
  const idx = await evalJs(
    ws,
    `(function(){
      const els = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const i = els.findIndex(e =>
        (e.innerText||"").trim() === ${JSON.stringify(text)} &&
        e.getBoundingClientRect().width > 0
      );
      return i;
    })()`,
  )
  if (idx < 0) throw new Error(`Teks tidak ditemukan: "${text}"`)
  return click(ws, selector, { index: idx })
}

/** Isi input teks React-controlled tanpa synthetic-event bermasalah. */
export async function typeInto(ws, selector, text) {
  await click(ws, selector)
  const ok = await evalJs(
    ws,
    `(function(){
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, ${JSON.stringify(text)});
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`,
  )
  if (!ok) throw new Error(`Input tidak ditemukan: ${selector}`)
  await sleep(250)
}

/** Simpan screenshot PNG. */
export async function shot(ws, file) {
  const { data } = await ws.send("Page.captureScreenshot", { format: "png" })
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, Buffer.from(data, "base64"))
  return file
}

export async function text(ws) {
  return evalJs(ws, "document.body.innerText")
}

export { sleep }
